// Re-date the founder handover tasks that are still open and overdue
//
//   node scripts/imports/redate-founder-tasks.mjs [--dry-run]
//
// The handover created one task per founder deal on Dhruv sir's own
// sheet dates (6–15 Aug 2026), so Manpreet's task list opened ~120 red
// and the daily overdue alerts would repeat all of them. This spreads
// the still-open ones over the next working days by sir's status, HOT
// first, so the list is a plan rather than a wall:
//
//   HOT            → Wed 16, Thu 17 Sep   (MD's immediate list, then value)
//   TENDER + WON   → Fri 18 Sep
//   FOLLOW-UP      → Sat 19, Mon 21, Tue 22 Sep
//   NEW            → Wed 23, Thu 24 Sep
//
// Sunday 20 Sep is skipped. The original sheet date is kept in the task
// description; the founder snapshot still holds it too.
// Idempotent: tasks already carrying the reschedule marker are skipped.

import { DRY_RUN, supabase, fetchAll, getDataSet, log } from "./_shared.mjs"

const MARKER = "[rescheduled-2026-09-15]"
const at = (day) => `2026-09-${String(day).padStart(2, "0")}T11:00:00+05:30`

const PLAN = [
  { statuses: ["HOT"], days: [16, 17] },
  { statuses: ["TENDER", "AWAITING CLIENT", "WON"], days: [18] },
  { statuses: ["FOLLOW-UP"], days: [19, 21, 22] },
  { statuses: ["NEW"], days: [23, 24] },
]

const istLabel = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })

async function main() {
  const sb = supabase()
  const founderSet = await getDataSet(sb, "founder-pipeline")

  const tasks = await fetchAll(sb, "tasks", "id, lead_id, title, due_at, description, completed_at", (q) =>
    q.like("description", "%[founder-handover #%").is("completed_at", null),
  )
  const snapshots = await fetchAll(
    sb, "lead_source_snapshots",
    "lead_id, data, lead:lead_id(proposal_estimated_cost, closure_value, final_agreed_price)",
    (q) => q.eq("data_set_id", founderSet.id),
  )
  const snapByLead = new Map(snapshots.map((s) => [s.lead_id, s]))

  const now = Date.now()
  const due = tasks.filter((t) => !t.description.includes(MARKER) && new Date(t.due_at).getTime() < now)
  const stats = { considered: tasks.length, rescheduled: 0, notOverdueOrDone: tasks.length - due.length, unmatched: 0 }

  for (const group of PLAN) {
    const items = due
      .map((t) => ({ t, s: snapByLead.get(t.lead_id) }))
      .filter(({ s }) => s && group.statuses.includes(s.data.status))
      .sort((a, b) => {
        const imm = Number(Boolean(b.s.data.immediate_action)) - Number(Boolean(a.s.data.immediate_action))
        if (imm) return imm
        const v = (x) => x.s.lead?.final_agreed_price ?? x.s.lead?.closure_value ?? x.s.lead?.proposal_estimated_cost ?? 0
        return v(b) - v(a)
      })

    const perDay = Math.ceil(items.length / group.days.length)
    for (let i = 0; i < items.length; i++) {
      const { t, s } = items[i]
      const newDue = at(group.days[Math.min(group.days.length - 1, Math.floor(i / perDay))])
      const description = `${t.description}\nRescheduled on 15 Sep 2026 from ${istLabel(t.due_at)} (Dhruv sir's sheet date) — ${s.data.status} deals first. ${MARKER}`
      log(`${s.data.status.padEnd(10)} ${newDue.slice(5, 10)}  ${t.title.slice(0, 60)}`)
      if (!DRY_RUN) {
        const { error } = await sb.from("tasks").update({ due_at: newDue, description }).eq("id", t.id)
        if (error) throw new Error(`${t.id}: ${error.message}`)
      }
      stats.rescheduled++
    }
  }

  stats.unmatched = due.length - stats.rescheduled
  console.log("\nDone.", JSON.stringify(stats))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
