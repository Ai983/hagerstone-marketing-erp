import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { RUNO_SOURCE } from "@/lib/utils/runo-ingest"

// Runo → ERP webhook (Runo admin → Integrations → Webhooks).
//
// Runo doesn't publish its webhook payload, so for now this route:
//  1. stores every payload in runo_sync_log (that's how we learn the shape), and
//  2. if it can find a call id and a recording link in it, attaches the
//     recording to the call the daily sync already imported (or will).
// Calls themselves still come from the daily pull (api/cron/runo-sync),
// which is the documented, reliable path.
//
// Auth: Runo may not support custom headers, so the secret is accepted
// either as `x-runo-secret` or as `?secret=` on the URL.

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "marketing" } }
  )
}

const AUDIO_URL = /^https:\/\/\S+\.(mp3|aac|m4a|wav|ogg|amr|3gp)(\?\S*)?$/i

/** Every string in a JSON value, paired with the key it sits under. */
function stringFields(value: unknown, key = "", out: [string, string][] = []): [string, string][] {
  if (typeof value === "string") out.push([key, value])
  else if (Array.isArray(value)) value.forEach((v) => stringFields(v, key, out))
  else if (value && typeof value === "object")
    Object.entries(value).forEach(([k, v]) => stringFields(v, k, out))
  return out
}

function findCallIdAndRecording(payload: unknown) {
  let callId: string | null = null
  let recordingUrl: string | null = null
  for (const [key, value] of stringFields(payload)) {
    const k = key.toLowerCase()
    if (!callId && (k === "callid" || k === "call_id")) callId = value
    if (!recordingUrl && (k.includes("record") || AUDIO_URL.test(value)) && value.startsWith("https://")) {
      recordingUrl = value
    }
  }
  return { callId, recordingUrl }
}

export async function POST(request: NextRequest) {
  const expected = process.env.RUNO_WEBHOOK_SECRET
  const given =
    request.headers.get("x-runo-secret") ?? request.nextUrl.searchParams.get("secret")
  if (!expected || given !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { callId, recordingUrl } = findCallIdAndRecording(payload)

  let attached = false
  let error: string | null = null
  if (callId && recordingUrl) {
    const { data, error: updateError } = await supabase
      .from("interactions")
      .update({ media_url: recordingUrl, media_type: "audio" })
      .eq("external_source", RUNO_SOURCE)
      .eq("external_id", callId)
      .select("id")
    if (updateError) error = updateError.message
    attached = Boolean(data?.length)
  }

  await supabase.from("runo_sync_log").insert({
    direction: "inbound",
    event_type: "webhook",
    status: error ? "error" : "ok",
    summary: { callId, recordingUrl, attached },
    error,
    raw_payload: payload,
  })

  // Always 200 once the secret is valid — an error here would only make
  // Runo retry the same payload.
  return NextResponse.json({ received: true, attached })
}
