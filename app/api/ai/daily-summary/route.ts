import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { generateAndSendDailySummary } from "@/lib/utils/daily-summary"

// ── Fallback: basic stats-only briefing when Claude is unavailable ─
async function buildFallbackMessage(supabase: SupabaseClient): Promise<string> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [activeLeadsRes, overdueRes, wonRes] = await Promise.all([
    supabase.from("leads").select("id, stage:stage_id(stage_type)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_overdue", true)
      .is("completed_at", null),
    supabase
      .from("leads")
      .select("closure_value, stage:stage_id(slug)")
      .gte("closed_at", startOfMonth),
  ])

  const activeLeads = (activeLeadsRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return (stage as { stage_type?: string } | null)?.stage_type === "active"
  }).length

  const won = (wonRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return (stage as { slug?: string } | null)?.slug === "won"
  })
  const wonValue = won.reduce((sum, l) => sum + (l.closure_value ?? 0), 0)
  const overdueCount = overdueRes.count ?? 0

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://erp.hagerstone.com"

  return [
    "🌅 *Hagerstone ERP — Morning Briefing*",
    "",
    "*Today's focus:*",
    overdueCount > 0
      ? `- ${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} need attention`
      : "- No overdue tasks",
    `- ${activeLeads} active lead${activeLeads === 1 ? "" : "s"} in the pipeline`,
    won.length > 0
      ? `- ${won.length} deal${won.length === 1 ? "" : "s"} won this month`
      : "- No deals closed yet this month",
    "",
    "📊 *Quick Stats*",
    `Active Leads: ${activeLeads}`,
    `Won This Month: ${won.length} deals · ₹${wonValue.toLocaleString("en-IN")}`,
    `Overdue Tasks: ${overdueCount}`,
    "",
    `View Pipeline: ${appUrl}/pipeline`,
  ].join("\n")
}

async function resolveTargetPhone(
  supabase: SupabaseClient,
  overridePhone?: string
): Promise<string | null> {
  if (overridePhone?.trim()) return overridePhone.trim()

  const { data: cfg } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "daily_summary_config")
    .maybeSingle()
  const phone = (cfg?.value as { phone_number?: string | null } | null)?.phone_number
  if (phone && phone.trim()) return phone.trim()

  return process.env.MANAGER_WHATSAPP_NUMBER || null
}

// ────────────────────────────────────────────────────────────────────
//  Route handler
// ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const cronHeader = request.headers.get("x-cron-secret")
    const expectedSecret = process.env.CRON_SECRET

    let authorized = false
    if (expectedSecret && cronHeader && cronHeader === expectedSecret) {
      authorized = true
    }

    if (!authorized) {
      const userClient = await createUserClient()
      const {
        data: { user },
      } = await userClient.auth.getUser()
      if (user) {
        const { data: profile } = await userClient
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()
        if (profile?.role === "admin") {
          authorized = true
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const overridePhone = (body?.phone_number as string | undefined)?.trim()
    const dryRun = Boolean(body?.dry_run)

    // ── Service client (for stats + last_sent upsert) ───────────
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Service role credentials not configured" },
        { status: 503 }
      )
    }
    const supabase = createServiceClient(url, serviceKey)

    // ── Build the message ──────────────────────────────────────
    const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY)
    let finalMessage = ""
    let usedFallback = false

    if (hasAnthropicKey) {
      // Try the AI-generated path first
      const result = await generateAndSendDailySummary({
        overridePhone: overridePhone || undefined,
        dryRun,
        skipSend: true,
      })

      if (result.success && result.message_preview) {
        finalMessage = result.message_preview
      } else {
        // Claude path failed — fall back to hardcoded template
        console.error("Daily summary (AI path) failed, using fallback:", result.error)
        finalMessage = await buildFallbackMessage(supabase)
        usedFallback = true
      }
    } else {
      // No key — use hardcoded template
      console.error("ANTHROPIC_API_KEY missing; using fallback summary.")
      finalMessage = await buildFallbackMessage(supabase)
      usedFallback = true
    }

    // Resolve the target phone after message-build so errors above are
    // isolated from phone-resolution errors.
    const managerNumberRaw = await resolveTargetPhone(supabase, overridePhone)

    // Dry run short-circuit
    if (dryRun) {
      await supabase.from("admin_settings").upsert({
        key: "daily_summary_last_sent",
        value: {
          sent_at: new Date().toISOString(),
          phone_number: managerNumberRaw,
          dry_run: true,
          used_fallback: usedFallback,
        },
        updated_at: new Date().toISOString(),
      })
      return NextResponse.json({
        success: true,
        message_preview: finalMessage,
        sent_to: managerNumberRaw,
        dry_run: true,
        used_fallback: usedFallback,
      })
    }

    // ── Send via Maytapi — non-fatal ───────────────────────────
    let sendOk = false
    let sendError: string | null = null
    let managerNumber: string | null = null

    if (!managerNumberRaw) {
      sendError = "No target phone number configured"
    } else {
      // Maytapi expects digits only — strip +, spaces, dashes, and parens
      managerNumber = managerNumberRaw.replace(/[\s\-()+]/g, "")

      try {
        const maytapiResponse = await fetch(
          `https://api.maytapi.com/api/${process.env.MAYTAPI_PRODUCT_ID}/${process.env.MAYTAPI_PHONE_ID}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-maytapi-key": process.env.MAYTAPI_API_TOKEN!,
            },
            body: JSON.stringify({
              to_number: managerNumber,
              type: "text",
              message: finalMessage,
            }),
          }
        )

        const maytapiJson = await maytapiResponse.json().catch(() => null)

        if (!maytapiResponse.ok || maytapiJson?.success === false) {
          sendError =
            maytapiJson?.message || `Maytapi returned ${maytapiResponse.status}`
          console.error("Maytapi send failed:", sendError, maytapiJson)
        } else {
          sendOk = true
        }
      } catch (err) {
        sendError = err instanceof Error ? err.message : "Network error calling Maytapi"
        console.error("Maytapi fetch threw:", err)
      }
    }

    // ── Record last-sent (best effort) ─────────────────────────
    try {
      await supabase.from("admin_settings").upsert({
        key: "daily_summary_last_sent",
        value: {
          sent_at: new Date().toISOString(),
          phone_number: managerNumber,
          dry_run: false,
          used_fallback: usedFallback,
          send_ok: sendOk,
          send_error: sendError,
        },
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error("Failed to upsert last_sent:", err)
    }

    // Always return 200 with the preview, even if send failed.
    return NextResponse.json({
      success: true,
      sent: sendOk,
      message_preview: finalMessage,
      sent_to: managerNumber,
      used_fallback: usedFallback,
      send_error: sendError,
    })
  } catch (error) {
    console.error("Daily summary error:", error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
