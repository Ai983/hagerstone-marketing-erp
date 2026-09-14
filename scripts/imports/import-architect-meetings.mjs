// Architect meeting drive (Dec 2025) → ERP
//
//   node scripts/imports/import-architect-meetings.mjs [--dry-run]
//
// Source: "Hagerstone Architect Meeting Data.xlsx" — the Delhi/NCR
// team's reports to the MD from the "Meeting Report : Last 15 Days"
// thread. The 35 firms on its master tracker are already leads (they
// were imported on 05-Sep-2026) but their meeting history was not, so
// whoever calls them next starts cold.
//
// This script:
//   1. Tags those 35 leads with the "Architect Drive" data set and
//      records their P1–P4 rating in `leads.priority`.
//   2. Creates leads for firms that were met but never made it onto
//      the tracker (MIM Architects, SHIVOASIS, …).
//   3. Logs every meeting from the three reports as a `meeting`
//      interaction, dated when it actually happened, so it sits in
//      the lead timeline and on the Meetings page.
//
// Source text is kept verbatim. Where the workbook's own "Data Notes
// & Flags" sheet marks something as wrong, the correction is applied
// AND the original is written into the note, so nothing is silently
// changed.

import {
  DRY_RUN, supabase, readWorkbook, sheetRows, clean, phoneTail, companyKey,
  istNoon, parseDayMonth, parseDmy, fetchAll, getDataSet, markImported, log,
} from "./_shared.mjs"

const FILE = "Hagerstone Architect Meeting Data.xlsx"
const DATA_SET = "architect-meetings-dec-2025"
const IMPORT_TAG = `[Imported from "${FILE}"]`

// The same firm is spelled differently across the four emails. These
// are the variants the workbook's own flags sheet lists, plus the two
// where the weekly summary shortens a name.
const ALIASES = {
  "hero reality": "Hero Realty",
  "mark and spencer": "Mark & Spencer",
  "ek chatt associate": "EK CHHAT ASSOCIATES (ECA)",
  "meskot architecture services": "MESKOT Architecture & Services",
  "msap architects": "MSAP Architects & Interior Designers",
  "neomen architects": "NEOMEN - Architects & Interior Designers",
  "essentia environments": "ESSENTIA ENVIRONMENT",
  "ykk": "YKK India Pvt. Ltd.",
  "ykk india": "YKK India Pvt. Ltd.",
  // Sojitz is the trading house YKK's tender runs through (founder
  // pipeline #284: "YKK India (via Sojitz — Mahak Khanna)"). The two
  // Sojitz meetings were about that deal, so they belong on that lead.
  "sojitz": "YKK India Pvt. Ltd.",
}

const PRIORITY = {
  "priority 1": "P1",
  "priority 2": "P2",
  "priority 3": "P3",
  "priority 4": "P4",
  "client dropped": "dropped",
}

// From the "Priority Actions" sheet — the MD's recommended handling
// for each bucket, as written in the 24 Dec strategy email.
const RECOMMENDED = {
  P1: "Schedule meetings within the next 2-3 weeks. Maintain weekly touchpoints and prepare BOQ/pricing readiness.",
  P2: "Nurture via follow-up emails, capability decks, and selective project references.",
  P4: "Quarterly check-ins only. Do not allocate high sales bandwidth.",
}

/** Strip the "| Architects & Interior Designers in Gurugram" SEO tails. */
function firmName(raw) {
  const s = clean(raw)
  return s ? s.split("|")[0].trim() : null
}

function canonical(raw) {
  const name = firmName(raw)
  if (!name) return null
  return ALIASES[name.toLowerCase()] ?? name
}

