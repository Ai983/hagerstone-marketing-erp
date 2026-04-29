import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Whapi inbound webhook. Whapi sends:
//   body.messages[]  — incoming + outgoing messages
//   body.statuses[]  — delivery status updates (sent / delivered / read)
//
// Uses service role for writes because there's no Supabase auth session
// on a webhook request, and the `interactions` table's INSERT policy
// requires `auth.uid() IS NOT NULL` — without service role, every
// reply insert silently fails RLS.

interface WhapiMessage {
  id?: string
  chat_id?: string
  from?: string
  from_me?: boolean
  text?: { body?: string }
  caption?: string
}

interface WhapiStatus {
  id?: string
  status?: string
}

interface WhapiWebhookBody {
  messages?: WhapiMessage[]
  statuses?: WhapiStatus[]
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    )
  }
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WhapiWebhookBody
    console.log("Whapi webhook received:", JSON.stringify(body, null, 2))

    const supabase = getServiceClient()

    // ── Incoming messages ───────────────────────────────────────
    if (body.messages && body.messages.length > 0) {
      for (const msg of body.messages) {
        // Skip our own outgoing messages — Whapi includes those in the
        // same array but we only want to log replies from leads.
        if (msg.from_me) continue

        // Whapi sends chat_id like "919876543210@s.whatsapp.net"
        const fromPhone = msg.chat_id
          ?.replace("@s.whatsapp.net", "")
          ?.replace("91", "")
          ?.slice(-10)

        const messageText =
          msg.text?.body || msg.caption || "[Media message]"

        console.log("Incoming WhatsApp from:", fromPhone)
        console.log("Message:", messageText)

        if (!fromPhone) continue

        const { data: lead } = await supabase
          .from("leads")
          .select("id, full_name, assigned_to")
          .ilike("phone", `%${fromPhone}%`)
          .maybeSingle()

        if (lead) {
          await supabase.from("interactions").insert({
            lead_id: lead.id,
            type: "whatsapp_received",
            notes: messageText,
            is_automated: true,
          })

          if (lead.assigned_to) {
            await supabase.from("notifications").insert({
              user_id: lead.assigned_to,
              type: "campaign_reply",
              title: "WhatsApp Reply Received",
              body: `${lead.full_name}: "${messageText.slice(0, 100)}"`,
              lead_id: lead.id,
              is_read: false,
            })
          }

          console.log("Logged reply for lead:", lead.full_name)
        } else {
          console.log("No lead found for phone:", fromPhone)
        }
      }
    }

    // ── Delivery status updates ─────────────────────────────────
    if (body.statuses && body.statuses.length > 0) {
      for (const status of body.statuses) {
        console.log("Message status update:", status.id, status.status)
        // Hook point: when we want to record delivery confirmations,
        // update the matching interaction row by `whatsapp_message_id`.
      }
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error("Whapi webhook error:", error)
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return Response.json({ status: "Webhook active" })
}
