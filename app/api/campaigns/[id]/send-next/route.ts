import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import {
  sendWhatsAppMedia,
  sendWhatsAppMessage,
  sendWhatsAppWithButtons,
} from "@/lib/utils/maytapi"

const WRITE_ROLES = new Set(["admin", "manager", "marketing", "founder"])
type WhatsAppButton = { id: string; title: string }
type MaytapiMediaType = "image" | "document" | "media"

function personalize(
  template: string,
  lead: { full_name?: string | null; company_name?: string | null }
) {
  return template
    .replace(/\[Name\]/g, lead.full_name ?? "")
    .replace(/\[Company\]/g, lead.company_name ?? "your company")
}

function getButtons(raw: unknown): WhatsAppButton[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (button) =>
        typeof button?.id === "string" &&
        button.id.trim() &&
        typeof button?.title === "string" &&
        button.title.trim()
    )
    .slice(0, 3)
    .map((button) => ({
      id: button.id.trim(),
      title: button.title.trim(),
    }))
}

function getMediaType(raw: unknown): MaytapiMediaType {
  if (raw === "image") return "image"
  return "document"
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    if (!process.env.MAYTAPI_API_TOKEN) {
      return NextResponse.json(
        {
          error:
            "Maytapi credentials not configured. Set MAYTAPI_API_TOKEN.",
        },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => null)
    const enrollmentId =
      typeof body?.enrollment_id === "string" ? body.enrollment_id : null

    if (!enrollmentId) {
      return NextResponse.json(
        { error: "enrollment_id is required" },
        { status: 400 }
      )
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Service role not configured" },
        { status: 503 }
      )
    }

    const supabase = createServiceClient(url, serviceKey)
    const campaignId = params.id

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("campaign_enrollments")
      .select(
        `
        *,
        lead:leads(
          id, full_name, company_name, phone, whatsapp_opted_in, assigned_to
        ),
        campaign:campaigns(id, name, status)
      `
      )
      .eq("id", enrollmentId)
      .eq("campaign_id", campaignId)
      .maybeSingle()

    if (enrollmentError) {
      return NextResponse.json(
        { error: enrollmentError.message },
        { status: 500 }
      )
    }

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      )
    }

    const lead = Array.isArray(enrollment.lead)
      ? enrollment.lead[0]
      : enrollment.lead
    const campaign = Array.isArray(enrollment.campaign)
      ? enrollment.campaign[0]
      : enrollment.campaign

    if (campaign?.status !== "active") {
      return NextResponse.json(
        { error: "Campaign is not active" },
        { status: 400 }
      )
    }

    if (enrollment.status !== "active") {
      return NextResponse.json(
        { error: "Enrollment is not active" },
        { status: 400 }
      )
    }

    if (!lead?.phone) {
      return NextResponse.json(
        { error: "Lead has no phone number" },
        { status: 400 }
      )
    }

    if (!lead.whatsapp_opted_in) {
      return NextResponse.json(
        { error: "Lead has not opted in to WhatsApp" },
        { status: 400 }
      )
    }

    const nextPosition = (enrollment.current_message_position ?? 0) + 1

    const { data: message, error: messageError } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("position", nextPosition)
      .maybeSingle()

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 })
    }

    if (!message) {
      const now = new Date().toISOString()
      await supabase
        .from("campaign_enrollments")
        .update({
          status: "completed",
          completed_at: now,
          next_message_due_at: null,
        })
        .eq("id", enrollment.id)

      return NextResponse.json({
        completed: true,
        message: "No next message found. Enrollment marked completed.",
      })
    }

    const processedMessage = personalize(
      message.message_template ?? message.message ?? "",
      lead
    )
    const mediaUrl =
      typeof message.media_url === "string" && message.media_url.trim()
        ? message.media_url.trim()
        : null
    const buttons = getButtons(message.buttons)

    const mediaType = getMediaType(message.media_type)
    const sendResult = mediaUrl
      ? await sendWhatsAppMedia(lead.phone, mediaType, mediaUrl, {
          caption: processedMessage,
          filename: message.media_filename ?? undefined,
        })
      : buttons.length > 0
        ? await sendWhatsAppWithButtons(lead.phone, processedMessage, buttons)
        : await sendWhatsAppMessage(lead.phone, processedMessage)

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error ?? "Failed to send message" },
        { status: 502 }
      )
    }

    const { data: nextMessage } = await supabase
      .from("campaign_messages")
      .select("delay_days, position")
      .eq("campaign_id", campaignId)
      .eq("position", nextPosition + 1)
      .maybeSingle()

    const now = new Date().toISOString()
    const nextDueAt = nextMessage
      ? new Date(
          Date.now() + (nextMessage.delay_days ?? 0) * 24 * 60 * 60 * 1000
        ).toISOString()
      : null

    await supabase
      .from("campaign_enrollments")
      .update({
        current_message_position: nextPosition,
        last_message_sent_at: now,
        next_message_due_at: nextDueAt,
        status: nextDueAt ? "active" : "completed",
        completed_at: nextDueAt ? null : now,
      })
      .eq("id", enrollment.id)

    await supabase.from("interactions").insert({
      lead_id: lead.id,
      user_id: user.id,
      type: "whatsapp_sent",
      title: `Campaign message ${nextPosition} sent now`,
      notes: processedMessage,
      campaign_id: campaignId,
      is_automated: true,
    })

    await supabase
      .from("campaigns")
      .update({ last_sent_at: now })
      .eq("id", campaignId)

    return NextResponse.json({
      success: true,
      position: nextPosition,
      next_message_due_at: nextDueAt,
      completed: !nextDueAt,
    })
  } catch (err) {
    console.error("send-next route threw:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
