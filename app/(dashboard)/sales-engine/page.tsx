"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNowStrict, subDays } from "date-fns"
import {
  AlertTriangle, CalendarDays, Flame, Gauge, Globe, IndianRupee, Loader2,
  Target, TrendingUp, UserCircle2, Users,
} from "lucide-react"

import { DataSetBadge, PriorityBadge } from "@/components/data/DataSetBadge"
import { useDataSets } from "@/lib/hooks/useDataSets"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// The founder's operating numbers (TEAM_PLAYBOOK): ₹20 Cr billed per month
// needs ≥ ₹40 Cr weighted pipeline at a ~50% proposal→closure rate.
const MONTHLY_TARGET = 20 * 1e7
const WEIGHTED_TARGET = 40 * 1e7

// HOT×50% · TENDER×30% · everything else active ×15%, mapped onto ERP stages.
const WEIGHT_FOR_STAGE: Record<string, number> = {
  negotiation: 0.5,
  proposal_sent: 0.3,
  boq_received: 0.3,
}
const DEFAULT_ACTIVE_WEIGHT = 0.15

// Founder vocabulary shown alongside ERP stage names, so both teams read it.
const FOUNDER_LABEL: Record<string, string> = {
  new_lead: "NEW",
  contacted: "FOLLOW-UP",
  qualified: "FOLLOW-UP",
  boq_received: "TENDER",
  proposal_sent: "TENDER",
  negotiation: "HOT",
  won: "WON",
  lost: "LOST",
  on_hold: "AWAITING",
  reengagement: "FOLLOW-UP",
}

type LeadRow = {
  id: string
  full_name: string
  company_name: string | null
  proposal_estimated_cost: number | null
  closure_value: number | null
  final_agreed_price: number | null
  estimated_budget: string | null
  priority: string | null
  priority_note: string | null
  owner_name: string | null
  data_set_id: string | null
  won_date: string | null
  closed_at: string | null
  updated_at: string
  stage: { slug: string; name: string; color: string; stage_type: string; position: number } | null
  assignee: { full_name: string } | null
}

type ActivityRow = {
  id: string
  lead_id: string
  type: string
  title: string | null
  notes: string | null
  outcome: string | null
  occurred_at: string | null
  created_at: string
  data_set_id: string | null
  user: { full_name: string } | null
  lead: { full_name: string; company_name: string | null; data_set_id: string | null } | null
}

