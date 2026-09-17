import { NextRequest, NextResponse } from "next/server"

import { createClient as createUserClient } from "@/lib/supabase/server"
import { callClaudeJSON, ClaudeError } from "@/lib/utils/claude"

interface GeneratedPitch {
  title: string
  body: string
}

const AUDIENCES: Record<string, string> = {
  architect: "an architect or interior design consultant who could recommend Hagerstone to their clients for execution",
  corporate: "a corporate client — admin, facilities, procurement head or CXO — planning an office fit-out",
  pmc: "a project management consultant (PMC) or cost consultant evaluating contractors for a client",
  developer: "a real-estate developer or landlord building out commercial space",
  general: "a first-time prospect who does not know Hagerstone yet",
}

const FORMATS: Record<string, string> = {
  whatsapp: "a WhatsApp message, under 120 words, plain text, no headings, at most one emoji",
  email: "an email: first line 'Subject: …', then a short body of 150–220 words with a clear ask at the end",
  talking_points: "meeting talking points: 6–9 short bullet points in the order they should be said, ending with the question to ask",
  one_pager: "a one-page pitch of 300–450 words with short headed sections: Who we are, What we do, Why it matters to you, How we work, Next step",
  call_script: "a phone call opener: a 20-second introduction, 3 discovery questions, and a one-line close asking for a meeting",
}

const SERVICE_LINES: Record<string, string> = {
  all: "all Hagerstone services",
  office_interiors: "office interiors (design and build fit-outs)",
  mep: "MEP — mechanical, electrical and plumbing services",
  facade_glazing: "facade and glazing",
  peb_construction: "PEB (pre-engineered building) construction",
  civil_works: "civil works",
  multiple: "a combined interiors + MEP + civil scope",
}

// Brand rules come from the company's brand-core rulebook: the facts bank is
// not ratified yet, so the pitch must not contain any figures or client names
// — it marks the gap so Manpreet sir fills in only what he can stand behind.
const SYSTEM_PROMPT = `You write sales pitches for Hagerstone International, a design-and-build company based in Noida (Delhi NCR), India.

What Hagerstone does: office interiors and fit-outs, MEP (mechanical, electrical, plumbing), facade and glazing, PEB construction and civil works, delivered as one accountable team from design through handover. The buyer's real worry is a project that runs late or over budget while they referee several vendors; Hagerstone's case is execution certainty — one team, MEP handled in-house so services and ceilings are coordinated, and site progress that can be shown, not just renders.

STRICT RULES — these protect the company in front of procurement heads. They apply even when the salesperson's notes contain numbers or client names:
1. Do NOT write any number about the company: no years in business, square feet, project counts, client counts, cities, team size, savings or revenue. Where a number would help, write a bracketed gap WITHOUT any figure inside, e.g. [ADD: number of projects completed — confirmed figure only]. Never copy a figure from the notes into the text or into the brackets.
2. Do NOT name any client, brand or company Hagerstone has worked for — not even if the notes name one. Write [ADD: client example — only with written permission] instead.
3. Only claim what is stated above. Do not invent facts about team composition, certifications, awards, subcontracting, warranties, timelines, guarantees or processes. If a claim would need proof, leave it out.
4. No superlatives or clichés: never "world-class", "state-of-the-art", "one-stop solution", "best-in-class", "leading", "unmatched", "revolutionary", "passionate", "No. 1", "top".
5. Plain, specific, confident, never pushy. No urgency theatre, no stacked exclamation marks.
6. Indian business English (lakhs/crores, NCR, site visit). Write as the salesperson, first person plural ("we").
7. Placeholders for the person's name / firm are fine: [Name], [Firm], [Your name].
8. Plain text only — no markdown, no ** or #. For section headings use a short line ending with a colon.

Return ONLY valid JSON, no markdown fences:
{ "title": string (short, e.g. "Architect intro — WhatsApp"), "body": string (the full pitch; use \\n for new lines) }`

export async function POST(request: NextRequest) {
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Only active ERP members (RLS returns no row otherwise).
  const { data: profile } = await userClient
    .from("profiles")
    .select("id, is_active, full_name")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.is_active) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const audience = String(body?.audience ?? "general")
  const format = String(body?.format ?? "one_pager")
  const serviceLine = String(body?.service_line ?? "all")
  const notes = String(body?.notes ?? "").trim().slice(0, 1500)
  const current = String(body?.current ?? "").trim().slice(0, 6000)

  if (!AUDIENCES[audience] || !FORMATS[format] || !SERVICE_LINES[serviceLine]) {
    return NextResponse.json({ error: "Unknown audience, format or service line" }, { status: 400 })
  }

  const userMessage = [
    `Write ${FORMATS[format]}.`,
    `Audience: ${AUDIENCES[audience]}.`,
    `Focus: ${SERVICE_LINES[serviceLine]}.`,
    notes ? `Points the salesperson wants included (use them, but still follow the rules — turn any unconfirmed number or client name into a placeholder):\n${notes}` : "",
    current ? `Improve this existing draft rather than starting over:\n"""\n${current}\n"""` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  try {
    const { data } = await callClaudeJSON<GeneratedPitch>({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 1500,
      temperature: 0.7,
    })
    if (!data?.body?.trim()) throw new ClaudeError("Empty pitch", 502)
    return NextResponse.json({
      title: data.title?.trim() || "Sales pitch",
      body: data.body.replace(/\\n/g, "\n").trim(),
    })
  } catch (err) {
    if (err instanceof ClaudeError) {
      return NextResponse.json({ error: "AI service unavailable — try again" }, { status: err.status || 502 })
    }
    return NextResponse.json({ error: "Could not write the pitch" }, { status: 500 })
  }
}
