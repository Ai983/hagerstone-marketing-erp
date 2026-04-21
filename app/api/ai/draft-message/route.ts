import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { callClaudeJSON, ClaudeError } from "@/lib/utils/claude"

interface DraftMessage {
  message: string
  tone: string
  suggested_follow_up_days: number
}

const SYSTEM_PROMPT = `You are a WhatsApp sales assistant for Hagerstone International, an interior design and build firm in Noida, India. Write natural, conversational WhatsApp messages in English that an Indian sales rep would actually send. Keep messages under 150 words. Be warm but professional. Use Indian business context (Rs/lakhs/crores, Noida/NCR, site visits, etc.). Avoid corporate jargon and emoji overload — one or two emojis max, only where natural.

Return ONLY valid JSON, no markdown, no preamble:
{ "message": string, "tone": string, "suggested_follow_up_days": number }`

export async function POST(request: NextRequest) {
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const leadId = body?.lead_id as string | undefined
  const context = (body?.context as string | undefined)?.trim()

  if (!leadId) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 })
  }
  const supabase = createServiceClient(url, serviceKey)

  // Fetch lead + last 3 interactions
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, full_name, company_name, service_line, estimated_budget, stage:stage_id(name)"
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
    .limit(3)

  const stage = Array.isArray(lead.stage) ? lead.stage[0] : lead.stage
  const stageName = (stage as { name?: string } | null)?.name ?? "Unknown"

  const lastInteractionText =
    (interactions ?? []).length === 0
      ? "No prior interactions."
      : (interactions ?? [])
          .map((i) => {
            const when = new Date(i.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })
            const out = i.outcome ? ` (${i.outcome})` : ""
            const notes = i.notes ? ` — ${i.notes}` : ""
            return `[${when}] ${i.type}${out}${notes}`
          })
          .join("\n")

  const userMessage = [
    `Draft a follow-up WhatsApp message to this lead.`,
    "",
    `Lead: ${lead.full_name}`,
    `Company: ${lead.company_name ?? "—"}`,
    `Service interest: ${lead.service_line ?? "—"}`,
    `Budget: ${lead.estimated_budget ?? "—"}`,
    `Current stage: ${stageName}`,
    "",
    `Recent interactions:\n${lastInteractionText}`,
    context ? `\nAdditional context from the rep: ${context}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  try {
    const { data: draft } = await callClaudeJSON<DraftMessage>({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 500,
      temperature: 0.6,
    })

    if (!draft.message || !draft.tone) {
      throw new ClaudeError("Claude returned an incomplete draft", 502)
    }

    // Log (but don't cache — drafts are always fresh)
    await supabase.from("ai_suggestions").insert({
      type: "draft_message",
      lead_id: leadId,
      content: draft,
    })

    return NextResponse.json(draft)
  } catch (err) {
    if (err instanceof ClaudeError) {
      return NextResponse.json(
        { error: "AI service unavailable" },
        { status: err.status }
      )
    }
    return NextResponse.json({ error: "Unable to draft message" }, { status: 500 })
  }
}
