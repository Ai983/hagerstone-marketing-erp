// Founder Sales Engine — working pipeline → ERP leads
//
//   node scripts/imports/import-founder-pipeline.mjs [--dry-run]
//
// Source: SALES_FUNNEL_MASTER.xlsx, tab "00-ONGOING TENDERS" — the
// founder's ~120 named deals, each with a permanent serial, status,
// value, owner and next action. Plus "03-IMMEDIATE ACTIONS", the MD's
// do-now subset of those same serials.
//
// Each row becomes a real lead on the pipeline, tagged "Founder
// Pipeline", unless it is already in the ERP — then the founder's
// view is added to that lead's timeline instead of creating a twin.
//
// Matching, strongest first:
//   1. Our own earlier import  (data set + serial) → update in place
//   2. Email or phone on an existing lead          → merge
//   3. Company name, when the founder has only ONE deal with that
//      company                                     → merge
// The founder lists several separate deals for Hero Realty, Minebea,
// SAEL, Eldeco…; a company match there would fold distinct projects
// into one lead, so those always become their own leads.

import {
  DRY_RUN, supabase, readWorkbook, sheetRows, clean, phoneTail, companyKey,
  istNoon, fetchAll, getDataSet, markImported, log,
} from "./_shared.mjs"

const FILE = "SALES_FUNNEL_MASTER.xlsx"
const DATA_SET = "founder-pipeline"
const SNAPSHOT = { label: "14 Sep 2026", at: istNoon(2026, 9, 14) }

// Founder status → ERP stage. TENDER is bid submission and
// techno-commercial rounds, i.e. a price is with the client.
const STAGE_FOR_STATUS = {
  "NEW": "new_lead",
  "FOLLOW-UP": "contacted",
  "TENDER": "proposal_sent",
  "AWAITING CLIENT": "proposal_sent",
  "HOT": "negotiation",
  "WON": "won",
  "LOST": "lost",
  "DROPPED": "lost",
}

const SERVICE_LINE_FOR_CAT = {
  Interior: "office_interiors",
  Facade: "facade_glazing",
  MEP: "mep",
  EPC: "civil_works",
  Furniture: "office_interiors",
  Channel: "unknown",
  Corporate: "unknown",
  Region: "unknown",
  Mixed: "multiple",
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

// Serial #287 is not a deal: it is the founder's pointer to the nine
// Priority-1 architect firms left mid-follow-up when Saurabh resigned.
// Those firms are already leads (Architect Drive), so instead of a
// 121st lead, each of the nine gets the note.
const ORPHANED_ARCHITECTS_SERIAL = "287"
const ORPHANED_ARCHITECTS = [
  "Tripathi & Associates Pvt. Ltd.", "Gulati Architects", "Niche Architects",
  "City Cube Architects", "ESSENTIA ENVIRONMENT", "MSAP Architects & Interior Designers",
  "Anma Architects", "Quintessence Landscape + Architecture", "Architect Harish Tripathi & Associates",
]

// Party cells the parser reads the wrong way round — "(Brookfield)" is
// the company, not the person; "(corporate)" is neither. Pinned by
// serial, since there are few and a smarter heuristic would just move
// the errors somewhere else.
const PARTY_OVERRIDES = {
  "2": { company: "Brookfield Properties", person: "Ravi Sunder" },
  "3": { company: "SGRR Education Mission (Dehradun Hospital)", person: null },
  "55": { company: "HoABL + Viva ACP", person: "Ganesh Dhongadi" },
  "81": { company: "Signature Towers (RRPL)", person: null },
  "82": { company: "Via Designio", person: null },
  "213": { company: "HCL (corporate)", person: null },
  "80876": { company: "ST-04 Infra — Japanese GC cluster", person: "Somnath Mandal ji" },
  "80880": { company: "Metalman — Aurangabad (site #3)", person: null },
}

/** "06-Aug" → 2026-08-06. Every date in the tab is in 2026. */
function parseNextDate(value) {
  const m = String(value ?? "").trim().match(/^(\d{1,2})-([A-Za-z]{3})$/)
  if (!m) return null
  const month = MONTHS[m[2].toLowerCase()]
  return month ? { label: m[0], iso: istNoon(2026, month, Number(m[1])) } : null
}

/**
 * "₹56.4 L+" → 5640000, "₹2.97–3.38 Cr" → 29700000 (the low end),
 * "Large" / "?" → null. The low end, because the dashboard's weighted
 * pipeline should not be flattered by the top of a range.
 */
function parseValue(raw) {
  const s = clean(raw)
  if (!s) return null
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(?:[–-]\s*\d+(?:\.\d+)?)?\s*(cr|crore|l|lakh|lac)\b/i)
  if (!m) return null
  const n = Number(m[1])
  return /^c/i.test(m[2]) ? Math.round(n * 1e7) : Math.round(n * 1e5)
}

