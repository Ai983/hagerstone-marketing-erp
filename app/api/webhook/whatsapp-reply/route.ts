import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Maytapi payload — phone is in body.conversation, NOT body.message.from
    // body.conversation = "919958131069@c.us"
    // body.message = { id, type, text, fromMe, ... }

    const message = body?.message
    if (!message) return NextResponse.json({ ok: true })
    if (message.fromMe === true) return NextResponse.json({ ok: true })

    // Extract phone from body.conversation (primary) or body.message.from (fallback)
    const conversationRaw: string =
      body?.conversation ??
      message?.from ??
      message?.chatId ??
      ""

    // Ignore group messages
    if (conversationRaw.includes("@g.us")) return NextResponse.json({ ok: true })

    // Strip WhatsApp suffixes
    const phone = conversationRaw
      .replace("@c.us", "")
      .replace("@s.whatsapp.net", "")
      .trim()

    // Normalise to last 10 digits for DB lookup
    const fromPhone = phone.replace(/\D/g, "").slice(-10)

    // Extract message text
    const text: string =
      message?.text ||
      message?.body ||
      message?.caption ||
      ""

    const messageId: string = message?.id ?? ""

    // Button reply detection
    const buttonReplyId: string =
      message?.buttons_reply?.id ||
      message?.selectedButtonId ||
      (text === "btn_interested" || text === "btn_not_now" || text === "btn_call_me" ? text : "")

    const messageText = text || buttonReplyId || "[Media message]"

    console.log("Maytapi webhook — conversation:", conversationRaw, "| fromPhone:", fromPhone, "| text:", messageText, "| messageId:", messageId)

    if (!fromPhone) return NextResponse.json({ ok: true })

    const supabase = getServiceClient()

    // Find lead by last 10 digits of phone
    const { data: lead } = await supabase
      .from("leads")
      .select("id, full_name, assigned_to, stage_id, category")
      .ilike("phone", `%${fromPhone}%`)
      .maybeSingle()

    if (!lead) {
      console.log("No lead found for phone:", fromPhone)
      return NextResponse.json({ ok: true })
    }

    // Log interaction
    await supabase.from("interactions").insert({
      lead_id: lead.id,
      type: "whatsapp_received",
      notes: messageText,
      is_automated: true,
    })

    // Notify assigned rep
    if (lead.assigned_to) {
      await supabase.from("notifications").insert({
        user_id: lead.assigned_to,
        type: "campaign_reply",
        title: "WhatsApp Reply",
        body: `${lead.full_name}: "${messageText.slice(0, 100)}"`,
        lead_id: lead.id,
        is_read: false,
      })
    }

    // Button reply auto-actions
    if (buttonReplyId === "btn_interested") {
      await supabase
        .from("leads")
        .update({ category: "hot", category_remarks: "Replied Interested via WhatsApp" })
        .eq("id", lead.id)
      console.log("Lead marked HOT:", lead.full_name)
    }

    if (buttonReplyId === "btn_not_now") {
      await supabase
        .from("leads")
        .update({ category: "cold", category_remarks: "Replied Not Now via WhatsApp" })
        .eq("id", lead.id)
      console.log("Lead marked COLD:", lead.full_name)
    }

    if (buttonReplyId === "btn_call_me") {
      await supabase.from("tasks").insert({
        lead_id: lead.id,
        assigned_to: lead.assigned_to,
        title: `Call requested by ${lead.full_name} via WhatsApp`,
        type: "call",
        due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        is_completed: false,
      })
      console.log("Call task created for:", lead.full_name)
    }

    console.log("Webhook processed for lead:", lead.full_name)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Maytapi webhook error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ status: "Maytapi webhook active", ok: true })
}
