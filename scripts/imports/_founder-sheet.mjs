// Reading Dhruv sir's SALES_FUNNEL_MASTER.xlsx working pipeline.
// Shared by the import and the Manpreet handover so both read the
// tab — including its column shift — the same way.

import { clean, istNoon, sheetRows } from "./_shared.mjs"

export const FOUNDER_FILE = "SALES_FUNNEL_MASTER.xlsx"
export const FOUNDER_SNAPSHOT = { label: "14 Sep 2026", at: istNoon(2026, 9, 14) }

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

/** "06-Aug" → 2026-08-06. Every date in the tab is in 2026. */
export function parseNextDate(value) {
  const m = String(value ?? "").trim().match(/^(\d{1,2})-([A-Za-z]{3})$/)
  if (!m) return null
  const month = MONTHS[m[2].toLowerCase()]
  return month ? { label: m[0], iso: istNoon(2026, month, Number(m[1])) } : null
}

/** Rows of `00-ONGOING TENDERS`, plus the serials on `03-IMMEDIATE ACTIONS`. */
export function readFounderPipeline(XLSX, wb) {
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

  return { rows, immediate }
}
