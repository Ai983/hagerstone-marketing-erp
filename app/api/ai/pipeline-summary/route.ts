import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { callClaudeJSON, ClaudeError } from "@/lib/utils/claude"

interface PipelineSummary {
  summary: string
  hot_lead_ids: string[]
  stale_alerts: string[]
  top_recommendation: string
  pipeline_health: "good" | "warning" | "critical"
}

const SYSTEM_PROMPT = `You are a sales analyst for Hagerstone International, an interior design and build firm in Noida, India. Analyze the pipeline data and give a concise, actionable summary.

Focus on:
- Overall pipeline health (good / warning / critical)
- Top 3 leads that need attention today (return their UUIDs exactly as provided)
- Stage concentration issues ("too many leads stuck in X")
- One specific, actionable recommendation the manager should prioritize today

Be direct and use Indian business context (rupees, lakhs, crores, NCR cities). No corporate fluff.

Return ONLY valid JSON, no markdown, no preamble:
{
  "summary": string,
  "hot_lead_ids": string[],
  "stale_alerts": string[],
  "top_recommendation": string,
  "pipeline_health": "good"|"warning"|"critical"
}`

export async function POST(request: NextRequest) {
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const force = Boolean(body?.force)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 })
  }
  const supabase = createServiceClient(url, serviceKey)

  // 1. Cache check (30 mins)
  if (!force) {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: cached } = await supabase
      .from("ai_suggestions")
      .select("content, generated_at")
      .is("lead_id", null)
      .eq("type", "pipeline_summary")
      .gte("generated_at", cutoff)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached?.content) {
      return NextResponse.json({
        ...(cached.content as PipelineSummary),
        cached: true,
        generated_at: cached.generated_at,
      })
    }
  }

  // 2. Fetch pipeline data
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [overviewRes, staleLeadsRes, overdueTasksRes, wonRes, lostRes] = await Promise.all([
    supabase.from("pipeline_overview").select("*").order("stage_position"),
    supabase
      .from("leads")
      .select(
        "id, full_name, company_name, score, stage:stage_id(name, slug, stage_type), updated_at"
      )
      .order("score", { ascending: false })
      .limit(20),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_overdue", true)
      .is("completed_at", null),
    supabase
      .from("leads")
      .select("closure_value, stage:stage_id(slug)")
      .gte("closed_at", startOfMonth),
    supabase
      .from("leads")
      .select("id, stage:stage_id(slug)")
      .gte("closed_at", startOfMonth),
  ])

  // Filter: leads with score > 40, stage is active, and no interaction in 7+ days
  const topLeadIds = (staleLeadsRes.data ?? [])
    .filter((l) => {
      const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
      const stageType = (stage as { stage_type?: string } | null)?.stage_type
      return (
        stageType === "active" &&
        (l.score ?? 0) >= 40 &&
        new Date(l.updated_at).getTime() < new Date(sevenDaysAgo).getTime()
      )
    })
    .slice(0, 5)

  // Compute won totals
  const won = (wonRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return (stage as { slug?: string } | null)?.slug === "won"
  })
  const wonValue = won.reduce((sum, l) => sum + (l.closure_value ?? 0), 0)

  const lost = (lostRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return (stage as { slug?: string } | null)?.slug === "lost"
  })

  // 3. Build user message
  const overviewText = (overviewRes.data ?? [])
    .map((s) => `- ${s.stage_name}: ${s.lead_count} leads`)
    .join("\n")

  const topLeadsText =
    topLeadIds.length === 0
      ? "No stale high-score leads."
      : topLeadIds
          .map((l) => {
            const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
            const stageName = (stage as { name?: string } | null)?.name ?? "?"
            return `- ${l.id} | ${l.full_name} (${l.company_name ?? "no company"}) | score ${l.score} | stage ${stageName}`
          })
          .join("\n")

  const userMessage = [
    "PIPELINE STAGE COUNTS:",
    overviewText || "(no stages)",
    "",
    "HIGH-SCORE LEADS STALE 7+ DAYS (id | name | score | stage):",
    topLeadsText,
    "",
    `OVERDUE TASKS: ${overdueTasksRes.count ?? 0}`,
    `WON THIS MONTH: ${won.length} deals, ₹${wonValue.toLocaleString("en-IN")} total`,
    `LOST THIS MONTH: ${lost.length} deals`,
  ].join("\n")

  try {
    const { data: summary } = await callClaudeJSON<PipelineSummary>({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 1000,
      temperature: 0.3,
    })

    if (!summary.summary || !summary.pipeline_health) {
      throw new ClaudeError("Claude returned an incomplete summary", 502)
    }

    await supabase.from("ai_suggestions").insert({
      type: "pipeline_summary",
      lead_id: null,
      content: summary,
    })

    return NextResponse.json({
      ...summary,
      cached: false,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    if (err instanceof ClaudeError) {
      return NextResponse.json(
        { error: "AI service unavailable" },
        { status: err.status }
      )
    }
    return NextResponse.json({ error: "Unable to generate summary" }, { status: 500 })
  }
}
