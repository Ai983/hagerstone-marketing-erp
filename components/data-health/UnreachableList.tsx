"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { toast } from "sonner"
import { Archive, Loader2, Pencil } from "lucide-react"

import { DataSetBadge } from "@/components/data/DataSetBadge"
import { DATA_HEALTH_KEY, type HealthLead } from "@/lib/hooks/useDataHealth"
import { useLeads } from "@/lib/hooks/useLeads"
import { useUIStore } from "@/lib/stores/uiStore"

/**
 * Leads with neither a phone nor an email — nobody can act on them. For
 * each: open it and find the contact, or archive it (restorable).
 */
export function UnreachableList({ leads }: { leads: HealthLead[] }) {
  const queryClient = useQueryClient()
  const { setLeadDrawerId } = useUIStore()
  const { archiveLead } = useLeads()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: DATA_HEALTH_KEY })
    queryClient.invalidateQueries({ queryKey: ["leads"] })
    queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    queryClient.invalidateQueries({ queryKey: ["relationship-groups"] })
  }

  const archive = async (ids: string[]) => {
    setBusy(ids.length === 1 ? ids[0] : "bulk")
    try {
      for (const id of ids) await archiveLead(id)
      toast.success(`Archived ${ids.length} lead${ids.length === 1 ? "" : "s"} — restore any from Archive`)
      setSelected(new Set())
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not archive")
    } finally {
      setBusy(null)
    }
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (leads.length === 0) {
    return <p className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] px-4 py-6 text-center text-sm text-[#9090A8]">Every open lead has a phone or an email.</p>
  }

  const allSelected = selected.size === leads.length

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-[#9090A8]">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)))}
            className="size-4 accent-[#3B82F6]"
          />
          Select all
        </label>
        {selected.size > 0 ? (
          <button
            type="button"
            onClick={() => archive(Array.from(selected))}
            disabled={busy === "bulk"}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#7F1D1D] bg-[#2A1215] px-3 text-xs text-[#F87171] disabled:opacity-60"
          >
            {busy === "bulk" ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
            Archive {selected.size} selected
          </button>
        ) : null}
      </div>

      <ul className="divide-y divide-[#1F1F2E] overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
        {leads.map((l) => (
          <li key={l.id} className="flex items-center gap-3 p-3">
            <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="size-4 shrink-0 accent-[#3B82F6]" aria-label={`Select ${l.full_name}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm text-[#F0F0FA]">{l.full_name}</span>
                {l.company_name ? <span className="truncate text-xs text-[#9090A8]">{l.company_name}</span> : null}
                <DataSetBadge dataSetId={l.data_set_id} />
              </div>
              <p className="text-[11px] text-[#5A5A72]">{l.stage?.name ?? "No stage"} · added {format(new Date(l.created_at), "d MMM yyyy")}</p>
            </div>
            <button type="button" onClick={() => setLeadDrawerId(l.id)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#2A2A3C] px-2.5 text-xs text-[#F0F0FA]">
              <Pencil className="size-3.5" /> Find contact
            </button>
            <button
              type="button"
              onClick={() => archive([l.id])}
              disabled={busy === l.id}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-[#9090A8] hover:text-[#F87171] disabled:opacity-60"
            >
              {busy === l.id ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />} Archive
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
