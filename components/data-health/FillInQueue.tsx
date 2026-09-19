"use client"

import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckCircle2, ExternalLink, Loader2, Phone, SkipForward } from "lucide-react"

import { DataSetBadge, PriorityBadge } from "@/components/data/DataSetBadge"
import { RelationshipGroupBadge } from "@/components/data/RelationshipGroupBadge"
import { DATA_HEALTH_KEY, missingChecks, type HealthCheckKey, type HealthLead } from "@/lib/hooks/useDataHealth"
import { useRelationshipGroups } from "@/lib/hooks/useRelationshipGroups"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import type { LeadRelationshipGroup } from "@/lib/types"

const SERVICE_LINES = [
  { value: "office_interiors", label: "Office Interiors" },
  { value: "mep", label: "MEP" },
  { value: "facade_glazing", label: "Facade doors & Windows" },
  { value: "peb_construction", label: "PEB Construction" },
  { value: "civil_works", label: "Civil Works" },
  { value: "multiple", label: "Multiple" },
]

// The fields this queue fills. "Phone or email" is handled in Unreachable.
const FILLABLE: HealthCheckKey[] = ["company", "city", "service", "value"]

const PRIORITY_RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 }
// Closest to money first; new prospects last.
const GROUP_RANK: Partial<Record<LeadRelationshipGroup, number>> = {
  proposal_pending: 0, gone_quiet: 1, warm_prospect: 2, active_client: 3, dormant_client: 4, new_prospect: 5,
}

const inputClass =
  "w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2.5 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#3B82F6] md:text-sm"

/**
 * "Complete these leads": one lead at a time, only its missing fields,
 * Save & next. Ordered P1/P2 first, then deals closest to money.
 */
export function FillInQueue({ leads }: { leads: HealthLead[] }) {
  const queryClient = useQueryClient()
  const { setLeadDrawerId } = useUIStore()
  const { byLeadId } = useRelationshipGroups()
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [doneCount, setDoneCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ company_name: "", city: "", service_line: "", estimated_budget: "" })

  const queue = useMemo(() => {
    return leads
      .filter((l) => l.stage?.stage_type !== "lost" && missingChecks(l).some((k) => FILLABLE.includes(k)))
      .sort((a, b) => {
        const pa = a.priority ? PRIORITY_RANK[a.priority] ?? 5 : 4
        const pb = b.priority ? PRIORITY_RANK[b.priority] ?? 5 : 4
        if (pa !== pb) return pa - pb
        const ga = GROUP_RANK[byLeadId.get(a.id)?.relationship_group as LeadRelationshipGroup] ?? 6
        const gb = GROUP_RANK[byLeadId.get(b.id)?.relationship_group as LeadRelationshipGroup] ?? 6
        if (ga !== gb) return ga - gb
        return b.created_at.localeCompare(a.created_at)
      })
  }, [leads, byLeadId])

  const remaining = queue.filter((l) => !skipped.has(l.id))
  const current = remaining[0]
  const missing = current ? missingChecks(current).filter((k) => FILLABLE.includes(k)) : []

  useEffect(() => {
    setForm({ company_name: "", city: "", service_line: "", estimated_budget: "" })
  }, [current?.id])

  const skip = () => current && setSkipped((s) => new Set(s).add(current.id))

  const save = async () => {
    if (!current) return
    const patch: Record<string, string> = {}
    if (form.company_name.trim()) patch.company_name = form.company_name.trim()
    if (form.city.trim()) patch.city = form.city.trim()
    if (form.service_line) patch.service_line = form.service_line
    if (form.estimated_budget.trim()) patch.estimated_budget = form.estimated_budget.trim()
    if (Object.keys(patch).length === 0) {
      skip()
      return
    }
    setSaving(true)
    const { error } = await createClient().from("leads").update(patch).eq("id", current.id)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    // Budget feeds the lead score — rescore, fire-and-forget.
    if (patch.estimated_budget) {
      fetch("/api/leads/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: current.id }),
      }).catch(() => {})
    }
    setDoneCount((n) => n + 1)
    // Fully complete → drops out on refetch; partly filled → skip so the
    // queue still moves on.
    setSkipped((s) => new Set(s).add(current.id))
    queryClient.invalidateQueries({ queryKey: DATA_HEALTH_KEY })
    queryClient.invalidateQueries({ queryKey: ["leads"] })
    queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
  }

  if (!current) {
    return (
      <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] px-4 py-12 text-center">
        <CheckCircle2 className="mx-auto size-8 text-[#10B981]" />
        <p className="mt-3 text-sm font-medium text-[#F0F0FA]">
          {queue.length === 0 ? "Every open lead has company, city, service line and budget." : "You've been through the queue."}
        </p>
        {skipped.size > 0 ? (
          <button type="button" onClick={() => setSkipped(new Set())} className="mt-3 text-xs text-[#60A5FA]">
            Show the {skipped.size} skipped again
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 text-xs text-[#9090A8]">
        {remaining.length} lead{remaining.length === 1 ? "" : "s"} to complete
        {doneCount ? <span className="text-[#34D399]"> · {doneCount} done this session</span> : null}
      </p>

      <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[#F0F0FA]">{current.full_name}</p>
            {current.company_name ? <p className="truncate text-sm text-[#9090A8]">{current.company_name}</p> : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <PriorityBadge priority={current.priority} />
              <RelationshipGroupBadge leadId={current.id} />
              <DataSetBadge dataSetId={current.data_set_id} />
              {current.stage ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#9090A8]">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: current.stage.color }} />
                  {current.stage.name}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-1.5">
            {current.phone ? (
              <a href={`tel:${current.phone}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#2A2A3C] px-2.5 text-xs text-[#F0F0FA]">
                <Phone className="size-3.5 text-[#10B981]" /> Call
              </a>
            ) : null}
            <button type="button" onClick={() => setLeadDrawerId(current.id)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#2A2A3C] px-2.5 text-xs text-[#F0F0FA]">
              <ExternalLink className="size-3.5" /> Open
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {missing.includes("company") ? (
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-[#9090A8]">Company</span>
              <input className={inputClass} value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} />
            </label>
          ) : null}
          {missing.includes("city") ? (
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-[#9090A8]">City</span>
              <input className={inputClass} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="e.g. Gurugram" />
            </label>
          ) : null}
          {missing.includes("service") ? (
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-[#9090A8]">Service line</span>
              <select className={inputClass} value={form.service_line} onChange={(e) => setForm((f) => ({ ...f, service_line: e.target.value }))}>
                <option value="">Select…</option>
                {SERVICE_LINES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          ) : null}
          {missing.includes("value") ? (
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-[#9090A8]">Estimated budget</span>
              <input className={inputClass} value={form.estimated_budget} onChange={(e) => setForm((f) => ({ ...f, estimated_budget: e.target.value }))} placeholder="e.g. ₹50L–₹1Cr" />
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#3B82F6] text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save &amp; next
          </button>
          <button type="button" onClick={skip} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-4 text-sm text-[#9090A8] hover:text-[#F0F0FA]">
            <SkipForward className="size-4" /> Skip
          </button>
        </div>
      </div>
    </div>
  )
}
