import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import type { FeedbackReview } from "@/lib/types"
import { callClaudeJSON, ClaudeError } from "@/lib/utils/claude"
import { OBJECTIONS, objectionLabel } from "@/lib/utils/objections"

/**
 * The playbook's Step 7 review: "What did you learn from your last lost
 * deals? Which objection do you hear again and again?" Reads the last 90
 * days of losses, objections and win stories, asks Claude for patterns
 * and fixes, and saves the result to marketing.ai_reviews.
 *
 * GET  → the latest saved review
 * POST → generate a new one
 */

const PERIOD_DAYS = 90

const SYSTEM_PROMPT = `You review the sales results of Hagerstone International, a B2B interior design-and-build firm in Noida, India (office interiors, MEP, facade, PEB, civil works; projects roughly ₹25L to ₹2Cr+). One salesperson works the pipeline.

You get the last ${PERIOD_DAYS} days of: deals lost (with reasons and competitors), objections clients raised on calls and meetings (with the salesperson's notes), and short "why they bought" answers from won deals.

Find what the team should learn and fix. Rules:
- Use ONLY the data given. Never invent clients, numbers, percentages or facts about Hagerstone.
- Say how strong each pattern is ("3 of 5 losses…"). If something rests on one or two data points, say so.
- Actions must be concrete and doable in 1–3 weeks by this team: a message to test, a resource to create, a pitch change, a process fix. Owner is "sales", "marketing" or "founder". When something fails, fix the process — never blame a person.
- pitch_lines: short things the salesperson can actually say, grounded in the win stories. No statistics or claims that are not in the data. Empty array if there are no win stories.
- If the data is thin, say that plainly in data_note and keep lists short rather than padding them.

objection_key must be one of: ${OBJECTIONS.map((o) => o.key).join(", ")} — or null.

Return ONLY valid JSON, no markdown:
{
  "headline": string,
  "patterns": [{ "title": string, "detail": string, "evidence": string }],
  "why_clients_buy": [string],
  "pitch_lines": [string],
  "actions": [{ "heard": string, "objection_key": string|null, "meaning": string, "action": string, "owner": "sales"|"marketing"|"founder", "due_in_days": number }],
  "data_note": string
}
At most 5 patterns, 4 why_clients_buy, 3 pitch_lines, 5 actions.`

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { db: { schema: "marketing" } })
}

