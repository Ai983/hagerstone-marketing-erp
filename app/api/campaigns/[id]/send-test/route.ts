import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import {
  isWhapiConfigured,
  sendWhatsAppMedia,
  sendWhatsAppMessage,
} from "@/lib/utils/whapi"

const WRITE_ROLES = new Set(["admin", "manager", "marketing", "founder"])

/**
 * Normalise an Indian phone number to 12 digits starting with "91".
 * The shared whapi helper does its own normalisation, but we keep this
 * here so the result can be displayed back to the user in the response
 * row alongside the lead.
 */
function normalisePhone(raw: string): string {
  let digits = String(raw).replace(/\D/g, "")
  // Strip any remaining leading plus (already gone from \D above, but
  // kept for clarity in case raw is pre-normalised).
  digits = digits.replace(/^\+/, "")

  if (digits.startsWith("91") && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`
  return digits
}

interface SendResult {
  lead_id?: string
  lead: string
  phone?: string
  status: "sent" | "failed" | "skipped" | "error"
  reason?: string
  message_preview?: string
}

/**
 * Manual test send. Fires the FIRST message of this campaign to every
 * active enrollment via Whapi. Intentionally not the same as the
 * future automated drip — this is a "blast now" button for verification.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Role gate — same set that's allowed to edit campaigns
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    const role = profile?.role
    if (!role || !WRITE_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!isWhapiConfigured()) {
      return NextResponse.json(
        {
          error:
            "Whapi credentials not configured. Set WHAPI_TOKEN and WHAPI_API_URL.",
        },
        { status: 503 }
      )
    }

    const campaignId = params.id

    // 1. First message of the campaign (position = 1)
    const { data: firstMessage, error: msgError } = await supabase
      .from("campaign_messages")
      .select("id, message_template, media_url, media_type, media_filename")
      .eq("campaign_id", campaignId)
      .eq("position", 1)
      .maybeSingle()

    if (msgError) {
      console.error("send-test: failed to fetch first message", msgError)
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }
    if (!firstMessage) {
      return NextResponse.json(
        { error: "No messages in campaign" },
        { status: 400 }
      )
    }

    // 2. Active enrollments + joined lead info
    const { data: enrollments, error: enrollError } = await supabase
      .from("campaign_enrollments")
      .select(
        "id, status, current_message_position, lead:lead_id(id, full_name, company_name, phone, whatsapp_opted_in)"
      )
      .eq("campaign_id", campaignId)
      .eq("status", "active")

    if (enrollError) {
      console.error("send-test: failed to fetch enrollments", enrollError)
      return NextResponse.json({ error: enrollError.message }, { status: 500 })
    }
    if (!enrollments?.length) {
      return NextResponse.json(
        { error: "No active enrollments" },
        { status: 400 }
      )
    }

    const results: SendResult[] = []

    for (const enrollment of enrollments) {
      const lead = Array.isArray(enrollment.lead)
        ? enrollment.lead[0]
        : enrollment.lead

      if (!lead) {
        results.push({
          lead: "Unknown",
          status: "skipped",
          reason: "Enrollment has no lead",
        })
        continue
      }

      if (!lead.phone) {
        results.push({
          lead_id: lead.id,
          lead: lead.full_name,
          status: "skipped",
          reason: "No phone number",
        })
        continue
      }

      // Personalise template — raw string replacement only, no URL encoding.
      const personalised = firstMessage.message_template
        .replace(/\[Name\]/g, lead.full_name)
        .replace(/\[Company\]/g, lead.company_name || "your company")

      const phone = normalisePhone(lead.phone)

      // Pick text vs media path based on whether the campaign message
      // has an attachment. Whapi has dedicated endpoints per media type.
      const mediaUrl =
        typeof firstMessage.media_url === "string" &&
        firstMessage.media_url.trim()
          ? firstMessage.media_url.trim()
          : null
      const mediaType = firstMessage.media_type as
        | "image"
        | "document"
        | "video"
        | null

      try {
        const result = mediaUrl
          ? await sendWhatsAppMedia(
              lead.phone,
              mediaType === "image"
                ? "image"
                : mediaType === "video"
                  ? "video"
                  : "document",
              mediaUrl,
              {
                caption: personalised,
                filename: firstMessage.media_filename ?? undefined,
              }
            )
          : await sendWhatsAppMessage(lead.phone, personalised)

        if (result.success) {
          await supabase.from("interactions").insert({
            lead_id: lead.id,
            user_id: user.id,
            type: "campaign_message_sent",
            title: "Campaign message sent (test)",
            notes: personalised.slice(0, 500),
            campaign_id: campaignId,
            is_automated: true,
          })

          await supabase
            .from("campaign_enrollments")
            .update({ current_message_position: 1 })
            .eq("id", enrollment.id)

          results.push({
            lead_id: lead.id,
            lead: lead.full_name,
            phone,
            status: "sent",
            message_preview:
              personalised.length > 80
                ? `${personalised.slice(0, 80)}…`
                : personalised,
          })
        } else {
          console.error(
            `send-test: Whapi rejected ${lead.full_name}`,
            result.error
          )
          results.push({
            lead_id: lead.id,
            lead: lead.full_name,
            phone,
            status: "failed",
            reason: result.error ?? "Whapi rejected the message",
          })
        }
      } catch (err) {
        console.error(`send-test: send threw for ${lead.full_name}`, err)
        results.push({
          lead_id: lead.id,
          lead: lead.full_name,
          phone,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        })
      }

      // Rate-limit to avoid spam detection on the WhatsApp number
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    const sent = results.filter((r) => r.status === "sent").length
    const failed = results.length - sent

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: results.length,
      results,
    })
  } catch (err) {
    console.error("send-test route threw:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
