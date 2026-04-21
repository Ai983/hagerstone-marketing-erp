import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { scoreLead } from "@/lib/utils/lead-scoring"

export async function POST() {
  const supabase = await createUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  const role = profile?.role
  if (role !== "admin" && role !== "manager") {
    return NextResponse.json(
      { error: "Only admins and managers can batch-score leads" },
      { status: 403 }
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json(
      { error: "Service role credentials not configured" },
      { status: 503 }
    )
  }

  const serviceClient = createServiceClient(url, key)

  // Fetch all leads with active stages (exclude terminal for the batch)
  const { data: leads, error: leadsError } = await serviceClient
    .from("leads")
    .select(
      "id, email, company_name, city, service_line, whatsapp_opted_in, estimated_budget, source, stage:stage_id(slug, stage_type)"
    )

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 500 })
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ scored: 0, average_score: 0 })
  }

  // Fetch interaction counts in bulk for the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: interactions } = await serviceClient
    .from("interactions")
    .select("lead_id")
    .gte("created_at", thirtyDaysAgo)

  const countByLead = new Map<string, number>()
  for (const i of interactions ?? []) {
    if (i.lead_id) countByLead.set(i.lead_id, (countByLead.get(i.lead_id) ?? 0) + 1)
  }

  let sumScore = 0
  const updates = leads.map((lead) => {
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
      countByLead.get(lead.id) ?? 0
    )
    sumScore += result.total
    return { id: lead.id, score: result.total }
  })

  // Batch update: one PATCH per lead. Supabase doesn't support bulk UPDATE by varying values
  // in a single call, so fan out with Promise.all.
  const chunkSize = 20
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map((u) =>
        serviceClient.from("leads").update({ score: u.score }).eq("id", u.id)
      )
    )
  }

  const averageScore = Math.round((sumScore / leads.length) * 10) / 10

  return NextResponse.json({
    scored: leads.length,
    average_score: averageScore,
  })
}
