import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { callClaudeJSON, ClaudeError } from "@/lib/utils/claude"

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_CATEGORIES = [
  "office_interiors",
  "mep",
  "facade_glazing",
  "peb_construction",
  "civil_works",
  "hospitality",
] as const

type CategoriseResult = {
  categories: string[]
  primary: string
  reason: string
  confidence: string
}

const SYSTEM_PROMPT = `You are a B2B sales analyst for Hagerstone International,
an interior design and build firm in Noida, India.

Hagerstone offers these services:
- office_interiors: Office fitout, workspace design, turnkey interiors
- mep: Mechanical, Electrical, Plumbing for commercial spaces
- facade_glazing: Curtain wall, ACP cladding, structural glazing
- peb_construction: Pre-engineered buildings, warehouses, factories
- civil_works: RCC structure, renovation, ground-up construction
- hospitality: Hotels, restaurants, resorts, club lounges

Rules:
- Always assign at least 1 category, maximum 3
- First category in the array is the PRIMARY (most likely)
- If service_line is clearly one of the above, that is primary
- Consider company type: IT firm = office_interiors, factory = peb_construction,
  hotel chain = hospitality, real estate developer = multiple categories
- confidence: "high" if service_line matches clearly, "medium" if inferred,
  "low" if genuinely unclear

Return ONLY valid JSON, no explanation, no markdown:
{
  "categories": ["category1", "category2"],
  "primary": "category1",
  "reason": "One sentence explaining the assignment",
  "confidence": "high" | "medium" | "low"
}`

export async function POST(req: NextRequest) {
  try {
    const { lead_id } = (await req.json()) as { lead_id?: string }
    if (!lead_id) {
      return NextResponse.json({ error: "lead_id required" }, { status: 400 })
    }

    const { data: lead, error: leadError } = await serviceClient
      .from("leads")
      .select(
        `id, full_name, company_name, city, service_line,
         estimated_budget, source, initial_notes,
         profile_categories, profile_category_primary`
      )
      .eq("id", lead_id)
      .single()

    if (leadError) console.error("Lead fetch error:", leadError)

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const { data: interactions } = await serviceClient
      .from("interactions")
      .select("type, notes, outcome, created_at")
      .eq("lead_id", lead_id)
      .order("created_at", { ascending: false })
      .limit(5)

    const interactionSummary =
      interactions
        ?.map(
          (i) =>
            `${i.type}: ${i.notes || ""} ${
              i.outcome ? "(outcome: " + i.outcome + ")" : ""
            }`
        )
        .join("\n") || "No interactions yet"

    const userMessage = `Lead Data:
- Company: ${lead.company_name || "Unknown"}
- Service Line (self-reported): ${lead.service_line || "Not specified"}
- City: ${lead.city || "Unknown"}
- Estimated Budget: ${lead.estimated_budget || "Not specified"}
- Source: ${lead.source || "Unknown"}
- Notes: ${lead.initial_notes || "None"}

Recent Interactions:
${interactionSummary}

Assign 1-3 profile categories using the rules above.`

    const { data: result } = await callClaudeJSON<CategoriseResult>({
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 300,
      temperature: 0.2,
    })

    if (!Array.isArray(result.categories)) {
      throw new Error("Claude response missing 'categories' array")
    }

    const validCategories = result.categories.filter((c): c is string =>
      (VALID_CATEGORIES as readonly string[]).includes(c)
    )
    if (validCategories.length === 0) {
      throw new Error("No valid categories returned")
    }

    const primary =
      result.primary && validCategories.includes(result.primary)
        ? result.primary
        : validCategories[0]

    const { error: updateError } = await serviceClient
      .from("leads")
      .update({
        profile_categories: validCategories,
        profile_category_primary: primary,
        profile_category_reason: result.reason,
        profile_category_confidence: result.confidence,
        profile_categorised_at: new Date().toISOString(),
      })
      .eq("id", lead_id)

    if (updateError) {
      throw new Error("Failed to save categories: " + updateError.message)
    }

    // Auto-enrollment: find matching campaigns
    try {
      const { data: matchingCampaigns } = await serviceClient
        .from("campaigns")
        .select("id, name, target_profile_category")
        .eq("auto_enroll_enabled", true)
        .eq("status", "active")
        .in("target_profile_category", validCategories)

      if (matchingCampaigns && matchingCampaigns.length > 0) {
        for (const campaign of matchingCampaigns) {
          // Check if already enrolled
          const { data: existing } = await serviceClient
            .from("campaign_enrollments")
            .select("id")
            .eq("lead_id", lead_id)
            .eq("campaign_id", campaign.id)
            .single()

          if (!existing) {
            // Enroll the lead
            await serviceClient.from("campaign_enrollments").insert({
              lead_id,
              campaign_id: campaign.id,
              status: "active",
              current_message_position: 0,
              next_message_due_at: new Date().toISOString(),
              enrolled_at: new Date().toISOString(),
            })

            // Log the auto-enrollment
            await serviceClient.from("interactions").insert({
              lead_id,
              type: "note",
              notes: `Auto-enrolled in campaign "${campaign.name}" based on AI profile category: ${campaign.target_profile_category}`,
              is_automated: true,
            })
          }
        }
      }
    } catch (enrollError) {
      // Never break categorisation if auto-enrollment fails
      console.error("Auto-enrollment error:", enrollError)
    }

    await serviceClient.from("interactions").insert({
      lead_id,
      type: "note",
      notes: `AI Profile Categorisation: ${validCategories.join(", ")} (${
        result.confidence
      } confidence). Reason: ${result.reason}`,
      is_automated: true,
    })

    return NextResponse.json({
      success: true,
      categories: validCategories,
      primary,
      reason: result.reason,
      confidence: result.confidence,
    })
  } catch (error: unknown) {
    console.error("Categorise lead error:", error)
    const status = error instanceof ClaudeError ? error.status : 500
    const message =
      error instanceof Error ? error.message : "Categorisation failed"
    return NextResponse.json({ error: message }, { status })
  }
}
