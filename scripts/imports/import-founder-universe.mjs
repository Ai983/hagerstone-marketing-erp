// Founder Sales Engine — contact universe → universe_contacts
//
//   node scripts/imports/import-founder-universe.mjs [--dry-run]
//
// Source: SALES_FUNNEL_MASTER.xlsx — the L-* tabs (touched leads, by
// funnel stage) and A-* tabs (marketing audience, by persona). ~98k
// rows, all sharing one 13-column layout.
//
// Rows go to `universe_contacts`, never to `leads` — see migration
// 004 for why. Upserted on the founder's permanent serial, so a
// re-run after the founder rebuilds the workbook refreshes in place.
//
// Contacts already in the ERP (same phone tail or email as a lead)
// are linked via `converted_lead_id`, so the Universe browser shows
// them as "in pipeline" instead of offering to create a duplicate.

import {
  DRY_RUN, supabase, readWorkbook, sheetRows, clean, phoneTail, chunk,
  fetchAll, getDataSet, markImported, log,
} from "./_shared.mjs"

const FILE = "SALES_FUNNEL_MASTER.xlsx"
const DATA_SET = "founder-universe"
const BATCH = 1000

const STAGE_FOR_TAB = {
  "L-5-CLIENT": "5-CLIENT",
  "L-4-OPPORTUNITY": "4-OPPORTUNITY",
  "L-3-ENGAGED": "3-ENGAGED",
  "L-2-CONTACTED": "2-CONTACTED",
}

function stageFor(tab) {
  if (STAGE_FOR_TAB[tab]) return STAGE_FOR_TAB[tab]
  if (tab.startsWith("A-")) return "1-AUDIENCE"
  return null
}

/** Phone as a readable string: "8223047773.0" → "8223047773". */
function tidyPhone(value) {
  const s = clean(value)
  return s ? s.replace(/(\d)\.0\b/g, "$1") : null
}

async function main() {
  const sb = supabase()
  const { XLSX, wb } = readWorkbook(FILE)

  const dataSet = DRY_RUN
    ? await getDataSet(sb, DATA_SET).catch(() => ({ id: "dry-run-data-set" }))
    : await getDataSet(sb, DATA_SET)

  // Existing leads, for the "already in pipeline" link.
  const leads = await fetchAll(sb, "leads", "id, email, phone, phone_alt")
  const leadByPhone = new Map()
  const leadByEmail = new Map()
  for (const l of leads) {
    if (l.email) leadByEmail.set(l.email.trim().toLowerCase(), l.id)
    for (const p of [l.phone, l.phone_alt]) {
      const t = phoneTail(p)
      if (t) leadByPhone.set(t, l.id)
    }
  }

  const tabs = wb.SheetNames.filter((n) => stageFor(n))
  const rows = []
  const seenSerials = new Set()
  const perTab = {}
  let duplicateSerials = 0
  let linked = 0

  for (const tab of tabs) {
    const [header, ...body] = sheetRows(XLSX, wb, tab)
    const col = Object.fromEntries(header.map((h, i) => [h, i]))
    const stage = stageFor(tab)
    perTab[tab] = 0

    for (const r of body) {
      const serial = clean(r[col.serial])
      if (!serial) continue
      // Serials are unique by the founder's rule; if one ever repeats,
      // the first tab (highest funnel stage, as the tabs are ordered)
      // wins rather than the upsert silently overwriting it.
      if (seenSerials.has(serial)) {
        duplicateSerials++
        continue
      }
      seenSerials.add(serial)

      const phone = tidyPhone(r[col.phone])
      const email = clean(r[col.email])?.toLowerCase() ?? null
      const leadId = leadByPhone.get(phoneTail(phone)) ?? (email ? leadByEmail.get(email) : undefined) ?? null
      if (leadId) linked++

      rows.push({
        serial,
        name: clean(r[col.name]),
        company: clean(r[col.company]),
        role: clean(r[col.role]),
        phone,
        email,
        city: clean(r[col.city]),
        region: clean(r[col.region]),
        persona: clean(r[col.persona]),
        field: clean(r[col.field]),
        recency: clean(r[col.recency]),
        project: clean(r[col.project]),
        suggested_action: clean(r[col.suggested_action]),
        funnel_stage: stage,
        source_tag: tab,
        data_set_id: dataSet.id,
        // Only set the link, never clear it: a contact someone converted
        // by hand must stay converted when the workbook is re-imported.
        ...(leadId ? { converted_lead_id: leadId } : {}),
      })
      perTab[tab]++
    }
  }

  log("rows per tab:", JSON.stringify(perTab, null, 1))
  log(`total ${rows.length}, duplicate serials skipped ${duplicateSerials}, already in ERP ${linked}`)

  if (DRY_RUN) {
    const stages = {}
    for (const r of rows) stages[r.funnel_stage] = (stages[r.funnel_stage] ?? 0) + 1
    log("by stage:", JSON.stringify(stages))
    log("sample:", JSON.stringify(rows.slice(0, 2), null, 1))
    return
  }

  // PostgREST upserts need every row in a batch to carry the same
  // columns, so rows with and without a lead link go in separate calls.
  const withLink = rows.filter((r) => r.converted_lead_id)
  const withoutLink = rows.filter((r) => !r.converted_lead_id)

  let done = 0
  for (const group of [withLink, withoutLink]) {
    for (const batch of chunk(group, BATCH)) {
      const { error } = await sb.from("universe_contacts").upsert(batch, { onConflict: "serial" })
      if (error) throw new Error(`upsert at row ${done}: ${error.message}`)
      done += batch.length
      process.stdout.write(`\r  upserted ${done} / ${rows.length}`)
    }
  }
  process.stdout.write("\n")

  await markImported(
    sb, dataSet.id, rows.length,
    `${Object.entries(perTab).map(([t, n]) => `${t} ${n}`).join(" · ")}. ${linked} already matched an ERP lead.`,
  )

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
