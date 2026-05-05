import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

const PRODUCT_ID = process.env.MAYTAPI_PRODUCT_ID!
const PHONE_ID = process.env.MAYTAPI_PHONE_ID!
const API_TOKEN = process.env.MAYTAPI_API_TOKEN!

export const dynamic = "force-dynamic"

type MaytapiLog = {
  type: string
  body?: unknown
}

type MaytapiPhone = {
  id?: number | string
  phone_id?: number | string
  number?: string
  phone?: string
  wa_id?: string
  status?: string
  phone_status?: string
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    const allowedRoles = ["admin", "manager", "founder"]
    if (!profile?.role || !allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let phoneStatus = "unknown"
    let isConnected = false
    let phoneNumber = PHONE_ID

    try {
      const phonesRes = await fetch(
        `https://api.maytapi.com/api/${PRODUCT_ID}/listPhones`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-maytapi-key": API_TOKEN,
          },
          cache: "no-store",
        }
      )
      const phonesData = await phonesRes.json().catch(() => ([]))
      console.log(
        "Maytapi listPhones response:",
        JSON.stringify(phonesData).slice(0, 300)
      )

      const phones: MaytapiPhone[] = Array.isArray(phonesData)
        ? phonesData
        : phonesData?.data ?? []
      const thisPhone = phones.find(
        (p) =>
          String(p.id) === String(PHONE_ID) ||
          String(p.phone_id) === String(PHONE_ID)
      )

      if (thisPhone) {
        phoneStatus = thisPhone.status ?? thisPhone.phone_status ?? "unknown"
        phoneNumber =
          thisPhone.number ?? thisPhone.phone ?? thisPhone.wa_id ?? PHONE_ID
        isConnected =
          phoneStatus === "active" ||
          phoneStatus === "connected" ||
          phoneStatus === "CONNECTED" ||
          phoneStatus === "Active"
      }
    } catch (err) {
      console.error("Failed to fetch Maytapi phone list:", err)
    }

    // Logs
    let logs: MaytapiLog[] = []
    try {
      const logsRes = await fetch(
        `https://api.maytapi.com/api/${PRODUCT_ID}/${PHONE_ID}/logs`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-maytapi-key": API_TOKEN,
          },
          cache: "no-store",
        }
      )
      const logsData = await logsRes.json().catch(() => ({}))
      console.log(
        "Maytapi logs response:",
        JSON.stringify(logsData).slice(0, 200)
      )
      logs = logsData?.data ?? logsData?.logs ?? logsData?.result ?? []
      if (!Array.isArray(logs)) logs = []
    } catch {
      console.error("Failed to fetch Maytapi logs")
    }

    const errorCount = logs.filter((l) => l.type === "error").length
    const logoutCount = logs.filter(
      (l) => l.type === "status" && JSON.stringify(l).includes("logout")
    ).length
    const qrCount = logs.filter(
      (l) => l.type === "status" && JSON.stringify(l).includes("qr-screen")
    ).length
    const dupeCount = logs.filter((l) =>
      JSON.stringify(l).includes("Message Dupe")
    ).length
    const ackCount = logs.filter((l) => l.type === "ack").length
    const messageCount = logs.filter((l) => l.type === "message").length
    const noLidCount = logs.filter((l) => JSON.stringify(l).includes("No LID")).length

    let healthScore = 100
    if (logoutCount > 0) healthScore -= 40
    if (qrCount > 2) healthScore -= 20
    if (dupeCount > 5) healthScore -= 15
    if (noLidCount > 3) healthScore -= 10
    if (errorCount > 10) healthScore -= 15
    healthScore = Math.max(0, healthScore)

    const warnings: {
      level: "critical" | "warning" | "info"
      message: string
    }[] = []

    if (logoutCount > 0) {
      warnings.push({
        level: "critical",
        message: `Phone was logged out ${logoutCount} time(s) recently - session instability detected. Rescan QR immediately.`,
      })
    }
    if (qrCount > 2) {
      warnings.push({
        level: "critical",
        message: `QR screen appeared ${qrCount} times - WhatsApp is disconnecting repeatedly. Risk of ban.`,
      })
    }
    if (dupeCount > 0) {
      warnings.push({
        level: "warning",
        message: `${dupeCount} duplicate message error(s) - you are sending too fast. Increase delay between messages.`,
      })
    }
    if (noLidCount > 0) {
      warnings.push({
        level: "warning",
        message: `${noLidCount} "No LID" error(s) - some contacts may not be on WhatsApp or have blocked you.`,
      })
    }
    if (errorCount > 10) {
      warnings.push({
        level: "warning",
        message: `High error rate: ${errorCount} errors in recent logs. Monitor closely.`,
      })
    }
    if (warnings.length === 0) {
      warnings.push({
        level: "info",
        message: "No issues detected. Phone is healthy.",
      })
    }

    return NextResponse.json({
      phone_id: PHONE_ID,
      phone_number: phoneNumber,
      status: phoneStatus,
      is_connected: isConnected,
      health_score: healthScore,
      warnings,
      stats: {
        total_logs: logs.length,
        messages: messageCount,
        acks: ackCount,
        errors: errorCount,
        logouts: logoutCount,
        qr_screens: qrCount,
        dupes: dupeCount,
        no_lid: noLidCount,
      },
      tips: [
        "Keep daily sends under 50 messages on new numbers",
        "Maintain 30-90 second delay between campaign messages",
        "Only send to leads who have opted in to WhatsApp",
        "Vary message content - avoid identical templates",
      ],
      checked_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("WhatsApp health check error:", error)
    return NextResponse.json({ error: "Health check failed" }, { status: 500 })
  }
}
