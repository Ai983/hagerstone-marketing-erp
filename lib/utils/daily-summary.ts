// Shared logic for the daily WhatsApp briefing.
// Used by both the direct API route (manual "Send Test") and
// the cron route (scheduled by Vercel).

import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"
import { CLAUDE_MODEL } from "@/lib/utils/claude"

export interface DailySummaryResult {
  success: boolean
  message_preview: string
  sent_to: string | null
  error?: string
  dry_run?: boolean
}

const SYSTEM_PROMPT = `You are a sales manager assistant for Hagerstone International, an interior design and build firm in Noida, India. Write a concise WhatsApp morning briefing for the sales manager.

Requirements:
- Use bullet points
- Keep under 300 words
- Use Indian business context (rupees, NCR, etc.)
- Use emojis sparingly (1-3 max, where natural)
- Format for WhatsApp: no markdown headers, use *bold* for emphasis
- Return ONLY the message text — no JSON, no preamble, no quotes around it

Structure the message as short sections covering:
- What needs attention first today
- Hot leads going cold
- Critical stage status (e.g. negotiation)
- Quick wins already in progress
- One direct recommendation`

// Whapi sender — replaced Maytapi. The shared helper handles phone
// normalisation and bearer auth. Returns the same { ok, error } shape
// the cron route expects.

import { sendWhatsAppMessage } from "@/lib/utils/whapi"

async function sendViaWhapi(
  toNumber: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await sendWhatsAppMessage(toNumber, message)
  return result.success
    ? { ok: true }
    : { ok: false, error: result.error }
}

// ── Claude caller (local copy: avoids forcing JSON parsing) ─────────

async function callClaudeText(system: string, userMessage: string, maxTokens = 600): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured")

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature: 0.4,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  })

  const raw = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(raw?.error?.message || `Anthropic API returned ${res.status}`)
  }
  const text: string = raw?.content?.[0]?.text ?? ""
  if (!text.trim()) throw new Error("Claude returned empty response")
  return text.trim()
}

// ── Data gather ─────────────────────────────────────────────────────

async function gatherPipelineContext(supabase: SupabaseClient) {
  const now = new Date()
  const yesterdayStart = new Date(now)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  yesterdayStart.setHours(0, 0, 0, 0)

  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    overdueRes,
    hotStaleRes,
    negotiationRes,
    newYesterdayRes,
    wonRes,
    activeCountRes,
  ] = await Promise.all([
    // 1. Overdue tasks (joined with lead name)
    supabase
      .from("tasks")
      .select("id, title, due_at, lead:lead_id(full_name, company_name)")
      .eq("is_overdue", true)
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .limit(10),

    // 2. Hot leads (score >= 80) with no interaction in last 3 days
    // We fetch hot leads and their latest interaction, then filter
    supabase
      .from("leads")
      .select(
        "id, full_name, company_name, score, updated_at, stage:stage_id(name, stage_type)"
      )
      .gte("score", 80)
      .order("score", { ascending: false })
      .limit(15),

    // 3. Leads in negotiation
    supabase
      .from("leads")
      .select(
        "id, full_name, company_name, estimated_budget, updated_at, stage:stage_id(slug, name)"
      )
      .order("updated_at", { ascending: false })
      .limit(20),

    // 4. New leads added yesterday
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", yesterdayStart.toISOString())
      .lt("created_at", now.toISOString()),

    // 5. Won deals this month
    supabase
      .from("leads")
      .select("closure_value, stage:stage_id(slug)")
      .gte("closed_at", startOfMonth),

    // 6. Total active leads count
    supabase.from("leads").select("id, stage:stage_id(stage_type)"),
  ])

  // Filter hot leads that haven't been updated in 3+ days
  const hotStale = (hotStaleRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    const stageType = (stage as { stage_type?: string } | null)?.stage_type
    return stageType === "active" && new Date(l.updated_at).toISOString() < threeDaysAgo
  })

  // Filter negotiation-stage leads
  const negotiation = (negotiationRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return (stage as { slug?: string } | null)?.slug === "negotiation"
  })

  // Filter won for the month
  const won = (wonRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return (stage as { slug?: string } | null)?.slug === "won"
  })
  const wonValue = won.reduce((sum, l) => sum + (l.closure_value ?? 0), 0)

  // Active lead count
  const activeLeads = (activeCountRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return (stage as { stage_type?: string } | null)?.stage_type === "active"
  }).length

  return {
    overdueTasks: overdueRes.data ?? [],
    hotStaleLeads: hotStale.slice(0, 5),
    negotiationLeads: negotiation.slice(0, 5),
    newLeadsYesterday: newYesterdayRes.count ?? 0,
    wonCount: won.length,
    wonValue,
    activeLeads,
    overdueTaskCount: overdueRes.data?.length ?? 0,
  }
}

