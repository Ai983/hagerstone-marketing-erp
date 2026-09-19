"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowRightCircle, CheckCircle2, ChevronLeft, ChevronRight, Globe, Loader2,
  Mail, MapPin, MessageCircle, Phone, Search, SlidersHorizontal, X,
} from "lucide-react"

import { useLeads } from "@/lib/hooks/useLeads"
import { getCachedUser } from "@/lib/hooks/useUser"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import { GroupBadge } from "@/components/data/RelationshipGroupBadge"
import type { FunnelStage, UniverseContact, UniverseRelationshipGroup } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  applyUniverseGroupFilter, isUniverseGroup, UNIVERSE_GROUP_ORDER, UNIVERSE_GROUPS, universeGroupOf,
} from "@/lib/utils/relationship-group"

const PAGE_SIZE = 50

// The funnel, top to bottom. Leads (2–5) and audience (1) are never mixed:
// the default view is leads only, audience is an explicit switch.
const STAGES: { value: FunnelStage; label: string; color: string; hint: string }[] = [
  { value: "5-CLIENT", label: "Client", color: "#10B981", hint: "Won / billed / existing relationship — farm for repeat" },
  { value: "4-OPPORTUNITY", label: "Opportunity", color: "#F59E0B", hint: "Gave us a tender or enquiry, or we quoted" },
  { value: "3-ENGAGED", label: "Engaged", color: "#8B5CF6", hint: "Live correspondence or meetings" },
  { value: "2-CONTACTED", label: "Contacted", color: "#3B82F6", hint: "Touched at least once" },
  { value: "1-AUDIENCE", label: "Audience", color: "#6B7280", hint: "Marketing audience — relationship unknown" },
]

const PERSONAS = ["Architect", "End-Client", "Developer", "PMC", "Broker-IPC", "Channel-Partner", "Unknown"]
const REGIONS = ["NCR", "North", "South", "West", "East", "Central", "Unknown"]
const FIELDS = ["Interior", "Facade", "MEP", "EPC", "Furniture"]
const RECENCY = ["0-1mo", "1-3mo", "3-6mo", "6mo+"]

const FIELD_TO_SERVICE_LINE: Record<string, string> = {
  Interior: "office_interiors",
  Facade: "facade_glazing",
  MEP: "mep",
  EPC: "civil_works",
  Furniture: "office_interiors",
}

type Filters = {
  scope: "leads" | "audience" | "all"
  stage: FunnelStage | ""
  /** Relationship group — overrides scope and stage while set. */
  group: UniverseRelationshipGroup | ""
  persona: string
  region: string
  field: string
  recency: string
  hideConverted: boolean
}

const EMPTY: Filters = { scope: "leads", stage: "", group: "", persona: "", region: "", field: "", recency: "", hideConverted: false }

type SummaryRow = { dimension: string; bucket: string; total: number }

function stageMeta(s: string) {
  return STAGES.find((x) => x.value === s)
}

function tenDigits(phone: string | null) {
  const d = (phone ?? "").split(/[\/,;]/)[0].replace(/\D/g, "")
  return d.length >= 10 ? d.slice(-10) : null
}

