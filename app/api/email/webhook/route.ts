import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

export const dynamic = "force-dynamic"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  let event: {
    type?: string
    data?: { email_id?: string }
  }

  try {
    const payload = await request.text()
    const id = request.headers.get("svix-id")
    const timestamp = request.headers.get("svix-timestamp")
    const signature = request.headers.get("svix-signature")

    if (!id || !timestamp || !signature) {
      return NextResponse.json({ error: "Missing webhook signature headers" }, { status: 400 })
    }

    event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    }) as { type?: string; data?: { email_id?: string } }
  } catch (err) {
    console.error("Invalid Resend webhook:", err)
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 })
  }

  const eventType = event?.type as string | undefined
  const emailId = event?.data?.email_id as string | undefined

  if (!eventType || !emailId) {
    return NextResponse.json({ received: true })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (eventType === "email.opened") {
    const { data: existing } = await supabase
      .from("email_logs")
      .select("opened_count")
      .eq("resend_email_id", emailId)
      .maybeSingle()

    await supabase
      .from("email_logs")
      .update({
        status: "opened",
        opened_at: new Date().toISOString(),
        opened_count: (existing?.opened_count ?? 0) + 1,
      })
      .eq("resend_email_id", emailId)
  }

  if (eventType === "email.clicked") {
    const { data: existing } = await supabase
      .from("email_logs")
      .select("clicked_count")
      .eq("resend_email_id", emailId)
      .maybeSingle()

    await supabase
      .from("email_logs")
      .update({
        status: "clicked",
        clicked_at: new Date().toISOString(),
        clicked_count: (existing?.clicked_count ?? 0) + 1,
      })
      .eq("resend_email_id", emailId)
  }

  if (eventType === "email.bounced") {
    await supabase
      .from("email_logs")
      .update({ status: "bounced" })
      .eq("resend_email_id", emailId)
  }

  if (eventType === "email.delivered") {
    await supabase
      .from("email_logs")
      .update({ status: "delivered" })
      .eq("resend_email_id", emailId)
  }

  return NextResponse.json({ received: true })
}