async function requireUser() {
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = serviceClient()
  if (!supabase) return NextResponse.json({ error: "Service role not configured" }, { status: 503 })

  const { data, error } = await supabase
    .from("ai_reviews")
    .select("id, period_start, period_end, content, created_at, creator:created_by(full_name)")
    .eq("kind", "feedback_review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ review: data ?? null })
}

const clip = (s: string | null | undefined, n = 240) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

export async function POST() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = serviceClient()
  if (!supabase) return NextResponse.json({ error: "Service role not configured" }, { status: 503 })

  const end = new Date()
  const start = new Date(end.getTime() - PERIOD_DAYS * 24 * 60 * 60 * 1000)
  const since = start.toISOString()

  const [lostRes, objectionsRes, winsRes, openActionsRes] = await Promise.all([
    supabase
      .from("leads")
      .select("company_name, full_name, service_line, estimated_budget, closure_reason, lost_to_competitor, closed_at, stage:stage_id(stage_type)")
      .eq("is_archived", false)
      .gte("closed_at", since)
      .not("closure_reason", "is", null)
      .limit(60),
    supabase
      .from("interactions")
      .select("type, outcome, objections, notes, created_at, lead:lead_id(company_name, full_name, service_line)")
      .not("objections", "eq", "{}")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(80),
    // Win stories are rare — use every one on record, not just this period.
    supabase
      .from("leads")
      .select("company_name, full_name, service_line, final_agreed_price, closure_value, win_trigger, win_why_us, win_worry")
      .or("win_trigger.not.is.null,win_why_us.not.is.null,win_worry.not.is.null")
      .limit(40),
    supabase.from("feedback_actions").select("heard, action").eq("status", "open").limit(30),
  ])

  const firstError = lostRes.error || objectionsRes.error || winsRes.error || openActionsRes.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  const lost = (lostRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return (stage as { stage_type?: string } | null)?.stage_type === "lost"
  })
  const objections = objectionsRes.data ?? []
  const wins = winsRes.data ?? []

  if (lost.length + objections.length + wins.length < 3) {
    return NextResponse.json(
      {
        error: `Not enough to review yet — ${lost.length} lost deals, ${objections.length} calls/meetings with objections and ${wins.length} win stories in the last ${PERIOD_DAYS} days. Log objections, mark lost deals Lost with a reason, and capture why won deals bought; then run the review.`,
      },
      { status: 422 }
    )
  }

  const counts = new Map<string, number>()
  for (const o of objections) for (const k of (o.objections ?? []) as string[]) counts.set(k, (counts.get(k) ?? 0) + 1)

  const userMessage = [
    `PERIOD: ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
    "",
    `LOST DEALS (${lost.length}):`,
    ...lost.map(
      (l) =>
        `- ${l.company_name || l.full_name} | ${l.service_line ?? "?"} | budget ${l.estimated_budget ?? "?"} | reason: ${l.closure_reason}${l.lost_to_competitor ? ` | lost to ${l.lost_to_competitor}` : ""}`
    ),
    "",
    `OBJECTION COUNTS: ${Array.from(counts.entries()).map(([k, n]) => `${objectionLabel(k)} (${k}) ×${n}`).join("; ") || "none"}`,
    "",
    `CALLS/MEETINGS WITH OBJECTIONS (${objections.length}, newest first):`,
    ...objections.map((o) => {
      const lead = (Array.isArray(o.lead) ? o.lead[0] : o.lead) as { company_name?: string; full_name?: string } | null
      return `- ${o.type}${o.outcome ? ` (${o.outcome})` : ""} | ${lead?.company_name || lead?.full_name || "?"} | ${((o.objections ?? []) as string[]).join(", ")} | notes: ${clip(o.notes)}`
    }),
    "",
    `WIN STORIES (${wins.length}):`,
    ...wins.map(
      (w) =>
        `- ${w.company_name || w.full_name} | ${w.service_line ?? "?"} | started: ${clip(w.win_trigger, 160) || "?"} | why us: ${clip(w.win_why_us, 160) || "?"} | worried about: ${clip(w.win_worry, 160) || "?"}`
    ),
    "",
    `ACTIONS ALREADY OPEN ON THE BOARD (don't repeat these): ${(openActionsRes.data ?? []).map((a) => `"${a.heard}" → ${a.action}`).join("; ") || "none"}`,
  ].join("\n")

  try {
    const { data } = await callClaudeJSON<FeedbackReview>({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 2000,
      temperature: 0.3,
    })

    const validKeys = new Set<string>(OBJECTIONS.map((o) => o.key))
    const review: FeedbackReview = {
      headline: data.headline ?? "",
      patterns: (data.patterns ?? []).slice(0, 5),
      why_clients_buy: (data.why_clients_buy ?? []).slice(0, 4),
      pitch_lines: (data.pitch_lines ?? []).slice(0, 3),
      actions: (data.actions ?? []).slice(0, 5).map((a) => ({
        ...a,
        objection_key: a.objection_key && validKeys.has(a.objection_key) ? a.objection_key : null,
        owner: (["sales", "marketing", "founder"] as const).includes(a.owner) ? a.owner : "sales",
        due_in_days: Math.min(Math.max(Math.round(Number(a.due_in_days) || 14), 1), 60),
      })),
      data_note: data.data_note ?? "",
    }

    const { data: saved, error } = await supabase
      .from("ai_reviews")
      .insert({
        kind: "feedback_review",
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
        content: review,
        created_by: user.id,
      })
      .select("id, period_start, period_end, content, created_at")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ review: saved })
  } catch (err) {
    const status = err instanceof ClaudeError ? err.status : 500
    return NextResponse.json({ error: err instanceof Error ? err.message : "Review failed" }, { status })
  }
}
