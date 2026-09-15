// Dhruv sir's Sales Engine → Manpreet Singh
//
//   node scripts/imports/handover-founder-to-manpreet.mjs [--dry-run]
//
// Run AFTER the assignment migration (008), which moves the founder
// deals to Manpreet with the assignment-notification trigger held off.
// This script then, for every founder pipeline row:
//
//   1. Freezes the row as received into `lead_source_snapshots`, so
//      sir's original status / value / owner / next action survive
//      whatever Manpreet changes later.
//   2. Turns the row's Next Action + Next Date into a real task for
//      Manpreet, on the sheet's own date (agreed: keep sheet dates).
//   3. Writes a "Handed over" note on the lead's timeline.
//
// It also snapshots the architect tracker rows, so both of the sources
// Manpreet inherits read the same way in the lead drawer.
//
// Idempotent: snapshots upsert on (lead, data set); tasks and notes are
// skipped when this script's marker is already present.

import {
  DRY_RUN, supabase, readWorkbook, sheetRows, clean, companyKey, istNoon,
  fetchAll, getDataSet, log,
} from "./_shared.mjs"
import { FOUNDER_FILE, FOUNDER_SNAPSHOT, readFounderPipeline } from "./_founder-sheet.mjs"

const HANDOVER_TITLE = "Handed over to Manpreet Singh"
const TASK_MARKER = (serial) => `[founder-handover #${serial}]`
const ARCHITECT_FILE = "Hagerstone Architect Meeting Data.xlsx"

// #284 was merged into the architect drive's YKK lead, not created.
const MERGED_SERIALS = { "284": "ykk" }   // companyKey("YKK India Pvt. Ltd.")
// #287 is a pointer to nine architect firms, not a deal.
const SKIP_SERIALS = new Set(["287"])

/** The sheet's next action, as a task type the ERP accepts. */
function taskType(text) {
  const t = (text ?? "").toLowerCase()
  if (/whatsapp/.test(t)) return "whatsapp"
  if (/\b(call|phone|ring|dial)\b/.test(t)) return "call"
  if (/site|visit/.test(t)) return "site_visit"
  if (/\b(meet|mtg|meeting)\b/.test(t)) return "meeting"
  if (/quote|quotation|proposal|boq|bid|submit|estimate|pq\b/.test(t)) return "proposal"
  if (/mail|email|send|profile/.test(t)) return "email"
  return "follow_up"
}

