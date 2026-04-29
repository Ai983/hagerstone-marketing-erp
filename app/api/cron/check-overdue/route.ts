import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

type OverdueTask = {
  id: string
  lead_id: string | null
  assigned_to: string | null
  title: string
  due_at: string
  completed_at: string | null
  lead?:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null
}

function getLeadName(lead: OverdueTask["lead"]) {
  if (Array.isArray(lead)) return lead[0]?.full_name ?? "this lead"
  return lead?.full_name ?? "this lead"
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

  const { data: overdueTasks, error: overdueError } = await supabase
    .from("overdue_tasks")
    .select("*, lead:leads(full_name)")
    .is("completed_at", null)
    .lt("due_at", new Date().toISOString())
    .not("assigned_to", "is", null)

  if (overdueError) {
    console.error("check-overdue query failed:", overdueError)
    return NextResponse.json(
      { error: overdueError.message },
      { status: 500 }
    )
  }

  if (!overdueTasks || overdueTasks.length === 0) {
    return NextResponse.json({ notified: 0 })
  }

  let notified = 0

  for (const task of overdueTasks as OverdueTask[]) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", task.assigned_to)
      .eq("type", "follow_up_overdue")
      .eq("lead_id", task.lead_id)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )
      .maybeSingle()

    if (existing) continue

    await supabase.from("notifications").insert({
      user_id: task.assigned_to,
      type: "follow_up_overdue",
      title: "Follow-up Overdue",
      body: `Task "${task.title}" for ${getLeadName(task.lead)} is overdue`,
      lead_id: task.lead_id,
      is_read: false,
    })

    notified++
  }

  return NextResponse.json({ notified })
}
