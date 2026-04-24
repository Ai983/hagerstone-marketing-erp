import { NextResponse } from "next/server"

import { createClient as createUserClient } from "@/lib/supabase/server"
import { CLAUDE_MODEL } from "@/lib/utils/claude"

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

Return ONLY valid JSON, no markdown, no preamble. Shape:
{
  "leads": [
    {
      "company_name": "Actual company name",
      "contact_name": "Decision maker name if found, else null",
      "phone": "Phone number if found, else null",
      "email": "Email if found, else null",
      "website": "Company website if found, else null",
      "city": "City name",
      "industry": "Industry type",
      "service_line": "office_interiors|mep|facade_glazing|peb_construction|civil_works|multiple",
      "company_size": "estimated employee count range",
      "estimated_budget": "<25L|25L-50L|50L-1Cr|1Cr-2Cr|2Cr+",
      "score": 0-100,
      "ai_insight": "1-2 sentence explanation of why this company needs Hagerstone services right now",
      "source_url": "URL where this info was found"
    }
  ]
}

Rules:
- Return ONLY real companies found via web search. Do NOT invent companies.
- Return 6-10 leads per request.
- Prioritize companies showing signals of growth, relocation, renovation, or new office opening.
- Score higher if: large company, Delhi NCR location, recent growth signals, matches service line exactly.`

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
    try {
      const parsed = JSON.parse(cleaned) as { leads?: unknown[] }
      return NextResponse.json({ leads: parsed.leads ?? [] })
    } catch {
      // Last-resort: try extracting the first { ... } block
      const firstBrace = cleaned.indexOf("{")
      const lastBrace = cleaned.lastIndexOf("}")
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
          const parsed = JSON.parse(
            cleaned.slice(firstBrace, lastBrace + 1)
          ) as { leads?: unknown[] }
          return NextResponse.json({ leads: parsed.leads ?? [] })
        } catch {
          /* fall through */
        }
      }
      console.error("generate-leads: failed to parse AI response as JSON")
      return NextResponse.json(
        { leads: [], error: "Failed to parse AI response as JSON" },
        { status: 200 }
      )
    }
  } catch (err) {
    console.error("generate-leads error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