async function main() {
  const sb = supabase()
  const { XLSX, wb } = readWorkbook(FOUNDER_FILE)
  const founderSet = await getDataSet(sb, "founder-pipeline")
  const architectSet = await getDataSet(sb, "architect-meetings-dec-2025")

  const { data: manpreet, error: mErr } = await sb
    .from("profiles").select("id, full_name").eq("full_name", "Manpreet Singh").maybeSingle()
  if (mErr || !manpreet) throw new Error("Manpreet Singh's profile not found")

  const leads = await fetchAll(sb, "leads", "id, full_name, company_name, external_ref, data_set_id, assigned_to")
  const founderLeadByRef = new Map(
    leads.filter((l) => l.data_set_id === founderSet.id && l.external_ref).map((l) => [l.external_ref, l]),
  )
  const leadByCompany = new Map()
  for (const l of leads) {
    const k = companyKey(l.company_name)
    if (k && !leadByCompany.has(k)) leadByCompany.set(k, l)
  }

  const existingTasks = await fetchAll(sb, "tasks", "lead_id, description", (q) => q.like("description", "%[founder-handover #%"))
  const taskDone = new Set(existingTasks.map((t) => t.description.match(/\[founder-handover #[^\]]+\]/)?.[0]))
  const existingNotes = await fetchAll(sb, "interactions", "lead_id", (q) => q.eq("title", HANDOVER_TITLE))
  const noted = new Set(existingNotes.map((n) => n.lead_id))

  const stats = { snapshots: 0, tasks: 0, tasksSkipped: 0, notes: 0, notAssigned: 0, missing: [] }

  // ----------------------------------------------------------------
  // Founder pipeline
  // ----------------------------------------------------------------
  const { rows, immediate } = readFounderPipeline(XLSX, wb)
  const snapshots = []

  for (const r of rows) {
    if (SKIP_SERIALS.has(r.serial)) continue
    const lead = MERGED_SERIALS[r.serial]
      ? leadByCompany.get(MERGED_SERIALS[r.serial])
      : founderLeadByRef.get(r.serial)
    if (!lead) {
      stats.missing.push(`#${r.serial} ${r.partyRaw}`)
      continue
    }
    if (lead.assigned_to !== manpreet.id) stats.notAssigned++

    snapshots.push({
      lead_id: lead.id,
      data_set_id: founderSet.id,
      external_ref: r.serial,
      source_file: `${FOUNDER_FILE} → 00-ONGOING TENDERS`,
      captured_at: FOUNDER_SNAPSHOT.at,
      data: {
        serial: r.serial,
        category: r.cat,
        party: r.partyRaw,
        project: r.project,
        value: r.valueRaw,
        contact: r.contactRaw,
        status: r.status,
        next_action: r.nextAction,
        next_date: r.nextDate?.label ?? null,
        owner: r.owner,
        immediate_action: immediate.has(r.serial),
      },
    })

    // Task from Next Action / Next Date.
    const marker = TASK_MARKER(r.serial)
    if (r.nextAction || r.nextDate) {
      if (taskDone.has(marker)) {
        stats.tasksSkipped++
      } else {
        // Where the sheet has no action text (rows #47+), name the party,
        // not the whole project description — the description has that.
        const party = (r.partyRaw ?? "").split(/\s+\(|\s+—\s+/)[0].trim()
        const title = r.nextAction?.trim() || `Follow up with ${party || lead.company_name || lead.full_name}`
        const task = {
          lead_id: lead.id,
          assigned_to: manpreet.id,
          created_by: manpreet.id,
          title: title.length > 120 ? `${title.slice(0, 117)}…` : title,
          // Type only from the action text itself; project descriptions
          // ("BOQ received 16-Jun") describe history, not the next step.
          type: r.nextAction ? taskType(r.nextAction) : "follow_up",
          // Sheet dates kept as-is (Aug 2026) — these start overdue.
          due_at: r.nextDate?.iso ?? FOUNDER_SNAPSHOT.at,
          description: [
            `From Dhruv sir's Sales Engine — pipeline #${r.serial} (${r.status}${r.cat ? ` · ${r.cat}` : ""}).`,
            r.project ? `Project: ${r.project}` : null,
            r.valueRaw ? `Value: ${r.valueRaw}` : null,
            r.owner ? `Owner on the sheet: ${r.owner}` : null,
            r.nextDate ? `Due on the sheet: ${r.nextDate.label}` : null,
            marker,
          ].filter(Boolean).join("\n"),
        }
        log(`task     #${r.serial.padEnd(6)} ${task.type.padEnd(10)} ${r.nextDate?.label ?? "—"}  ${task.title.slice(0, 60)}`)
        if (!DRY_RUN) {
          const { error } = await sb.from("tasks").insert(task)
          if (error) throw new Error(`task #${r.serial}: ${error.message}`)
        }
        taskDone.add(marker)
        stats.tasks++
      }
    }

    // Handover note.
    if (!noted.has(lead.id)) {
      const note = {
        lead_id: lead.id,
        user_id: null,
        type: "note",
        title: HANDOVER_TITLE,
        notes: [
          `This deal came from Dhruv sir's Sales Engine (pipeline #${r.serial}) and is now handled by Manpreet Singh.`,
          "",
          `As handed over (${FOUNDER_SNAPSHOT.label}):`,
          `• Status: ${r.status}${r.cat ? ` · ${r.cat}` : ""}`,
          r.valueRaw ? `• Value: ${r.valueRaw}` : "• Value: not yet known",
          r.owner ? `• Owner on the sheet: ${r.owner}` : null,
          r.nextAction || r.nextDate
            ? `• Next action: ${r.nextAction ?? "follow up"}${r.nextDate ? ` (due ${r.nextDate.label})` : ""}`
            : null,
          immediate.has(r.serial) ? "• On the MD's Immediate Actions list" : null,
        ].filter((x) => x !== null).join("\n"),
        data_set_id: founderSet.id,
        is_automated: false,
      }
      if (!DRY_RUN) {
        const { error } = await sb.from("interactions").insert(note)
        if (error) throw new Error(`note #${r.serial}: ${error.message}`)
      }
      noted.add(lead.id)
      stats.notes++
    }
  }

  // ----------------------------------------------------------------
  // Architect tracker — snapshots only (no tasks: Dec 2025 remarks)
  // ----------------------------------------------------------------
  const arch = readWorkbook(ARCHITECT_FILE)
  const tracker = sheetRows(arch.XLSX, arch.wb, "Master Tracker (24 Dec)")
    .slice(1)
    .filter((r) => clean(r[1]) && !String(r[0]).startsWith("Source:"))
  const archLeads = leads.filter((l) => l.data_set_id === architectSet.id)
  const archByCompany = new Map(archLeads.map((l) => [companyKey(l.company_name) ?? (l.company_name ?? "").toLowerCase(), l]))

  for (const [region, client, phone, location, priority, remark, poc] of tracker) {
    const lead = archByCompany.get(companyKey(client) ?? String(client).toLowerCase())
    if (!lead) {
      stats.missing.push(`tracker ${client}`)
      continue
    }
    snapshots.push({
      lead_id: lead.id,
      data_set_id: architectSet.id,
      external_ref: clean(client),
      source_file: `${ARCHITECT_FILE} → Master Tracker (24 Dec)`,
      captured_at: istNoon(2025, 12, 24),
      data: {
        region: clean(region),
        client: clean(client),
        phone: clean(phone),
        location: clean(location),
        priority: clean(priority),
        remark: clean(remark),
        poc: clean(poc),
      },
    })
  }

  log(`snapshots ${snapshots.length} (founder ${snapshots.filter((s) => s.data_set_id === founderSet.id).length}, architect ${snapshots.filter((s) => s.data_set_id === architectSet.id).length})`)
  if (!DRY_RUN) {
    const { error } = await sb.from("lead_source_snapshots").upsert(snapshots, { onConflict: "lead_id,data_set_id" })
    if (error) throw new Error(`snapshots: ${error.message}`)
  }
  stats.snapshots = snapshots.length

  console.log("\nDone.", JSON.stringify(stats, null, 1))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
