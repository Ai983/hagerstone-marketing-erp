import { createClient } from "@supabase/supabase-js"
import { NextRequest } from "next/server"

import {
  sendWhatsAppMessage,
  sendWhatsAppWithButtons,
  type WhapiButton,
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
      continue
    }
    if (!lead?.phone) {
      results.skipped++
      continue
    }
    if (!lead.whatsapp_opted_in) {
      results.skipped++
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
    const buttons = getButtons(message.buttons)

    const sendResult =
      buttons.length > 0
        ? await sendWhatsAppWithButtons(lead.phone, processedMessage, buttons)
        : await sendWhatsAppMessage(lead.phone, processedMessage)

    if (!sendResult.success) {
      console.error("Send failed:", lead.full_name, sendResult.error)
      results.failed++
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
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  console.log("Results:", results)
  return Response.json(results)
}
