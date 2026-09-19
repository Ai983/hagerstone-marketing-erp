"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { toast } from "sonner"
import { CheckCircle2, Link2, Loader2, Merge } from "lucide-react"

import { DataSetBadge } from "@/components/data/DataSetBadge"
import { getCachedUser } from "@/lib/hooks/useUser"
import {
  DATA_HEALTH_KEY, missingChecks, type DuplicateGroup, type HealthLead, type UniverseMatch,
} from "@/lib/hooks/useDataHealth"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const UNIVERSE_STAGE_LABEL: Record<string, string> = {
  "5-CLIENT": "Client", "4-OPPORTUNITY": "Opportunity", "3-ENGAGED": "Engaged", "2-CONTACTED": "Contacted", "1-AUDIENCE": "Audience",
}

/** Default pick: the most complete record, then the oldest. */
function suggestedKeep(leads: HealthLead[]) {
  return [...leads].sort(
    (a, b) => missingChecks(a).length - missingChecks(b).length || a.created_at.localeCompare(b.created_at)
  )[0].id
}

export function DuplicatesPanel({
  groups,
  leadsById,
  universeMatches,
}: {
  groups: DuplicateGroup[]
  leadsById: Map<string, HealthLead>
  universeMatches: UniverseMatch[]
}) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9090A8]">Duplicate leads ({groups.length})</h2>
        <p className="mb-3 text-xs text-[#5A5A72]">
          Same phone (last 10 digits) or same email. Pick the record to keep — the others&apos; calls, meetings, tasks and tags
          move onto it, empty fields are filled from them, and they are archived (restorable from Archive).
        </p>
        {groups.length === 0 ? (
          <Empty text="No duplicate leads." />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => <DuplicateGroupCard key={g.key} group={g} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#9090A8]">
          In the Contact Universe but not linked ({universeMatches.length})
        </h2>
        <p className="mb-3 text-xs text-[#5A5A72]">
          Linking marks the universe contact &ldquo;In pipeline&rdquo;, so nobody pulls the same person in a second time.
        </p>
        {universeMatches.length === 0 ? (
          <Empty text="Every pipeline lead that is in the universe is linked." />
        ) : (
          <ul className="divide-y divide-[#1F1F2E] overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
            {universeMatches.map((m) => <UniverseMatchRow key={m.lead_id} match={m} lead={leadsById.get(m.lead_id)} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

function DuplicateGroupCard({ group }: { group: DuplicateGroup }) {
  const queryClient = useQueryClient()
  const { setLeadDrawerId } = useUIStore()
  const [keepId, setKeepId] = useState(() => suggestedKeep(group.leads))
  const [merging, setMerging] = useState(false)

  const merge = async () => {
    setMerging(true)
    const supabase = createClient()
    try {
      for (const l of group.leads) {
        if (l.id === keepId) continue
        const { error } = await supabase.rpc("merge_leads", { p_keep: keepId, p_merge: l.id })
        if (error) throw error
      }
      toast.success(`Merged ${group.leads.length - 1} duplicate${group.leads.length > 2 ? "s" : ""}`)
      queryClient.invalidateQueries({ queryKey: DATA_HEALTH_KEY })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
      queryClient.invalidateQueries({ queryKey: ["relationship-groups"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Merge failed")
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-3">
      <p className="mb-2 text-[11px] text-[#9090A8]">
        Same {group.matchedOn}: <span className="font-mono text-[#F0F0FA]">{group.value}</span>
      </p>
      <div className="space-y-1.5">
        {group.leads.map((l) => (
          <label
            key={l.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition",
              keepId === l.id ? "border-[#3B82F6]/60 bg-[#1E3A5F]/30" : "border-[#2A2A3C] hover:border-[#3A3A52]"
            )}
          >
            <input type="radio" name={group.key} checked={keepId === l.id} onChange={() => setKeepId(l.id)} className="mt-1 size-4 accent-[#3B82F6]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium text-[#F0F0FA]">{l.full_name}</span>
                {l.company_name ? <span className="text-xs text-[#9090A8]">{l.company_name}</span> : null}
                <DataSetBadge dataSetId={l.data_set_id} />
                {keepId === l.id ? <span className="text-[10px] font-semibold uppercase text-[#60A5FA]">Keep</span> : null}
              </div>
              <p className="mt-0.5 text-[11px] text-[#5A5A72]">
                {l.stage?.name ?? "No stage"} · added {format(new Date(l.created_at), "d MMM yyyy")} ·{" "}
                {5 - missingChecks(l).length}/5 fields complete
              </p>
            </div>
            <button type="button" onClick={(e) => { e.preventDefault(); setLeadDrawerId(l.id) }} className="text-[11px] text-[#60A5FA]">
              Open
            </button>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={merge}
        disabled={merging}
        className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 text-sm font-medium text-white disabled:opacity-60"
      >
        {merging ? <Loader2 className="size-4 animate-spin" /> : <Merge className="size-4" />}
        Merge into the one marked Keep
      </button>
    </div>
  )
}

function UniverseMatchRow({ match, lead }: { match: UniverseMatch; lead?: HealthLead }) {
  const queryClient = useQueryClient()
  const { setLeadDrawerId } = useUIStore()
  const [state, setState] = useState<"idle" | "saving" | "done">("idle")

  const link = async () => {
    setState("saving")
    const user = await getCachedUser()
    const { error } = await createClient()
      .from("universe_contacts")
      .update({ converted_lead_id: match.lead_id, converted_at: new Date().toISOString(), converted_by: user?.id ?? null })
      .eq("id", match.universe_contact_id)
    if (error) {
      setState("idle")
      toast.error(error.message)
      return
    }
    setState("done")
    queryClient.invalidateQueries({ queryKey: [...DATA_HEALTH_KEY, "universe-matches"] })
    queryClient.invalidateQueries({ queryKey: ["universe"] })
  }

  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <button type="button" onClick={() => setLeadDrawerId(match.lead_id)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm text-[#F0F0FA]">{lead?.full_name ?? "Lead"}{lead?.company_name ? ` · ${lead.company_name}` : ""}</p>
        <p className="truncate text-[11px] text-[#5A5A72]">
          Universe: {match.universe_name || match.universe_company || "Unnamed"} ({UNIVERSE_STAGE_LABEL[match.funnel_stage] ?? match.funnel_stage}) · same {match.matched_on}
        </p>
      </button>
      {state === "done" ? (
        <span className="inline-flex items-center gap-1 text-xs text-[#34D399]"><CheckCircle2 className="size-3.5" /> Linked</span>
      ) : (
        <button type="button" onClick={link} disabled={state === "saving"} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#2A2A3C] px-2.5 text-xs text-[#F0F0FA] disabled:opacity-60">
          {state === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />} Link
        </button>
      )}
    </li>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] px-4 py-6 text-center text-sm text-[#9090A8]">{text}</p>
}
