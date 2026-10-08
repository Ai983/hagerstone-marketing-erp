// Turns a day of Runo calls into ERP timeline entries.
//
// Every Runo field name lives either here or in lib/utils/runo.ts — nowhere
// else. Runs on the server with the service-role client (cron + admin route).
//
// Rules:
//  - A call lands on the lead whose phone_tail (last 10 digits) matches the
//    customer's number. Unknown numbers are NOT turned into leads — they're
//    reported back so someone can decide.
//  - Calls the rep marked "personal" in Runo are never imported.
//  - The caller is matched to an ERP profile by the last 10 digits of the
//    Runo user's phone vs profiles.phone.
//  - Idempotent: a callId already imported is skipped, so a day can be
//    re-run safely.

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchRunoCallLogs,
  fetchRunoInteractions,
  fetchRunoUsers,
  type RunoCallLog,
  type RunoInteraction,
} from "@/lib/utils/runo"

export const RUNO_SOURCE = "runo"

/** Same rule as leads.phone_tail: last 10 digits, or null. */
export function phoneTail(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "")
  return digits.length >= 10 ? digits.slice(-10) : null
}

/** IST calendar date for "yesterday" — Runo only serves past dates. */
export function yesterdayIST(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  ist.setUTCDate(ist.getUTCDate() - 1)
  return ist.toISOString().slice(0, 10)
}

/**
 * Which past dates to sync: one `date`, or the last `days` (max 31) ending
 * yesterday. Runo refuses today and future dates.
 */
export function resolveRunoDates(input: {
  date?: string | null
  days?: number | string | null
}): { dates: string[] } | { error: string } {
  const yesterday = yesterdayIST()
  if (input.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date > yesterday) {
      return { error: `Date must be YYYY-MM-DD and no later than ${yesterday} — Runo only gives past days.` }
    }
    return { dates: [input.date] }
  }
  const days = Math.min(Math.max(Number(input.days) || 1, 1), 31)
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${yesterday}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i)
    return d.toISOString().slice(0, 10)
  }).reverse()
  return { dates }
}

type CallType = "call_outbound" | "call_inbound" | "call_missed"

export function mapCallType(log: Pick<RunoCallLog, "type" | "duration" | "tag">): CallType {
  if (log.type === "missed") return "call_missed"
  if (log.type === "outgoing" && (log.tag === "unanswered" || !log.duration)) return "call_missed"
  return log.type === "incoming" ? "call_inbound" : "call_outbound"
}

// Runo disposition → interactions.outcome (CHECK-constrained). Matched on
// lower-case keywords because each Runo account names its own dispositions.
// Anything unrecognised becomes null; the raw string is always kept in
// call_disposition, so this table can grow later without losing data.
const DISPOSITION_RULES: [RegExp, string][] = [
  [/not\s*interest/, "not_interested"],
  [/wrong\s*(number|no)/, "wrong_number"],
  [/call\s*back|callback|follow/, "callback_requested"],
  [/busy/, "busy"],
  [/not\s*(answer|pick|contact|reach)|no\s*answer|rnr|switch(ed)?\s*off|unreach/, "no_answer"],
  [/voice\s*mail/, "voicemail"],
  [/boq/, "boq_requested"],
  [/proposal|quotation|quote/, "proposal_requested"],
  [/negotiat/, "negotiating"],
  [/hold/, "on_hold"],
  [/won|converted|closed\s*won|order/, "converted"],
  [/lost|closed\s*lost|drop/, "lost"],
  [/interest|appointment|meeting|visit|positive/, "interested"],
]

export function mapDisposition(status: string | null, type: CallType): string | null {
  const s = (status ?? "").trim().toLowerCase()
  if (s) {
    for (const [pattern, outcome] of DISPOSITION_RULES) {
      if (pattern.test(s)) return outcome
    }
    return "other"
  }
  return type === "call_missed" ? "no_answer" : null
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0s"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m ? `${m}m ${s}s` : `${s}s`
}

/** Notes typed in Runo within this window after a call belong to that call. */
const NOTE_WINDOW_SECONDS = 2 * 60 * 60

export interface RunoDaySummary {
  date: string
  dryRun: boolean
  callsFetched: number
  imported: number
  alreadyImported: number
  personalSkipped: number
  notesAttached: number
  notesImported: number
  /** Numbers Runo called that match no lead — candidates for "Add lead". */
  unmatched: { phone: string; name: string | null; calls: number }[]
  /** Runo users whose phone matches no ERP profile — their calls show as "System". */
  unmappedCallers: string[]
  warnings: string[]
  errors: string[]
}

interface LeadRow {
  id: string
  phone_tail: string
  is_archived: boolean | null
  updated_at: string | null
}