/**
 * "Minebea AS (Minoru Haranomura)"         → company "Minebea AS",  person "Minoru Haranomura"
 * "Ar. Adeesh Garg — ONE.618 Architects…"  → company "ONE.618 Architects", person "Ar. Adeesh Garg"
 * "Khanna Commercial"                      → company "Khanna Commercial", person null
 */
function parseParty(raw) {
  const s = clean(raw) ?? ""
  const dash = s.split(/\s+—\s+/)
  if (dash.length > 1 && /^(ar\.|mr\.|ms\.|dr\.)/i.test(dash[0])) {
    return { company: dash[1].replace(/\s*\(.*\)\s*$/, "").trim(), person: dash[0].trim() }
  }
  const paren = s.match(/^(.*?)\s*\((.*)\)\s*$/)
  if (paren) {
    // "(ref. Ar. Sandeep, Arch10)" and "(Dharuhera)" are context, not people.
    const inner = paren[2]
    const isPerson = !/^(ref\.|via |based in|dharuhera|bangalore|kiwale|group rhine|govt)/i.test(inner) && !/ex-/i.test(inner)
    return { company: paren[1].trim(), person: isPerson ? inner.split(/[;,/]/)[0].replace(/\b(PM|Sr Engr|SCM|GM-Proc|VP|ED)\b/g, "").trim() : null, context: isPerson ? null : inner }
  }
  return { company: s, person: null }
}

function extractEmail(raw) {
  const m = String(raw ?? "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  return m ? m[0].toLowerCase() : null
}

function extractPhone(raw) {
  // Only Indian numbers; "+1 615 310 5410" and "+66 957019391" are
  // kept in the notes but not forced into a 10-digit field.
  const s = String(raw ?? "")
  const m = s.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/)
  return m ? phoneTail(m[0]) : null
}

// ------------------------------------------------------------------

