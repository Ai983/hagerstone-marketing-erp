import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import {
  sendWhatsAppMedia,
  sendWhatsAppMessage,
  sendWhatsAppWithButtons,
} from "@/lib/utils/maytapi"
import { renderTemplate, sendEmail } from "@/lib/utils/resend"
import { wrapInEmailTemplate } from "@/lib/utils/email-content"

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
  if (raw === "document") return "document"
  return "media"
}

function getEmailVariables(lead: {
  full_name?: string | null
  company_name?: string | null
  service_line?: string | null
  city?: string | null
}) {
  return {
    lead_name: lead.full_name ?? "",
    company_name: lead.company_name ?? "",
    service_line: (lead.service_line ?? "").replaceAll("_", " "),
    city: lead.city ?? "",
    visit_date: "",
    rep_name: "Hagerstone Team",
  }
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
          id, full_name, company_name, phone, email, service_line, city, whatsapp_opted_in, assigned_to
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

    if (message.channel === "email") {
      if (!lead?.email) {
        return NextResponse.json(
          { error: "Lead has no email address" },
          { status: 400 }
        )
      }
      if (enrollment.email_opted_out === true) {
        return NextResponse.json(
          { error: "Lead has opted out of email for this campaign" },
          { status: 400 }
        )
      }

      const variables = getEmailVariables(lead)
      const emailSubject = renderTemplate(
        message.email_subject ?? "Message from Hagerstone",
        variables
      )
      const emailHtml = renderTemplate(message.message_template ?? "", variables)
      const finalHtml = emailHtml.includes("Hagerstone International")
        ? emailHtml
        : wrapInEmailTemplate(emailHtml)
      const unsubscribeToken = Buffer.from(enrollment.id).toString("base64")
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/campaign-unsubscribe?token=${unsubscribeToken}`
      const htmlWithUnsubscribe = finalHtml + `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
  <p style="font-size:12px;color:#999;margin:0;">
    You received this email because you enquired about our services.<br>
    <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">Unsubscribe from this campaign</a>
  </p>
</div>`

      const sentAt = new Date().toISOString()
      let emailResult
      try {
        emailResult = await sendEmail({
          to: lead.email,
          subject: emailSubject,
          html: htmlWithUnsubscribe,
          leadId: lead.id,
          campaignId: campaignId,
          templateId: message.email_template_id ?? undefined,
        })
      } catch (err) {
        await supabase.from("email_logs").insert({
          lead_id: lead.id,
          sent_by: user.id,
          template_id: message.email_template_id ?? null,
          to_email: lead.email,
          from_email: process.env.EMAIL_FROM!,
          subject: emailSubject,
          body_html: htmlWithUnsubscribe,
          status: "failed",
          sent_at: sentAt,
          failed_at: new Date().toISOString(),
          campaign_id: campaignId,
          error_message: err instanceof Error ? err.message : "Email send failed",
        })
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Email send failed" },
          { status: 502 }
        )
      }

      await supabase.from("email_logs").insert({
        lead_id: lead.id,
        sent_by: user.id,
        template_id: message.email_template_id ?? null,
        resend_email_id: emailResult?.id ?? null,
        to_email: lead.email,
        from_email: process.env.EMAIL_FROM!,
        subject: emailSubject,
        body_html: htmlWithUnsubscribe,
        status: "sent",
        sent_at: sentAt,
        campaign_id: campaignId,
      })

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        user_id: user.id,
        type: "email_sent",
        title: `Campaign email ${nextPosition} sent`,
        notes: emailSubject,
        campaign_id: campaignId,
        is_automated: true,
      })
    } else {
      if (!lead?.phone || !lead.whatsapp_opted_in) {
        return NextResponse.json(
          { error: "Lead has no phone or has not opted in to WhatsApp" },
          { status: 400 }
        )
      }
      if (enrollment.whatsapp_opted_out === true) {
        return NextResponse.json(
          { error: "Lead has opted out of WhatsApp for this campaign" },
          { status: 400 }
        )
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

      const messageWithStop = processedMessage + "\n\n_Reply STOP to unsubscribe from this campaign._"
      const mediaType = getMediaType(message.media_type)
      const sendResult = mediaUrl
        ? await sendWhatsAppMedia(lead.phone, mediaType, mediaUrl, {
            caption: messageWithStop,
            filename: message.media_filename ?? undefined,
          })
        : buttons.length > 0
          ? await sendWhatsAppWithButtons(lead.phone, messageWithStop, buttons)
          : await sendWhatsAppMessage(lead.phone, messageWithStop)

      if (!sendResult.success) {
        return NextResponse.json(
          { error: sendResult.error ?? "Failed to send message" },
          { status: 502 }
        )
      }

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        user_id: user.id,
        type: "whatsapp_sent",
        title: `Campaign message ${nextPosition} sent now`,
        notes: processedMessage,
        campaign_id: campaignId,
        is_automated: true,
        media_url: mediaUrl,
        media_type: mediaUrl ? message.media_type ?? getMediaType(message.media_type) : null,
      })
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
