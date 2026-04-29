import { NextResponse } from "next/server"

import { createClient as createUserClient } from "@/lib/supabase/server"
import { sendWhatsAppMessage } from "@/lib/utils/whapi"

// Default to MANAGER_WHATSAPP_NUMBER for the test send. Falls back to a
// safe placeholder so the route never tries to spam an unspecified number.
const TEST_NUMBER =
  process.env.MANAGER_WHATSAPP_NUMBER || "+919999999999"

export async function POST() {
  const supabase = await createUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await sendWhatsAppMessage(
    TEST_NUMBER,
    "Hagerstone ERP test message ✅ — Whapi integration working!"
  )

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to send test message" },
      { status: 502 }
    )
  }

  return NextResponse.json({
    success: true,
    sent_to: TEST_NUMBER,
    messageId: result.messageId,
  })
}