export default function UniversePage() {
  const queryClient = useQueryClient()
  const { setLeadDrawerId } = useUIStore()
  const { getStageBySlug } = useLeads()

  const [input, setInput] = useState("")
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [page, setPage] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [converting, setConverting] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(input.trim().toLowerCase()), 350)
    return () => window.clearTimeout(t)
  }, [input])

  useEffect(() => setPage(0), [search, filters])

  // Deep link from the Sales Engine groups panel: /universe?group=past_client.
  // Read once on mount — plain window access keeps this page out of a
  // Suspense boundary.
  useEffect(() => {
    const group = new URLSearchParams(window.location.search).get("group")
    if (group && isUniverseGroup(group)) setFilters((f) => ({ ...f, group, stage: "", scope: "all" }))
  }, [])

  const summary = useQuery({
    queryKey: ["universe-summary"],
    queryFn: async (): Promise<SummaryRow[]> => {
      const { data, error } = await createClient().rpc("universe_summary")
      if (error) throw error
      return (data ?? []) as SummaryRow[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of summary.data ?? []) if (r.dimension === "funnel_stage") c[r.bucket] = Number(r.total)
    return c
  }, [summary.data])

  const totalLeads = STAGES.filter((s) => s.value !== "1-AUDIENCE").reduce((n, s) => n + (stageCounts[s.value] ?? 0), 0)

  const list = useQuery({
    queryKey: ["universe", search, filters, page],
    queryFn: async () => {
      let q = createClient()
        .from("universe_contacts")
        .select("*", { count: "estimated" })

      if (filters.group) q = applyUniverseGroupFilter(q, filters.group)
      else if (filters.stage) q = q.eq("funnel_stage", filters.stage)
      else if (filters.scope === "leads") q = q.eq("is_lead", true)
      else if (filters.scope === "audience") q = q.eq("is_lead", false)

      if (filters.persona) q = q.eq("persona", filters.persona)
      if (filters.region) q = q.eq("region", filters.region)
      if (filters.field) q = q.eq("field", filters.field)
      if (filters.recency) q = q.eq("recency", filters.recency)
      if (filters.hideConverted) q = q.is("converted_lead_id", null)
      if (search) q = q.ilike("search_text", `%${search}%`)

      const { data, error, count } = await q
        .order("funnel_stage", { ascending: false })
        .order("serial", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (error) throw error
      return { rows: (data ?? []) as UniverseContact[], count: count ?? 0 }
    },
    placeholderData: (prev) => prev,
  })

  const rows = list.data?.rows ?? []
  const count = list.data?.count ?? 0
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const activeFilterCount = [filters.group, filters.persona, filters.region, filters.field, filters.recency].filter(Boolean).length + (filters.hideConverted ? 1 : 0)

  const convert = async (c: UniverseContact) => {
    setConverting(c.id)
    try {
      const supabase = createClient()
      const user = await getCachedUser()
      if (!user) throw new Error("Not signed in")

      const phone = tenDigits(c.phone)
      // Dedupe on the founder's rule before creating anything.
      if (phone || c.email) {
        const ors = [phone ? `phone.ilike.%${phone}` : null, c.email ? `email.ilike.${c.email}` : null].filter(Boolean).join(",")
        const { data: existing } = await supabase.from("leads").select("id, full_name").or(ors).limit(1).maybeSingle()
        if (existing) {
          await supabase.from("universe_contacts").update({ converted_lead_id: existing.id, converted_at: new Date().toISOString(), converted_by: user.id }).eq("id", c.id)
          toast.info(`Already in the pipeline as ${existing.full_name}`)
          queryClient.invalidateQueries({ queryKey: ["universe"] })
          setLeadDrawerId(existing.id)
          return
        }
      }

      const stage = await getStageBySlug(c.funnel_stage === "4-OPPORTUNITY" ? "qualified" : c.funnel_stage === "1-AUDIENCE" ? "new_lead" : "contacted")
      const { data: ds } = await supabase.from("data_sets").select("id").eq("key", "founder-universe").maybeSingle()

      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          full_name: c.name || c.company || "Unknown contact",
          company_name: c.company,
          designation: c.role,
          phone,
          email: c.email,
          city: c.city,
          service_line: (c.field && FIELD_TO_SERVICE_LINE[c.field]) || "unknown",
          source: "other",
          source_detail: `Founder universe · ${c.source_tag ?? c.funnel_stage}${c.serial ? ` · #${c.serial}` : ""}`,
          stage_id: stage?.id,
          created_by: user.id,
          assigned_to: user.id,
          data_set_id: ds?.id ?? null,
          external_ref: c.serial,
          initial_notes: [
            `[Pulled from the founder's contact universe — ${stageMeta(c.funnel_stage)?.label ?? c.funnel_stage}]`,
            c.persona ? `Persona: ${c.persona}` : null,
            c.region ? `Region: ${c.region}` : null,
            c.recency ? `Last activity: ${c.recency}` : null,
            c.project ? `Context: ${c.project}` : null,
            c.suggested_action ? `Suggested action: ${c.suggested_action}` : null,
          ].filter(Boolean).join("\n"),
        })
        .select("id")
        .single()
      if (error) throw error

      await supabase.from("universe_contacts").update({ converted_lead_id: lead.id, converted_at: new Date().toISOString(), converted_by: user.id }).eq("id", c.id)

      toast.success("Added to your pipeline")
      queryClient.invalidateQueries({ queryKey: ["universe"] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
      setLeadDrawerId(lead.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert")
    } finally {
      setConverting(null)
    }
  }

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))

  const selects = (
    <>
      <select
        value={filters.group}
        onChange={(e) => set({ group: e.target.value as UniverseRelationshipGroup | "", stage: "", scope: e.target.value ? "all" : "leads" })}
        className="h-11 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none md:h-10"
      >
        <option value="">All groups</option>
        {UNIVERSE_GROUP_ORDER.map((g) => <option key={g} value={g}>{UNIVERSE_GROUPS[g].label}</option>)}
      </select>
      {[
        { key: "persona", label: "All personas", options: PERSONAS },
        { key: "region", label: "All regions", options: REGIONS },
        { key: "field", label: "All fields", options: FIELDS },
        { key: "recency", label: "Any recency", options: RECENCY },
      ].map((s) => (
        <select
          key={s.key}
          value={filters[s.key as keyof Filters] as string}
          onChange={(e) => set({ [s.key]: e.target.value } as Partial<Filters>)}
          className="h-11 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none md:h-10"
        >
          <option value="">{s.label}</option>
          {s.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ))}
      <label className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-xs text-[#9090A8] md:h-10">
        <input type="checkbox" checked={filters.hideConverted} onChange={(e) => set({ hideConverted: e.target.checked })} className="size-4 accent-[#3B82F6]" />
        Hide ones in pipeline
      </label>
    </>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
          <Globe className="size-5 text-[#10B981]" /> Contact Universe
        </h1>
        <p className="mt-1 text-sm text-[#9090A8]">
          The founder&apos;s compiled contact base. Leads (touched) and marketing audience (never touched) are kept apart — pull a contact into the pipeline when you pick it up.
        </p>
      </div>

      {/* Funnel stage cards */}
      <div className="thin-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-5 md:px-0">
        {STAGES.map((s) => {
          const active = filters.stage === s.value
          return (
            <button
              key={s.value}
              type="button"
              title={s.hint}
              onClick={() => set({ stage: active ? "" : s.value, group: "", scope: s.value === "1-AUDIENCE" ? "audience" : "leads" })}
              className={cn(
                "min-w-[128px] shrink-0 rounded-xl border p-3 text-left transition",
                active ? "bg-[#1A1A24]" : "border-[#2A2A3C] bg-[#111118] hover:border-[#3A3A52]"
              )}
              style={active ? { borderColor: s.color } : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-[11px] uppercase tracking-wider text-[#9090A8]">{s.label}</span>
              </div>
              <p className="mt-1 text-xl font-semibold text-[#F0F0FA]">
                {summary.isLoading ? "…" : (stageCounts[s.value] ?? 0).toLocaleString("en-IN")}
              </p>
            </button>
          )
        })}
      </div>

      {/* Scope + search */}
      <div className="mb-3 flex flex-col gap-2 md:flex-row">
        <div className="flex rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-1">
          {([
            { v: "leads", l: `Leads${totalLeads ? ` · ${totalLeads.toLocaleString("en-IN")}` : ""}` },
            { v: "audience", l: "Audience" },
            { v: "all", l: "All" },
          ] as const).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => set({ scope: o.v, stage: "", group: "" })}
              className={cn(
                "h-9 flex-1 whitespace-nowrap rounded-md px-3 text-sm transition md:flex-none",
                filters.scope === o.v && !filters.stage && !filters.group ?"bg-[#3B82F6] text-white" : "text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5A5A72]" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Name, company, email, city, phone or project"
              className="h-11 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] pl-9 pr-3 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#3B82F6] md:text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] md:hidden"
          >
            <SlidersHorizontal className="size-4" />
            {activeFilterCount ? <span className="rounded-full bg-[#3B82F6] px-1.5 text-xs text-white">{activeFilterCount}</span> : null}
          </button>
        </div>
      </div>

      <div className={cn("mb-4 grid grid-cols-2 gap-2 md:flex md:flex-wrap", showFilters ? "grid" : "hidden md:flex")}>
        {selects}
        {activeFilterCount ? (
          <button type="button" onClick={() => setFilters((f) => ({ ...EMPTY, scope: f.group ? "leads" : f.scope, stage: f.stage }))}className="inline-flex h-11 items-center justify-center gap-1 rounded-lg px-3 text-xs text-[#9090A8] hover:text-[#F0F0FA] md:h-10">
            <X className="size-3.5" /> Clear
          </button>
        ) : null}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-[#9090A8]">
        <span>{list.isFetching ? "Searching…" : `${count.toLocaleString("en-IN")} contacts`}</span>
        {pages > 1 ? <span>Page {page + 1} of {pages.toLocaleString("en-IN")}</span> : null}
      </div>

      {list.error ? (
        <div className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">
          Could not load the universe. The contact-universe migration and import may not have been run yet.
        </div>
      ) : list.isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] py-16 text-center text-sm text-[#9090A8]">
          No contacts match.
        </div>
      ) : (
        <ul className="divide-y divide-[#1F1F2E] overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
          {rows.map((c) => {
            const meta = stageMeta(c.funnel_stage)
            const phone = tenDigits(c.phone)
            return (
              <li key={c.id} className="p-3 md:p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: meta?.color }} title={meta?.label} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="truncate text-sm font-semibold text-[#F0F0FA]">{c.name || c.company || "Unnamed"}</p>
                      {c.company && c.name ? <p className="truncate text-xs text-[#9090A8]">{c.company}</p> : null}
                    </div>
                    {c.role ? <p className="truncate text-xs text-[#9090A8]">{c.role}</p> : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <GroupBadge meta={UNIVERSE_GROUPS[universeGroupOf(c)]} />
                      {c.persona ? <span className="rounded-full bg-[#1F1F2E] px-1.5 py-0.5 text-[#9090A8]">{c.persona}</span> : null}
                      {c.field ? <span className="rounded-full bg-[#1F1F2E] px-1.5 py-0.5 text-[#9090A8]">{c.field}</span> : null}
                      {c.recency ? <span className="rounded-full bg-[#1F1F2E] px-1.5 py-0.5 text-[#9090A8]">{c.recency}</span> : null}
                      {c.city || c.region ? (
                        <span className="inline-flex items-center gap-0.5 text-[#9090A8]"><MapPin className="size-2.5" />{[c.city, c.region].filter(Boolean).join(" · ")}</span>
                      ) : null}
                    </div>
                    {c.project ? <p className="mt-1.5 line-clamp-2 text-xs text-[#9090A8]">{c.project}</p> : null}
                    {c.suggested_action ? <p className="mt-1 text-[11px] text-[#5A5A72]">→ {c.suggested_action}</p> : null}
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2 pl-5">
                  {phone ? (
                    <>
                      <a href={`tel:${phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-3 text-xs text-[#F0F0FA]"><Phone className="size-3.5" />Call</a>
                      <a href={`https://wa.me/91${phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-3 text-xs text-[#F0F0FA]"><MessageCircle className="size-3.5 text-[#25D366]" />WhatsApp</a>
                    </>
                  ) : null}
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-3 text-xs text-[#F0F0FA]"><Mail className="size-3.5" /><span className="truncate">{c.email}</span></a>
                  ) : null}
                  {c.converted_lead_id ? (
                    <button type="button" onClick={() => setLeadDrawerId(c.converted_lead_id!)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#163322] px-3 text-xs text-[#34D399]">
                      <CheckCircle2 className="size-3.5" />In pipeline
                    </button>
                  ) : (
                    <button type="button" disabled={converting === c.id} onClick={() => convert(c)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 text-xs font-medium text-white disabled:opacity-60">
                      {converting === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRightCircle className="size-3.5" />}
                      Add to pipeline
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="inline-flex h-10 items-center gap-1 rounded-lg border border-[#2A2A3C] px-3 text-sm text-[#F0F0FA] disabled:opacity-40">
            <ChevronLeft className="size-4" /> Prev
          </button>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="inline-flex h-10 items-center gap-1 rounded-lg border border-[#2A2A3C] px-3 text-sm text-[#F0F0FA] disabled:opacity-40">
            Next <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
