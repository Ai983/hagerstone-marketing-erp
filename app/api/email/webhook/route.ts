import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Webhook } from "svix"

export const dynamic = "force-dynamic"

type ResendEmailEvent = {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    bounce?: { message?: string }
    error?: { message?: string }
    failed?: { reason?: string }
  }
}

type EmailLogRow = {
  status: string | null
  opened_at: string | null
  clicked_at: string | null
  open_count: number | null
  click_count: number | null
  opened_count: number | null
  clicked_count: number | null
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const payload = await request.text()
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error("[email/webhook] RESEND_WEBHOOK_SECRET is not configured")
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 })
  }

  let event: ResendEmailEvent
  try {
    event = new Webhook(webhookSecret).verify(payload, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    }) as ResendEmailEvent
  } catch (err) {
    console.error("[email/webhook] Invalid signature:", err)
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 })
  }

  const eventType = event.type
  const emailId = event.data?.email_id
  console.log("[email/webhook] Received event", { eventType, emailId })

  if (!eventType || !emailId) {
    console.log("[email/webhook] Missing event type or email id")
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (eventType === "email.delivery_delayed") {
    console.log("[email/webhook] Delivery delayed", { emailId })
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: existingRow, error: fetchError } = await supabaseAdmin
    .from("email_logs")
    .select("status, opened_at, clicked_at, open_count, click_count, opened_count, clicked_count")
    .eq("resend_email_id", emailId)
    .maybeSingle<EmailLogRow>()

  if (fetchError) {
    console.error("[email/webhook] Failed to fetch email log:", fetchError)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (!existingRow) {
    console.log("[email/webhook] No matching email log", { emailId, eventType })
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const now = new Date().toISOString()
  const updates: Record<string, string | number | null> = {}

  switch (eventType) {
    case "email.sent":
      updates.status = existingRow.status ?? "sent"
      updates.sent_at = event.created_at ?? now
      break
    case "email.delivered":
      updates.status = "delivered"
      updates.delivered_at = now
      break
    case "email.opened": {
      const openCount = existingRow.open_count ?? existingRow.opened_count ?? 0
      updates.status = ["sent", "delivered"].includes(existingRow.status ?? "")
        ? "opened"
        : existingRow.status
      updates.opened_at = existingRow.opened_at ?? now
      updates.open_count = openCount + 1
      updates.opened_count = openCount + 1
      break
    }
    case "email.clicked": {
      const clickCount = existingRow.click_count ?? existingRow.clicked_count ?? 0
      updates.status = "clicked"
      updates.clicked_at = existingRow.clicked_at ?? now
      updates.click_count = clickCount + 1
      updates.clicked_count = clickCount + 1
      break
    }
    case "email.bounced":
      updates.status = "bounced"
      updates.bounced_at = now
      updates.error_message = event.data?.bounce?.message ?? null
      break
    case "email.complained":
      updates.status = "complained"
      updates.complained_at = now
      break
    case "email.failed":
      updates.status = "failed"
      updates.failed_at = now
      updates.error_message = event.data?.error?.message ?? event.data?.failed?.reason ?? null
      break
    default:
      console.log("[email/webhook] Ignored event type", { eventType, emailId })
      return NextResponse.json({ received: true }, { status: 200 })
  }

  const { error: updateError } = await supabaseAdmin
    .from("email_logs")
    .update(updates)
    .eq("resend_email_id", emailId)

  if (updateError) {
    console.error("[email/webhook] Failed to update email log:", updateError)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  console.log("[email/webhook] Updated email log", { eventType, emailId, updates })
  return NextResponse.json({ received: true }, { status: 200 })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    resend_webhook_secret_set: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  })
}
