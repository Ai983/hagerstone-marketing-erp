"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { toast } from "sonner"
import { FileText, UserCircle2 } from "lucide-react"

import { WhereItStoppedCard } from "@/components/architect/WhereItStopped"
import { DataSetBadge, PRIORITY_OPTIONS, PriorityBadge } from "@/components/data/DataSetBadge"
import { useDataSets } from "@/lib/hooks/useDataSets"
import { getCachedUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import type { Lead } from "@/lib/types"
import { cn } from "@/lib/utils"

type SnapshotRow = {
  id: string
  data_set_id: string
  external_ref: string | null
  source_file: string | null
  captured_at: string
  data: Record<string, string | boolean | null>
}

// Founder sheet status → the ERP stage it was imported as. Used to say
// whether the deal has moved since the handover.
const FOUNDER_STATUS_STAGE: Record<string, string> = {
  NEW: "new_lead",
  "FOLLOW-UP": "contacted",
  TENDER: "proposal_sent",
  "AWAITING CLIENT": "proposal_sent",
  HOT: "negotiation",
  WON: "won",
  LOST: "lost",
  DROPPED: "lost",
}

type ShareRow = {
  id: string
  channel: string
  created_at: string
  document: { title: string; version: string } | null
  sharer: { full_name: string } | null
}

/**
 * Where this lead came from, how the field team rated it, who owns it,
 * and which company documents it has already been sent — the context
 * the next person needs before they call.
 */
export function LeadProvenancePanel({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const sharesQuery = useQuery({
    queryKey: ["document-shares", lead.id],
    queryFn: async (): Promise<ShareRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("document_shares")
        .select("id, channel, created_at, document:document_id(title, version), sharer:shared_by(full_name)")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as unknown as ShareRow[]
    },
    retry: false,
  })

  const snapshotsQuery = useQuery({
    queryKey: ["lead-snapshots", lead.id],
    queryFn: async (): Promise<SnapshotRow[]> => {
      const { data, error } = await createClient()
        .from("lead_source_snapshots")
        .select("id, data_set_id, external_ref, source_file, captured_at, data")
        .eq("lead_id", lead.id)
        .order("captured_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as SnapshotRow[]
    },
    retry: false,
  })
  const { byId: dataSetById } = useDataSets()

  const setPriority = async (next: string) => {
    const value = lead.priority === next ? null : next
    setSaving(true)
    try {
      const supabase = createClient()
      const user = await getCachedUser()
      const { error } = await supabase
        .from("leads")
        .update({
          priority: value,
          priority_updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id)
      if (error) throw error

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        user_id: user?.id ?? null,
        type: "note",
        title: "Priority updated",
        notes: value
          ? `Priority set to ${value === "dropped" ? "Dropped" : value}${lead.priority ? ` (was ${lead.priority})` : ""}.`
          : `Priority cleared (was ${lead.priority}).`,
      })

      queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
      queryClient.invalidateQueries({ queryKey: ["lead-interactions", lead.id] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
      toast.success(value ? `Priority set to ${value === "dropped" ? "Dropped" : value}` : "Priority cleared")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update priority")
    } finally {
      setSaving(false)
    }
  }

  const shares = sharesQuery.data ?? []

  return (
    <div className="px-4 pb-3">
      <div className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] uppercase tracking-wider text-[#9090A8]">Source</p>
          <DataSetBadge dataSetId={lead.data_set_id} size="sm" />
          {lead.external_ref ? (
            <span className="text-[11px] text-[#5A5A72]">#{lead.external_ref}</span>
          ) : null}
          {lead.owner_name ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#9090A8]">
              <UserCircle2 className="size-3" />
              Owner: <span className="text-[#F0F0FA]">{lead.owner_name}</span>
            </span>
          ) : null}
        </div>

        <p className="mb-2 mt-3 text-[11px] uppercase tracking-wider text-[#9090A8]">Field Priority</p>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={saving}
              onClick={() => setPriority(p)}
              className={cn(
                "min-h-9 touch-manipulation rounded-md border px-3 text-xs transition disabled:opacity-50",
                lead.priority === p
                  ? "border-transparent"
                  : "border-[#2A2A3C] bg-[#111118] text-[#5A5A72] hover:text-[#F0F0FA]"
              )}
            >
              {lead.priority === p ? <PriorityBadge priority={p} /> : p === "dropped" ? "Dropped" : p}
            </button>
          ))}
        </div>
        {lead.priority_note ? (
          <p className="mt-2 text-xs leading-relaxed text-[#9090A8]">{lead.priority_note}</p>
        ) : null}

        {lead.data_set_id && dataSetById.get(lead.data_set_id)?.key === "architect-meetings-dec-2025" ? (
          <WhereItStoppedCard leadId={lead.id} />
        ) : null}

        {(snapshotsQuery.data ?? []).map((snap) => {
          const ds = dataSetById.get(snap.data_set_id)
          const d = snap.data
          const isFounder = ds?.key === "founder-pipeline"
          // The architect tracker row is already inside "Where it stopped".
          if (!isFounder) return null
          const sheetStage = isFounder && typeof d.status === "string" ? FOUNDER_STATUS_STAGE[d.status] : undefined
          const currentStage = (lead.stage as { slug?: string; name?: string } | undefined)
          const moved = sheetStage && currentStage?.slug && currentStage.slug !== sheetStage

          const rows: [string, string | boolean | null | undefined][] = isFounder
            ? [
                ["Status", d.status],
                ["Value", d.value ?? "not known"],
                ["Owner (sheet)", d.owner],
                ["Next action", [d.next_action, d.next_date ? `due ${d.next_date}` : null].filter(Boolean).join(" · ") || null],
                ["Project", d.project],
                ["Contact", d.contact],
              ]
            : [
                ["Priority", d.priority],
                ["Status", d.remark],
                ["POC", d.poc],
                ["Location", d.location],
              ]

          return (
            <div key={snap.id} className="mt-3 rounded-md border border-dashed border-[#3A3A52] bg-[#111118] p-2.5">
              <p className="flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#9090A8]">
                {isFounder ? "As received from Dhruv sir" : "As received from the Delhi team"}
                <span className="normal-case tracking-normal text-[#5A5A72]">
                  · {format(new Date(snap.captured_at), "d MMM yyyy")}
                  {isFounder && snap.external_ref ? ` · #${snap.external_ref}` : ""}
                </span>
              </p>
              <dl className="mt-1.5 space-y-1">
                {rows
                  .filter(([, v]) => v !== null && v !== undefined && v !== "")
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <dt className="w-24 shrink-0 text-[#5A5A72]">{k}</dt>
                      <dd className="min-w-0 break-words text-[#F0F0FA]">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
              {isFounder && sheetStage ? (
                <p className={cn("mt-1.5 text-[11px]", moved ? "text-[#F59E0B]" : "text-[#5A5A72]")}>
                  {moved
                    ? `Moved since handover: ${d.status} → now ${currentStage?.name ?? currentStage?.slug}`
                    : "Stage unchanged since handover"}
                </p>
              ) : null}
            </div>
          )
        })}

        {shares.length > 0 ? (
          <>
            <p className="mb-1.5 mt-3 text-[11px] uppercase tracking-wider text-[#9090A8]">Documents Shared</p>
            <ul className="space-y-1">
              {shares.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-xs text-[#9090A8]">
                  <FileText className="size-3 shrink-0 text-[#5A5A72]" />
                  <span className="truncate text-[#F0F0FA]">
                    {s.document?.title ?? "Document"} <span className="text-[#5A5A72]">{s.document?.version}</span>
                  </span>
                  <span className="ml-auto shrink-0">
                    {s.channel} · {format(new Date(s.created_at), "d MMM")}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  )
}
