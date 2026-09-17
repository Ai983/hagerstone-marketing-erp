// Sales BD mailbox (sales@hagerstone.com) → ERP
//
//   node scripts/imports/import-sales-bd-mailbox.mjs [--dry-run]
//
// Source: the 14 Sep 2026 review of the sales@ mailbox — Anand S
// Choudhari's (Head – BD, South) clients, tenders and prospects, with
// where each email conversation last stopped. The report is structured
// by hand into scripts/imports/data/sales-bd-mailbox-2026-09-14.json,
// which is git-ignored because it holds client contact names.
//
// What it does, all tagged with the "Sales BD" data set so it stays
// separate from ERP / Website / Architect Drive / founder data:
//   1. Creates a lead per opportunity, at the stage the email trail
//      reached, with Anand as deal owner and a P1–P4 rating.
//   2. For firms already in the ERP it does NOT create a duplicate:
//      - founder / architect leads keep their section; the mailbox
//        history is added to their timeline and a source snapshot is kept;
//        their stage only ever moves forward, never back;
//      - plain ERP leads (no known origin) move into Sales BD.
//   3. Writes the journey and the last email as timeline entries on the
//      dates they happened, so the next person sees where it stopped.
//   4. Adds a follow-up task for each open next step, for Anand
//      (the mailbox owner), due over the next two weeks.
//   5. Adds the December cold-outreach list as P4 "Contacted" leads.
//
// Re-runnable: leads are matched by external_ref, timeline entries and
// tasks are skipped when already present.

import fs from "node:fs"
import path from "node:path"

import { DRY_RUN, ROOT, supabase, fetchAll, getDataSet, markImported, log } from "./_shared.mjs"

const DATA_FILE = path.join(ROOT, "scripts/imports/data/sales-bd-mailbox-2026-09-14.json")
const DATA_SET = "sales-bd-mailbox"
const OWNER_EMAIL = "sales@hagerstone.com"

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const STAGE_ORDER = ["new_lead", "contacted", "qualified", "boq_received", "proposal_sent", "negotiation"]

/** "17 Jun" → IST midday. The mailbox runs Nov 2025 – Sep 2026. */
function dated(value) {
  const m = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]{3})/)
  if (!m) throw new Error(`Bad date: ${value}`)
  const month = MONTHS[m[2].toLowerCase()]
  const year = month >= 11 ? 2025 : 2026
  return `${year}-${String(month).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}T12:00:00+05:30`
}

/** Follow-ups spread over the next working days, most urgent first. */
function dueDate(opp, index) {
  const slots = ["2026-09-18", "2026-09-18", "2026-09-19", "2026-09-19", "2026-09-21", "2026-09-21", "2026-09-22", "2026-09-22"]
  if (opp.follow_up_rank) return `${slots[opp.follow_up_rank - 1]}T11:00:00+05:30`
  const base = opp.priority === "P1" || opp.priority === "P2" ? 23 : 25
  const day = base + (index % 5)
  return `2026-09-${String(day).padStart(2, "0")}T11:00:00+05:30`
}

