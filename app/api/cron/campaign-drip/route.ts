import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"

import {
  sendWhatsAppMedia,
  sendWhatsAppMessage,
  sendWhatsAppWithButtons,
  type WhapiButton,
  type WhapiMediaType,
} from "@/lib/utils/whapi"

export const dynamic = "force-dynamic"

function personalize(template: string, lead: { full_name?: string | null; company_name?: string | null }) {
  return template
    .replace(/\[Name\]/g, lead.full_name ?? "")
    .replace(/\[Company\]/g, lead.company_name ?? "your company")
}

function getButtons(raw: unknown): WhapiButton[] {
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

function getMediaType(raw: unknown): WhapiMediaType {
  if (raw === "image" || raw === "video" || raw === "document") return raw
  return "document"
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
        phone, whatsapp_opted_in, assigned_to
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
    if (!lead?.phone) {
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
    if (!lead.whatsapp_opted_in) {
      results.skipped++
      await logCampaignSend(supabase, {
        campaign_id: enrollment.campaign_id,
        enrollment_id: enrollment.id,
        lead_id: lead.id,
        lead_name: lead.full_name ?? "Unknown",
        phone: lead.phone,
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

    const sendResult = mediaUrl
      ? await sendWhatsAppMedia(
          lead.phone,
          getMediaType(message.media_type),
          mediaUrl,
          {
            caption: processedMessage,
            filename: message.media_filename ?? undefined,
          }
        )
      : buttons.length > 0
        ? await sendWhatsAppWithButtons(lead.phone, processedMessage, buttons)
        : await sendWhatsAppMessage(lead.phone, processedMessage)

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

    await supabase.from("interactions").insert({
      lead_id: lead.id,
      type: "whatsapp_sent",
      notes: processedMessage,
      campaign_id: enrollment.campaign_id,
      is_automated: true,
      media_url: mediaUrl ?? null,
      media_type: mediaUrl ? getMediaType(message.media_type) : null,
    })

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
      phone: lead.phone,
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
