"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  UserPlus,
} from "lucide-react"

import { useUIStore } from "@/lib/stores/uiStore"
import { cn } from "@/lib/utils"
import type { RunoSyncRun, RunoUnmatchedNumber } from "@/app/api/runo/route"
import type { RunoDaySummary } from "@/lib/utils/runo-ingest"

type RunoCall = {
  id: string
  lead_id: string
  type: "call_outbound" | "call_inbound" | "call_missed"
  title: string | null
  outcome: string | null
  call_disposition: string | null
  duration_seconds: number | null
  media_url: string | null
  media_type: string | null
  notes: string | null
  occurred_at: string
  lead: { id: string; full_name: string; company_name: string | null; phone: string | null } | null
  user: { full_name: string } | null
}

type Overview = {
  configured: boolean
  needsMigration: boolean
  error: string | null
  calls: RunoCall[]
  unmatched: RunoUnmatchedNumber[]
  runs: RunoSyncRun[]
  lastWebhookAt: string | null
  lastSyncAt: string | null
  yesterday: string
}

const RANGES = [7, 30, 90] as const

function formatSeconds(total: number): string {
  if (!total) return "0s"
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h) return `${h}h ${m}m`
  return m ? `${m}m ${s}s` : `${s}s`
}

const callStyle = {
  call_outbound: { icon: PhoneOutgoing, label: "Outgoing", color: "text-[#60A5FA]" },
  call_inbound: { icon: PhoneIncoming, label: "Incoming", color: "text-[#34D399]" },
  call_missed: { icon: PhoneMissed, label: "Missed", color: "text-[#F87171]" },
} as const

/**
 * Runo — the SIM call-tracking app on the sales head's phone. Calls it logs
 * land on lead timelines automatically (daily, for the day before); this
 * page is the one place to see them all, pick up numbers that aren't leads
 * yet, and check the sync is healthy.
 */
