import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

type StaleLead = {
  id: string
  full_name: string
  assigned_to: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data: closedStages, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id")
    .in("slug", ["won", "lost"])

  if (stageError) {
    console.error("check-stale stage lookup failed:", stageError)
    return NextResponse.json({ error: stageError.message }, { status: 500 })
  }

  let query = supabase
    .from("leads")
    .select("id, full_name, assigned_to, updated_at")
    .not("assigned_to", "is", null)
    .eq("is_archived", false)
    .lt("updated_at", sevenDaysAgo)

  const closedStageIds = (closedStages ?? []).map((stage) => stage.id)
  if (closedStageIds.length > 0) {
    query = query.not("stage_id", "in", `(${closedStageIds.join(",")})`)
  }

  const { data: staleLeads, error: staleError } = await query

  if (staleError) {
    console.error("check-stale query failed:", staleError)
    return NextResponse.json({ error: staleError.message }, { status: 500 })
  }

  if (!staleLeads || staleLeads.length === 0) {
    return NextResponse.json({ notified: 0 })
  }

  let notified = 0

  for (const lead of staleLeads as StaleLead[]) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("type", "lead_stale")
      .gte("created_at", sevenDaysAgo)
      .maybeSingle()

    if (existing) continue

    await supabase.from("notifications").insert({
      user_id: lead.assigned_to,
      type: "lead_stale",
      title: "Lead Going Stale",
      body: `${lead.full_name} has had no activity for 7+ days`,
      lead_id: lead.id,
      is_read: false,
    })

    notified++
  }

  return NextResponse.json({ notified })
}
