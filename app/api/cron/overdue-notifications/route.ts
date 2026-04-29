import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    )
  }
  return createClient(url, key)
}

function getLeadRelation(
  lead:
    | { id: string; full_name: string | null }
    | { id: string; full_name: string | null }[]
    | null
    | undefined
) {
  return Array.isArray(lead) ? (lead[0] ?? null) : (lead ?? null)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = getServiceClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: overdueTasks, error: overdueError } = await supabase
      .from("tasks")
      .select(
        "id, title, type, due_at, assigned_to, completed_at, lead:lead_id(id, full_name)"
      )
      .is("completed_at", null)
      .lt("due_at", new Date().toISOString())

    if (overdueError) throw overdueError

    let notified = 0

    for (const task of overdueTasks ?? []) {
      if (!task.assigned_to) continue
      const taskLead = getLeadRelation(task.lead)

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", task.assigned_to)
        .eq("type", "follow_up_overdue")
        .eq("lead_id", taskLead?.id ?? null)
        .gte("created_at", today.toISOString())
        .limit(1)
        .maybeSingle()

      if (existing) continue

      await supabase.from("notifications").insert({
        user_id: task.assigned_to,
        type: "follow_up_overdue",
        title: "Overdue Task",
        body: `"${task.title}" for ${taskLead?.full_name ?? "a lead"} is overdue`,
        lead_id: taskLead?.id ?? null,
        is_read: false,
      })
      notified++
    }

    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - 7)

    const { data: terminalStages, error: stagesError } = await supabase
      .from("pipeline_stages")
      .select("id")
      .in("slug", ["won", "lost"])

    if (stagesError) throw stagesError

    const terminalStageIds = (terminalStages ?? []).map((stage) => stage.id)

    let staleQuery = supabase
      .from("leads")
      .select("id, full_name, assigned_to, updated_at")
      .eq("is_archived", false)
      .not("stage_id", "is", null)
      .lt("updated_at", staleDate.toISOString())

    if (terminalStageIds.length > 0) {
      staleQuery = staleQuery.not(
        "stage_id",
        "in",
        `(${terminalStageIds.join(",")})`
      )
    }

    const { data: staleLeads, error: staleError } = await staleQuery

    if (staleError) throw staleError

    for (const lead of staleLeads ?? []) {
      if (!lead.assigned_to) continue

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", lead.assigned_to)
        .eq("type", "lead_stale")
        .eq("lead_id", lead.id)
        .gte("created_at", today.toISOString())
        .limit(1)
        .maybeSingle()

      if (existing) continue

      await supabase.from("notifications").insert({
        user_id: lead.assigned_to,
        type: "lead_stale",
        title: "Lead Going Cold",
        body: `${lead.full_name} has had no activity for 7+ days`,
        lead_id: lead.id,
        is_read: false,
      })
      notified++
    }

    return NextResponse.json({ notified })
  } catch (error) {
    console.error("Overdue notifications cron failed:", error)
    return NextResponse.json(
      { error: "Failed to process overdue notifications" },
      { status: 500 }
    )
  }
}