export default function RunoCallsPage() {
  const queryClient = useQueryClient()
  const { setLeadDrawerId, openNewLeadModalWith } = useUIStore()
  const [days, setDays] = useState<(typeof RANGES)[number]>(7)
  const [syncDate, setSyncDate] = useState("")
  const [preview, setPreview] = useState<RunoDaySummary | null>(null)

  const overview = useQuery({
    queryKey: ["runo-overview", days],
    queryFn: async (): Promise<Overview> => {
      const res = await fetch(`/api/runo?days=${days}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Could not load Runo calls")
      return body
    },
  })

  const data = overview.data
  const date = syncDate || data?.yesterday || ""

  const sync = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await fetch("/api/runo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, dryRun }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Sync failed")
      return body as { dryRun: boolean; results: RunoDaySummary[] }
    },
    onSuccess: ({ dryRun, results }) => {
      const r = results[0]
      if (r?.errors.length) {
        toast.error(r.errors.join(" · "))
        return
      }
      if (dryRun) {
        setPreview(r ?? null)
        return
      }
      setPreview(null)
      toast.success(
        r ? `${r.imported} call${r.imported === 1 ? "" : "s"} added for ${r.date}` : "Synced"
      )
      queryClient.invalidateQueries({ queryKey: ["runo-overview"] })
      queryClient.invalidateQueries({ queryKey: ["lead-interactions"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stats = useMemo(() => {
    const calls = data?.calls ?? []
    const connected = calls.filter((c) => c.type !== "call_missed")
    return {
      total: calls.length,
      connected: connected.length,
      missed: calls.length - connected.length,
      talk: connected.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0),
      leads: new Set(calls.map((c) => c.lead_id)).size,
      recordings: calls.filter((c) => c.media_type === "audio" && c.media_url).length,
    }
  }, [data?.calls])

  const card = "rounded-xl border border-[#2A2A3C] bg-[#111118] p-4"

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
            <PhoneCall className="size-5 text-[#F97316]" /> Runo Calls
          </h1>
          <p className="mt-1 text-sm text-[#9090A8]">
            Calls from the Runo app land on each lead&apos;s timeline every morning, for the day before.
          </p>
        </div>
        <div className="flex rounded-lg border border-[#2A2A3C] bg-[#111118] p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                days === r ? "bg-[#1F1F2E] text-[#F0F0FA]" : "text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {overview.isLoading ? (
        <Loader2 className="mt-8 size-5 animate-spin text-[#9090A8]" />
      ) : overview.isError ? (
        <p className="text-sm text-[#F87171]">{(overview.error as Error).message}</p>
      ) : data ? (
        <>
          {/* Setup status */}
          {(data.needsMigration || !data.configured) && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-3 text-sm text-[#FBBF24]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                {data.needsMigration && <p>The database isn&apos;t set up for Runo yet — run migration 023_runo_calls.sql.</p>}
                {!data.configured && <p>RUNO_API_KEY isn&apos;t set on the server, so nothing can be synced.</p>}
              </div>
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatusTile label="Runo API" ok={data.configured} value={data.configured ? "Connected" : "No API key"} />
            <StatusTile
              label="Last sync"
              ok={Boolean(data.lastSyncAt)}
              value={data.lastSyncAt ? formatDistanceToNow(new Date(data.lastSyncAt), { addSuffix: true }) : "Never"}
            />
            <StatusTile
              label="Recordings (webhook)"
              ok={Boolean(data.lastWebhookAt)}
              value={data.lastWebhookAt ? formatDistanceToNow(new Date(data.lastWebhookAt), { addSuffix: true }) : "Not connected yet"}
            />
            <StatusTile label="Not in ERP" ok={data.unmatched.length === 0} value={`${data.unmatched.length} number${data.unmatched.length === 1 ? "" : "s"}`} />
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3 md:grid-cols-6">
            <Stat label="Calls" value={stats.total} />
            <Stat label="Connected" value={stats.connected} />
            <Stat label="Missed / no answer" value={stats.missed} />
            <Stat label="Talk time" value={formatSeconds(stats.talk)} />
            <Stat label="Leads reached" value={stats.leads} />
            <Stat label="Recordings" value={stats.recordings} />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Calls */}
            <section className={cn(card, "lg:col-span-2")}>
              <h2 className="mb-3 text-sm font-semibold text-[#F0F0FA]">Calls on leads · last {days} days</h2>
              {data.calls.length === 0 ? (
                <p className="text-sm text-[#9090A8]">
                  No Runo calls on leads yet. Calls appear the morning after they&apos;re made — or use Sync below.
                </p>
              ) : (
                <ul className="divide-y divide-[#2A2A3C]">
                  {data.calls.map((call) => {
                    const style = callStyle[call.type] ?? callStyle.call_outbound
                    const Icon = style.icon
                    return (
                      <li key={call.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <Icon className={cn("mt-0.5 size-4 shrink-0", style.color)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <button
                                type="button"
                                onClick={() => call.lead && setLeadDrawerId(call.lead.id)}
                                className="truncate text-sm font-medium text-[#F0F0FA] hover:text-[#60A5FA]"
                              >
                                {call.lead?.full_name ?? "Lead"}
                              </button>
                              {call.lead?.company_name && (
                                <span className="truncate text-xs text-[#9090A8]">{call.lead.company_name}</span>
                              )}
                              {call.call_disposition && (
                                <span className="rounded-full bg-[#1A1A24] px-2 py-0.5 text-[11px] text-[#9090A8]">
                                  {call.call_disposition}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-[#9090A8]">
                              {style.label}
                              {call.type !== "call_missed" && ` · ${formatSeconds(call.duration_seconds ?? 0)}`}
                              {" · "}
                              {format(new Date(call.occurred_at), "d MMM, h:mm a")}
                              {call.user?.full_name && ` · ${call.user.full_name}`}
                            </p>
                            {call.notes && (
                              <p className="mt-1 whitespace-pre-line text-xs text-[#C0C0D0]">{call.notes}</p>
                            )}
                            {call.media_type === "audio" && call.media_url && (
                              <audio src={call.media_url} controls preload="none" className="mt-2 h-8 w-full max-w-sm" />
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <div className="space-y-4">
              {/* Numbers not in the ERP */}
              <section className={card}>
                <h2 className="mb-0.5 text-sm font-semibold text-[#F0F0FA]">Called, but not a lead</h2>
                <p className="mb-3 text-xs text-[#9090A8]">
                  Numbers from Runo that match no lead. Add the real prospects — their next calls will then land on the timeline.
                </p>
                {data.unmatched.length === 0 ? (
                  <p className="text-sm text-[#9090A8]">Nothing waiting.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.unmatched.map((u) => (
                      <li key={u.phone} className="flex items-center justify-between gap-2 rounded-lg bg-[#1A1A24] px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-[#F0F0FA]">{u.universe?.name || u.name || u.phone}</p>
                          <p className="truncate text-[11px] text-[#9090A8]">
                            {u.universe?.name || u.name ? `${u.phone} · ` : ""}
                            {u.calls} call{u.calls === 1 ? "" : "s"} · last {format(new Date(`${u.lastDate}T00:00:00`), "d MMM")}
                            {u.universe && " · in Contact Universe"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openNewLeadModalWith({
                              phone: u.phone,
                              full_name: u.universe?.name || u.name || "",
                              initial_notes: `Called via Runo (${u.calls} call${u.calls === 1 ? "" : "s"}, last on ${u.lastDate}).`,
                            })
                          }
                          className="flex shrink-0 items-center gap-1 rounded-md border border-[#3A3A52] px-2 py-1 text-[11px] text-[#F0F0FA] hover:border-[#3B82F6]"
                        >
                          <UserPlus className="size-3" /> Add lead
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Manual sync */}
              <section className={card}>
                <h2 className="mb-0.5 text-sm font-semibold text-[#F0F0FA]">Sync a day</h2>
                <p className="mb-3 text-xs text-[#9090A8]">
                  Runs by itself at 7 AM for yesterday. Runo only gives past days, so today&apos;s calls come tomorrow.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={date}
                    max={data.yesterday}
                    onChange={(e) => {
                      setSyncDate(e.target.value)
                      setPreview(null)
                    }}
                    className="rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 py-1.5 text-sm text-[#F0F0FA] [color-scheme:dark]"
                  />
                  <button
                    type="button"
                    disabled={sync.isPending || !data.configured || data.needsMigration}
                    onClick={() => sync.mutate(true)}
                    className="rounded-lg border border-[#3A3A52] px-3 py-1.5 text-sm text-[#F0F0FA] hover:border-[#3B82F6] disabled:opacity-50"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    disabled={sync.isPending || !data.configured || data.needsMigration}
                    onClick={() => sync.mutate(false)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2563EB] disabled:opacity-50"
                  >
                    {sync.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    Import
                  </button>
                </div>
                {preview && (
                  <div className="mt-3 rounded-lg bg-[#1A1A24] p-3 text-xs text-[#C0C0D0]">
                    <p className="mb-1 font-medium text-[#F0F0FA]">Preview for {preview.date} — nothing saved</p>
                    <p>{preview.callsFetched} calls in Runo</p>
                    <p>{preview.imported} would be added to leads</p>
                    {preview.alreadyImported > 0 && <p>{preview.alreadyImported} already in the ERP</p>}
                    {preview.personalSkipped > 0 && <p>{preview.personalSkipped} personal, skipped</p>}
                    <p>{preview.unmatched.length} number{preview.unmatched.length === 1 ? "" : "s"} not a lead</p>
                    {preview.warnings.map((w) => (
                      <p key={w} className="mt-1 text-[#FBBF24]">{w}</p>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Sync history */}
          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold text-[#F0F0FA]">Sync history</h2>
            {data.runs.length === 0 ? (
              <p className="text-sm text-[#9090A8]">No syncs yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.runs.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                    {run.status === "error" ? (
                      <AlertTriangle className="size-3.5 text-[#F87171]" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-[#34D399]" />
                    )}
                    <span className="text-[#F0F0FA]">{run.date ?? "—"}</span>
                    <span className="text-[#9090A8]">
                      {run.imported ?? 0} added · {run.unmatched ?? 0} not a lead
                      {run.event_type === "call_logs_manual" ? " · by hand" : ""}
                    </span>
                    <span className="text-[#5A5A72]">{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</span>
                    {run.error && <span className="w-full pl-5 text-[#F87171]">{run.error}</span>}
                    {!run.error && run.warnings.length > 0 && (
                      <span className="w-full pl-5 text-[#FBBF24]">{run.warnings.join(" · ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

function StatusTile({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.05em] text-[#9090A8]">{label}</p>
      <p className={cn("mt-0.5 flex items-center gap-1.5 text-sm font-medium", ok ? "text-[#F0F0FA]" : "text-[#FBBF24]")}>
        <span className={cn("size-1.5 rounded-full", ok ? "bg-[#34D399]" : "bg-[#F59E0B]")} />
        {value}
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] px-3 py-2.5">
      <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#F0F0FA]">{value}</p>
      <p className="text-[11px] text-[#9090A8]">{label}</p>
    </div>
  )
}
