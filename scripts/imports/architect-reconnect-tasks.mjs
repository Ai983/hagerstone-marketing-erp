// Architect Drive — reconnect tasks for Manpreet (P1 and P2 firms)
//
//   node scripts/imports/architect-reconnect-tasks.mjs [--dry-run]
//
// Run after migration 009 (firms assigned to Manpreet). One "Reconnect"
// call task per P1/P2 firm that has no open task yet, spread over the
// working days of the week so the list is callable, not a wall:
//   P1 → Wed 16 & Thu 17 Sep 2026, P2 → Fri 18 & Sat 19 Sep 2026, 11:00 IST.
//
// The description carries where the conversation stopped — last meeting,
// what was said, the 24 Dec tracker status, the MD's recommendation —
// so the task is readable on its own before dialling.
//
// Idempotent: skips firms that already have a task with this marker.

import { DRY_RUN, supabase, fetchAll, getDataSet, log } from "./_shared.mjs"

const MARKER = "[architect-reconnect-sep-2026]"
const TRACKER_TITLE = "Status — 24 Dec 2025 master tracker"
const SLOTS = {
  P1: ["2026-09-16T11:00:00+05:30", "2026-09-17T11:00:00+05:30"],
  P2: ["2026-09-18T11:00:00+05:30", "2026-09-19T11:00:00+05:30"],
}

const firstParagraph = (s) => (s ?? "").split(/\n\s*\n/)[0].trim()
const istDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })

async function main() {
  const sb = supabase()
  const dataSet = await getDataSet(sb, "architect-meetings-dec-2025")
  const { data: manpreet } = await sb.from("profiles").select("id").eq("full_name", "Manpreet Singh").maybeSingle()
  if (!manpreet) throw new Error("Manpreet Singh's profile not found")

  const leads = await fetchAll(sb, "leads", "id, full_name, company_name, priority, assigned_to", (q) =>
    q.eq("data_set_id", dataSet.id).in("priority", ["P1", "P2"]).eq("is_archived", false),
  )
  const interactions = await fetchAll(
    sb, "interactions", "lead_id, type, title, notes, attendees, occurred_at, created_at, lead:lead_id!inner(data_set_id)",
    (q) => q.eq("lead.data_set_id", dataSet.id),
  )
  const openTasks = await fetchAll(
    sb, "tasks", "lead_id, description, lead:lead_id!inner(data_set_id)",
    (q) => q.eq("lead.data_set_id", dataSet.id).is("completed_at", null),
  )
  const hasOpenTask = new Set(openTasks.map((t) => t.lead_id))

  const byLead = new Map()
  for (const i of interactions) {
    const list = byLead.get(i.lead_id) ?? []
    list.push(i)
    byLead.set(i.lead_id, list)
  }

  // P1 before P2, then by name, so the spread over days is stable.
  const queue = leads
    .filter((l) => !hasOpenTask.has(l.id))
    .sort((a, b) => a.priority.localeCompare(b.priority) || (a.company_name ?? "").localeCompare(b.company_name ?? ""))

  const perPriority = { P1: 0, P2: 0 }
  const counts = { P1: queue.filter((l) => l.priority === "P1").length, P2: queue.filter((l) => l.priority === "P2").length }
  const stats = { created: 0, skippedHasTask: leads.length - queue.length }

  for (const lead of queue) {
    const firm = lead.company_name || lead.full_name
    const list = (byLead.get(lead.id) ?? []).sort((a, b) => (b.occurred_at ?? b.created_at).localeCompare(a.occurred_at ?? a.created_at))
    const meeting = list.find((i) => i.type === "meeting" || i.type === "site_visit")
    const tracker = list.find((i) => i.title === TRACKER_TITLE)
    const recommended = (tracker?.notes ?? "").split("\n").find((l) => l.startsWith("MD's recommended next step:"))

    const by = (meeting?.attendees ?? "").split("·").map((s) => s.trim()).find((s) => s.startsWith("Hagerstone:"))?.replace("Hagerstone:", "").trim()
    const met = (meeting?.attendees ?? "").split("·").map((s) => s.trim()).filter((s) => s && !s.startsWith("Hagerstone:")).join(", ")

    // First half of each priority's firms on the first slot, rest on the second.
    const idx = perPriority[lead.priority]++
    const dueAt = SLOTS[lead.priority][idx < Math.ceil(counts[lead.priority] / 2) ? 0 : 1]

    const description = [
      `Architect Drive — ${lead.priority}. Pick up where the Delhi team left off.`,
      "",
      meeting
        ? `Last met: ${istDate(meeting.occurred_at ?? meeting.created_at)}${by ? ` by ${by}` : ""}${met ? `, met ${met}` : ""}`
        : "Last met: no meeting on record",
      meeting ? `What was said: ${firstParagraph(meeting.notes)}` : null,
      tracker ? `Status 24 Dec 2025: ${firstParagraph(tracker.notes)}` : null,
      recommended ?? null,
      "",
      MARKER,
    ].filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n")

    const task = {
      lead_id: lead.id,
      assigned_to: lead.assigned_to ?? manpreet.id,
      created_by: manpreet.id,
      title: `Reconnect with ${firm}`,
      type: "call",
      due_at: dueAt,
      description,
    }

    log(`task  ${lead.priority}  ${dueAt.slice(0, 10)}  ${firm}`)
    if (!DRY_RUN) {
      const { error } = await sb.from("tasks").insert(task)
      if (error) throw new Error(`${firm}: ${error.message}`)
    }
    stats.created++
  }

  console.log("\nDone.", JSON.stringify(stats))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