/** Imports each date in turn and records every real run in runo_sync_log. */
export async function syncRunoDates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  dates: string[],
  { dryRun = false, trigger }: { dryRun?: boolean; trigger: "cron" | "manual" }
): Promise<RunoDaySummary[]> {
  const results: RunoDaySummary[] = []
  for (const date of dates) {
    const summary = await ingestRunoDay(supabase, date, { dryRun })
    results.push(summary)
    if (!dryRun) {
      await supabase.from("runo_sync_log").insert({
        direction: "pull",
        event_type: trigger === "cron" ? "call_logs" : "call_logs_manual",
        status: summary.errors.length ? "error" : "ok",
        summary,
        error: summary.errors.join("; ") || null,
      })
    }
  }
  return results
}

export async function ingestRunoDay(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  date: string,
  { dryRun = false }: { dryRun?: boolean } = {}
): Promise<RunoDaySummary> {
  const summary: RunoDaySummary = {
    date,
    dryRun,
    callsFetched: 0,
    imported: 0,
    alreadyImported: 0,
    personalSkipped: 0,
    notesAttached: 0,
    notesImported: 0,
    unmatched: [],
    unmappedCallers: [],
    warnings: [],
    errors: [],
  }

  const [usersRes, callsRes, notesRes] = await Promise.all([
    fetchRunoUsers(),
    fetchRunoCallLogs(date),
    fetchRunoInteractions(date),
  ])
  if (!callsRes.success) {
    summary.errors.push(`Call logs: ${callsRes.error}`)
    return summary
  }
  // Neither of these blocks importing calls, so they're warnings: without
  // users, calls show as "System"; without interactions, calls have no notes.
  // (/crm/interactions has returned "Internal server error" on our account.)
  if (!usersRes.success) summary.warnings.push(`Users: ${usersRes.error}`)
  if (!notesRes.success) summary.warnings.push(`Interactions (notes): ${notesRes.error}`)

  const calls = callsRes.data ?? []
  const runoNotes = (notesRes.data ?? []).filter((n) => n.notes?.trim())
  summary.callsFetched = calls.length

  // ── Runo caller → ERP profile ─────────────────────────────────────
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, phone")
    .eq("is_active", true)
  const profileByTail = new Map<string, string>()
  for (const p of profiles ?? []) {
    const tail = phoneTail(p.phone)
    if (tail) profileByTail.set(tail, p.id)
  }
  const profileByRunoUser = new Map<string, string>()
  for (const u of usersRes.data ?? []) {
    const profileId = profileByTail.get(phoneTail(u.phoneNumber) ?? "")
    if (profileId) profileByRunoUser.set(u.userId, profileId)
  }

  // ── Customer number → lead ────────────────────────────────────────
  const tails = new Set<string>()
  for (const c of calls) {
    const t = phoneTail(c.phoneNumber)
    if (t) tails.add(t)
  }
  for (const n of runoNotes) {
    const t = phoneTail(n.customer?.phoneNumber)
    if (t) tails.add(t)
  }

  const leadByTail = new Map<string, LeadRow>()
  const tailList = Array.from(tails)
  for (let i = 0; i < tailList.length; i += 200) {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, phone_tail, is_archived, updated_at")
      .in("phone_tail", tailList.slice(i, i + 200))
    if (error) {
      summary.errors.push(`Lead lookup: ${error.message}`)
      return summary
    }
    // Several leads can share a number: prefer an open (non-archived) one,
    // then the most recently touched.
    for (const lead of (leads ?? []) as LeadRow[]) {
      const current = leadByTail.get(lead.phone_tail)
      const better =
        !current ||
        (current.is_archived && !lead.is_archived) ||
        (Boolean(current.is_archived) === Boolean(lead.is_archived) &&
          (lead.updated_at ?? "") > (current.updated_at ?? ""))
      if (better) leadByTail.set(lead.phone_tail, lead)
    }
  }

  // ── Already imported? ─────────────────────────────────────────────
  const callIds = calls.map((c) => c.callId).filter(Boolean)
  const existing = new Set<string>()
  for (let i = 0; i < callIds.length; i += 200) {
    const { data } = await supabase
      .from("interactions")
      .select("external_id")
      .eq("external_source", RUNO_SOURCE)
      .in("external_id", callIds.slice(i, i + 200))
    for (const row of data ?? []) existing.add(row.external_id as string)
  }

  // ── Build rows ────────────────────────────────────────────────────
  const unmatched = new Map<string, { phone: string; name: string | null; calls: number }>()
  const unmappedCallers = new Set<string>()
  type Row = Record<string, unknown> & { _tail: string; _start: number }
  const rows: Row[] = []

  for (const call of calls) {
    if (call.tag === "personal") {
      summary.personalSkipped++
      continue
    }
    // Runo logs a type-less, duration-less marker a second after some
    // calls (seen in real data) — the real call is its own row.
    if (!call.callId || !call.type) continue
    if (existing.has(call.callId)) {
      summary.alreadyImported++
      continue
    }
    const tail = phoneTail(call.phoneNumber)
    const lead = tail ? leadByTail.get(tail) : undefined
    if (!tail || !lead) {
      const key = tail ?? call.phoneNumber
      const entry = unmatched.get(key) ?? { phone: call.phoneNumber, name: call.name, calls: 0 }
      entry.calls++
      unmatched.set(key, entry)
      continue
    }

    const type = mapCallType(call)
    const seconds = Math.max(0, Math.round(call.duration || 0))
    const userId = profileByRunoUser.get(call.callerId) ?? null
    if (!userId && call.calledBy) unmappedCallers.add(call.calledBy)

    const label =
      type === "call_missed"
        ? call.type === "missed" ? "Missed call" : "Call not answered"
        : `${type === "call_inbound" ? "Incoming" : "Outgoing"} call · ${formatDuration(seconds)}`

    rows.push({
      _tail: tail,
      _start: call.startTime,
      lead_id: lead.id,
      user_id: userId,
      type,
      title: call.status ? `${label} (${call.status})` : label,
      outcome: mapDisposition(call.status, type),
      call_disposition: call.status || null,
      duration_seconds: seconds,
      duration_minutes: Math.round(seconds / 60),
      occurred_at: new Date(call.startTime * 1000).toISOString(),
      is_automated: true,
      external_source: RUNO_SOURCE,
      external_id: call.callId,
    })
  }

  // ── Recordings that arrived by webhook before this import ─────────
  // The webhook fires right after the call; the call row only exists from
  // the next morning's pull. The webhook stores the link in runo_sync_log,
  // so pick it up here.
  const newCallIds = rows.map((r) => r.external_id as string)
  for (let i = 0; i < newCallIds.length; i += 200) {
    const { data } = await supabase
      .from("runo_sync_log")
      .select("summary")
      .eq("direction", "inbound")
      .in("summary->>callId", newCallIds.slice(i, i + 200))
    for (const entry of data ?? []) {
      const s = entry.summary as { callId?: string; recordingUrl?: string } | null
      const row = s?.recordingUrl ? rows.find((r) => r.external_id === s.callId) : undefined
      if (row && s?.recordingUrl) {
        row.media_url = s.recordingUrl
        row.media_type = "audio"
      }
    }
  }

  // ── Notes the rep typed in Runo ───────────────────────────────────
  // Attach each to the call on the same number that started closest
  // before it (within the window). Otherwise it becomes a note of its own.
  const noteRows: Record<string, unknown>[] = []
  for (const note of runoNotes as RunoInteraction[]) {
    const tail = phoneTail(note.customer?.phoneNumber)
    const lead = tail ? leadByTail.get(tail) : undefined
    if (!tail || !lead) continue
    const text = note.notes!.trim()

    const call = rows
      .filter(
        (r) =>
          r._tail === tail &&
          r._start <= note.createdAt &&
          note.createdAt - r._start <= NOTE_WINDOW_SECONDS
      )
      .sort((a, b) => b._start - a._start)[0]
    if (call) {
      call.notes = call.notes ? `${call.notes}\n${text}` : text
      summary.notesAttached++
      continue
    }
    noteRows.push({
      lead_id: lead.id,
      type: "note",
      title: "Note from Runo",
      notes: text,
      occurred_at: new Date(note.createdAt * 1000).toISOString(),
      is_automated: true,
      external_source: RUNO_SOURCE,
      external_id: `note:${note.customer.id}:${note.createdAt}`,
    })
  }

  // Drop notes already imported on an earlier run.
  if (noteRows.length) {
    const { data } = await supabase
      .from("interactions")
      .select("external_id")
      .eq("external_source", RUNO_SOURCE)
      .in("external_id", noteRows.map((r) => r.external_id as string))
    const seen = new Set((data ?? []).map((r) => r.external_id as string))
    for (let i = noteRows.length - 1; i >= 0; i--) {
      if (seen.has(noteRows[i].external_id as string)) noteRows.splice(i, 1)
    }
  }

  summary.unmatched = Array.from(unmatched.values()).sort((a, b) => b.calls - a.calls)
  summary.unmappedCallers = Array.from(unmappedCallers)

  const toInsert = [
    ...rows.map((r) => {
      const row: Record<string, unknown> = { ...r }
      delete row._tail
      delete row._start
      return row
    }),
    ...noteRows,
  ]

  if (dryRun) {
    summary.imported = rows.length
    summary.notesImported = noteRows.length
    return summary
  }

  for (let i = 0; i < toInsert.length; i += 200) {
    const { error } = await supabase.from("interactions").insert(toInsert.slice(i, i + 200))
    if (error) {
      summary.errors.push(`Insert: ${error.message}`)
      return summary
    }
  }
  summary.imported = rows.length
  summary.notesImported = noteRows.length
  return summary
}
