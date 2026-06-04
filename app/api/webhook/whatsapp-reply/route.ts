import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { matchAndRunChatbot } from "@/lib/utils/chatbot-engine"

const SESSION_TIMEOUT_HOURS = 24

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, key, { db: { schema: "marketing" } })
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

    const sessionCutoff = new Date(
      Date.now() - SESSION_TIMEOUT_HOURS * 60 * 60 * 1000
    ).toISOString()
    const { data: staleSession } = await supabase
      .from("chatbot_sessions")
      .select("id, last_activity_at")
      .eq("lead_id", lead.id)
      .in("status", ["active", "waiting_answer"])
      .lt("last_activity_at", sessionCutoff)
      .order("last_activity_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (staleSession) {
      await supabase
        .from("chatbot_sessions")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", staleSession.id)
    }

    let campaignId: string | null = null
    const { data: latestCampaignSend } = await supabase
      .from("interactions")
      .select("campaign_id")
      .eq("lead_id", lead.id)
      .in("type", ["whatsapp_sent", "campaign_message_sent"])
      .not("campaign_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestCampaignSend?.campaign_id) {
      const { data: enrollment } = await supabase
        .from("campaign_enrollments")
        .select("campaign_id")
        .eq("lead_id", lead.id)
        .eq("campaign_id", latestCampaignSend.campaign_id)
        .maybeSingle()

      campaignId = enrollment?.campaign_id ?? null
    }

    if (messageId) {
      const { data: existingReply } = await supabase
        .from("interactions")
        .select("id")
        .eq("whatsapp_message_id", messageId)
        .maybeSingle()

      if (existingReply) {
        return NextResponse.json({ success: true, duplicate: true })
      }
    }

    // Log interaction
    await supabase.from("interactions").insert({
      lead_id: lead.id,
      type: "whatsapp_received",
      notes: messageText,
      is_automated: true,
      campaign_id: campaignId,
      whatsapp_message_id: messageId || null,
    })

    if (campaignId) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("total_replies")
        .eq("id", campaignId)
        .maybeSingle()

      await supabase
        .from("campaigns")
        .update({ total_replies: (campaign?.total_replies ?? 0) + 1 })
        .eq("id", campaignId)
    }

    // Notify assigned rep + all admins
    const usersToNotify = new Set<string>()

    if (lead.assigned_to) {
      usersToNotify.add(lead.assigned_to)
    }

    const { data: adminUsers } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true)

    if (adminUsers && adminUsers.length > 0) {
      adminUsers.forEach((admin: { id: string }) => {
        usersToNotify.add(admin.id)
      })
    }

    if (usersToNotify.size > 0) {
      await supabase.from("notifications").insert(
        Array.from(usersToNotify).map((userId) => ({
          user_id: userId,
          type: "campaign_reply",
          title: `💬 WhatsApp Reply — ${lead.full_name}`,
          body: `${lead.full_name}: "${messageText.slice(0, 100)}"`,
          lead_id: lead.id,
          is_read: false,
        }))
      )
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

    // ── Run chatbot automation if lead found ──
    try {
      const botButtonId = message?.buttons_reply?.id ?? message?.selectedButtonId ?? undefined
      await matchAndRunChatbot(
        phone,
        messageText,
        lead.id,
        botButtonId
      )
    } catch (chatbotError) {
      console.error("Chatbot engine error (non-fatal):", chatbotError)
    }

    // Handle STOP for campaign opt-out
    const stopText = (message?.text ?? message?.message ?? text ?? "").trim().toUpperCase()
    if (stopText === "STOP" || stopText === "STOP." || stopText === "UNSUBSCRIBE") {
      const senderPhone = message?.from ?? message?.phone ?? phone ?? ""
      if (senderPhone) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { db: { schema: "marketing" } }
        )
        // Find the lead by phone
        const { data: leadForOptOut } = await supabaseAdmin
          .from("leads")
          .select("id, full_name, phone")
          .ilike("phone", `%${senderPhone.replace(/\D/g, "").slice(-10)}%`)
          .maybeSingle()

        if (leadForOptOut) {
          // Opt out all active enrollments for this lead
          await supabaseAdmin
            .from("campaign_enrollments")
            .update({ whatsapp_opted_out: true })
            .eq("lead_id", leadForOptOut.id)
            .eq("status", "active")

          // Log it
          await supabaseAdmin.from("interactions").insert({
            lead_id: leadForOptOut.id,
            type: "whatsapp_received",
            title: "Opted out via STOP reply",
            notes: "Lead replied STOP and was opted out from all active campaign enrollments",
            is_automated: true,
          })

          // Send confirmation back
          const { sendWhatsAppMessage } = await import("@/lib/utils/maytapi")
          await sendWhatsAppMessage(
            senderPhone,
            "You have been unsubscribed from our campaigns. You will not receive further automated messages. Reply START if you wish to re-subscribe."
          )
        }
      }
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
