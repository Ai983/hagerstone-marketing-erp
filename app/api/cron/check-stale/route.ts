import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

import type { LeadRelationshipGroup } from "@/lib/types"
import { FOLLOW_UP_ORDER, LEAD_GROUPS } from "@/lib/utils/relationship-group"

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** Start of today and of tomorrow in India time, as UTC instants. */
function istDayBounds(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  ist.setUTCHours(0, 0, 0, 0)
  const start = new Date(ist.getTime() - IST_OFFSET_MS)
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
}

/**
 * Daily follow-ups digest. One notification per salesperson per day —
 * "12 follow-ups due: 5 proposal pending · 4 gone quiet · 3 warm" — that
 * opens My Schedule. Replaces the old one-alert-per-lead "no activity for
 * 7 days" rule; due dates now come from each relationship group's rhythm
 * (migration 018, `marketing.lead_follow_ups`).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "marketing" } }
  )

  const { start, end } = istDayBounds()

  const { data: due, error: dueError } = await supabase
    .from("lead_follow_ups")
    .select("relationship_group")
    .lt("due_at", end.toISOString())

  if (dueError) {
    console.error("follow-ups digest query failed:", dueError)
    return NextResponse.json({ error: dueError.message }, { status: 500 })
  }

  const total = due?.length ?? 0
  if (total === 0) return NextResponse.json({ notified: 0, due: 0 })

  const counts = new Map<LeadRelationshipGroup, number>()
  for (const row of due as { relationship_group: LeadRelationshipGroup }[]) {
    counts.set(row.relationship_group, (counts.get(row.relationship_group) ?? 0) + 1)
  }
  const body = FOLLOW_UP_ORDER.filter((g) => counts.get(g))
    .map((g) => `${counts.get(g)} ${LEAD_GROUPS[g].label.toLowerCase()}`)
    .join(" · ")

  // Leads are not assigned — every salesperson works the same book, so
  // each gets the same digest.
  const { data: people, error: peopleError } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true)
    .eq("role", "sales_head")

  if (peopleError) {
    console.error("follow-ups digest recipients failed:", peopleError)
    return NextResponse.json({ error: peopleError.message }, { status: 500 })
  }

  let notified = 0
  for (const person of people ?? []) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", person.id)
      .eq("type", "follow_ups_due")
      .gte("created_at", start.toISOString())
      .limit(1)
      .maybeSingle()

    if (existing) continue

    const { error } = await supabase.from("notifications").insert({
      user_id: person.id,
      type: "follow_ups_due",
      title: `${total} follow-up${total === 1 ? "" : "s"} due today`,
      body: `${body} — open My Schedule`,
      lead_id: null,
      is_read: false,
    })
    if (error) console.error("follow-ups digest insert failed:", error)
    else notified++
  }

  return NextResponse.json({ notified, due: total })
}
