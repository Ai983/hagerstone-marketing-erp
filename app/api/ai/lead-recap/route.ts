import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { callClaudeJSON, ClaudeError } from "@/lib/utils/claude"

interface LeadRecap {
  summary: string
  sentiment: "hot" | "warm" | "cold" | "dead"
  next_action: string
  message_angle: string
}

const SYSTEM_PROMPT = `You are a senior sales assistant at Hagerstone International, an ISO-certified interior design and build firm in Noida, India. Given a lead's profile and interaction history, provide:
1. A 2–3 sentence summary of the lead's current status and engagement.
2. Sentiment: one of "hot", "warm", "cold", or "dead".
3. The single most important next action the sales rep should take.
4. A suggested WhatsApp message angle (1–2 sentences, natural conversational tone — not the full message).

Return ONLY valid JSON, no markdown, no preamble:
{ "summary": string, "sentiment": "hot"|"warm"|"cold"|"dead", "next_action": string, "message_angle": string }`

export async function POST(request: NextRequest) {
  // Auth check
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const leadId = body?.lead_id as string | undefined
  const force = Boolean(body?.force)

  if (!leadId) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
  }

  // Need service role to read across leads and write to ai_suggestions bypassing RLS
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Service role not configured" },
      { status: 503 }
    )
  }
  const supabase = createServiceClient(url, serviceKey)

  // 1. Cache check: latest lead_recap within last hour
  if (!force) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: cached } = await supabase
      .from("ai_suggestions")
      .select("content, generated_at")
      .eq("lead_id", leadId)
      .eq("type", "lead_recap")
      .gte("generated_at", oneHourAgo)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached?.content) {
      return NextResponse.json({
        ...(cached.content as LeadRecap),
        cached: true,
        generated_at: cached.generated_at,
      })
    }
  }

  // 2. Fetch lead + recent interactions
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, full_name, company_name, city, service_line, estimated_budget, initial_notes, score, stage:stage_id(name, slug)"
    )
    .eq("id", leadId)
    .maybeSingle()

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  const { data: interactions } = await supabase
    .from("interactions")
    .select("type, title, notes, outcome, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(10)

  // 3. Build prompt
  const stage = Array.isArray(lead.stage) ? lead.stage[0] : lead.stage
  const stageName = (stage as { name?: string } | null)?.name ?? "Unknown"

  const historyText =
    (interactions ?? []).length === 0
      ? "No interactions logged yet."
      : (interactions ?? [])
          .map((i, idx) => {
            const when = new Date(i.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
            const parts = [
              `${idx + 1}. [${when}] ${i.type}`,
              i.title ? ` — ${i.title}` : "",
              i.outcome ? ` (outcome: ${i.outcome})` : "",
              i.notes ? `\n   Notes: ${i.notes}` : "",
            ]
            return parts.join("")
          })
          .join("\n")

  const userMessage = [
    `Lead name: ${lead.full_name}`,
    `Company: ${lead.company_name ?? "—"}`,
    `City: ${lead.city ?? "—"}`,
    `Service line: ${lead.service_line ?? "—"}`,
    `Estimated budget: ${lead.estimated_budget ?? "—"}`,
    `Current stage: ${stageName}`,
    `Lead score: ${lead.score ?? 0} / 100`,
    lead.initial_notes ? `Initial notes: ${lead.initial_notes}` : null,
    "",
    "Interaction history (most recent first):",
    historyText,
  ]
    .filter(Boolean)
    .join("\n")

  // 4. Call Claude
  try {
    const { data: recap } = await callClaudeJSON<LeadRecap>({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 1000,
      temperature: 0.4,
    })

    // Validate shape
    if (!recap.summary || !recap.sentiment || !recap.next_action || !recap.message_angle) {
      throw new ClaudeError("Claude returned an incomplete recap", 502)
    }

    // 5. Cache result
    await supabase.from("ai_suggestions").insert({
      type: "lead_recap",
      lead_id: leadId,
      content: recap,
    })

    return NextResponse.json({ ...recap, cached: false, generated_at: new Date().toISOString() })
  } catch (err) {
    if (err instanceof ClaudeError) {
      return NextResponse.json(
        { error: "AI service unavailable" },
        { status: err.status }
      )
    }
    return NextResponse.json({ error: "Unable to generate recap" }, { status: 500 })
  }
}
