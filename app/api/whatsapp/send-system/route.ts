import { NextRequest, NextResponse } from "next/server"

import { sendWhatsAppMessage } from "@/lib/utils/maytapi"

export async function POST(req: NextRequest) {
  try {
    // Auth via CRON_SECRET - used by n8n and internal system calls.
    const auth = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { phone, message } = body

    if (!phone || !message) {
      return NextResponse.json(
        { error: "phone and message are required" },
        { status: 400 }
      )
    }

    const result = await sendWhatsAppMessage(phone, message)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("send-system error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
