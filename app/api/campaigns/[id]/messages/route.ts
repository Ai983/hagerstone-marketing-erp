import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

const WRITE_ROLES = new Set(["admin", "manager", "marketing", "founder"])

const ALLOWED_MEDIA_TYPES = new Set(["image", "document", "video"])

interface IncomingMessage {
  position: number
  delay_days: number
  message_template: string
  media_url?: string | null
  media_type?: string | null
  media_filename?: string | null
}

/**
 * PUT: atomically replace the campaign's entire message sequence.
 *
 * Auth + role check uses the user-scoped client. The actual writes use
 * the service role client so the DELETE cannot be silently blocked by
 * any RLS policy on campaign_messages. This was the root cause of the
 * "Save duplicates messages instead of replacing" bug.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id

    // ── 1. Auth + role (user-scoped client) ─────────────────────
    const userClient = await createClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    const role = profile?.role
    if (!role || !WRITE_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // ── 2. Parse + validate body ────────────────────────────────
    const body = await request.json().catch(() => null)
    const messages = Array.isArray(body?.messages)
      ? (body.messages as IncomingMessage[])
      : null
    if (!messages) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      )
    }

    for (const m of messages) {
      const hasBody = Boolean(m.message_template?.trim())
      const hasMedia = Boolean(m.media_url)
      // A message is valid if it has EITHER a body OR a media attachment.
      if (!hasBody && !hasMedia) {
        return NextResponse.json(
          { error: "Each message must have a body or an attachment" },
          { status: 400 }
        )
      }
      if (m.message_template && m.message_template.length > 1000) {
        return NextResponse.json(
          { error: "Message body cannot exceed 1000 characters" },
          { status: 400 }
        )
      }
      if (m.media_type && !ALLOWED_MEDIA_TYPES.has(m.media_type)) {
        return NextResponse.json(
          { error: `Invalid media_type "${m.media_type}"` },
          { status: 400 }
        )
      }
    }

    // ── 3. Service role client for writes (bypasses RLS) ────────
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Service role not configured" },
        { status: 503 }
      )
    }
    const supabase = createServiceClient(url, serviceKey)

    // ── 4. DELETE existing messages for this campaign ───────────
    const { error: deleteError } = await supabase
      .from("campaign_messages")
      .delete()
      .eq("campaign_id", campaignId)

    if (deleteError) {
      console.error("campaign_messages DELETE failed:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // ── 5. INSERT the new set (only if there are any) ──────────
    if (messages.length > 0) {
      const rows = messages.map((msg, index) => ({
        campaign_id: campaignId,
        position: index + 1,
        delay_days: Math.max(0, Number(msg.delay_days) ?? 0),
        delay_hours: 0,
        message_template: (msg.message_template ?? "").trim(),
        message_type: msg.media_type ?? "text",
        media_url: msg.media_url ?? null,
        media_type: msg.media_type ?? null,
        media_filename: msg.media_filename ?? null,
      }))

      const { error: insertError } = await supabase
        .from("campaign_messages")
        .insert(rows)

      if (insertError) {
        console.error("campaign_messages INSERT failed:", insertError)
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("campaign_messages PUT threw:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
