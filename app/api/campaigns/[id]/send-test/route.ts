import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const WRITE_ROLES = new Set(["admin", "manager", "marketing"])

/**
 * Normalise an Indian phone number for Maytapi:
 *   - strip spaces / dashes / parens / plus
 *   - if 10 digits → prepend "91"
 *   - if already 12 digits starting "91" → leave alone
 */
function normalisePhone(raw: string): string {
  let digits = raw.replace(/[\s\-()+]/g, "")
  digits = digits.replace(/\D/g, "")
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith("91")) return digits
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
 * active enrollment via Maytapi. Intentionally not the same as the
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

    // Maytapi config check
    const productId = process.env.MAYTAPI_PRODUCT_ID
    const phoneId = process.env.MAYTAPI_PHONE_ID
    const apiToken = process.env.MAYTAPI_API_TOKEN
    if (!productId || !phoneId || !apiToken) {
      return NextResponse.json(
        {
          error:
            "Maytapi credentials not configured. Set MAYTAPI_PRODUCT_ID, MAYTAPI_PHONE_ID, MAYTAPI_API_TOKEN.",
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

      // Build the Maytapi payload.
      //
      // Correct Maytapi contract (verified against a working Apps Script):
      //   image    → { type: "image", message: <URL>, text: <caption>, filename, skip_filter: false }
      //   document → { type: "media", message: <URL>, text: <caption>, filename, skip_filter: false }
      //   video    → treated as media
      //   text     → { type: "text",  message: <body> }
      //
      // Maytapi does NOT have a `media_url` field. The URL always goes in
      // `message` and the caption always goes in `text`. Passing an
      // unrecognised `media_url` caused Maytapi to fall back to treating
      // the caption text as a URL: "Error: Invalid URI Hiiiii%20*Shubh*…".
      const mediaUrl =
        typeof firstMessage.media_url === "string" && firstMessage.media_url.trim()
          ? firstMessage.media_url.trim()
          : null

      let maytapiPayload: Record<string, unknown>

      if (mediaUrl) {
        const isImage = firstMessage.media_type === "image"
        const defaultFilename = isImage ? "image.jpg" : "document.pdf"
        maytapiPayload = {
          to_number: phone,
          type: isImage ? "image" : "media",
          message: mediaUrl,
          text: personalised,
          filename: firstMessage.media_filename || defaultFilename,
          skip_filter: false,
        }
      } else {
        maytapiPayload = {
          to_number: phone,
          type: "text",
          message: personalised,
        }
      }

      console.log("Maytapi payload →", {
        to: phone,
        type: maytapiPayload.type,
        has_media: Boolean(mediaUrl),
        media_url_preview: mediaUrl ? `${mediaUrl.slice(0, 60)}…` : null,
        caption_preview: `${personalised.slice(0, 60)}…`,
      })

      try {
        const maytapiRes = await fetch(
          `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-maytapi-key": apiToken,
            },
            body: JSON.stringify(maytapiPayload),
          }
        )

        const maytapiData = await maytapiRes.json().catch(() => ({}))

        if (maytapiRes.ok && maytapiData?.success !== false) {
          // Log the interaction
          await supabase.from("interactions").insert({
            lead_id: lead.id,
            user_id: user.id,
            type: "campaign_message_sent",
            title: "Campaign message sent (test)",
            notes: personalised.slice(0, 500),
            campaign_id: campaignId,
            is_automated: true,
          })

          // Advance enrollment position
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
          const reason =
            maytapiData?.message ||
            maytapiData?.error ||
            `Maytapi returned ${maytapiRes.status}`
          console.error(
            `send-test: Maytapi rejected ${lead.full_name}`,
            maytapiData
          )
          results.push({
            lead_id: lead.id,
            lead: lead.full_name,
            phone,
            status: "failed",
            reason,
          })
        }
      } catch (err) {
        console.error(`send-test: fetch threw for ${lead.full_name}`, err)
        results.push({
          lead_id: lead.id,
          lead: lead.full_name,
          phone,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        })
      }

      // Rate-limit to avoid Maytapi spam detection
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
