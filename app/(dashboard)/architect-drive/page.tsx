"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, MessageCircle, Phone, Search, Users } from "lucide-react"

import {
  summarise, WhereItStoppedView,
  type StopInteraction, type StopTask, type WhereItStopped,
} from "@/components/architect/WhereItStopped"
import { PriorityBadge } from "@/components/data/DataSetBadge"
import { useDataSets } from "@/lib/hooks/useDataSets"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type ArchitectLead = {
  id: string
  full_name: string
  company_name: string | null
  phone: string | null
  city: string | null
  priority: string | null
  priority_note: string | null
  stage: { name: string; slug: string; color: string } | null
  assignee: { full_name: string } | null
}

const PRIORITY_RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3, dropped: 5 }
const rank = (p: string | null) => PRIORITY_RANK[p ?? ""] ?? 4

export default function ArchitectDrivePage() {
  const { setLeadDrawerId } = useUIStore()
  const { byKey } = useDataSets()
  const dataSet = byKey.get("architect-meetings-dec-2025")
  const [priority, setPriority] = useState("")
  const [search, setSearch] = useState("")
  const [needsStep, setNeedsStep] = useState(false)

  // Three queries for the whole drive, filtered in the database through
  // the lead join — never by listing lead ids in the URL.
  const query = useQuery({
    queryKey: ["architect-drive", dataSet?.id],
    enabled: Boolean(dataSet),
    queryFn: async () => {
      const supabase = createClient()
      const id = dataSet!.id
      const [leads, ints, tasks] = await Promise.all([
        supabase
          .from("leads")
          .select("id, full_name, company_name, phone, city, priority, priority_note, stage:stage_id(name, slug, color), assignee:assigned_to(full_name)")
          .eq("data_set_id", id)
          .eq("is_archived", false),
        supabase
          .from("interactions")
          .select("lead_id, type, title, notes, outcome, attendees, occurred_at, created_at, user:user_id(full_name), lead:lead_id!inner(data_set_id)")
          .eq("lead.data_set_id", id)
          .limit(5000),
        supabase
          .from("tasks")
          .select("lead_id, title, type, due_at, lead:lead_id!inner(data_set_id)")
          .eq("lead.data_set_id", id)
          .is("completed_at", null),
      ])
      if (leads.error) throw leads.error
      if (ints.error) throw ints.error
      if (tasks.error) throw tasks.error

      const intsByLead = new Map<string, StopInteraction[]>()
      for (const i of (ints.data ?? []) as unknown as StopInteraction[]) {
        const list = intsByLead.get(i.lead_id) ?? []
        list.push(i)
        intsByLead.set(i.lead_id, list)
      }
      const tasksByLead = new Map<string, StopTask[]>()
      for (const t of (tasks.data ?? []) as unknown as StopTask[]) {
        const list = tasksByLead.get(t.lead_id) ?? []
        list.push(t)
        tasksByLead.set(t.lead_id, list)
      }

      return ((leads.data ?? []) as unknown as ArchitectLead[]).map((lead) => {
        const leadInts = intsByLead.get(lead.id) ?? []
        return {
          lead,
          stop: summarise(leadInts, tasksByLead.get(lead.id) ?? []),
          meetingCount: leadInts.filter((i) => i.type === "meeting" || i.type === "site_visit").length,
          // Dhruv sir's pipeline row #287 points at nine of these firms.
          // Shown as a label; the firm stays Architect Drive data.
          onFounderList: leadInts.some((i) => (i.title ?? "").startsWith("Founder pipeline #287")),
        }
      })
    },
  })

  const rows = useMemo(() => query.data ?? [], [query.data])

  const stats = useMemo(() => ({
    firms: rows.length,
    p1: rows.filter((r) => r.lead.priority === "P1").length,
    met: rows.filter((r) => r.meetingCount > 0).length,
    workedSince: rows.filter((r) => r.stop.latestErp).length,
    noStep: rows.filter((r) => !r.stop.nextTask && r.lead.priority !== "dropped").length,
  }), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => !priority || r.lead.priority === priority)
      .filter((r) => !needsStep || (!r.stop.nextTask && r.lead.priority !== "dropped"))
      .filter((r) => !q || [r.lead.company_name, r.lead.full_name, r.lead.city, r.lead.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      .sort((a, b) => rank(a.lead.priority) - rank(b.lead.priority) || (a.lead.company_name ?? "").localeCompare(b.lead.company_name ?? ""))
  }, [rows, priority, needsStep, search])

  const chip = (active: boolean) =>
    cn("inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs transition", active ? "border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#F0F0FA]" : "border-[#2A2A3C] text-[#9090A8] hover:text-[#F0F0FA]")

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
          <Users className="size-5 text-[#8B5CF6]" /> Architect Drive
        </h1>
        <p className="mt-1 text-sm text-[#9090A8]">
          The Delhi/NCR team&apos;s architect &amp; designer meeting drive (Nov–Dec 2025, Saurabh &amp; Vishal). Separate from Dhruv sir&apos;s founder data. Each firm shows where the conversation stopped.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: "Firms", value: stats.firms },
          { label: "Priority 1", value: stats.p1 },
          { label: "Met in person", value: stats.met },
          { label: "Worked in ERP since", value: stats.workedSince },
          { label: "No next step set", value: stats.noStep, warn: stats.noStep > 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-3">
            <p className="truncate text-[10px] uppercase tracking-wider text-[#9090A8]">{s.label}</p>
            <p className={cn("mt-1 text-xl font-semibold", s.warn ? "text-[#F59E0B]" : "text-[#F0F0FA]")}>{query.isLoading ? "…" : s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5A5A72]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search firm, person, city or phone"
            className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] pl-9 pr-3 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#8B5CF6] md:text-sm"
          />
        </div>
        <div className="thin-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {["", "P1", "P2", "P3", "P4", "dropped"].map((p) => (
            <button key={p || "all"} type="button" className={chip(priority === p)} onClick={() => setPriority(p)}>
              {p === "" ? "All" : p === "dropped" ? "Dropped" : p}
              <span className="ml-1 text-[#5A5A72]">{p === "" ? rows.length : rows.filter((r) => r.lead.priority === p).length}</span>
            </button>
          ))}
          <button type="button" className={chip(needsStep)} onClick={() => setNeedsStep((v) => !v)}>
            Needs a next step
          </button>
        </div>
      </div>

      {query.isLoading || !dataSet ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]"><Loader2 className="mr-2 size-4 animate-spin" /> Loading the drive…</div>
      ) : query.error ? (
        <div className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">Could not load the architect drive.</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] py-16 text-center text-sm text-[#9090A8]">No firms match.</div>
      ) : (
        <ul className="space-y-3">
          {filtered.map(({ lead, stop, meetingCount, onFounderList }) => (
            <ArchitectRow
              key={lead.id}
              lead={lead}
              stop={stop}
              meetingCount={meetingCount}
              onFounderList={onFounderList}
              onOpen={() => setLeadDrawerId(lead.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ArchitectRow({
  lead, stop, meetingCount, onFounderList, onOpen,
}: {
  lead: ArchitectLead
  stop: WhereItStopped
  meetingCount: number
  onFounderList: boolean
  onOpen: () => void
}) {
  const digits = (lead.phone ?? "").replace(/\D/g, "").slice(-10)
  return (
    <li className="rounded-xl border border-[#2A2A3C] bg-[#111118]">
      <button type="button" onClick={onOpen} className="block w-full p-3 text-left hover:bg-[#15151D] md:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={lead.priority} note={lead.priority_note} />
          <span className="truncate text-sm font-semibold text-[#F0F0FA]">{lead.company_name || lead.full_name}</span>
          {lead.company_name && lead.full_name !== lead.company_name ? (
            <span className="truncate text-xs text-[#9090A8]">· {lead.full_name}</span>
          ) : null}
          {onFounderList ? (
            <span
              className="rounded border border-[#F59E0B]/40 px-1.5 py-0.5 text-[10px] text-[#F59E0B]"
              title="Dhruv sir's pipeline row #287 lists this firm among the P1 architects left mid-follow-up when Saurabh resigned."
            >
              Also on Dhruv sir&apos;s list
            </span>
          ) : null}
          <span className="ml-auto text-[10px] text-[#5A5A72]">
            {meetingCount} meeting{meetingCount === 1 ? "" : "s"} · {lead.stage?.name ?? "—"} · {lead.assignee?.full_name ?? "Unassigned"}
          </span>
        </div>

        <div className="mt-2.5 border-t border-[#1F1F2E] pt-2.5">
          <WhereItStoppedView stop={stop} compact />
        </div>
      </button>

      {digits.length === 10 ? (
        <div className="flex gap-2 border-t border-[#1F1F2E] px-3 py-2 md:px-4">
          <a href={`tel:${digits}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-3 text-xs text-[#F0F0FA]">
            <Phone className="size-3.5" /> Call
          </a>
          <a href={`https://wa.me/91${digits}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-3 text-xs text-[#F0F0FA]">
            <MessageCircle className="size-3.5 text-[#25D366]" /> WhatsApp
          </a>
        </div>
      ) : null}
    </li>
  )
}
