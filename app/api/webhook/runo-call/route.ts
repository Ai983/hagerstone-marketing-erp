import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ingestRunoWebhookCall } from "@/lib/utils/runo-ingest"
import type { RunoCallLog } from "@/lib/utils/runo"

// Runo → ERP "Call Event" webhook (Runo admin → Integrations → Webhooks).
//
// Runo doesn't publish this payload. Its admin app lists the fields it can
// send: createdAt, customerId, name, phoneNumber, leadPhone, startTime,
// duration, recordingUrl, type, callId, callerId, calledBy, userPhone, tag,
// processId, triggerType — the call-log fields plus the recording.
//
// So each hit:
//  1. is stored raw in runo_sync_log (to confirm the real shape), and
//  2. puts the call on the lead's timeline right away, recording included
//     (or adds the recording to a call the daily pull already imported).
// The daily pull (api/cron/runo-sync) stays the safety net.
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

type Json = Record<string, unknown>

/** The object carrying `callId` — top level, or nested (e.g. under `data`). */
function findCallObject(value: unknown, depth = 0): Json | null {
  if (!value || typeof value !== "object" || depth > 4) return null
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = findCallObject(v, depth + 1)
      if (hit) return hit
    }
    return null
  }
  const obj = value as Json
  if (typeof obj.callId === "string" || typeof obj.callId === "number") return obj
  for (const v of Object.values(obj)) {
    const hit = findCallObject(v, depth + 1)
    if (hit) return hit
  }
  return null
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null)

/** Epoch seconds from seconds, milliseconds, a numeric string or an ISO date. */
function toEpochSeconds(v: unknown): number {
  if (typeof v === "number") return v > 1e12 ? Math.round(v / 1000) : v
  if (typeof v === "string") {
    const n = Number(v)
    if (Number.isFinite(n) && v.trim() !== "") return n > 1e12 ? Math.round(n / 1000) : n
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return Math.round(t / 1000)
  }
  return 0
}

function toRunoCall(o: Json): RunoCallLog & { userPhone: string | null; recordingUrl: string | null } {
  const type = str(o.type)?.toLowerCase()
  const tag = str(o.tag)?.toLowerCase()
  return {
    callId: str(o.callId)!,
    callerId: str(o.callerId) ?? "",
    calledBy: str(o.calledBy) ?? "",
    name: str(o.name),
    customerId: str(o.customerId),
    phoneNumber: str(o.phoneNumber) ?? str(o.leadPhone) ?? "",
    startTime: toEpochSeconds(o.startTime ?? o.createdAt),
    duration: Number(o.duration) || 0,
    type: type === "incoming" || type === "outgoing" || type === "missed" ? type : null,
    status: str(o.status) ?? str(o.disposition),
    tag: tag === "personal" || tag === "unanswered" ? tag : null,
    createdAt: toEpochSeconds(o.createdAt),
    userPhone: str(o.userPhone),
    recordingUrl: str(o.recordingUrl),
  }
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
  const callObj = findCallObject(payload)
  const call = callObj ? toRunoCall(callObj) : null

  let result: string = "no_call_id"
  let error: string | null = null
  if (call) {
    const outcome = await ingestRunoWebhookCall(supabase, call)
    result = outcome.result
    error = outcome.error ?? null
  }

  await supabase.from("runo_sync_log").insert({
    direction: "inbound",
    event_type: "webhook",
    status: error ? "error" : "ok",
    // callId + recordingUrl here also let a later daily pull pick up the
    // recording if this call couldn't be placed yet.
    summary: { callId: call?.callId ?? null, recordingUrl: call?.recordingUrl ?? null, result },
    error,
    raw_payload: payload,
  })

  // Always 200 once the secret is valid — an error here would only make
  // Runo retry the same payload.
  return NextResponse.json({ received: true, result })
}