function inr(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

function dealValue(l: LeadRow) {
  return l.final_agreed_price ?? l.closure_value ?? l.proposal_estimated_cost ?? 0
}

function ownerOf(l: LeadRow) {
  return l.owner_name || l.assignee?.full_name || "Unassigned"
}

export default function SalesEnginePage() {
  const { setLeadDrawerId } = useUIStore()
  const { dataSets } = useDataSets()
  const [dataSetKey, setDataSetKey] = useState("")

  const leadsQuery = useQuery({
    queryKey: ["sales-engine-leads"],
    queryFn: async (): Promise<LeadRow[]> => {
      const { data, error } = await createClient()
        .from("leads")
        .select("*, stage:stage_id(slug, name, color, stage_type, position), assignee:assigned_to(full_name)")
        .eq("is_archived", false)
        .limit(5000)
      if (error) throw error
      return (data ?? []) as unknown as LeadRow[]
    },
  })

  const activityQuery = useQuery({
    queryKey: ["sales-engine-activity"],
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await createClient()
        .from("interactions")
        .select("id, lead_id, type, title, notes, outcome, occurred_at, created_at, data_set_id, user:user_id(full_name), lead:lead_id(full_name, company_name, data_set_id)")
        .in("type", ["meeting", "site_visit", "call_outbound", "call_inbound", "note", "whatsapp_sent", "email_sent"])
        .gte("created_at", subDays(new Date(), 30).toISOString())
        .order("created_at", { ascending: false })
        .limit(1000)
      if (error) throw error
      return (data ?? []) as unknown as ActivityRow[]
    },
  })

  const summaryQuery = useQuery({
    queryKey: ["universe-summary"],
    queryFn: async () => {
      const { data, error } = await createClient().rpc("universe_summary")
      if (error) throw error
      return (data ?? []) as { dimension: string; bucket: string; total: number }[]
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const selectedDataSetId = dataSets.find((d) => d.key === dataSetKey)?.id
  const leads = useMemo(
    () => (leadsQuery.data ?? []).filter((l) => !selectedDataSetId || l.data_set_id === selectedDataSetId),
    [leadsQuery.data, selectedDataSetId]
  )

  const m = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const active = leads.filter((l) => l.stage?.stage_type === "active")
    const won = leads.filter((l) => l.stage?.slug === "won")
    const wonThisMonth = won.filter((l) => {
      const d = l.won_date ?? l.closed_at
      return d ? new Date(d) >= monthStart : false
    })

    let weighted = 0
    let gross = 0
    for (const l of active) {
      const v = dealValue(l)
      gross += v
      weighted += v * (WEIGHT_FOR_STAGE[l.stage?.slug ?? ""] ?? DEFAULT_ACTIVE_WEIGHT)
    }

    const byStage = new Map<string, { name: string; color: string; position: number; count: number; value: number }>()
    for (const l of leads) {
      if (!l.stage) continue
      const s = byStage.get(l.stage.slug) ?? { name: l.stage.name, color: l.stage.color, position: l.stage.position, count: 0, value: 0 }
      s.count++
      s.value += dealValue(l)
      byStage.set(l.stage.slug, s)
    }

    const owners = new Map<string, { hot: number; tender: number; other: number; value: number }>()
    for (const l of active) {
      const o = owners.get(ownerOf(l)) ?? { hot: 0, tender: 0, other: 0, value: 0 }
      if (l.stage?.slug === "negotiation") o.hot++
      else if (l.stage?.slug === "proposal_sent" || l.stage?.slug === "boq_received") o.tender++
      else o.other++
      o.value += dealValue(l)
      owners.set(ownerOf(l), o)
    }

    // The MD's critical list: anything HOT or P1 that is still open, biggest first.
    const critical = active
      .filter((l) => l.stage?.slug === "negotiation" || l.priority === "P1")
      .sort((a, b) => dealValue(b) - dealValue(a) || (a.priority === "P1" ? -1 : 1))
      .slice(0, 15)

    return {
      activeCount: active.length,
      noValue: active.filter((l) => !dealValue(l)).length,
      weighted,
      gross,
      wonThisMonthValue: wonThisMonth.reduce((n, l) => n + dealValue(l), 0),
      wonThisMonthCount: wonThisMonth.length,
      stages: Array.from(byStage.entries()).sort((a, b) => a[1].position - b[1].position),
      owners: Array.from(owners.entries()).sort((a, b) => b[1].value - a[1].value || b[1].hot - a[1].hot),
      critical,
      p1: leads.filter((l) => l.priority === "P1").length,
    }
  }, [leads])

  const activity = useMemo(() => {
    const rows = (activityQuery.data ?? []).filter((a) => !selectedDataSetId || a.lead?.data_set_id === selectedDataSetId)
    // Only human-entered activity: skip AI categorisation notes and imports.
    const human = rows.filter((a) => a.user && !(a.type === "note" && a.notes?.startsWith("AI Profile Categorisation")))
    const weekAgo = subDays(new Date(), 7)
    const byPerson = new Map<string, { meetings: number; calls: number; notes: number; last: string }>()
    for (const a of human) {
      const who = a.user!.full_name
      const p = byPerson.get(who) ?? { meetings: 0, calls: 0, notes: 0, last: a.created_at }
      if (new Date(a.created_at) >= weekAgo) {
        if (a.type === "meeting" || a.type === "site_visit") p.meetings++
        else if (a.type.startsWith("call")) p.calls++
        else p.notes++
      }
      if (a.created_at > p.last) p.last = a.created_at
      byPerson.set(who, p)
    }
    return { recent: human.slice(0, 12), byPerson: Array.from(byPerson.entries()) }
  }, [activityQuery.data, selectedDataSetId])

  const funnel = useMemo(() => {
    const rows = summaryQuery.data ?? []
    const stage = (b: string) => Number(rows.find((r) => r.dimension === "funnel_stage" && r.bucket === b)?.total ?? 0)
    const dim = (d: string) => rows.filter((r) => r.dimension === d).map((r) => ({ bucket: r.bucket, total: Number(r.total) })).sort((a, b) => b.total - a.total)
    return {
      stages: [
        { label: "Client", value: stage("5-CLIENT"), color: "#10B981" },
        { label: "Opportunity", value: stage("4-OPPORTUNITY"), color: "#F59E0B" },
        { label: "Engaged", value: stage("3-ENGAGED"), color: "#8B5CF6" },
        { label: "Contacted", value: stage("2-CONTACTED"), color: "#3B82F6" },
        { label: "Audience", value: stage("1-AUDIENCE"), color: "#6B7280" },
      ],
      personas: dim("persona").slice(0, 6),
      regions: dim("region"),
      available: rows.length > 0,
    }
  }, [summaryQuery.data])

  const weightedPct = Math.min(100, (m.weighted / WEIGHTED_TARGET) * 100)
  const billedPct = Math.min(100, (m.wonThisMonthValue / MONTHLY_TARGET) * 100)
  const card = "rounded-xl border border-[#2A2A3C] bg-[#111118] p-4"

  if (leadsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#9090A8]">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading sales engine…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
            <Gauge className="size-5 text-[#F59E0B]" /> Sales Engine
          </h1>
          <p className="mt-1 text-sm text-[#9090A8]">Target, live pipeline and team activity across every data source.</p>
        </div>
        {dataSets.length > 0 ? (
          <div className="thin-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {[{ key: "", name: "All data", color: "#9090A8" }, ...dataSets.filter((d) => d.kind !== "founder_universe")].map((d) => (
              <button
                key={d.key || "all"}
                type="button"
                onClick={() => setDataSetKey(d.key)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition",
                  dataSetKey === d.key ? "text-[#F0F0FA]" : "border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8]"
                )}
                style={dataSetKey === d.key ? { borderColor: d.color, backgroundColor: `${d.color}22` } : undefined}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Target tracker */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className={cn(card, "md:col-span-2")}>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#9090A8]"><Target className="size-3.5" />Weighted pipeline vs ₹40 Cr</div>
          <p className="mt-1 text-2xl font-semibold text-[#F0F0FA]">{inr(m.weighted)}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1F1F2E]">
            <div className={cn("h-full rounded-full", weightedPct >= 100 ? "bg-[#10B981]" : weightedPct >= 50 ? "bg-[#F59E0B]" : "bg-[#EF4444]")} style={{ width: `${weightedPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#9090A8]">
            HOT×50% · TENDER×30% · others×15% on {inr(m.gross)} gross open value.
            {m.noValue ? <span className="text-[#F59E0B]"> {m.noValue} open deals have no value yet — they count as ₹0.</span> : null}
          </p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#9090A8]"><IndianRupee className="size-3.5" />Won this month</div>
          <p className="mt-1 text-2xl font-semibold text-[#F0F0FA]">{inr(m.wonThisMonthValue)}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1F1F2E]">
            <div className="h-full rounded-full bg-[#10B981]" style={{ width: `${billedPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#9090A8]">{m.wonThisMonthCount} deals · target ₹20 Cr</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <div className={card}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#9090A8]"><TrendingUp className="size-3.5" />Open deals</div>
            <p className="mt-1 text-xl font-semibold text-[#F0F0FA]">{m.activeCount}</p>
          </div>
          <div className={card}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#9090A8]"><Flame className="size-3.5" />P1 priority</div>
            <p className="mt-1 text-xl font-semibold text-[#F0F0FA]">{m.p1}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Critical list */}
        <section className={cn(card, "lg:col-span-2")}>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[#F0F0FA]"><AlertTriangle className="size-4 text-[#EF4444]" />Critical this week</h2>
          {m.critical.length === 0 ? (
            <p className="text-sm text-[#9090A8]">No HOT or P1 deals open.</p>
          ) : (
            <ul className="divide-y divide-[#1F1F2E]">
              {m.critical.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setLeadDrawerId(l.id)} className="flex w-full items-start gap-3 py-2.5 text-left">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: l.stage?.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-[#F0F0FA]">{l.company_name || l.full_name}</span>
                        <PriorityBadge priority={l.priority} note={l.priority_note} />
                        <DataSetBadge dataSetId={l.data_set_id} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#9090A8]">
                        {FOUNDER_LABEL[l.stage?.slug ?? ""] ?? l.stage?.name} · {ownerOf(l)}
                        {l.company_name && l.full_name !== l.company_name ? ` · ${l.full_name}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[#F0F0FA]">
                      {dealValue(l) ? inr(dealValue(l)) : <span className="text-xs font-normal text-[#5A5A72]">{l.estimated_budget ?? "no value"}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* By stage */}
        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-[#F0F0FA]">Pipeline by stage</h2>
          <ul className="space-y-2">
            {m.stages.map(([slug, s]) => (
              <li key={slug} className="flex items-center gap-2 text-sm">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1 truncate text-[#F0F0FA]">{s.name} <span className="text-[10px] text-[#5A5A72]">{FOUNDER_LABEL[slug]}</span></span>
                <span className="w-8 text-right text-[#9090A8]">{s.count}</span>
                <span className="w-20 text-right text-xs text-[#9090A8]">{s.value ? inr(s.value) : "—"}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Owners */}
        <section className={card}>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[#F0F0FA]"><UserCircle2 className="size-4" />Deals by owner</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#5A5A72]">
                  <th className="pb-2 text-left font-medium">Owner</th>
                  <th className="pb-2 text-right font-medium">Hot</th>
                  <th className="pb-2 text-right font-medium">Tender</th>
                  <th className="pb-2 text-right font-medium">Other</th>
                  <th className="pb-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {m.owners.slice(0, 10).map(([owner, o]) => (
                  <tr key={owner} className="border-t border-[#1F1F2E]">
                    <td className="max-w-[120px] truncate py-2 text-[#F0F0FA]">{owner}</td>
                    <td className="py-2 text-right text-[#F87171]">{o.hot || "·"}</td>
                    <td className="py-2 text-right text-[#F59E0B]">{o.tender || "·"}</td>
                    <td className="py-2 text-right text-[#9090A8]">{o.other || "·"}</td>
                    <td className="py-2 text-right text-xs text-[#9090A8]">{o.value ? inr(o.value) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Team activity */}
        <section className={cn(card, "lg:col-span-2")}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#F0F0FA]"><Users className="size-4" />Team activity</h2>
            <Link href="/meetings" className="text-xs text-[#60A5FA]">All meetings →</Link>
          </div>
          {activity.byPerson.length > 0 ? (
            <div className="thin-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {activity.byPerson.map(([who, p]) => (
                <div key={who} className="min-w-[150px] shrink-0 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-2.5">
                  <p className="truncate text-xs font-medium text-[#F0F0FA]">{who}</p>
                  <p className="mt-1 text-[11px] text-[#9090A8]">7d: {p.meetings} meetings · {p.calls} calls · {p.notes} updates</p>
                  <p className="text-[10px] text-[#5A5A72]">last {formatDistanceToNowStrict(new Date(p.last), { addSuffix: true })}</p>
                </div>
              ))}
            </div>
          ) : null}
          {activity.recent.length === 0 ? (
            <p className="text-sm text-[#9090A8]">No team activity in the last 30 days.</p>
          ) : (
            <ul className="divide-y divide-[#1F1F2E]">
              {activity.recent.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setLeadDrawerId(a.lead_id)} className="block w-full py-2 text-left">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs">
                      <span className="font-medium text-[#F0F0FA]">{a.user?.full_name}</span>
                      <span className="text-[#5A5A72]">{a.type.replace(/_/g, " ")}</span>
                      <span className="truncate text-[#9090A8]">{a.lead?.company_name || a.lead?.full_name}</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-[#5A5A72]"><CalendarDays className="size-3" />{format(new Date(a.occurred_at ?? a.created_at), "d MMM, h:mm a")}</span>
                    </div>
                    {a.notes ? <p className="mt-0.5 line-clamp-2 text-xs text-[#9090A8]">{a.notes}</p> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Universe */}
        <section className={cn(card, "lg:col-span-3")}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#F0F0FA]"><Globe className="size-4 text-[#10B981]" />Contact universe</h2>
            <Link href="/universe" className="text-xs text-[#60A5FA]">Browse →</Link>
          </div>
          {!funnel.available ? (
            <p className="text-sm text-[#9090A8]">{summaryQuery.isLoading ? "Loading…" : "Universe not imported yet."}</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-[#9090A8]">Funnel</p>
                {funnel.stages.map((s) => {
                  const max = Math.max(...funnel.stages.map((x) => x.value), 1)
                  return (
                    <div key={s.label} className="mb-1.5">
                      <div className="flex justify-between text-xs"><span className="text-[#F0F0FA]">{s.label}</span><span className="text-[#9090A8]">{s.value.toLocaleString("en-IN")}</span></div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#1F1F2E]"><div className="h-full rounded-full" style={{ width: `${Math.max(1, (s.value / max) * 100)}%`, backgroundColor: s.color }} /></div>
                    </div>
                  )
                })}
              </div>
              {[{ title: "Persona", rows: funnel.personas }, { title: "Region", rows: funnel.regions }].map((g) => (
                <div key={g.title}>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-[#9090A8]">{g.title}</p>
                  {g.rows.map((r) => {
                    const max = Math.max(...g.rows.map((x) => x.total), 1)
                    return (
                      <div key={r.bucket} className="mb-1.5">
                        <div className="flex justify-between text-xs"><span className="text-[#F0F0FA]">{r.bucket}</span><span className="text-[#9090A8]">{r.total.toLocaleString("en-IN")}</span></div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[#1F1F2E]"><div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${Math.max(1, (r.total / max) * 100)}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