async function main() {
  const sb = supabase()
  const { XLSX, wb } = readWorkbook(FILE)

  const dataSet = DRY_RUN
    ? await getDataSet(sb, DATA_SET).catch(() => ({ id: "dry-run-data-set" }))
    : await getDataSet(sb, DATA_SET)

  const { data: admin } = await sb.from("profiles").select("id").eq("email", "admin@hagerstone.com").maybeSingle()
  const { data: stages } = await sb.from("pipeline_stages").select("id, slug, position")
  const stageBySlug = Object.fromEntries(stages.map((s) => [s.slug, s]))
  const stageById = Object.fromEntries(stages.map((s) => [s.id, s]))

  // external_ref exists only after migration 003; a pre-migration dry
  // run falls back to the base columns.
  const leads = await fetchAll(sb, "leads", "id, full_name, company_name, email, phone, phone_alt, stage_id, external_ref, data_set_id")
    .catch(() => fetchAll(sb, "leads", "id, full_name, company_name, email, phone, phone_alt, stage_id"))

  const byRef = new Map()
  const byEmail = new Map()
  const byPhone = new Map()
  const byCompany = new Map()
  for (const l of leads) {
    if (l.external_ref && l.data_set_id === dataSet.id) byRef.set(l.external_ref, l)
    if (l.email) byEmail.set(l.email.toLowerCase(), l)
    for (const p of [l.phone, l.phone_alt]) {
      const t = phoneTail(p)
      if (t) byPhone.set(t, l)
    }
    const k = companyKey(l.company_name)
    if (k && !byCompany.has(k)) byCompany.set(k, l)
  }

  // ----------------------------------------------------------------
  // Read the tabs
  // ----------------------------------------------------------------

  const [header, ...body] = sheetRows(XLSX, wb, "00-ONGOING TENDERS")
  const col = Object.fromEntries(header.map((h, i) => [h, i]))
  const rows = body
    .filter((r) => clean(r[col["#"]]))
    .map((r) => {
      let nextAction = clean(r[col["Next Action"]])
      let nextDateRaw = clean(r[col["Next Date"]])
      // From serial #47 on, the tab's Next Action column holds the date
      // and Next Date holds "?" — a column shift in the source.
      if (nextAction && /^\d{1,2}-[A-Za-z]{3}$/.test(nextAction) && !nextDateRaw) {
        nextDateRaw = nextAction
        nextAction = null
      }
      return {
        serial: String(r[col["#"]]).trim(),
        cat: clean(r[col["Cat"]]),
        partyRaw: clean(r[col["Party"]]),
        project: clean(r[col["Project"]]),
        valueRaw: clean(r[col["Value"]]),
        contactRaw: clean(r[col["Contact"]]),
        status: clean(r[col["Status"]])?.toUpperCase(),
        nextAction,
        nextDate: parseNextDate(nextDateRaw),
        owner: clean(r[col["Owner"]]),
      }
    })

  const immediate = new Set(
    sheetRows(XLSX, wb, "03-IMMEDIATE ACTIONS").slice(1).map((r) => String(r[0]).trim()).filter(Boolean),
  )

  // How many deals the founder lists per company — see header note.
  const dealsPerCompany = new Map()
  for (const r of rows) {
    const k = companyKey((PARTY_OVERRIDES[r.serial] ?? parseParty(r.partyRaw)).company)
    if (k) dealsPerCompany.set(k, (dealsPerCompany.get(k) ?? 0) + 1)
  }

  // Idempotency for merge notes.
  const existingNotes = DRY_RUN ? [] : await fetchAll(
    sb, "interactions", "lead_id, title",
    (q) => q.eq("data_set_id", dataSet.id).eq("type", "note"),
  )
  const noted = new Set(existingNotes.map((n) => `${n.lead_id}|${n.title}`))

  const addNote = async (leadId, title, notes, occurredAt = SNAPSHOT.at) => {
    const key = `${leadId}|${title}`
    if (noted.has(key)) return false
    noted.add(key)
    if (DRY_RUN) return true
    const { error } = await sb.from("interactions").insert({
      lead_id: leadId, user_id: null, type: "note", title, notes,
      occurred_at: occurredAt, created_at: occurredAt,
      is_automated: false, data_set_id: dataSet.id,
    })
    if (error) throw new Error(`note on ${leadId}: ${error.message}`)
    return true
  }

  const stats = { created: 0, updated: 0, merged: 0, orphanNotes: 0 }

  for (const r of rows) {
    // --------------------------------------------------------------
    // #287 — annotate the nine orphaned architect firms
    // --------------------------------------------------------------
    if (r.serial === ORPHANED_ARCHITECTS_SERIAL) {
      for (const name of ORPHANED_ARCHITECTS) {
        const lead = byCompany.get(companyKey(name))
        if (!lead) {
          log(`#287     no lead for ${name}`)
          continue
        }
        const wrote = await addNote(
          lead.id,
          "Founder pipeline #287 — orphaned architect follow-up",
          [
            "Listed in the founder's working pipeline as one of 9 Priority-1 NCR architect firms left mid-follow-up when Saurabh (NCR sales, delhi@) resigned in Apr 2026.",
            "",
            `Status: ${r.status} · Owner: ${r.owner}`,
            `Next action (as of ${r.nextDate?.label ?? "Aug 2026"}): re-establish contact and pick up from the last meeting below.`,
            `Source: ${FILE} → 00-ONGOING TENDERS, snapshot ${SNAPSHOT.label}.`,
          ].join("\n"),
        )
        log(`#287     → ${lead.company_name}${wrote ? "" : " (already noted)"}`)
        if (wrote) stats.orphanNotes++
      }
      continue
    }

    const party = PARTY_OVERRIDES[r.serial] ?? parseParty(r.partyRaw)
    const email = extractEmail(r.contactRaw)
    const phone = extractPhone(r.contactRaw)
    const value = parseValue(r.valueRaw)
    const stageSlug = STAGE_FOR_STATUS[r.status] ?? "new_lead"
    const stage = stageBySlug[stageSlug]
    const onImmediateList = immediate.has(r.serial)
    const companyK = companyKey(party.company)

    const summary = [
      r.project ? `Project: ${r.project}` : null,
      `Status: ${r.status}${r.cat ? ` · ${r.cat}` : ""}`,
      r.valueRaw ? `Value: ${r.valueRaw}` : "Value: not yet known",
      r.contactRaw ? `Contact: ${r.contactRaw}` : null,
      r.owner ? `Owner: ${r.owner}` : null,
      r.nextAction || r.nextDate
        ? `Next action: ${r.nextAction ?? "follow up"}${r.nextDate ? ` (due ${r.nextDate.label})` : ""}`
        : null,
      onImmediateList ? "On the MD's IMMEDIATE ACTIONS list." : null,
    ].filter(Boolean)

    // --------------------------------------------------------------
    // Already imported → refresh the founder-owned fields
    // --------------------------------------------------------------
    const own = byRef.get(r.serial)
    if (own) {
      log(`update   #${r.serial}  ${r.partyRaw}`)
      if (!DRY_RUN) {
        const { error } = await sb.from("leads").update({
          owner_name: r.owner,
          estimated_budget: r.valueRaw,
          proposal_estimated_cost: value,
          ...(onImmediateList ? { priority: "P1", priority_note: `On the MD's Immediate Actions list (${SNAPSHOT.label}).`, priority_updated_at: SNAPSHOT.at } : {}),
        }).eq("id", own.id)
        if (error) throw new Error(`update #${r.serial}: ${error.message}`)
      }
      stats.updated++
      continue
    }

    // --------------------------------------------------------------
    // Already in the ERP from another source → merge
    // --------------------------------------------------------------
    // A company-only match is trusted only when it cannot be two
    // different people: either the ERP lead is a bare company record
    // (name = company) or the founder row names nobody.
    const companyMatch = companyK && dealsPerCompany.get(companyK) === 1 ? byCompany.get(companyK) : null
    const samePersonPossible = companyMatch && (
      !party.person ||
      !companyMatch.full_name ||
      companyMatch.full_name.trim().toLowerCase() === (companyMatch.company_name ?? "").trim().toLowerCase()
    )

    const match =
      (email && byEmail.get(email)) ||
      (phone && byPhone.get(phone)) ||
      (samePersonPossible ? companyMatch : null) ||
      null

    if (match) {
      const patch = { owner_name: r.owner }
      if (r.valueRaw) patch.estimated_budget = r.valueRaw
      if (value) patch.proposal_estimated_cost = value
      if (onImmediateList) Object.assign(patch, { priority: "P1", priority_note: `On the MD's Immediate Actions list (${SNAPSHOT.label}).`, priority_updated_at: SNAPSHOT.at })
      // Only move a lead that nobody has worked yet. If someone already
      // moved it, their judgement is newer than this spreadsheet.
      const current = stageById[match.stage_id]
      if (current?.slug === "new_lead" && stage && stageSlug !== "new_lead") patch.stage_id = stage.id

      log(`merge    #${r.serial}  ${r.partyRaw}  →  ${match.company_name ?? match.full_name}${patch.stage_id ? `  [stage → ${stageSlug}]` : ""}`)
      if (!DRY_RUN) {
        const { error } = await sb.from("leads").update(patch).eq("id", match.id)
        if (error) throw new Error(`merge #${r.serial}: ${error.message}`)
      }
      await addNote(
        match.id,
        `Founder pipeline #${r.serial} — ${r.status}`,
        [...summary, "", `Source: ${FILE} → 00-ONGOING TENDERS, snapshot ${SNAPSHOT.label}.`].join("\n"),
      )
      stats.merged++
      continue
    }

    // --------------------------------------------------------------
    // New lead
    // --------------------------------------------------------------
    const row = {
      full_name: party.person ?? party.company ?? r.partyRaw,
      company_name: party.company,
      email,
      phone,
      service_line: SERVICE_LINE_FOR_CAT[r.cat] ?? "unknown",
      estimated_budget: r.valueRaw,
      proposal_estimated_cost: value,
      stage_id: stage?.id ?? null,
      stage_entered_at: SNAPSHOT.at,
      source: "manual_sales",
      source_detail: `Founder Sales Engine · pipeline #${r.serial}`,
      created_by: admin?.id ?? null,
      data_set_id: dataSet.id,
      external_ref: r.serial,
      owner_name: r.owner,
      priority: onImmediateList ? "P1" : null,
      priority_note: onImmediateList ? `On the MD's Immediate Actions list (${SNAPSHOT.label}).` : null,
      priority_updated_at: onImmediateList ? SNAPSHOT.at : null,
      ...(stageSlug === "won" ? { won_date: SNAPSHOT.at.slice(0, 10), closure_value: value } : {}),
      initial_notes: [
        `[Imported from ${FILE} — founder's working pipeline, serial #${r.serial}]`,
        "",
        `Party: ${r.partyRaw}`,
        ...summary,
      ].join("\n"),
    }

    log(`create   #${r.serial}  ${stageSlug.padEnd(13)}  ${row.company_name}${party.person ? ` (${party.person})` : ""}${value ? `  ₹${value.toLocaleString("en-IN")}` : ""}`)
    if (!DRY_RUN) {
      const { data, error } = await sb.from("leads").insert(row).select("id").single()
      if (error) throw new Error(`insert #${r.serial}: ${error.message}`)
      byRef.set(r.serial, { id: data.id })
    }
    stats.created++
  }

  const { count } = DRY_RUN
    ? { count: stats.created }
    : await sb.from("leads").select("id", { count: "exact", head: true }).eq("data_set_id", dataSet.id)

  await markImported(
    sb, dataSet.id, count ?? 0,
    `${rows.length} rows from 00-ONGOING TENDERS (${stats.created} new leads, ${stats.merged} merged into existing leads), snapshot ${SNAPSHOT.label}.`,
  )

  console.log("\nDone.", JSON.stringify(stats))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