async function main() {
  const src = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
  const sb = supabase()
  const dataSet = await getDataSet(sb, DATA_SET)

  const { data: owner } = await sb.from("profiles").select("id, full_name").eq("email", OWNER_EMAIL).maybeSingle()
  const { data: admin } = await sb.from("profiles").select("id").eq("email", "admin@hagerstone.com").maybeSingle()
  const stages = await fetchAll(sb, "pipeline_stages", "id, slug, stage_type")
  const stageBySlug = new Map(stages.map((s) => [s.slug, s]))
  const stageById = new Map(stages.map((s) => [s.id, s]))
  const dataSets = await fetchAll(sb, "data_sets", "id, key")
  const erpNativeId = dataSets.find((d) => d.key === "erp-native")?.id

  const existingByRef = new Map(
    (await fetchAll(sb, "leads", "id, external_ref", (q) => q.eq("data_set_id", dataSet.id))).map((l) => [l.external_ref, l])
  )

  const stats = { created: 0, merged: 0, retagged: 0, stageMoved: 0, entries: 0, tasks: 0, snapshots: 0, skipped: 0 }

  // Cold outreach becomes opportunities of its own, at P4.
  const cold = [
    ...src.cold_outreach.end_clients.map((c) => ({ ...c, kind: "End-client target" })),
    ...src.cold_outreach.partners.map((c) => ({ ...c, kind: "PMC / architect / channel partner" })),
  ]
    .filter((c) => !c.skip_reason)
    .map((c) => ({
      ref: `cold-${c.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      section: "Cold outreach",
      match_lead_id: c.match_lead_id,
      retag: c.retag,
      company: c.company,
      contact: c.contact ?? c.company,
      city: c.city ?? null,
      service_line: "unknown",
      stage: "contacted",
      priority: "P4",
      status: "Profile sent, little / no reply",
      industry: c.kind,
      scope: `${c.kind}. ${src.cold_outreach.note}`,
      journey: [],
      last: { date: src.cold_outreach.date, approx: true, dir: "out", text: `Capability profile sent (December 2025 prospecting blast) — little or no reply.${c.extra ? ` ${c.extra}` : ""}` },
      next: null,
    }))

  const all = [...src.opportunities, ...cold]
  let taskIndex = 0

  for (const opp of all) {
    const header = `[Sales BD mailbox — ${src.mailbox}, reviewed 14 Sep 2026]`
    const notesBlock = [
      header,
      `${opp.section} · ${opp.status}`,
      "",
      opp.scope ? `Scope: ${opp.scope}` : null,
      opp.designation ? `Contact role: ${opp.designation}` : null,
      opp.other_contacts ? `Other contacts: ${opp.other_contacts}` : null,
      opp.address ? `Address: ${opp.address}` : null,
      opp.next ? `Next (per report): ${opp.next}` : null,
      "",
      `Note: ${src.caveat}`,
    ].filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n")

    const priorityNote = opp.priority
      ? `${opp.priority} — sales@ BD report 14 Sep 2026: ${opp.status}${opp.follow_up_rank ? ` (priority follow-up #${opp.follow_up_rank})` : ""}.`
      : null

    // ── Find or create the lead ─────────────────────────────────────
    let leadId
    let merged = false
    const existingRef = existingByRef.get(opp.ref)

    if (existingRef) {
      leadId = existingRef.id
    } else if (opp.match_lead_id) {
      const { data: lead, error } = await sb
        .from("leads")
        .select("id, company_name, data_set_id, stage_id, priority, project_size_sqft, city, state, owner_name, service_line")
        .eq("id", opp.match_lead_id)
        .maybeSingle()
      if (error || !lead) throw new Error(`match ${opp.ref}: lead ${opp.match_lead_id} not found`)
      leadId = lead.id
      merged = true

      const patch = {}
      if (opp.retag && lead.data_set_id === erpNativeId) {
        Object.assign(patch, {
          data_set_id: dataSet.id,
          external_ref: opp.ref,
          owner_name: lead.owner_name ?? src.owner,
          source_detail: `Sales BD mailbox (${src.mailbox})`,
        })
        stats.retagged++
      }
      if (!lead.priority && opp.priority) Object.assign(patch, { priority: opp.priority, priority_note: priorityNote, priority_updated_at: dated("14 Sep") })
      if (!lead.project_size_sqft && opp.sqft) patch.project_size_sqft = opp.sqft
      if (!lead.city && opp.city) Object.assign(patch, { city: opp.city, state: opp.state ?? null })
      if ((!lead.service_line || lead.service_line === "unknown") && opp.service_line !== "unknown") patch.service_line = opp.service_line

      // Stage only moves forward, and never off Won / Lost.
      const current = stageById.get(lead.stage_id)
      const target = opp.stage ? stageBySlug.get(opp.stage) : null
      if (target && current && current.stage_type === "active" &&
          STAGE_ORDER.indexOf(opp.stage) > STAGE_ORDER.indexOf(current.slug)) {
        Object.assign(patch, { stage_id: target.id, stage_entered_at: new Date().toISOString() })
        stats.stageMoved++
        log(`stage    ${opp.ref}: ${current.slug} → ${opp.stage}`)
      }

      log(`merge    ${opp.ref}  →  ${lead.company_name}${patch.data_set_id ? "  (moved into Sales BD)" : ""}`)
      if (!DRY_RUN && Object.keys(patch).length) {
        const { error: upErr } = await sb.from("leads").update(patch).eq("id", lead.id)
        if (upErr) throw new Error(`update ${opp.ref}: ${upErr.message}`)
      }
      stats.merged++
    } else {
      const row = {
        full_name: opp.contact || opp.company,
        company_name: opp.company,
        designation: opp.designation ?? null,
        industry: opp.industry ?? null,
        city: opp.city ?? null,
        state: opp.state ?? null,
        full_address: opp.address ?? null,
        service_line: opp.service_line ?? "unknown",
        project_size_sqft: opp.sqft ?? null,
        source: "manual_sales",
        source_detail: `Sales BD mailbox (${src.mailbox})`,
        stage_id: stageBySlug.get(opp.stage ?? "contacted").id,
        created_by: admin?.id ?? null,
        data_set_id: dataSet.id,
        external_ref: opp.ref,
        owner_name: src.owner,
        priority: opp.priority ?? null,
        priority_note: priorityNote,
        priority_updated_at: opp.priority ? dated("14 Sep") : null,
        initial_notes: notesBlock,
      }
      log(`create   ${opp.priority ?? "—"}  ${opp.stage}  ${opp.company}`)
      if (DRY_RUN) {
        leadId = `dry-${opp.ref}`
      } else {
        const { data, error } = await sb.from("leads").insert(row).select("id").single()
        if (error) throw new Error(`insert ${opp.ref}: ${error.message}`)
        leadId = data.id
      }
      stats.created++
    }

    // ── Source snapshot ("as received") ─────────────────────────────
    if (!DRY_RUN) {
      const { error } = await sb.from("lead_source_snapshots").upsert({
        lead_id: leadId,
        data_set_id: dataSet.id,
        external_ref: opp.ref,
        source_file: src.source_file,
        captured_at: dated("14 Sep"),
        data: { ...opp, mailbox: src.mailbox, owner: src.owner, merged_into_existing_lead: merged },
      }, { onConflict: "lead_id,data_set_id" })
      if (error) throw new Error(`snapshot ${opp.ref}: ${error.message}`)
    }
    stats.snapshots++

    // ── Timeline ────────────────────────────────────────────────────
    const already = DRY_RUN || String(leadId).startsWith("dry-") ? [] : (await sb
      .from("interactions").select("id").eq("lead_id", leadId).eq("data_set_id", dataSet.id).limit(1)).data ?? []

    if (already.length) {
      stats.skipped++
    } else {
      const entries = []
      if (merged) {
        entries.push({
          type: "note",
          title: "Sales BD mailbox — summary",
          notes: notesBlock,
          occurred_at: dated("14 Sep"),
        })
      }
      for (const step of opp.journey ?? []) {
        entries.push({
          type: step.type,
          title: `Sales BD mailbox — ${step.type === "meeting" ? "meeting" : step.type === "site_visit" ? "site visit" : step.type.startsWith("email") ? "email" : "update"}`,
          notes: `${step.text}${step.approx ? "\n(Date approximate — the report gives the month.)" : ""}`,
          occurred_at: dated(step.date),
        })
      }
      if (opp.last) {
        entries.push({
          type: opp.last.dir === "in" ? "email_received" : "email_sent",
          title: `Last email — ${opp.last.dir === "in" ? "client → Hagerstone" : "Hagerstone → client"} (where it stopped)`,
          notes: [
            opp.last.text,
            opp.next ? `\nNext step: ${opp.next}` : null,
            opp.last.approx ? "\n(Date approximate, as given in the report.)" : null,
          ].filter(Boolean).join(""),
          occurred_at: dated(opp.last.date),
        })
      }
      for (const e of entries) {
        if (!DRY_RUN) {
          const { error } = await sb.from("interactions").insert({
            ...e,
            lead_id: leadId,
            user_id: null,
            created_at: e.occurred_at,
            is_automated: false,
            attendees: e.type === "meeting" || e.type === "site_visit" ? `Hagerstone: ${src.owner}` : null,
            data_set_id: dataSet.id,
          })
          if (error) throw new Error(`interaction ${opp.ref}: ${error.message}`)
        }
        stats.entries++
      }
    }

    // ── Follow-up task for the open next step ───────────────────────
    const wantsTask = opp.next && (opp.follow_up_rank || ["P1", "P2", "P3"].includes(opp.priority))
    if (wantsTask && owner) {
      const title = opp.next.length > 140 ? `${opp.next.slice(0, 137)}…` : opp.next
      const dup = DRY_RUN || String(leadId).startsWith("dry-") ? [] : (await sb
        .from("tasks").select("id").eq("lead_id", leadId).eq("title", title).is("completed_at", null).limit(1)).data ?? []
      if (!dup.length) {
        const due = dueDate(opp, taskIndex++)
        log(`task     ${due.slice(0, 10)}  ${opp.ref}: ${title}`)
        if (!DRY_RUN) {
          const { error } = await sb.from("tasks").insert({
            lead_id: leadId,
            assigned_to: owner.id,
            created_by: admin?.id ?? null,
            title,
            description: `From the sales@ mailbox BD report (14 Sep 2026). Last email: ${opp.last?.date ?? "—"}.`,
            type: "follow_up",
            due_at: due,
          })
          if (error) throw new Error(`task ${opp.ref}: ${error.message}`)
        }
        stats.tasks++
      }
    }
  }

  const { count } = DRY_RUN
    ? { count: stats.created + stats.retagged }
    : await sb.from("leads").select("id", { count: "exact", head: true }).eq("data_set_id", dataSet.id)

  // Totals from the database, so a re-run (which skips everything)
  // doesn't overwrite the summary with zeros.
  const { count: entryCount } = DRY_RUN
    ? { count: stats.entries }
    : await sb.from("interactions").select("id", { count: "exact", head: true }).eq("data_set_id", dataSet.id)
  await markImported(
    sb, dataSet.id, count ?? 0,
    `${all.length} opportunities from the sales@ mailbox review (14 Sep 2026): ${count ?? 0} in Sales BD, ${all.length - (count ?? 0)} kept in their existing section (founder pipeline) with the mailbox history added. ${entryCount ?? 0} timeline entries.`,
  )

  console.log("\nDone.", JSON.stringify(stats))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
