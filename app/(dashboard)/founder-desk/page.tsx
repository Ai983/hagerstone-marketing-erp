"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNowStrict, isPast } from "date-fns"
import { toast } from "sonner"
import {
  BookOpen, CalendarDays, Copy, Crown, Flame, Globe, Loader2, Phone, Search, Users,
} from "lucide-react"

import { PriorityBadge } from "@/components/data/DataSetBadge"
import { formatInrShort } from "@/components/kanban/lead-value"
import { useDataSets } from "@/lib/hooks/useDataSets"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// ------------------------------------------------------------------
// Types & constants
// ------------------------------------------------------------------

type Stage = { name: string; slug: string; color: string; stage_type: string }

type FounderDeal = {
  snapshotId: string
  serial: string
  sheet: {
    status: string | null
    category: string | null
    party: string | null
    project: string | null
    value: string | null
    contact: string | null
    owner: string | null
    next_action: string | null
    next_date: string | null
    immediate_action: boolean | null
  }
  lead: {
    id: string
    full_name: string
    company_name: string | null
    phone: string | null
    priority: string | null
    proposal_estimated_cost: number | null
    closure_value: number | null
    final_agreed_price: number | null
    stage: Stage | null
    assignee: { full_name: string } | null
  }
}

type OpenTask = { id: string; lead_id: string; title: string; type: string; due_at: string }

const STATUS_ORDER = ["HOT", "TENDER", "AWAITING CLIENT", "FOLLOW-UP", "NEW", "WON", "LOST", "DROPPED"]
const STATUS_STYLE: Record<string, string> = {
  HOT: "bg-[#3F161A] text-[#F87171]",
  TENDER: "bg-[#3F2A12] text-[#F59E0B]",
  "AWAITING CLIENT": "bg-[#3F2A12] text-[#F59E0B]",
  "FOLLOW-UP": "bg-[#1E2A4A] text-[#60A5FA]",
  NEW: "bg-[#2A1F3F] text-[#A78BFA]",
  WON: "bg-[#163322] text-[#34D399]",
}
const STATUS_STAGE: Record<string, string> = {
  NEW: "new_lead", "FOLLOW-UP": "contacted", TENDER: "proposal_sent", "AWAITING CLIENT": "proposal_sent",
  HOT: "negotiation", WON: "won", LOST: "lost", DROPPED: "lost",
}

type Tab = "today" | "deals" | "architect" | "contacts" | "guide"

function dealValue(d: FounderDeal) {
  return d.lead.final_agreed_price ?? d.lead.closure_value ?? d.lead.proposal_estimated_cost ?? 0
}

function partyName(d: FounderDeal) {
  return d.lead.company_name || d.lead.full_name
}