function buildUserMessage(ctx: Awaited<ReturnType<typeof gatherPipelineContext>>): string {
  const overdueText =
    ctx.overdueTasks.length === 0
      ? "None."
      : ctx.overdueTasks
          .map((t) => {
            const lead = Array.isArray(t.lead) ? t.lead[0] : t.lead
            const name = (lead as { full_name?: string } | null)?.full_name ?? "?"
            const due = new Date(t.due_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })
            return `- ${t.title} (lead: ${name}, was due ${due})`
          })
          .join("\n")

  const hotStaleText =
    ctx.hotStaleLeads.length === 0
      ? "None."
      : ctx.hotStaleLeads
          .map((l) => {
            const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
            const stageName = (stage as { name?: string } | null)?.name ?? "?"
            return `- ${l.full_name} (${l.company_name ?? "no company"}) — score ${l.score}, stage ${stageName}`
          })
          .join("\n")

  const negotiationText =
    ctx.negotiationLeads.length === 0
      ? "None."
      : ctx.negotiationLeads
          .map(
            (l) =>
              `- ${l.full_name} (${l.company_name ?? "no company"}) — budget ${l.estimated_budget ?? "N/A"}`
          )
          .join("\n")

  return [
    `OVERDUE TASKS (${ctx.overdueTaskCount}):`,
    overdueText,
    "",
    "HOT LEADS (score ≥ 80) WITH NO ACTIVITY FOR 3+ DAYS:",
    hotStaleText,
    "",
    "LEADS CURRENTLY IN NEGOTIATION:",
    negotiationText,
    "",
    `NEW LEADS YESTERDAY: ${ctx.newLeadsYesterday}`,
    `WON THIS MONTH: ${ctx.wonCount} deals · ₹${ctx.wonValue.toLocaleString("en-IN")}`,
    `ACTIVE LEADS: ${ctx.activeLeads}`,
  ].join("\n")
}

function formatWhatsAppMessage(ai: string, stats: { activeLeads: number; wonCount: number; wonValue: number; overdueTaskCount: number }): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://erp.hagerstone.com"

  return [
    "🌅 *Hagerstone ERP — Morning Briefing*",
    "",
    ai.trim(),
    "",
    "📊 *Quick Stats*",
    `Active Leads: ${stats.activeLeads}`,
    `Won This Month: ${stats.wonCount} deals · ₹${stats.wonValue.toLocaleString("en-IN")}`,
    `Overdue Tasks: ${stats.overdueTaskCount}`,
    "",
    `View Pipeline: ${appUrl}/pipeline`,
  ].join("\n")
}

// ── Main entry ──────────────────────────────────────────────────────

export interface DailySummaryOptions {
  /** Override the phone number; otherwise falls back to admin_settings then MANAGER_WHATSAPP_NUMBER */
  overridePhone?: string
  /** If true, generate but don't actually send via Whapi */
  dryRun?: boolean
  /** If true, generate and log the message but skip Whapi send (caller sends it). */
  skipSend?: boolean
}

export async function generateAndSendDailySummary(
  options: DailySummaryOptions = {}
): Promise<DailySummaryResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return {
      success: false,
      message_preview: "",
      sent_to: null,
      error: "Service role credentials not configured",
    }
  }
  const supabase = createServiceClient(url, serviceKey)

  // Resolve target phone: override > admin_settings config > env var
  let targetPhone = options.overridePhone?.trim() || null
  if (!targetPhone) {
    const { data: cfg } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "daily_summary_config")
      .maybeSingle()
    const phone = (cfg?.value as { phone_number?: string | null } | null)?.phone_number
    if (phone && phone.trim()) targetPhone = phone.trim()
  }
  if (!targetPhone) {
    targetPhone = process.env.MANAGER_WHATSAPP_NUMBER || null
  }

  try {
    // 1. Gather pipeline context
    const ctx = await gatherPipelineContext(supabase)

    // 2. Call Claude for the narrative section
    const aiText = await callClaudeText(SYSTEM_PROMPT, buildUserMessage(ctx), 600)

    // 3. Format the final WhatsApp message
    const message = formatWhatsAppMessage(aiText, {
      activeLeads: ctx.activeLeads,
      wonCount: ctx.wonCount,
      wonValue: ctx.wonValue,
      overdueTaskCount: ctx.overdueTaskCount,
    })

    // 4. Log to ai_suggestions regardless of send outcome
    await supabase.from("ai_suggestions").insert({
      type: "daily_summary",
      lead_id: null,
      content: {
        message,
        ai_text: aiText,
        stats: {
          activeLeads: ctx.activeLeads,
          wonCount: ctx.wonCount,
          wonValue: ctx.wonValue,
          overdueTaskCount: ctx.overdueTaskCount,
          newLeadsYesterday: ctx.newLeadsYesterday,
        },
        sent_to: targetPhone,
        dry_run: Boolean(options.dryRun),
      },
    })

    // 5. Send via Whapi unless dry run or caller wants to send it themselves
    if (options.dryRun) {
      await updateLastSent(supabase, targetPhone, true)
      return {
        success: true,
        message_preview: message,
        sent_to: targetPhone,
        dry_run: true,
      }
    }

    if (!targetPhone) {
      return {
        success: false,
        message_preview: message,
        sent_to: null,
        error: "No target phone number configured",
      }
    }

    if (options.skipSend) {
      // Caller (route.ts) will send; we return the prepared message and phone.
      return {
        success: true,
        message_preview: message,
        sent_to: targetPhone,
      }
    }

    const sendResult = await sendViaWhapi(targetPhone, message)
    if (!sendResult.ok) {
      return {
        success: false,
        message_preview: message,
        sent_to: targetPhone,
        error: sendResult.error,
      }
    }

    await updateLastSent(supabase, targetPhone, false)

    return {
      success: true,
      message_preview: message,
      sent_to: targetPhone,
    }
  } catch (err) {
    return {
      success: false,
      message_preview: "",
      sent_to: targetPhone,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

async function updateLastSent(
  supabase: SupabaseClient,
  phone: string | null,
  dryRun: boolean
) {
  await supabase
    .from("admin_settings")
    .upsert({
      key: "daily_summary_last_sent",
      value: {
        sent_at: new Date().toISOString(),
        phone_number: phone,
        dry_run: dryRun,
      },
      updated_at: new Date().toISOString(),
    })
}
