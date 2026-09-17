"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, isPast } from "date-fns"
import { ArrowDownLeft, ArrowUpRight, Loader2, Mail, Search } from "lucide-react"

import { PriorityBadge } from "@/components/data/DataSetBadge"
import { useDataSets } from "@/lib/hooks/useDataSets"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type BdLead = {
  id: string
  full_name: string
  company_name: string | null
  city: string | null
  priority: string | null
  priority_note: string | null
  data_set_id: string | null
  stage: { name: string; slug: string; color: string } | null
}

type Snapshot = { lead_id: string; external_ref: string | null; data: { section?: string; status?: string; next?: string | null; follow_up_rank?: number } }
type Entry = { lead_id: string; type: string; title: string | null; notes: string | null; occurred_at: string | null; created_at: string; data_set_id: string | null; user: { full_name: string } | null }
type OpenTask = { lead_id: string; title: string; due_at: string }

const SECTIONS = ["Active client", "Live tender", "Warm prospect", "Cold outreach"]
const PRIORITY_RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3, dropped: 5 }

export default function SalesBdPage() {
  const { setLeadDrawerId } = useUIStore()
  const { byKey, byId } = useDataSets()
  const dataSet = byKey.get("sales-bd-mailbox")
  const [section, setSection] = useState("")
  const [priority, setPriority] = useState("")
  const [search, setSearch] = useState("")

  // Every lead with a Sales BD snapshot — including firms that already
  // belonged to the founder's pipeline and keep that section.
  const query = useQuery({
    queryKey: ["sales-bd", dataSet?.id],
    enabled: Boolean(dataSet),
    queryFn: async () => {
      const supabase = createClient()
      const id = dataSet!.id
      const snaps = await supabase
        .from("lead_source_snapshots")
        .select("lead_id, external_ref, data")
        .eq("data_set_id", id)
      if (snaps.error) throw snaps.error
      const ids = (snaps.data ?? []).map((s) => s.lead_id)
      if (!ids.length) return []

      const [leads, entries, tasks] = await Promise.all([
        supabase
          .from("leads")
          .select("id, full_name, company_name, city, priority, priority_note, data_set_id, stage:stage_id(name, slug, color)")
          .in("id", ids)
          .eq("is_archived", false),
        supabase
          .from("interactions")
          .select("lead_id, type, title, notes, occurred_at, created_at, data_set_id, user:user_id(full_name)")
          .in("lead_id", ids)
          .limit(5000),
        supabase
          .from("tasks")
          .select("lead_id, title, due_at")
          .in("lead_id", ids)
          .is("completed_at", null),
      ])
      if (leads.error) throw leads.error
      if (entries.error) throw entries.error
      if (tasks.error) throw tasks.error

      const snapByLead = new Map((snaps.data as Snapshot[]).map((s) => [s.lead_id, s]))
      const when = (e: Entry) => e.occurred_at ?? e.created_at

      return ((leads.data ?? []) as unknown as BdLead[]).map((lead) => {
        const mine = ((entries.data ?? []) as unknown as Entry[])
          .filter((e) => e.lead_id === lead.id)
          .sort((a, b) => when(b).localeCompare(when(a)))
        return {
          lead,
          snap: snapByLead.get(lead.id)!,
          lastEmail: mine.find((e) => e.data_set_id === id && (e.type === "email_sent" || e.type === "email_received")) ?? null,
          latestErp: mine.find((e) => e.user && e.type !== "stage_change") ?? null,
          nextTask: ((tasks.data ?? []) as OpenTask[])
            .filter((t) => t.lead_id === lead.id)
            .sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null,
        }
      })
    },
  })

  const rows = useMemo(() => query.data ?? [], [query.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => !section || r.snap.data.section === section)
      .filter((r) => !priority || r.lead.priority === priority)
      .filter((r) => !q || [r.lead.company_name, r.lead.full_name, r.lead.city, r.snap.data.status].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
      .sort((a, b) =>
        (a.snap.data.follow_up_rank ?? 99) - (b.snap.data.follow_up_rank ?? 99) ||
        (PRIORITY_RANK[a.lead.priority ?? ""] ?? 4) - (PRIORITY_RANK[b.lead.priority ?? ""] ?? 4) ||
        (a.lead.company_name ?? "").localeCompare(b.lead.company_name ?? "")
      )
  }, [rows, section, priority, search])

  const stats = useMemo(() => ({
    total: rows.length,
    p1: rows.filter((r) => r.lead.priority === "P1").length,
    ballInOurCourt: rows.filter((r) => r.lastEmail?.type === "email_received" && r.lead.priority !== "P4").length,
    overdue: rows.filter((r) => r.nextTask && isPast(new Date(r.nextTask.due_at))).length,
  }), [rows])

  const chip = (active: boolean) =>
    cn("inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs transition", active ? "border-[#EC4899] bg-[#EC4899]/15 text-[#F0F0FA]" : "border-[#2A2A3C] text-[#9090A8] hover:text-[#F0F0FA]")

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
          <Mail className="size-5 text-[#EC4899]" /> Sales BD
        </h1>
        <p className="mt-1 text-sm text-[#9090A8]">
          Clients, tenders and prospects from the sales@hagerstone.com mailbox (Anand S Choudhari, BD South), reviewed 14 Sep 2026 — with where each email conversation stopped. Separate from founder, architect and website data.
        </p>
        <p className="mt-1 text-xs text-[#5A5A72]">
          Email state only: outbound from that mailbox mostly stopped around 19 Jun 2026, so check by phone before assuming a deal is still where it shows.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Opportunities", value: stats.total },
          { label: "Priority 1", value: stats.p1 },
          { label: "Client wrote last", value: stats.ballInOurCourt, warn: stats.ballInOurCourt > 0 },
          { label: "Follow-ups overdue", value: stats.overdue, warn: stats.overdue > 0 },
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
            placeholder="Search company, person or city"
            className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] pl-9 pr-3 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#EC4899] md:text-sm"
          />
        </div>
        <div className="thin-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {["", ...SECTIONS].map((s) => (
            <button key={s || "all"} type="button" className={chip(section === s)} onClick={() => setSection(s)}>
              {s || "All"}
              <span className="ml-1 text-[#5A5A72]">{s ? rows.filter((r) => r.snap.data.section === s).length : rows.length}</span>
            </button>
          ))}
        </div>
        <div className="thin-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {["", "P1", "P2", "P3", "P4"].map((p) => (
            <button key={p || "any"} type="button" className={chip(priority === p)} onClick={() => setPriority(p)}>
              {p || "Any priority"}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading || !dataSet ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]"><Loader2 className="mr-2 size-4 animate-spin" /> Loading…</div>
      ) : query.error ? (
        <div className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">Could not load the Sales BD pipeline.</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] py-16 text-center text-sm text-[#9090A8]">Nothing matches.</div>
      ) : (
        <ul className="space-y-3">
          {filtered.map(({ lead, snap, lastEmail, latestErp, nextTask }) => {
            const otherSection = lead.data_set_id && lead.data_set_id !== dataSet.id ? byId.get(lead.data_set_id) : null
            const inbound = lastEmail?.type === "email_received"
            const erpIsNewer = latestErp && lastEmail && (latestErp.occurred_at ?? latestErp.created_at) > (lastEmail.occurred_at ?? lastEmail.created_at)
            return (
              <li key={lead.id}>
                <button type="button" onClick={() => setLeadDrawerId(lead.id)} className="block w-full rounded-xl border border-[#2A2A3C] bg-[#111118] p-3 text-left hover:bg-[#15151D] md:p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={lead.priority} note={lead.priority_note} />
                    <span className="truncate text-sm font-semibold text-[#F0F0FA]">{lead.company_name || lead.full_name}</span>
                    {lead.company_name && lead.full_name !== lead.company_name ? <span className="truncate text-xs text-[#9090A8]">· {lead.full_name}</span> : null}
                    {otherSection ? (
                      <span className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: `${otherSection.color}66`, color: otherSection.color }} title="This firm was already in the ERP; it stays in that section and the mailbox history was added to it.">
                        Also in {otherSection.name}
                      </span>
                    ) : null}
                    <span className="ml-auto text-[10px] text-[#5A5A72]">{snap.data.section} · {lead.stage?.name ?? "—"}</span>
                  </div>
                  {snap.data.status ? <p className="mt-1 text-[11px] font-medium text-[#EC4899]">{snap.data.status}</p> : null}

                  <div className="mt-2.5 space-y-1.5 border-t border-[#1F1F2E] pt-2.5 text-[11px]">
                    {erpIsNewer ? (
                      <div className="flex gap-2">
                        <span className="w-[84px] shrink-0 text-[#34D399]">Latest</span>
                        <span className="min-w-0 text-[#F0F0FA]">
                          {format(new Date(latestErp!.occurred_at ?? latestErp!.created_at), "d MMM yyyy")} · {latestErp!.type.replace(/_/g, " ")} by {latestErp!.user?.full_name}
                          {latestErp!.notes ? <span className="text-[#9090A8]"> — {latestErp!.notes.slice(0, 110)}</span> : null}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <span className="w-[84px] shrink-0 text-[#5A5A72]">Last email</span>
                      <span className="min-w-0 text-[#F0F0FA]">
                        {lastEmail ? (
                          <>
                            <span className={cn("inline-flex items-center gap-0.5", inbound ? "text-[#34D399]" : "text-[#C8A878]")}>
                              {inbound ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
                              {inbound ? "From client" : "From us"}
                            </span>
                            {" · "}{format(new Date(lastEmail.occurred_at ?? lastEmail.created_at), "d MMM yyyy")}
                            <span className="line-clamp-2 text-[#9090A8]">{(lastEmail.notes ?? "").split("\n")[0]}</span>
                          </>
                        ) : <span className="text-[#5A5A72]">—</span>}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-[84px] shrink-0 text-[#5A5A72]">Next step</span>
                      <span className="min-w-0">
                        {nextTask ? (
                          <span className={isPast(new Date(nextTask.due_at)) ? "text-[#F87171]" : "text-[#F0F0FA]"}>
                            {format(new Date(nextTask.due_at), "d MMM")} — {nextTask.title}
                          </span>
                        ) : snap.data.next ? (
                          <span className="text-[#9090A8]">{snap.data.next}</span>
                        ) : (
                          <span className="text-[#5A5A72]">None set</span>
                        )}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
