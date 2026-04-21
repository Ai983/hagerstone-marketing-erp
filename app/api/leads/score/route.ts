import { NextRequest, NextResponse } from "next/server"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { scoreLead } from "@/lib/utils/lead-scoring"

export async function POST(request: NextRequest) {
  const supabase = await createUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const leadId = body?.lead_id as string | undefined
  if (!leadId) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
  }

  // Fetch lead with stage slug
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, email, company_name, city, service_line, whatsapp_opted_in, estimated_budget, source, stage:stage_id(slug)"
    )
    .eq("id", leadId)
    .maybeSingle()

  if (leadError || !lead) {
    return NextResponse.json({ error: leadError?.message || "Lead not found" }, { status: 404 })
  }

  // Count interactions in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from("interactions")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .gte("created_at", thirtyDaysAgo)

  const stage = Array.isArray(lead.stage) ? lead.stage[0] : lead.stage
  const result = scoreLead(
    {
      email: lead.email,
      company_name: lead.company_name,
      city: lead.city,
      service_line: lead.service_line,
      whatsapp_opted_in: lead.whatsapp_opted_in,
      estimated_budget: lead.estimated_budget,
      source: lead.source,
      stage_slug: (stage as { slug?: string } | null)?.slug ?? null,
    },
    count ?? 0
  )

  // Persist the score
  const { error: updateError } = await supabase
    .from("leads")
    .update({ score: result.total })
    .eq("id", leadId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    lead_id: leadId,
    score: result.total,
    label: result.label,
    breakdown: {
      budget: result.budget,
      source: result.source,
      profile: result.profile,
      activity: result.activity,
      stage: result.stage,
      total: result.total,
    },
  })
}
