import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"

import {
  sendWhatsAppMedia,
  sendWhatsAppMessage,
  sendWhatsAppWithButtons,
} from "@/lib/utils/maytapi"
import { renderTemplate, sendEmail } from "@/lib/utils/resend"
import { wrapInEmailTemplate } from "@/lib/utils/email-content"

export const dynamic = "force-dynamic"
type WhatsAppButton = { id: string; title: string }
type MaytapiMediaType = "image" | "document" | "media"

function personalize(template: string, lead: { full_name?: string | null; company_name?: string | null }) {
  return template
    .replace(/\[Name\]/g, lead.full_name ?? "")
    .replace(/\[Company\]/g, lead.company_name ?? "your company")
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

type SendLogClient = {
  from: (table: "campaign_send_log") => {
    insert: (
      values: Record<string, unknown>
    ) => Promise<{ error: { message: string } | null }>
  }
}

async function logCampaignSend(
  supabase: unknown,
  entry: {
    campaign_id: string | null
    enrollment_id: string | null
    lead_id: string | null
    lead_name: string
    phone: string
    message_position: number | null
    message_preview: string
    status: "sent" | "failed" | "skipped"
    error_message?: string | null
    sleep_seconds: number
  }
) {
  const sendLogClient = supabase as unknown as SendLogClient
  const { error } = await sendLogClient.from("campaign_send_log").insert({
    ...entry,
    sent_at: new Date().toISOString(),
  })

  if (error) {
    console.error("Campaign send log insert failed:", error.message)
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log("Campaign drip engine running...")
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    completed: 0,
  }

  const { data: dueEnrollments, error } = await supabase
    .from("campaign_enrollments")
    .select(
      `
      *,
      lead:leads(
        id, full_name, company_name,
        phone, email, whatsapp_opted_in, assigned_to, service_line, city
      ),
      campaign:campaigns(id, name, status)
    `
    )
    .eq("status", "active")
    .lte("next_message_due_at", new Date().toISOString())
    .not("lead", "is", null)

  if (error) {
    console.error("Fetch error:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!dueEnrollments || dueEnrollments.length === 0) {
    return Response.json({ ...results, message: "No messages due" })
  }

  for (const enrollment of dueEnrollments) {
    results.processed++

    const lead = Array.isArray(enrollment.lead)
      ? enrollment.lead[0]
      : enrollment.lead
    const campaign = Array.isArray(enrollment.campaign)
      ? enrollment.campaign[0]
      : enrollment.campaign

    if (campaign?.status !== "active") {
      results.skipped++
      await logCampaignSend(supabase, {
        campaign_id: enrollment.campaign_id,
        enrollment_id: enrollment.id,
        lead_id: lead?.id ?? null,
        lead_name: lead?.full_name ?? "Unknown",
        phone: lead?.phone ?? "",
        message_position: enrollment.current_message_position ?? null,
        message_preview: "Skipped",
        status: "skipped",
        error_message: "No phone / not opted in / inactive",
        sleep_seconds: 0,
      })
      continue
    }
    const nextPosition = (enrollment.current_message_position ?? 0) + 1

    const { data: message } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("campaign_id", enrollment.campaign_id)
      .eq("position", nextPosition)
      .maybeSingle()

    if (!message) {
      await supabase
        .from("campaign_enrollments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id)
      results.completed++
      continue
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
    const sleepSeconds = Math.floor(Math.random() * 50) + 1

    if (message.channel === "email") {
      if (!lead?.email) {
        results.skipped++
        await logCampaignSend(supabase, {
          campaign_id: enrollment.campaign_id,
          enrollment_id: enrollment.id,
          lead_id: lead?.id ?? null,
          lead_name: lead?.full_name ?? "Unknown",
          phone: lead?.phone ?? "",
          message_position: nextPosition,
          message_preview: "Email skipped",
          status: "skipped",
          error_message: "No email address on lead",
          sleep_seconds: 0,
        })
        continue
      }

      const variables = getEmailVariables(lead)
      const emailSubject = renderTemplate(
        message.email_subject ?? campaign?.name ?? "Hagerstone",
        variables
      )
      const emailHtml = renderTemplate(
        message.message_template ?? "",
        variables
      )
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

      try {
        const sentAt = new Date().toISOString()
        const email = await sendEmail({
          to: lead.email,
          subject: emailSubject,
          html: htmlWithUnsubscribe,
          leadId: lead.id,
          campaignId: enrollment.campaign_id,
          templateId: message.email_template_id ?? undefined,
        })

        await supabase.from("email_logs").insert({
          lead_id: lead.id,
          sent_by: null,
          template_id: message.email_template_id ?? null,
          resend_email_id: email?.id ?? null,
          to_email: lead.email,
          from_email: process.env.EMAIL_FROM!,
          subject: emailSubject,
          body_html: htmlWithUnsubscribe,
          status: "sent",
          sent_at: sentAt,
          campaign_id: enrollment.campaign_id,
        })

        await supabase.from("interactions").insert({
          lead_id: lead.id,
          type: "email_sent",
          title: "Campaign email sent",
          notes: emailSubject,
          campaign_id: enrollment.campaign_id,
          is_automated: true,
        })
      } catch (err) {
        results.failed++
        await supabase.from("email_logs").insert({
          lead_id: lead?.id ?? null,
          sent_by: null,
          template_id: message.email_template_id ?? null,
          to_email: lead?.email ?? "",
          from_email: process.env.EMAIL_FROM!,
          subject: emailSubject,
          body_html: htmlWithUnsubscribe,
          status: "failed",
          sent_at: new Date().toISOString(),
          failed_at: new Date().toISOString(),
          campaign_id: enrollment.campaign_id,
          error_message: err instanceof Error ? err.message : "Email send failed",
        })
        await logCampaignSend(supabase, {
          campaign_id: enrollment.campaign_id,
          enrollment_id: enrollment.id,
          lead_id: lead?.id ?? null,
          lead_name: lead?.full_name ?? "Unknown",
          phone: lead?.phone ?? "",
          message_position: nextPosition,
          message_preview: processedMessage.slice(0, 100),
          status: "failed",
          error_message: err instanceof Error ? err.message : "Email send failed",
          sleep_seconds: 0,
        })
        continue
      }
    } else {
      if (!lead?.phone || !lead.whatsapp_opted_in) {
        results.skipped++
        await logCampaignSend(supabase, {
          campaign_id: enrollment.campaign_id,
          enrollment_id: enrollment.id,
          lead_id: lead?.id ?? null,
          lead_name: lead?.full_name ?? "Unknown",
          phone: lead?.phone ?? "",
          message_position: nextPosition,
          message_preview: "Skipped",
          status: "skipped",
          error_message: "No phone / not opted in / inactive",
          sleep_seconds: 0,
        })
        continue
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
      console.error("Send failed:", lead.full_name, sendResult.error)
      results.failed++
      await logCampaignSend(supabase, {
        campaign_id: enrollment.campaign_id,
        enrollment_id: enrollment.id,
        lead_id: lead.id,
        lead_name: lead.full_name ?? "Unknown",
        phone: lead.phone,
        message_position: nextPosition,
        message_preview: processedMessage.slice(0, 100),
        status: "failed",
        error_message: sendResult.error ?? "Unknown error",
        sleep_seconds: 0,
      })
      continue
    }
    }

    const { data: nextMessage } = await supabase
      .from("campaign_messages")
      .select("delay_days, position")
      .eq("campaign_id", enrollment.campaign_id)
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

    if (message.channel !== "email") {
      await supabase.from("interactions").insert({
        lead_id: lead.id,
        type: "whatsapp_sent",
        notes: processedMessage,
        campaign_id: enrollment.campaign_id,
        is_automated: true,
        media_url: mediaUrl ?? null,
        media_type: mediaUrl ? message.media_type ?? getMediaType(message.media_type) : null,
      })
    }

    await supabase
      .from("campaigns")
      .update({ last_sent_at: now })
      .eq("id", enrollment.campaign_id)

    if (!nextDueAt && lead.assigned_to) {
      await supabase.from("notifications").insert({
        user_id: lead.assigned_to,
        type: "campaign_reply",
        title: "Campaign Completed",
        body: `${lead.full_name} completed all messages in ${campaign?.name ?? "campaign"}`,
        lead_id: lead.id,
        is_read: false,
      })
    }

    results.sent++
    await logCampaignSend(supabase, {
      campaign_id: enrollment.campaign_id,
      enrollment_id: enrollment.id,
      lead_id: lead.id,
      lead_name: lead.full_name ?? "Unknown",
      phone: lead.phone ?? "",
      message_position: nextPosition,
      message_preview: processedMessage.slice(0, 100),
      status: "sent",
      sleep_seconds: sleepSeconds,
    })
    console.log(`Sleeping ${sleepSeconds}s before next message...`)
    await new Promise((resolve) => setTimeout(resolve, sleepSeconds * 1000))
  }

  console.log("Results:", results)
  return Response.json(results)
}
