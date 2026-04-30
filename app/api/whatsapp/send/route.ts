import { NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import {
  sendWhatsAppMessage,
  sendWhatsAppWithButtons,
  type WhapiButton,
} from "@/lib/utils/whapi"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { phone, message, lead_id, buttons, header, footer } =
      (await request.json()) as {
      phone?: string
      message?: string
      lead_id?: string
      buttons?: WhapiButton[]
      header?: string
      footer?: string
    }
    console.log("WhatsApp send request:", { phone, message, lead_id })

    if (!phone || !message) {
      return Response.json(
        { error: "Phone and message required" },
        { status: 400 }
      )
    }

    const usableButtons = Array.isArray(buttons)
      ? buttons
          .filter((btn) => btn.id?.trim() && btn.title?.trim())
          .slice(0, 3)
      : []

    const result =
      usableButtons.length > 0
        ? await sendWhatsAppWithButtons(
            phone,
            message,
            usableButtons,
            header,
            footer
          )
        : await sendWhatsAppMessage(phone, message)

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 })
    }

    // Log interaction if lead_id provided.
    if (lead_id) {
      await supabase.from("interactions").insert({
        lead_id,
        type: "whatsapp_sent",
        notes: message,
        user_id: user.id,
        is_automated: false,
      })
    }

    return Response.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error) {
    console.error("WhatsApp send route error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
