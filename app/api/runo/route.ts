import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { isRunoConfigured } from "@/lib/utils/runo"
import { RUNO_SOURCE, phoneTail, yesterdayIST, type RunoDaySummary } from "@/lib/utils/runo-ingest"

/**
 * Everything the Runo Calls page shows: the imported calls, the numbers
 * Runo called that aren't leads yet, and the sync history. Read with the
 * service role (runo_sync_log is server-only) after checking the user.
 *
 *   ?days=N   calls from the last N days (default 7, max 90)
 */

export interface RunoUnmatchedNumber {
  phone: string
  name: string | null
  calls: number
  lastDate: string
  /** Same number in the Contact Universe, if any. */
  universe: { id: string; name: string | null; company: string | null } | null
}

export interface RunoSyncRun {
  id: string
  direction: "inbound" | "pull" | "push"
  event_type: string | null
  status: "ok" | "skipped" | "error"
  date: string | null
  imported: number | null
  unmatched: number | null
  warnings: string[]
  error: string | null
  created_at: string
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { db: { schema: "marketing" } })
}

export async function GET(request: NextRequest) {
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = serviceClient()
  if (!supabase) return NextResponse.json({ error: "Service role not configured" }, { status: 503 })

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days")) || 7, 1), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [callsRes, logsRes] = await Promise.all([
    supabase
      .from("interactions")
      .select(
        "id, lead_id, type, title, outcome, call_disposition, duration_seconds, media_url, media_type, notes, occurred_at, created_at, lead:lead_id(id, full_name, company_name, phone), user:user_id(full_name)"
      )
      .eq("external_source", RUNO_SOURCE)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(500),
    supabase
      .from("runo_sync_log")
      .select("id, direction, event_type, status, summary, error, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ])

  // Before migration 023 runs, these columns/tables don't exist yet.
  const setupError = callsRes.error?.message ?? logsRes.error?.message ?? null
  if (setupError) {
    return NextResponse.json({
      configured: isRunoConfigured(),
      needsMigration: /does not exist|schema cache/i.test(setupError),
      error: setupError,
      calls: [],
      unmatched: [],
      runs: [],
      lastWebhookAt: null,
      lastSyncAt: null,
      yesterday: yesterdayIST(),
    })
  }

  const logs = logsRes.data ?? []

  // Numbers Runo called that matched no lead, across recent real pulls.
  const byTail = new Map<string, RunoUnmatchedNumber>()
  for (const log of logs) {
    if (log.direction !== "pull" || log.status === "skipped") continue
    const s = log.summary as RunoDaySummary | null
    if (!s || s.dryRun) continue
    for (const u of s.unmatched ?? []) {
      const tail = phoneTail(u.phone)
      if (!tail) continue
      const entry = byTail.get(tail)
      if (entry) {
        entry.calls += u.calls
        if (s.date > entry.lastDate) entry.lastDate = s.date
      } else {
        byTail.set(tail, { phone: u.phone, name: u.name && u.name !== "Unknown" ? u.name : null, calls: u.calls, lastDate: s.date, universe: null })
      }
    }
  }

  // Drop numbers that have since become leads; note universe matches.
  const tails = Array.from(byTail.keys())
  if (tails.length) {
    const [leadHits, universeHits] = await Promise.all([
      supabase.from("leads").select("phone_tail").in("phone_tail", tails),
      supabase.from("universe_contacts").select("id, name, company, phone_tail").in("phone_tail", tails),
    ])
    for (const l of leadHits.data ?? []) byTail.delete(l.phone_tail as string)
    for (const u of universeHits.data ?? []) {
      const entry = byTail.get(u.phone_tail as string)
      if (entry && !entry.universe) entry.universe = { id: u.id, name: u.name, company: u.company }
    }
  }

  const runs: RunoSyncRun[] = logs
    .filter((l) => l.direction === "pull")
    .slice(0, 20)
    .map((l) => {
      const s = l.summary as RunoDaySummary | null
      return {
        id: l.id,
        direction: l.direction,
        event_type: l.event_type,
        status: l.status,
        date: s?.date ?? null,
        imported: s ? s.imported + (s.notesImported ?? 0) : null,
        unmatched: s?.unmatched?.length ?? null,
        warnings: s?.warnings ?? [],
        error: l.error,
        created_at: l.created_at,
      }
    })

  return NextResponse.json({
    configured: isRunoConfigured(),
    needsMigration: false,
    error: null,
    calls: callsRes.data ?? [],
    unmatched: Array.from(byTail.values()).sort((a, b) => b.calls - a.calls),
    runs,
    lastWebhookAt: logs.find((l) => l.direction === "inbound")?.created_at ?? null,
    lastSyncAt: logs.find((l) => l.direction === "pull")?.created_at ?? null,
    yesterday: yesterdayIST(),
  })
}
