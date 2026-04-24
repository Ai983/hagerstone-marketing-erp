import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ── Payload shape ──────────────────────────────────────────────────
//
// Maytapi's webhook body isn't strictly typed — across docs and
// in-the-wild traffic we've seen the reply number appear at several
// paths, so we probe each one.

interface MaytapiWebhookBody {
  message?: {
    from?: string
    text?: string | { body?: string }
  }
  from?: string
  phoneNumber?: string
  text?: string
  data?: {
    from?: string
    text?: string
  }
}

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Service role not configured" },
        { status: 503 }
      )
    }
    const supabase = createClient(url, serviceKey)

    const body = (await request.json()) as MaytapiWebhookBody
    console.log("WhatsApp webhook received:", JSON.stringify(body))

    // Extract phone + text from any of the known payload shapes
    const phone =
      body?.message?.from ||
      body?.from ||
      body?.data?.from ||
      body?.phoneNumber

    const messageText = body?.message?.text
    const text =
      (typeof messageText === "object" ? messageText?.body : messageText) ||
      body?.text ||
      body?.data?.text

    if (!phone || !text) {
      console.log("No phone or text found, ignoring")
      return NextResponse.json({ status: "ignored" })
    }

    // Keep last 10 digits — matches both "919876543210" and "9876543210"
    // stored against leads.phone via ILIKE %...%.
    const digits = String(phone).replace(/\D/g, "")
    const normalised = digits.slice(-10)

    console.log("Looking for lead with phone:", normalised)

    // maybeSingle() returns { data: null, error: null } on zero matches,
    // so unknown numbers fall through to the lead_not_found branch
    // instead of throwing PGRST116 into the catch.
    const { data: lead, error: lookupError } = await supabase
      .from("leads")
      .select("id, full_name, assigned_to")
      .or(`phone.ilike.%${normalised}%,phone_alt.ilike.%${normalised}%`)
      .limit(1)
      .maybeSingle()

    if (lookupError) {
      console.error("Lead lookup failed:", lookupError)
      return NextResponse.json({ error: lookupError.message }, { status: 500 })
    }

    if (!lead) {
      console.log("Lead not found for phone:", normalised)
      return NextResponse.json({ status: "lead_not_found" })
    }

    console.log("Found lead:", lead.full_name)

    // Log the reply on the lead timeline
    const { error: interactionError } = await supabase.from("interactions").insert({
      lead_id: lead.id,
      type: "whatsapp_received",
      notes: String(text),
      is_automated: true,
    })
    if (interactionError) {
      console.error("Interaction insert failed:", interactionError)
    }

    // Notify the assigned rep (type 'campaign_reply' is allowed by the
    // notifications CHECK constraint — see PRD §5).
    if (lead.assigned_to) {
      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: lead.assigned_to,
        type: "campaign_reply",
        title: `${lead.full_name} replied on WhatsApp`,
        body: String(text).slice(0, 100),
        lead_id: lead.id,
      })
      if (notifError) {
        console.error("Notification insert failed:", notifError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("WhatsApp reply webhook error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Maytapi pings GET to verify webhook reachability
export async function GET() {
  return NextResponse.json({ status: "ok", service: "hagerstone-erp" })
}
