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
  return createClient(url, key, { db: { schema: "marketing" } })
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

    // Quiet-lead alerts used to be sent here too, one per lead after 7
    // days. They are replaced by the single daily follow-ups digest in
    // /api/cron/check-stale, which uses each relationship group's rhythm.

    return NextResponse.json({ notified })
  } catch (error) {
    console.error("Overdue notifications cron failed:", error)
    return NextResponse.json(
      { error: "Failed to process overdue notifications" },
      { status: 500 }
    )
  }
}