function StatusChip({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", STATUS_STYLE[status] ?? "bg-[#1A1A24] text-[#9090A8]")}>
      {status}
    </span>
  )
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function FounderDeskPage() {
  const { setLeadDrawerId } = useUIStore()
  const { byKey } = useDataSets()
  const founderSet = byKey.get("founder-pipeline")
  const architectSet = byKey.get("architect-meetings-dec-2025")
  const [tab, setTab] = useState<Tab>("today")

  const dealsQuery = useQuery({
    queryKey: ["founder-desk-deals", founderSet?.id],
    enabled: Boolean(founderSet),
    queryFn: async (): Promise<FounderDeal[]> => {
      const { data, error } = await createClient()
        .from("lead_source_snapshots")
        .select(
          "id, external_ref, data, lead:lead_id(id, full_name, company_name, phone, priority, proposal_estimated_cost, closure_value, final_agreed_price, stage:stage_id(name, slug, color, stage_type), assignee:assigned_to(full_name))"
        )
        .eq("data_set_id", founderSet!.id)
      if (error) throw error
      return (data ?? [])
        .filter((r) => r.lead)
        .map((r) => ({
          snapshotId: r.id,
          serial: r.external_ref ?? "",
          sheet: r.data as FounderDeal["sheet"],
          lead: r.lead as unknown as FounderDeal["lead"],
        }))
    },
  })

  // Open tasks and human activity for the whole visible book — filtered to
  // founder deals in memory, never by passing ids in the URL (see the
  // pipeline board fix: an id list of a few hundred breaks the request).
  const tasksQuery = useQuery({
    queryKey: ["founder-desk-tasks"],
    queryFn: async (): Promise<OpenTask[]> => {
      const { data, error } = await createClient()
        .from("tasks")
        .select("id, lead_id, title, type, due_at")
        .is("completed_at", null)
        .order("due_at", { ascending: true })
        .limit(5000)
      if (error) throw error
      return (data ?? []) as OpenTask[]
    },
  })

  const touchesQuery = useQuery({
    queryKey: ["founder-desk-touches"],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("interactions")
        .select("lead_id, created_at, occurred_at, type, user:user_id(full_name)")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5000)
      if (error) throw error
      const last = new Map<string, { at: string; type: string; by: string | null }>()
      for (const r of (data ?? []) as unknown as { lead_id: string; created_at: string; occurred_at: string | null; type: string; user: { full_name: string } | null }[]) {
        if (!last.has(r.lead_id)) last.set(r.lead_id, { at: r.occurred_at ?? r.created_at, type: r.type, by: r.user?.full_name ?? null })
      }
      return last
    },
  })

  const deals = useMemo(() => dealsQuery.data ?? [], [dealsQuery.data])
  const lastTouch = useMemo(
    () => touchesQuery.data ?? new Map<string, { at: string; type: string; by: string | null }>(),
    [touchesQuery.data]
  )

  const nextTaskByLead = useMemo(() => {
    const m = new Map<string, OpenTask>()
    for (const t of tasksQuery.data ?? []) if (!m.has(t.lead_id)) m.set(t.lead_id, t)
    return m
  }, [tasksQuery.data])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const d of deals) if (d.sheet.status) c[d.sheet.status] = (c[d.sheet.status] ?? 0) + 1
    const overdue = deals.filter((d) => {
      const t = nextTaskByLead.get(d.lead.id)
      return t && isPast(new Date(t.due_at))
    }).length
    const touched = deals.filter((d) => lastTouch.has(d.lead.id)).length
    return { byStatus: c, overdue, touched }
  }, [deals, nextTaskByLead, lastTouch])

  const loading = dealsQuery.isLoading || !founderSet

  const tabs: { id: Tab; label: string; icon: typeof Flame }[] = [
    { id: "today", label: "Today", icon: Phone },
    { id: "deals", label: `Deals${deals.length ? ` · ${deals.length}` : ""}`, icon: Flame },
    { id: "architect", label: "Architect Drive", icon: Users },
    { id: "contacts", label: "Contacts", icon: Globe },
    { id: "guide", label: "Guide", icon: BookOpen },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
          <Crown className="size-5 text-[#F59E0B]" /> Founder Desk
        </h1>
        <p className="mt-1 text-sm text-[#9090A8]">
          Everything handed over from Dhruv sir&apos;s Sales Engine — kept separate from ERP leads. Handled by Manpreet Singh.
        </p>
      </div>

      {/* Stat strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Deals handed over", value: deals.length },
          { label: "HOT · TENDER", value: `${counts.byStatus.HOT ?? 0} · ${counts.byStatus.TENDER ?? 0}` },
          { label: "Overdue follow-ups", value: counts.overdue, warn: counts.overdue > 0 },
          { label: "Touched in ERP", value: `${counts.touched} / ${deals.length}` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-3">
            <p className="truncate text-[10px] uppercase tracking-wider text-[#9090A8]">{s.label}</p>
            <p className={cn("mt-1 text-xl font-semibold", s.warn ? "text-[#F87171]" : "text-[#F0F0FA]")}>
              {loading ? "…" : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="thin-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-[#2A2A3C] px-4 md:mx-0 md:px-0">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm transition",
                tab === t.id ? "border-[#F59E0B] text-[#F0F0FA]" : "border-transparent text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading && tab !== "guide" && tab !== "contacts" ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading founder deals…
        </div>
      ) : dealsQuery.error ? (
        <div className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">
          Could not load the founder deals.
        </div>
      ) : tab === "today" ? (
        <TodayTab deals={deals} nextTaskByLead={nextTaskByLead} lastTouch={lastTouch} onOpen={setLeadDrawerId} />
      ) : tab === "deals" ? (
        <DealsTab deals={deals} nextTaskByLead={nextTaskByLead} lastTouch={lastTouch} onOpen={setLeadDrawerId} />
      ) : tab === "architect" ? (
        <ArchitectTab dataSetId={architectSet?.id} onOpen={setLeadDrawerId} />
      ) : tab === "contacts" ? (
        <ContactsTab />
      ) : (
        <GuideTab />
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// Today — the call list
// ------------------------------------------------------------------

type TabProps = {
  deals: FounderDeal[]
  nextTaskByLead: Map<string, OpenTask>
  lastTouch: Map<string, { at: string; type: string; by: string | null }>
  onOpen: (id: string) => void
}

function TodayTab({ deals, nextTaskByLead, lastTouch, onOpen }: TabProps) {
  const [showAll, setShowAll] = useState(false)

  // Rank: sheet status first (HOT before TENDER…), then the MD's
  // immediate-action flag and P1, then overdue, then value.
  const ranked = useMemo(() => {
    const open = deals.filter((d) => !["won", "lost"].includes(d.lead.stage?.slug ?? "") || d.sheet.status === "WON")
    const statusWeight: Record<string, number> = { HOT: 50, TENDER: 35, "AWAITING CLIENT": 30, "FOLLOW-UP": 20, WON: 15, NEW: 10 }
    return open
      .map((d) => {
        const task = nextTaskByLead.get(d.lead.id)
        const overdue = task ? isPast(new Date(task.due_at)) : false
        const score =
          (statusWeight[d.sheet.status ?? ""] ?? 0) +
          (d.sheet.immediate_action ? 15 : 0) +
          (d.lead.priority === "P1" ? 10 : 0) +
          (overdue ? 5 : 0) +
          Math.min(10, dealValue(d) / 1e7)
        return { d, task, overdue, score }
      })
      .sort((a, b) => b.score - a.score)
  }, [deals, nextTaskByLead])

  const visible = showAll ? ranked : ranked.slice(0, 20)

  const copyWhatsApp = async () => {
    const lines = [
      "*HAGERSTONE – FOLLOW-UP LIST* 📋",
      `_${format(new Date(), "d MMM yyyy")}_`,
      ...visible.map(({ d, task }, i) => {
        const project = d.sheet.project ? d.sheet.project.split(/[—(]/)[0].trim().slice(0, 50) : ""
        return `${i + 1}. ${partyName(d)}${project ? ` – ${project}` : ""} – ${task?.title ?? d.sheet.next_action ?? "Follow up"}`
      }),
    ]
    await navigator.clipboard.writeText(lines.join("\n"))
    toast.success(`Copied ${visible.length} items — paste into WhatsApp`)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#9090A8]">
          Ranked by sheet status, the MD&apos;s immediate-action list, priority, overdue and value.
        </p>
        <button
          type="button"
          onClick={copyWhatsApp}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366]/15 px-3 text-sm font-medium text-[#25D366]"
        >
          <Copy className="size-4" /> Copy WhatsApp list
        </button>
      </div>

      <ol className="divide-y divide-[#1F1F2E] overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
        {visible.map(({ d, task, overdue }, i) => {
          const touch = lastTouch.get(d.lead.id)
          return (
            <li key={d.snapshotId}>
              <button type="button" onClick={() => onOpen(d.lead.id)} className="flex w-full items-start gap-3 p-3 text-left hover:bg-[#15151D]">
                <span className="mt-0.5 w-6 shrink-0 text-right text-xs tabular-nums text-[#5A5A72]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-[#F0F0FA]">{partyName(d)}</span>
                    <StatusChip status={d.sheet.status} />
                    <PriorityBadge priority={d.lead.priority} />
                    {d.sheet.immediate_action ? <span className="text-[10px] text-[#F59E0B]">MD list</span> : null}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[#9090A8]">{d.sheet.project ?? "—"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                    {task ? (
                      <span className={overdue ? "text-[#F87171]" : "text-[#9090A8]"}>
                        {overdue ? "Overdue" : "Due"} {format(new Date(task.due_at), "d MMM")} · {task.title}
                      </span>
                    ) : null}
                    <span className="text-[#5A5A72]">
                      {touch ? `Last touched ${formatDistanceToNowStrict(new Date(touch.at), { addSuffix: true })}${touch.by ? ` by ${touch.by}` : ""}` : "Not touched in ERP yet"}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {dealValue(d) ? <p className="text-sm font-semibold text-[#34D399]">{formatInrShort(dealValue(d))}</p> : null}
                  <p className="text-[10px] text-[#5A5A72]">{d.sheet.owner}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ol>

      {ranked.length > 20 ? (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 w-full rounded-lg border border-[#2A2A3C] py-2 text-sm text-[#9090A8] hover:text-[#F0F0FA]">
          {showAll ? "Show top 20" : `Show all ${ranked.length}`}
        </button>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------
// Deals — sir's pipeline, in his words, with where it stands now
// ------------------------------------------------------------------

function DealsTab({ deals, nextTaskByLead, lastTouch, onOpen }: TabProps) {
  const [status, setStatus] = useState("")
  const [owner, setOwner] = useState("")
  const [category, setCategory] = useState("")
  const [search, setSearch] = useState("")

  const owners = useMemo(() => Array.from(new Set(deals.map((d) => d.sheet.owner).filter(Boolean))) as string[], [deals])
  const categories = useMemo(() => Array.from(new Set(deals.map((d) => d.sheet.category).filter(Boolean))) as string[], [deals])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return deals
      .filter((d) => (!status || d.sheet.status === status) && (!owner || d.sheet.owner === owner) && (!category || d.sheet.category === category))
      .filter((d) => !q || [d.sheet.party, d.sheet.project, d.sheet.contact, d.serial].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      .sort((a, b) =>
        STATUS_ORDER.indexOf(a.sheet.status ?? "") - STATUS_ORDER.indexOf(b.sheet.status ?? "") || dealValue(b) - dealValue(a)
      )
  }, [deals, status, owner, category, search])

  const chip = (active: boolean) =>
    cn("inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs transition", active ? "border-[#F59E0B] bg-[#F59E0B]/15 text-[#F0F0FA]" : "border-[#2A2A3C] text-[#9090A8] hover:text-[#F0F0FA]")

  return (
    <div>
      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5A5A72]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party, project, contact or #serial"
            className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] pl-9 pr-3 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#F59E0B] md:text-sm"
          />
        </div>
        <div className="thin-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <button type="button" className={chip(!status)} onClick={() => setStatus("")}>All statuses</button>
          {STATUS_ORDER.filter((s) => deals.some((d) => d.sheet.status === s)).map((s) => (
            <button key={s} type="button" className={chip(status === s)} onClick={() => setStatus(status === s ? "" : s)}>
              {s} <span className="ml-1 text-[#5A5A72]">{deals.filter((d) => d.sheet.status === s).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA]">
            <option value="">All sheet owners</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA]">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="self-center text-xs text-[#5A5A72]">{filtered.length} deals</span>
        </div>
      </div>

      <ul className="divide-y divide-[#1F1F2E] overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
        {filtered.map((d) => {
          const task = nextTaskByLead.get(d.lead.id)
          const touch = lastTouch.get(d.lead.id)
          const moved = d.sheet.status && d.lead.stage && STATUS_STAGE[d.sheet.status] !== d.lead.stage.slug
          return (
            <li key={d.snapshotId}>
              <button type="button" onClick={() => onOpen(d.lead.id)} className="block w-full p-3 text-left hover:bg-[#15151D]">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] tabular-nums text-[#5A5A72]">#{d.serial}</span>
                      <span className="truncate text-sm font-semibold text-[#F0F0FA]">{d.sheet.party}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#9090A8]">{d.sheet.project ?? "—"}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <StatusChip status={d.sheet.status} />
                      {d.lead.stage ? (
                        <span className={cn("rounded px-1.5 py-0.5", moved ? "bg-[#3F2A12] text-[#F59E0B]" : "bg-[#1A1A24] text-[#9090A8]")}>
                          {moved ? "now " : ""}{d.lead.stage.name}
                        </span>
                      ) : null}
                      {d.sheet.category ? <span className="text-[#5A5A72]">{d.sheet.category}</span> : null}
                      <span className="text-[#5A5A72]">· sheet owner {d.sheet.owner ?? "—"}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
                      {task ? (
                        <span className={isPast(new Date(task.due_at)) ? "text-[#F87171]" : "text-[#9090A8]"}>
                          <CalendarDays className="mr-0.5 inline size-3" />
                          {format(new Date(task.due_at), "d MMM")} · {task.title}
                        </span>
                      ) : (
                        <span className="text-[#5A5A72]">No open task</span>
                      )}
                      <span className="text-[#5A5A72]">
                        {touch ? `touched ${formatDistanceToNowStrict(new Date(touch.at), { addSuffix: true })}` : "not touched yet"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[#F0F0FA]">{dealValue(d) ? formatInrShort(dealValue(d)) : d.sheet.value ?? "—"}</p>
                    <p className="text-[10px] text-[#5A5A72]">{d.lead.assignee?.full_name ?? "Unassigned"}</p>
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ------------------------------------------------------------------
// Architect Drive — where each firm's conversation stopped
// ------------------------------------------------------------------

type ArchitectLead = {
  id: string
  full_name: string
  company_name: string | null
  phone: string | null
  priority: string | null
  priority_note: string | null
  stage: Stage | null
  assignee: { full_name: string } | null
}

function ArchitectTab({ dataSetId, onOpen }: { dataSetId?: string; onOpen: (id: string) => void }) {
  const [priority, setPriority] = useState("")

  const leadsQuery = useQuery({
    queryKey: ["founder-desk-architects", dataSetId],
    enabled: Boolean(dataSetId),
    queryFn: async (): Promise<ArchitectLead[]> => {
      const { data, error } = await createClient()
        .from("leads")
        .select("id, full_name, company_name, phone, priority, priority_note, stage:stage_id(name, slug, color, stage_type), assignee:assigned_to(full_name)")
        .eq("data_set_id", dataSetId!)
        .eq("is_archived", false)
      if (error) throw error
      return (data ?? []) as unknown as ArchitectLead[]
    },
  })

  const meetingsQuery = useQuery({
    queryKey: ["founder-desk-architect-meetings", dataSetId],
    enabled: Boolean(dataSetId),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("interactions")
        .select("lead_id, occurred_at, created_at, notes, outcome, lead:lead_id!inner(data_set_id)")
        .in("type", ["meeting", "site_visit"])
        .eq("lead.data_set_id", dataSetId!)
        .order("occurred_at", { ascending: false, nullsFirst: false })
      if (error) throw error
      const last = new Map<string, { at: string; notes: string | null; count: number }>()
      for (const m of (data ?? []) as { lead_id: string; occurred_at: string | null; created_at: string; notes: string | null }[]) {
        const prev = last.get(m.lead_id)
        if (prev) prev.count++
        else last.set(m.lead_id, { at: m.occurred_at ?? m.created_at, notes: m.notes, count: 1 })
      }
      return last
    },
  })

  // P1 first, unrated after P4, dropped last.
  const rank = (p: string | null) => ({ P1: 0, P2: 1, P3: 2, P4: 3, dropped: 5 } as Record<string, number>)[p ?? ""] ?? 4
  const rows = (leadsQuery.data ?? [])
    .filter((l) => !priority || l.priority === priority)
    .sort((a, b) => rank(a.priority) - rank(b.priority))

  if (leadsQuery.isLoading) {
    return <div className="flex items-center justify-center py-16 text-[#9090A8]"><Loader2 className="mr-2 size-4 animate-spin" /> Loading…</div>
  }

  return (
    <div>
      <p className="mb-3 text-sm text-[#9090A8]">
        The Delhi team&apos;s Dec 2025 architect meeting drive. Each firm shows its field rating and the last thing said — pick up from there.
      </p>
      <div className="thin-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
        {["", "P1", "P2", "P3", "P4", "dropped"].map((p) => (
          <button
            key={p || "all"}
            type="button"
            onClick={() => setPriority(p)}
            className={cn("inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs", priority === p ? "border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#F0F0FA]" : "border-[#2A2A3C] text-[#9090A8]")}
          >
            {p === "" ? "All" : p === "dropped" ? "Dropped" : p}
            <span className="ml-1 text-[#5A5A72]">{p === "" ? (leadsQuery.data ?? []).length : (leadsQuery.data ?? []).filter((l) => l.priority === p).length}</span>
          </button>
        ))}
      </div>
      <ul className="divide-y divide-[#1F1F2E] overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
        {rows.map((l) => {
          const m = meetingsQuery.data?.get(l.id)
          return (
            <li key={l.id}>
              <button type="button" onClick={() => onOpen(l.id)} className="block w-full p-3 text-left hover:bg-[#15151D]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <PriorityBadge priority={l.priority} note={l.priority_note} />
                  <span className="truncate text-sm font-semibold text-[#F0F0FA]">{l.company_name || l.full_name}</span>
                  {l.company_name && l.full_name !== l.company_name ? <span className="text-xs text-[#9090A8]">· {l.full_name}</span> : null}
                  <span className="ml-auto text-[10px] text-[#5A5A72]">{l.assignee?.full_name ?? "Unassigned"}</span>
                </div>
                {m ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[#9090A8]">
                    <span className="text-[#A78BFA]">Last met {format(new Date(m.at), "d MMM yyyy")}{m.count > 1 ? ` (${m.count} meetings)` : ""}:</span>{" "}
                    {m.notes?.split("\n")[0]}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-[#5A5A72]">No meeting on record</p>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ------------------------------------------------------------------
// Contacts & Guide
// ------------------------------------------------------------------

function ContactsTab() {
  const summary = useQuery({
    queryKey: ["universe-summary"],
    queryFn: async () => {
      const { data, error } = await createClient().rpc("universe_summary")
      if (error) throw error
      return (data ?? []) as { dimension: string; bucket: string; total: number }[]
    },
    staleTime: 5 * 60 * 1000,
  })
  const get = (dim: string) => (summary.data ?? []).filter((r) => r.dimension === dim).sort((a, b) => Number(b.total) - Number(a.total))
  const stage = (b: string) => Number(get("funnel_stage").find((r) => r.bucket === b)?.total ?? 0)

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#9090A8]">
        Dhruv sir&apos;s compiled contact base. Kept out of the pipeline on purpose — pull a contact in only when you start working it.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[["Client", "5-CLIENT", "#10B981"], ["Opportunity", "4-OPPORTUNITY", "#F59E0B"], ["Engaged", "3-ENGAGED", "#8B5CF6"], ["Contacted", "2-CONTACTED", "#3B82F6"], ["Audience", "1-AUDIENCE", "#6B7280"]].map(([label, key, color]) => (
          <div key={key} className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-3">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#9090A8]"><span className="size-2 rounded-full" style={{ backgroundColor: color }} />{label}</p>
            <p className="mt-1 text-lg font-semibold text-[#F0F0FA]">{summary.isLoading ? "…" : stage(key).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4 text-sm text-[#9090A8]">
        <p className="font-medium text-[#F0F0FA]">Where to start</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><b className="text-[#F0F0FA]">Opportunity</b> contacts once gave a tender or enquiry — the warmest re-qualification calls.</li>
          <li><b className="text-[#F0F0FA]">Client</b> contacts are past relationships — ask for repeat work and referrals.</li>
          <li><b className="text-[#F0F0FA]">Audience</b> is for marketing campaigns, not calls.</li>
        </ul>
        <Link href="/universe" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#10B981]/15 px-3 text-sm font-medium text-[#34D399]">
          <Globe className="size-4" /> Open Contact Universe
        </Link>
      </div>
    </div>
  )
}

function GuideTab() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4 text-sm text-[#9090A8]">
        <p className="font-medium text-[#F0F0FA]">Working this desk — Manpreet sir</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>Start on <b className="text-[#F0F0FA]">Today</b>: the list is ranked HOT → TENDER → follow-ups. Call from the top.</li>
          <li>Open a deal to see <b className="text-[#F0F0FA]">As received from Dhruv sir</b> — his status, value, owner and next action — above your own timeline.</li>
          <li>After every call or visit, log it (＋ on phone, or Log Meeting in the lead). Move the stage when it changes; sir&apos;s original stays saved.</li>
          <li>Close the task, or reschedule it, so tomorrow&apos;s list is accurate.</li>
          <li>Every deal needs a value — sir&apos;s rule. Fill it in the lead when you learn it.</li>
          <li>Nothing sends automatically. Use <b className="text-[#F0F0FA]">Copy WhatsApp list</b> and send yourself.</li>
        </ol>
      </div>
      <Link href="/founder-desk/guide" className="flex items-center justify-between rounded-xl border border-[#2A2A3C] bg-[#111118] p-4 hover:border-[#3A3A52]">
        <span>
          <span className="block text-sm font-medium text-[#F0F0FA]">Dhruv sir&apos;s original documents</span>
          <span className="block text-xs text-[#9090A8]">README · System Guide · Team Playbook · Data Dictionary · Project History</span>
        </span>
        <BookOpen className="size-5 text-[#9090A8]" />
      </Link>
    </div>
  )
}
