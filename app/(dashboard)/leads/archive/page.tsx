"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Archive, RotateCcw, Trash2, Loader2 } from "lucide-react"

import { useLeads } from "@/lib/hooks/useLeads"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"

const DELETE_ROLES = new Set(["admin", "founder", "manager"])

function formatDate(value?: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

export default function ArchivePage() {
  const { getArchivedLeads, restoreLead, deleteLeadPermanently } = useLeads()
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ["archive-current-profile"],
    queryFn: async () => (await getCachedUserAndProfile()).profile,
  })
  const role = (profileQuery.data?.role as string | undefined) ?? undefined
  const canDelete = role ? DELETE_ROLES.has(role) : false

  const {
    data: leads = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["archived-leads"],
    queryFn: getArchivedLeads,
  })

  const invalidateAll = () => {
    for (const key of [
      ["archived-leads"],
      ["kanban-leads"],
      ["leads"],
      ["inbox-leads"],
      ["sidebar-counts"],
    ]) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }

  const handleRestore = async (id: string, name: string) => {
    if (busyId) return
    setBusyId(id)
    try {
      await restoreLead(id)
      toast.success(`Restored ${name}`)
      invalidateAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to restore lead")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (busyId) return
    if (
      !window.confirm(
        `Permanently delete "${name}"?\n\nThis CANNOT be undone. All of its interactions, tasks and campaign history will be removed.`
      )
    ) {
      return
    }
    setBusyId(id)
    try {
      await deleteLeadPermanently(id)
      toast.success(`Permanently deleted ${name}`)
      invalidateAll()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete lead")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#3F2A12] text-[#F59E0B]">
          <Archive className="size-4" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[#F0F0FA]">
            Archived Leads
          </h1>
          <p className="text-xs text-[#9090A8]">
            Archived leads are hidden from your pipeline and lists. Restore them, or
            {canDelete ? " permanently delete them." : " ask a manager to permanently delete them."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-[#2A2A3C] bg-[#111118] p-10">
          <Loader2 className="size-5 animate-spin text-[#9090A8]" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#EF4444]/30 bg-[#3F161A]/30 p-6 text-sm text-[#F87171]">
          Failed to load archived leads. If you just added the archive feature, make sure the
          database migration (<code>supabase/leads_archive.sql</code>) has been run.
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-10 text-center">
          <Archive className="mx-auto mb-2 size-6 text-[#9090A8]" />
          <p className="text-sm text-[#F0F0FA]">No archived leads</p>
          <p className="mt-1 text-xs text-[#9090A8]">
            Archive a lead from its detail drawer and it will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#2A2A3C]">
          <table className="w-full text-sm">
            <thead className="bg-[#0F0F15] text-[10px] uppercase tracking-wider text-[#9090A8]">
              <tr>
                <th className="px-4 py-2.5 text-left">Lead</th>
                <th className="px-4 py-2.5 text-left">Stage</th>
                <th className="px-4 py-2.5 text-left">Owner</th>
                <th className="px-4 py-2.5 text-left">Archived</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A3C]/60">
              {leads.map((lead) => {
                const busy = busyId === lead.id
                return (
                  <tr key={lead.id} className="hover:bg-[#1A1A24]/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#F0F0FA]">{lead.full_name}</div>
                      <div className="text-xs text-[#9090A8]">
                        {lead.company_name || "No company"}
                        {lead.city ? ` · ${lead.city}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.stage ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: lead.stage.color }}
                        >
                          {lead.stage.name}
                        </span>
                      ) : (
                        <span className="text-xs text-[#9090A8]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#9090A8]">
                      {lead.assignee?.full_name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#9090A8]">
                      {formatDate(lead.archived_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRestore(lead.id, lead.full_name)}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A3C] px-2.5 py-1.5 text-xs text-[#34D399] transition hover:bg-[#163322] disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3" />
                          )}
                          Restore
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(lead.id, lead.full_name)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#EF4444]/30 px-2.5 py-1.5 text-xs text-[#F87171] transition hover:bg-[#3F161A] disabled:opacity-50"
                          >
                            <Trash2 className="size-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
