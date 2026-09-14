// Shared plumbing for the one-off data imports in this folder.
//
// Every import here is designed to be re-runnable: rows are matched
// before they are inserted, so running a script twice updates rather
// than duplicates. Pass --dry-run to any script to see what it would
// do without writing anything.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
export const DRY_RUN = process.argv.includes("--dry-run")

export function loadEnv() {
  const file = path.join(ROOT, ".env.local")
  const env = {}
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

export function supabase() {
  const env = loadEnv()
  const { createClient } = require("@supabase/supabase-js")
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "marketing" },
    auth: { persistSession: false },
  })
}

export function readWorkbook(fileName) {
  const XLSX = require("xlsx")
  return { XLSX, wb: XLSX.readFile(path.join(ROOT, fileName)) }
}

/** Rows of a sheet as arrays, blanks as "". */
export function sheetRows(XLSX, wb, name) {
  const sheet = wb.Sheets[name]
  if (!sheet) throw new Error(`Sheet not found: ${name}`)
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
}

// ------------------------------------------------------------------
// Cleaning
// ------------------------------------------------------------------

/** The source workbooks use "?", "—" and "-" to mean "unknown". */
export function clean(value) {
  if (value === null || value === undefined) return null
  const s = String(value).replace(/\s+/g, " ").trim()
  if (s === "" || s === "?" || s === "—" || s === "-" || s === "–" || s.toLowerCase() === "na") return null
  return s
}

/**
 * Last 10 digits of a phone — the founder's dedupe key. Returns null
 * for anything that is not a plausible Indian mobile/landline, so a
 * stray "8223047773.0" still works but "123" does not match everything.
 */
export function phoneTail(value) {
  const s = clean(value)
  if (!s) return null
  // A cell can hold two numbers ("9826465458 / 9826333262"); take the first.
  const first = s.split(/[\/,;]| or /i)[0]
  const digits = first.replace(/\.0$/, "").replace(/\D/g, "")
  if (digits.length < 10) return null
  return digits.slice(-10)
}

/** A phone as stored on a lead: 10-digit tail, as the existing rows are. */
export function normalisePhone(value) {
  return phoneTail(value)
}

const COMPANY_NOISE = [
  "pvt", "private", "ltd", "limited", "llp", "inc", "india",
  "architects", "architect", "architecture", "and", "associates", "associate",
  "interior", "interiors", "designers", "designer", "design", "designs",
  "studio", "services", "the", "group", "co", "company",
]

/**
 * Reduce a company name to its distinctive core, so "EK CHHAT
 * ASSOCIATES (ECA)" and "Ek Chatt Associate" have a chance of meeting.
 */
export function companyKey(value) {
  const s = clean(value)
  if (!s) return null
  const words = s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !COMPANY_NOISE.includes(w))
  const key = words.join("")
  return key.length >= 3 ? key : null
}

// ------------------------------------------------------------------
// Dates
// ------------------------------------------------------------------

/**
 * A date as an IST midday timestamp. Midday, because these sources
 * only record the day, and midnight IST is the previous day in UTC —
 * which would put a meeting on the wrong date in half the views.
 */
export function istNoon(year, month, day) {
  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${year}-${mm}-${dd}T12:00:00+05:30`
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

/** "22 Dec" → { day: 22, month: 12 } */
export function parseDayMonth(value) {
  const m = String(value).trim().match(/^(\d{1,2})[\s-]+([A-Za-z]{3})/)
  if (!m) return null
  const month = MONTHS[m[2].toLowerCase()]
  return month ? { day: Number(m[1]), month } : null
}

/** "06/12/2025" → { day: 6, month: 12, year: 2025 } */
export function parseDmy(value) {
  const m = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) } : null
}

// ------------------------------------------------------------------
// Batching
// ------------------------------------------------------------------

export function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Every row of a table, paging past PostgREST's 1000-row cap. */
export async function fetchAll(sb, table, columns, apply = (q) => q) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await apply(sb.from(table).select(columns)).range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}

export async function getDataSet(sb, key) {
  const { data, error } = await sb.from("data_sets").select("id, key, name").eq("key", key).maybeSingle()
  if (error) throw new Error(`data_sets: ${error.message} — has migration 003 been applied?`)
  if (!data) throw new Error(`Data set "${key}" not found — has migration 003 been applied?`)
  return data
}

export async function markImported(sb, dataSetId, recordCount, note) {
  if (DRY_RUN) return
  const { error } = await sb
    .from("data_sets")
    .update({ record_count: recordCount, imported_at: new Date().toISOString(), source_note: note })
    .eq("id", dataSetId)
  if (error) throw new Error(`data_sets update: ${error.message}`)
}

export function log(...args) {
  console.log(DRY_RUN ? "[dry-run]" : "", ...args)
}
