import { createClient } from "@supabase/supabase-js"

import {
  sendWhatsAppMessage,
  sendWhatsAppWithButtons,
  type WhapiButton,
} from "@/lib/utils/whapi"

export const dynamic = "force-dynamic"

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

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const logs: string[] = []
  logs.push(`Test drip started: ${new Date().toISOString()}`)

  const { data: dueEnrollments, error } = await supabase
    .from("campaign_enrollments")
    .select(
      `
      *,
      lead:leads(id, full_name, company_name, phone, whatsapp_opted_in),
      campaign:campaigns(id, name, status)
    `
    )
    .eq("status", "active")
    .lte("next_message_due_at", new Date().toISOString())
    .limit(3)

  if (error) {
    logs.push(`Fetch error: ${error.message}`)
    return Response.json({ logs, error: error.message }, { status: 500 })
  }

  logs.push(`Found ${dueEnrollments?.length ?? 0} due enrollments`)

  if (!dueEnrollments || dueEnrollments.length === 0) {
    return Response.json({
      logs,
      tip: "No enrollments due. Set delay_days=0 and re-enroll a lead to test immediately.",
    })
  }

  for (const enrollment of dueEnrollments) {
    const lead = Array.isArray(enrollment.lead)
      ? enrollment.lead[0]
      : enrollment.lead
    const campaign = Array.isArray(enrollment.campaign)
      ? enrollment.campaign[0]
      : enrollment.campaign

    logs.push(`Processing: ${lead?.full_name ?? "Unknown lead"}`)
    logs.push(`Phone: ${lead?.phone ?? "missing"}`)
    logs.push(`Position: ${enrollment.current_message_position}`)
    logs.push(`Opted in: ${lead?.whatsapp_opted_in}`)
    logs.push(`Campaign: ${campaign?.name ?? "Unknown campaign"}`)
    logs.push(`Campaign status: ${campaign?.status ?? "unknown"}`)

    const nextPosition = (enrollment.current_message_position ?? 0) + 1

    const { data: message } = await supabase
      .from("campaign_messages")
      .select("*")
      .eq("campaign_id", enrollment.campaign_id)
      .eq("position", nextPosition)
      .maybeSingle()

    if (!message) {
      logs.push(
        `No message at position ${nextPosition} - would complete enrollment`
      )
      continue
    }

    const template = message.message_template ?? message.message ?? ""
    const buttons = getButtons(message.buttons)
    logs.push(`Message to send: "${template.slice(0, 50)}..."`)
    logs.push(`Has buttons: ${buttons.length > 0}`)

    if (campaign?.status !== "active") {
      logs.push("SKIPPED - campaign is not active")
      continue
    }
    if (!lead?.phone) {
      logs.push("SKIPPED - missing phone")
      continue
    }
    if (!lead.whatsapp_opted_in) {
      logs.push("SKIPPED - not opted in")
      continue
    }

    const processedMessage = template
      .replace(/\[Name\]/g, lead.full_name ?? "")
      .replace(/\[Company\]/g, lead.company_name ?? "")

    const sendResult =
      buttons.length > 0
        ? await sendWhatsAppWithButtons(lead.phone, processedMessage, buttons)
        : await sendWhatsAppMessage(lead.phone, processedMessage)

    logs.push(`Send result: ${sendResult.success ? "SUCCESS" : "FAILED"}`)
    if (!sendResult.success) {
      logs.push(`Error: ${sendResult.error}`)
    } else {
      logs.push(`Message ID: ${sendResult.messageId}`)
    }
  }

  return Response.json({ logs })
}
