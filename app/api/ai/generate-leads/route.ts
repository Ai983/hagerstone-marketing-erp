import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

import { createClient as createUserClient } from "@/lib/supabase/server"
import { CLAUDE_MODEL } from "@/lib/utils/claude"

// Strip Claude's web-search citation markup before persisting/returning.
function cleanText(text: string): string {
  return text
    .replace(/<cite[^>]*>/gi, "")
    .replace(/<\/cite>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

interface RawLead {
  company_name?: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  linkedin_url?: string | null
  city?: string | null
  industry?: string | null
  service_line?: string | null
  company_size?: string | null
  estimated_budget?: string | null
  score?: number | null
  ai_insight?: string | null
  source_url?: string | null
}

// Web search is a server-side tool — Claude runs the searches itself
// and returns a final assistant message that mixes text blocks with
// web_search_tool_result blocks. We only want the text.

const ALLOWED_ROLES = new Set(["admin", "manager", "founder", "marketing"])

const SYSTEM_PROMPT = `You are a B2B lead research specialist for Hagerstone International, an ISO-certified interior design and build firm in Noida, Delhi NCR, India. They offer:
- Office interior fit-out and design
- MEP (Mechanical, Electrical, Plumbing) works
- Facade and glazing solutions
- PEB (Pre-Engineered Building) construction
- Civil construction works

Your job is to find REAL companies that would genuinely need these services. Use the web_search tool to find actual businesses matching the criteria.

Return a JSON object with key 'leads' containing an array. Each lead MUST follow this exact structure:
{
  "company_name": "Company Name",
  "contact_name": "Decision maker full name or null",
  "phone": "Phone number with country code or null",
  "email": "official email address or null",
  "website": "https://companywebsite.com or null",
  "linkedin_url": "https://linkedin.com/company/... or null",
  "city": "City name",
  "industry": "Industry type",
  "service_line": "office_interiors OR mep OR facade_glazing OR peb_construction OR civil_works OR multiple",
  "company_size": "e.g. 100-500",
  "estimated_budget": "<25L OR 25L-50L OR 50L-1Cr OR 1Cr-2Cr OR 2Cr+",
  "score": "number between 0-100",
  "ai_insight": "2-3 sentences plain text only. Absolutely NO HTML, NO <cite> tags, NO XML tags.",
  "source_url": "URL where this info was found"
}

IMPORTANT: ai_insight must be plain text only — no tags of any kind.

Return ONLY valid JSON, no markdown, no preamble.

Rules:
- Return ONLY real companies found via web search. Do NOT invent companies.
- Return 6-10 leads per request.
- Prioritize companies showing signals of growth, relocation, renovation, or new office opening.
- Score higher if: large company, Delhi NCR location, recent growth signals, matches service line exactly.

CRITICAL REQUIREMENT:
Only return companies where you have found AT LEAST ONE of:
- A real phone number
- A real email address
- A LinkedIn company page URL

If you cannot find any contact info for a company, DO NOT include it in results.
Return 4-5 leads with contact info rather than 10 leads with no contact info.
Quality over quantity.`

export async function POST(request: Request) {
  try {
    const supabase = await createUserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    const role = profile?.role as string | undefined
    if (!role || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string
      city?: string
      serviceLine?: string
      companySize?: string
    }
    const prompt = (body.prompt ?? "").trim()
    if (prompt.length < 10) {
      return NextResponse.json(
        { error: "Please describe the leads you want (min 10 characters)" },
        { status: 400 }
      )
    }

    const userMessage = [
      `Find leads matching this criteria:`,
      prompt,
      body.city ? `City preference: ${body.city}` : null,
      body.serviceLine ? `Service needed: ${body.serviceLine}` : null,
      body.companySize ? `Company size: ${body.companySize} employees` : null,
      `\nSearch the web for real companies and return JSON only.`,
    ]
      .filter(Boolean)
      .join("\n")

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    })

    const raw = (await res.json().catch(() => null)) as {
      error?: { message?: string }
      content?: Array<{ type: string; text?: string }>
    } | null

    if (!res.ok) {
      const message =
        raw?.error?.message ?? `Anthropic API returned ${res.status}`
      console.error("generate-leads Anthropic error:", message)
      return NextResponse.json({ error: message }, { status: res.status })
    }

    // Concatenate only text blocks — ignore web_search_tool_result /
    // server_tool_use / citation blocks that Claude mixes into content.
    const textContent = (raw?.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("")

    if (!textContent) {
      return NextResponse.json(
        { leads: [], error: "Claude returned no text content" },
        { status: 200 }
      )
    }

    const cleaned = textContent.replace(/```json|```/g, "").trim()
    let parsedLeads: RawLead[] = []
    try {
      const parsed = JSON.parse(cleaned) as { leads?: RawLead[] }
      parsedLeads = parsed.leads ?? []
    } catch {
      const firstBrace = cleaned.indexOf("{")
      const lastBrace = cleaned.lastIndexOf("}")
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
          const parsed = JSON.parse(
            cleaned.slice(firstBrace, lastBrace + 1)
          ) as { leads?: RawLead[] }
          parsedLeads = parsed.leads ?? []
        } catch {
          /* fall through */
        }
      }
      if (parsedLeads.length === 0) {
        console.error("generate-leads: failed to parse AI response as JSON")
        return NextResponse.json(
          { leads: [], error: "Failed to parse AI response as JSON" },
          { status: 200 }
        )
      }
    }

    // ── Filter to contactable leads BEFORE persisting ───────────
    // A lead is contactable if at least one of phone/email/linkedin
    // is present and non-empty. Non-contactable leads are not saved.
    const contactableLeads = parsedLeads.filter((lead) => {
      const phone = lead.phone?.trim() ?? ""
      const email = lead.email?.trim() ?? ""
      const linkedin = lead.linkedin_url?.trim() ?? ""
      return phone !== "" || email !== "" || linkedin !== ""
    })

    // ── Persist to ai_generated_leads via service role ──────────
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceUrl || !serviceKey) {
      console.warn("generate-leads: service role missing, skipping DB persist")
      return NextResponse.json({ leads: contactableLeads })
    }
    const admin = createServiceClient(serviceUrl, serviceKey)

    const enriched: Array<
      RawLead & {
        dbId: string | null
        isDuplicate: boolean
        existingLeadId: string | null
        isNew: boolean
      }
    > = []

    for (const lead of contactableLeads) {
      if (!lead.company_name) continue

      const cleanedInsight = cleanText(lead.ai_insight ?? "")
      const cityForCheck = lead.city?.trim() ?? ""

      // Step 1 — already in our AI database?
      const aiQuery = admin
        .from("ai_generated_leads")
        .select("id, status, pipeline_lead_id")
        .ilike("company_name", lead.company_name)
      const { data: existingAI } = cityForCheck
        ? await aiQuery.ilike("city", cityForCheck).limit(1).maybeSingle()
        : await aiQuery.limit(1).maybeSingle()

      if (existingAI) {
        enriched.push({
          ...lead,
          ai_insight: cleanedInsight,
          dbId: (existingAI as { id: string }).id,
          isDuplicate: true,
          existingLeadId:
            (existingAI as { pipeline_lead_id: string | null })
              .pipeline_lead_id ?? null,
          isNew: false,
        })
        continue
      }

      // Step 2 — already in pipeline (leads table)?
      const { data: existingPipeline } = await admin
        .from("leads")
        .select("id")
        .ilike("company_name", lead.company_name)
        .limit(1)
        .maybeSingle()

      const baseRow = {
        company_name: lead.company_name,
        contact_name: lead.contact_name ?? null,
        phone: lead.phone ?? null,
        email: lead.email ?? null,
        website: lead.website ?? null,
        linkedin_url: lead.linkedin_url ?? null,
        city: lead.city ?? null,
        industry: lead.industry ?? null,
        service_line: lead.service_line ?? null,
        company_size: lead.company_size ?? null,
        estimated_budget: lead.estimated_budget ?? null,
        score: typeof lead.score === "number" ? lead.score : 0,
        ai_insight: cleanedInsight,
        source_url: lead.source_url ?? null,
        search_query: prompt,
      }

      if (existingPipeline) {
        const { data: inserted, error: insErr } = await admin
          .from("ai_generated_leads")
          .insert({
            ...baseRow,
            status: "duplicate",
            pipeline_lead_id: (existingPipeline as { id: string }).id,
          })
          .select("id")
          .maybeSingle()
        if (insErr) console.error("ai_generated_leads insert (dup):", insErr)
        enriched.push({
          ...lead,
          ai_insight: cleanedInsight,
          dbId: (inserted as { id: string } | null)?.id ?? null,
          isDuplicate: true,
          existingLeadId: (existingPipeline as { id: string }).id,
          isNew: false,
        })
        continue
      }

      // Step 3 — net-new lead
      const { data: inserted, error: insErr } = await admin
        .from("ai_generated_leads")
        .insert({ ...baseRow, status: "new" })
        .select("id")
        .maybeSingle()
      if (insErr) console.error("ai_generated_leads insert (new):", insErr)

      enriched.push({
        ...lead,
        ai_insight: cleanedInsight,
        dbId: (inserted as { id: string } | null)?.id ?? null,
        isDuplicate: false,
        existingLeadId: null,
        isNew: true,
      })
    }

    // All `enriched` rows are guaranteed contactable because we
    // filtered before the persist loop.
    return NextResponse.json({ leads: enriched })
  } catch (err) {
    console.error("generate-leads error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
