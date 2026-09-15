// Architect Drive — put the 24 Dec 2025 tracker status on each timeline
//
//   node scripts/imports/add-architect-tracker-status.mjs [--dry-run]
//
// The 24 Dec master tracker is the Delhi team's LAST word on every firm
// — newer than most of the meetings. The first import used it only to
// set `leads.priority`, so the timeline read: meetings… then nothing,
// and "Principal Architect out of town until Jan 9" was hidden in the
// lead's initial notes. This adds it as a dated timeline entry, so the
// story reads in order and ends where the team actually left it — and
// the three firms with no logged meeting still show where they stand.
//
// Separate from import-architect-meetings.mjs on purpose: re-running
// that would re-apply the tracker priorities over anything changed since.
// Idempotent: skips firms that already have this entry.

import {
  DRY_RUN, supabase, readWorkbook, sheetRows, clean, companyKey, istNoon,
  fetchAll, getDataSet, log,
} from "./_shared.mjs"

const FILE = "Hagerstone Architect Meeting Data.xlsx"
const TITLE = "Status — 24 Dec 2025 master tracker"

// From the "Priority Actions" sheet — the MD's handling for each bucket.
const RECOMMENDED = {
  "priority 1": "Schedule meetings within the next 2-3 weeks. Maintain weekly touchpoints and prepare BOQ/pricing readiness.",
  "priority 2": "Nurture via follow-up emails, capability decks, and selective project references.",
  "priority 4": "Quarterly check-ins only. Do not allocate high sales bandwidth.",
}

async function main() {
  const sb = supabase()
  const dataSet = await getDataSet(sb, "architect-meetings-dec-2025")
  const { XLSX, wb } = readWorkbook(FILE)

  const leads = await fetchAll(sb, "leads", "id, company_name", (q) => q.eq("data_set_id", dataSet.id))
  const byCompany = new Map(leads.map((l) => [companyKey(l.company_name) ?? (l.company_name ?? "").toLowerCase(), l]))

  const existing = await fetchAll(sb, "interactions", "lead_id", (q) => q.eq("title", TITLE))
  const done = new Set(existing.map((e) => e.lead_id))

  const tracker = sheetRows(XLSX, wb, "Master Tracker (24 Dec)")
    .slice(1)
    .filter((r) => clean(r[1]) && !String(r[0]).startsWith("Source:"))

  const at = istNoon(2025, 12, 24)
  const stats = { added: 0, skipped: 0, missing: [] }

  for (const [region, client, , location, priorityRaw, remark, poc] of tracker) {
    const lead = byCompany.get(companyKey(client) ?? String(client).toLowerCase())
    if (!lead) {
      stats.missing.push(client)
      continue
    }
    if (done.has(lead.id)) {
      stats.skipped++
      continue
    }

    const priority = clean(priorityRaw) ?? "Not specified"
    const recommended = RECOMMENDED[priority.toLowerCase()]
    const notes = [
      clean(remark) ?? "No remark recorded in the tracker.",
      "",
      [`${priority}`, clean(poc) ? `POC: ${clean(poc)}` : null, clean(location) ? `Location: ${clean(location)}` : null, clean(region)]
        .filter(Boolean)
        .join(" · "),
      recommended ? `MD's recommended next step: ${recommended}` : null,
      "",
      "Source: Delhi/NCR team's master tracker, emailed to the MD on 24 Dec 2025. This was the team's latest status on the firm.",
    ].filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n")

    log(`status   ${priority.padEnd(15)} ${client}`)
    if (!DRY_RUN) {
      const { error } = await sb.from("interactions").insert({
        lead_id: lead.id,
        user_id: null,
        type: "note",
        title: TITLE,
        notes,
        occurred_at: at,
        created_at: at,
        is_automated: false,
        data_set_id: dataSet.id,
      })
      if (error) throw new Error(`${client}: ${error.message}`)
    }
    done.add(lead.id)
    stats.added++
  }

  console.log("\nDone.", JSON.stringify(stats))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
