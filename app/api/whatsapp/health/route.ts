import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import {
  getSessionStatus,
  WHATSAPP_GATEWAY_URL,
  WHATSAPP_SESSION_ID,
} from "@/lib/utils/whatsapp"

export const dynamic = "force-dynamic"

/**
 * Health of the self-hosted WhatsApp gateway.
 *
 * The old MayTAPI vendor exposed a `/logs` endpoint; the gateway instead
 * writes an audit row per message to `public.wa_messages` in the Hub database,
 * so delivery stats are read from there. Note this table lives in the `public`
 * schema, not `marketing`, hence the dedicated service client.
 */
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

    const session = await getSessionStatus()
    const isConnected = session.status === "connected"

    // ── Delivery stats from the gateway's own audit table (last 7 days) ──
    let sent = 0
    let delivered = 0
    let read = 0
    let failed = 0
    let received = 0
    let statsAvailable = false

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (serviceKey && supabaseUrl) {
      try {
        const hub = createServiceClient(supabaseUrl, serviceKey, {
          db: { schema: "public" },
        })
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: rows, error } = await hub
          .from("wa_messages")
          .select("direction, status")
          .eq("session_id", WHATSAPP_SESSION_ID)
          .gte("created_at", since)
          .limit(10000)

        if (!error && rows) {
          statsAvailable = true
          for (const r of rows) {
            if (r.direction === "in") received++
            else if (r.status === "failed") failed++
            else if (r.status === "read") read++
            else if (r.status === "delivered") delivered++
            else if (r.status === "sent") sent++
          }
        }
      } catch (err) {
        console.error("wa_messages stats query failed:", err)
      }
    }

    const outbound = sent + delivered + read + failed
    const failureRate = outbound > 0 ? failed / outbound : 0

    let healthScore = 100
    if (!session.reachable) healthScore -= 50
    if (!isConnected) healthScore -= 40
    if (failureRate > 0.2) healthScore -= 20
    else if (failureRate > 0.1) healthScore -= 10
    healthScore = Math.max(0, healthScore)

    const warnings: {
      level: "critical" | "warning" | "info"
      message: string
    }[] = []

    if (!session.reachable) {
      warnings.push({
        level: "critical",
        message: `WhatsApp gateway is unreachable at ${WHATSAPP_GATEWAY_URL}. ${session.error ?? ""}`.trim(),
      })
    } else if (!isConnected) {
      warnings.push({
        level: "critical",
        message: `Session "${WHATSAPP_SESSION_ID}" is "${session.status}", not connected. Re-pair by scanning the QR from the gateway.`,
      })
    }

    if (failureRate > 0.1) {
      warnings.push({
        level: "warning",
        message: `${failed} of ${outbound} outbound messages failed in the last 7 days (${Math.round(failureRate * 100)}%). Check number validity and send pacing.`,
      })
    }

    if (!statsAvailable) {
      warnings.push({
        level: "info",
        message:
          "Delivery stats unavailable — SUPABASE_SERVICE_ROLE_KEY may not be set.",
      })
    }

    if (warnings.length === 0) {
      warnings.push({
        level: "info",
        message: "No issues detected. Gateway is connected and healthy.",
      })
    }

    return NextResponse.json({
      gateway_url: WHATSAPP_GATEWAY_URL,
      session_id: WHATSAPP_SESSION_ID,
      phone_number: session.phoneNumber,
      status: session.status,
      is_connected: isConnected,
      health_score: healthScore,
      warnings,
      stats: {
        window_days: 7,
        outbound,
        sent,
        delivered,
        read,
        failed,
        received,
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