function titleCase(s) {
  if (!s) return s
  // Leave mixed-case and short all-caps (acronyms) alone.
  if (s !== s.toLowerCase()) return s
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Outcome in the Log Meeting modal's vocabulary, inferred from the
 * remark. Conservative: anything not clearly one of these is "other"
 * rather than a guess.
 */
function inferOutcome(remark, priority) {
  const r = (remark || "").toLowerCase()
  if (priority === "dropped") return "not_interested"
  if (/\bboq\b/.test(r)) return "boq_requested"
  if (/not available|unavailable|out of town|denied|not picking|couldn't connect|reconnect|call after|connect after|confirm|meeting set|meeting fixed|further meeting|additional meeting|follow-up|follow up|need further|needs further|touchbase|further interaction|regular interaction/.test(r))
    return "needs_follow_up"
  if (/interested|fruitful|positive|will share|ready to have us|share some projects/.test(r)) return "positive"
  return "other"
}

// ------------------------------------------------------------------

async function main() {
  const sb = supabase()
  const { XLSX, wb } = readWorkbook(FILE)
  // A dry run is useful before migration 003 exists, to check matching.
  const dataSet = DRY_RUN
    ? await getDataSet(sb, DATA_SET).catch(() => ({ id: "dry-run-data-set" }))
    : await getDataSet(sb, DATA_SET)

  const { data: admin } = await sb.from("profiles").select("id").eq("email", "admin@hagerstone.com").maybeSingle()
  const { data: newStage } = await sb.from("pipeline_stages").select("id").eq("slug", "new_lead").maybeSingle()

  const leads = await fetchAll(sb, "leads", "id, full_name, company_name, phone, phone_alt")

  // A name made only of generic words ("The Interior Company") has no
  // company key, so it needs an exact-name fallback or it never matches.
  const exactName = (s) => (clean(s) ?? "").toLowerCase()

  const byPhone = new Map()
  const byCompany = new Map()
  for (const l of leads) {
    for (const p of [l.phone, l.phone_alt]) {
      const t = phoneTail(p)
      if (t && !byPhone.has(t)) byPhone.set(t, l)
    }
    const k = companyKey(l.company_name) ?? exactName(l.company_name)
    if (k && !byCompany.has(k)) byCompany.set(k, l)
  }

  // Company first here, not phone: several firms in this workbook share
  // a POC across rows, and a phone match to the wrong firm is worse
  // than a miss that creates a lead.
  const findLead = (company, phone) => {
    const k = companyKey(canonical(company)) ?? exactName(canonical(company))
    if (k && byCompany.has(k)) return byCompany.get(k)
    const t = phoneTail(phone)
    if (t && byPhone.has(t)) return byPhone.get(t)
    return null
  }

  const stats = { tagged: 0, prioritised: 0, created: 0, meetings: 0, meetingsSkipped: 0 }
  const unmatched = []

  // ----------------------------------------------------------------
  // 1. Master tracker (24 Dec) — the latest word on every firm
  // ----------------------------------------------------------------

  const tracker = sheetRows(XLSX, wb, "Master Tracker (24 Dec)")
    .slice(1)
    .filter((r) => clean(r[1]) && !String(r[0]).startsWith("Source:"))

  const trackerPriority = new Map()   // leadId → P-code, so later reports don't override the newer rating

  for (const [, client, phone, , priorityRaw, remark] of tracker) {
    const lead = findLead(client, phone)
    if (!lead) {
      unmatched.push(`tracker: ${client}`)
      continue
    }
    const priority = PRIORITY[String(priorityRaw).trim().toLowerCase()] ?? null
    trackerPriority.set(lead.id, priority)

    const noteParts = [`${clean(priorityRaw) ?? "Not specified"} — 24 Dec 2025 master tracker.`, clean(remark)]
    if (priority && RECOMMENDED[priority]) noteParts.push(`Recommended: ${RECOMMENDED[priority]}`)

    const patch = {
      data_set_id: dataSet.id,
      priority,
      priority_note: noteParts.filter(Boolean).join(" "),
      priority_updated_at: istNoon(2025, 12, 24),
    }

    log(`tracker  ${priority ?? "—"}  ${client}  →  ${lead.company_name}`)
    if (!DRY_RUN) {
      const { error } = await sb.from("leads").update(patch).eq("id", lead.id)
      if (error) throw new Error(`update lead ${lead.id}: ${error.message}`)
    }
    stats.tagged++
    if (priority) stats.prioritised++
  }

  // ----------------------------------------------------------------
  // 2. Gather every meeting from the three reports
  // ----------------------------------------------------------------

  const meetings = []

  // 23 Dec weekly meetings log — 20 rows with addresses and consultant.
  for (const [client, phone, address, priorityRaw, remark, poc, date, consultant] of sheetRows(XLSX, wb, "Meetings Log (23 Dec)").slice(1)) {
    if (!clean(client) || String(client).startsWith("Source:")) continue
    const dm = parseDayMonth(date)
    if (!dm) continue
    meetings.push({
      report: "23 Dec 2025 weekly meetings log",
      client, phone, address: clean(address), poc: clean(poc),
      consultant: clean(consultant),
      priority: PRIORITY[String(priorityRaw).trim().toLowerCase()] ?? null,
      remark: clean(remark) === "(no remark recorded in source)" ? null : clean(remark),
      occurredAt: istNoon(2025, dm.month, dm.day),
    })
  }

  // 08 Dec 15-day report — 14 rows. The workbook flags six of these
  // (24/12–29/12) as impossible: the email was sent 08 Dec. They are
  // almost certainly November dates with the month mistyped.
  const REPORT_SENT = new Date("2025-12-08T11:56:00+05:30")
  for (const [studio, poc, dateRaw, remark] of sheetRows(XLSX, wb, "15-Day Report (08 Dec)").slice(1)) {
    if (!clean(studio) || String(studio).startsWith("Source:")) continue
    const d = parseDmy(dateRaw)
    if (!d) continue
    let { day, month, year } = d
    let dateNote = null
    if (new Date(istNoon(year, month, day)) > REPORT_SENT) {
      dateNote = `Date written as ${dateRaw} in the source, which is after the report was sent (08 Dec 2025); recorded as ${String(day).padStart(2, "0")}/11/${year}.`
      month = 11
    }
    meetings.push({
      report: "08 Dec 2025 15-day meeting report",
      client: studio, phone: null, address: null, poc: clean(poc),
      consultant: null, priority: null,
      remark: clean(remark), dateNote,
      occurredAt: istNoon(year, month, day),
    })
  }

  // 13 Dec weekly summary — the six client meetings it lists.
  const weekly = sheetRows(XLSX, wb, "Weekly Summary (13 Dec)")
  const start = weekly.findIndex((r) => r[0] === "Client" && r[1] === "Date")
  for (const [client, dateRaw, remark] of weekly.slice(start + 1)) {
    if (!clean(client)) break
    const d = parseDmy(dateRaw)
    if (!d) continue
    meetings.push({
      report: "13 Dec 2025 weekly task summary",
      client, phone: null, address: null, poc: null,
      consultant: null, priority: null,
      remark: clean(remark),
      occurredAt: istNoon(d.year, d.month, d.day),
      viaSojitz: String(client).trim().toLowerCase() === "sojitz",
    })
  }

  // ----------------------------------------------------------------
  // 3. Create leads for firms met but never tracked
  // ----------------------------------------------------------------

  const needed = new Map()
  for (const m of meetings) {
    if (findLead(m.client, m.phone)) continue
    const name = canonical(m.client)
    const k = companyKey(name) ?? exactName(name)
    if (!needed.has(k)) needed.set(k, m)
    else if (!needed.get(k).phone && m.phone) needed.set(k, m)   // prefer the report that has a phone
  }

  // Shefali Design Studio is in the P2 recommendation list but never
  // made the tracker — record that rating when we create it.
  const PRIORITY_ACTION_ONLY = { shefali: "P2" }

  for (const m of needed.values()) {
    const company = titleCase(canonical(m.client))
    const k = companyKey(company) ?? exactName(company)
    const priority = m.priority ?? PRIORITY_ACTION_ONLY[k] ?? null
    const city = /greater noida/i.test(m.address ?? "") ? "Greater Noida"
      : /noida/i.test(m.address ?? "") ? "Noida"
      : /gurgaon|gurugram/i.test(m.address ?? "") ? "Gurugram"
      : /delhi/i.test(m.address ?? "") ? "Delhi"
      : null

    const row = {
      full_name: titleCase(m.poc) ?? company,
      company_name: company,
      phone: phoneTail(m.phone),
      city,
      full_address: m.address,
      source: "manual_sales",
      source_detail: "Architect meeting drive — Dec 2025",
      stage_id: newStage?.id ?? null,
      created_by: admin?.id ?? null,
      data_set_id: dataSet.id,
      priority,
      priority_note: priority
        ? `${priority === "dropped" ? "Client Dropped" : `Priority ${priority.slice(1)}`} — ${m.report}.${priority && RECOMMENDED[priority] ? ` Recommended: ${RECOMMENDED[priority]}` : ""}`
        : null,
      priority_updated_at: priority ? m.occurredAt : null,
      initial_notes: [
        `${IMPORT_TAG} — Delhi/NCR field campaign. This firm was met but does not appear on the 24 Dec 2025 master tracker.`,
        "",
        `First seen in: ${m.report}`,
        m.poc ? `POC: ${m.poc}` : null,
        m.address ? `Address: ${m.address}` : null,
      ].filter((x) => x !== null).join("\n"),
    }

    log(`create   ${priority ?? "—"}  ${company}  (${row.full_name}, ${row.phone ?? "no phone"})`)
    if (DRY_RUN) {
      const fake = { id: `dry-${k}`, company_name: company, phone: row.phone }
      byCompany.set(k, fake)
      stats.created++
      continue
    }
    const { data, error } = await sb.from("leads").insert(row).select("id, company_name, phone").single()
    if (error) throw new Error(`insert lead ${company}: ${error.message}`)
    byCompany.set(k, data)
    const t = phoneTail(data.phone)
    if (t) byPhone.set(t, data)
    stats.created++
  }

  // ----------------------------------------------------------------
  // 4. Log the meetings
  // ----------------------------------------------------------------

  // Idempotency: one imported meeting per (lead, day). A re-run finds
  // the existing row and skips it.
  const existing = DRY_RUN ? [] : await fetchAll(
    sb, "interactions", "lead_id, occurred_at",
    (q) => q.eq("data_set_id", dataSet.id).eq("type", "meeting"),
  )
  const seen = new Set(existing.map((e) => `${e.lead_id}|${String(e.occurred_at).slice(0, 10)}`))

  for (const m of meetings) {
    const lead = findLead(m.client, m.phone)
    if (!lead) {
      unmatched.push(`meeting: ${m.client}`)
      continue
    }
    const day = new Date(m.occurredAt).toISOString().slice(0, 10)
    const key = `${lead.id}|${day}`
    if (seen.has(key)) {
      stats.meetingsSkipped++
      continue
    }
    seen.add(key)

    const hagerstone = m.consultant ? `Hagerstone: ${m.consultant}` : null
    const attendees = [titleCase(m.poc), hagerstone].filter(Boolean).join(" · ") || null

    // The meeting's own priority is kept in the note, not on the lead:
    // the tracker (24 Dec) is newer and already set that.
    const priorityLine = m.priority && trackerPriority.get(lead.id) && trackerPriority.get(lead.id) !== m.priority
      ? `Rated ${m.priority === "dropped" ? "Client Dropped" : `Priority ${m.priority.slice(1)}`} in this report (the 24 Dec tracker later rated it ${trackerPriority.get(lead.id)}).`
      : m.priority ? `Rated ${m.priority === "dropped" ? "Client Dropped" : `Priority ${m.priority.slice(1)}`} in this report.` : null

    const notes = [
      m.remark ?? "No remark recorded in the source report.",
      "",
      m.viaSojitz ? "Meeting was with Sojitz, the trading house YKK's tender runs through." : null,
      priorityLine,
      m.dateNote,
      `Source: ${m.report}.`,
    ].filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim()

    const row = {
      lead_id: lead.id,
      user_id: null,                // Saurabh and Vishal have no ERP accounts
      type: "meeting",
      title: m.viaSojitz ? "Office Visit — Sojitz" : `Office Visit${m.consultant ? ` — ${m.consultant}` : ""}`,
      notes,
      outcome: inferOutcome(m.remark, m.priority),
      location: m.address,
      attendees,
      occurred_at: m.occurredAt,
      created_at: m.occurredAt,
      is_automated: false,
      data_set_id: dataSet.id,
    }

    log(`meeting  ${day}  ${m.client}  →  ${lead.company_name}  [${row.outcome}]`)
    if (!DRY_RUN) {
      const { error } = await sb.from("interactions").insert(row)
      if (error) throw new Error(`insert meeting ${m.client}: ${error.message}`)
    }
    stats.meetings++
  }

  // ----------------------------------------------------------------

  const { count } = DRY_RUN
    ? { count: stats.tagged + stats.created }
    : await sb.from("leads").select("id", { count: "exact", head: true }).eq("data_set_id", dataSet.id)

  await markImported(
    sb, dataSet.id, count ?? 0,
    `${stats.meetings} meetings from the 08, 13 and 23 Dec 2025 reports; priorities from the 24 Dec tracker.`,
  )

  console.log("\nDone.", JSON.stringify(stats))
  if (unmatched.length) console.log("Unmatched:\n  " + [...new Set(unmatched)].join("\n  "))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
