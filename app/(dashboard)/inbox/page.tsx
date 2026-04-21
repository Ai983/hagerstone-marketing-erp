"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { Inbox, Loader2, UserPlus, Check, Shield } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/lib/stores/uiStore"
import type { LeadSource, Profile, ServiceLine } from "@/lib/types"
import { cn } from "@/lib/utils"

interface InboxLead {
  id: string
  full_name: string
  company_name: string | null
  source: LeadSource
  city: string | null
  service_line: ServiceLine | null
  created_at: string
}

async function fetchInboxData() {
  const supabase = createClient()
  const [userRes, leadsRes, teamRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("leads")
      .select("id, full_name, company_name, source, city, service_line, created_at")
      .is("assigned_to", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ])

  let role: string | null = null
  if (userRes.data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userRes.data.user.id)
      .maybeSingle()
    role = profile?.role ?? null
  }

  return {
    leads: (leadsRes.data ?? []) as InboxLead[],
    team: (teamRes.data ?? []) as Pick<Profile, "id" | "full_name" | "role">[],
    role,
  }
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export default function InboxPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { setLeadDrawerId } = useUIStore()
  const [pendingAssignId, setPendingAssignId] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ["inbox-leads"],
    queryFn: fetchInboxData,
  })

  const role = data?.role
  const canAccess =
    role === "manager" || role === "admin" || role === "founder"

  useEffect(() => {
    if (data && !canAccess) {
      router.replace("/pipeline")
    }
  }, [canAccess, data, router])

  const handleAssign = async (leadId: string) => {
    const assignedTo = selections[leadId]
    if (!assignedTo) {
      toast.error("Please select a rep first")
      return
    }
    setPendingAssignId(leadId)
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to: assignedTo, assigned_at: new Date().toISOString() })
        .eq("id", leadId)
      if (error) throw error

      const repName = data?.team.find((t) => t.id === assignedTo)?.full_name ?? "rep"
      toast.success(`Assigned to ${repName}`)
      queryClient.invalidateQueries({ queryKey: ["inbox-leads"] })
      queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assign failed")
    } finally {
      setPendingAssignId(null)
    }
  }

  if (isLoading || !data) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  if (!canAccess) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-6 text-center">
          <Shield className="mx-auto size-8 text-[#F59E0B]" />
          <p className="mt-2 text-sm text-[#F0F0FA]">
            Manager access required to view the inbox.
          </p>
        </div>
      </main>
    )
  }

  const leads = data.leads
  const team = data.team

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
              <Inbox className="size-5" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
                Lead Inbox
              </h1>
              <p className="text-sm text-[#9090A8]">
                {leads.length} unassigned lead{leads.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[#2A2A3C] bg-[#111118]">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Check className="mb-3 size-10 text-[#34D399]" />
              <p className="text-sm font-medium text-[#F0F0FA]">Inbox zero</p>
              <p className="mt-1 text-xs text-[#9090A8]">
                All leads are assigned to a rep.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A3C] text-[11px] uppercase tracking-wider text-[#9090A8]">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  <th className="px-4 py-3 text-left font-medium">City</th>
                  <th className="px-4 py-3 text-left font-medium">Service</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Assign</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[#2A2A3C]/60 transition hover:bg-[#1A1A24]/60"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setLeadDrawerId(lead.id)}
                        className="truncate text-left font-medium text-[#F0F0FA] hover:text-[#3B82F6] hover:underline"
                      >
                        {lead.full_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[#9090A8]">
                      {lead.company_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#9090A8]">
                      {formatLabel(lead.source)}
                    </td>
                    <td className="px-4 py-3 text-[#9090A8]">{lead.city || "—"}</td>
                    <td className="px-4 py-3 text-[#9090A8]">
                      {lead.service_line ? formatLabel(lead.service_line) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#9090A8]">
                      {formatDistanceToNow(new Date(lead.created_at), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={selections[lead.id] ?? ""}
                          onChange={(e) =>
                            setSelections((prev) => ({
                              ...prev,
                              [lead.id]: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                        >
                          <option value="">Select rep...</option>
                          {team.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssign(lead.id)}
                          disabled={
                            pendingAssignId === lead.id || !selections[lead.id]
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md bg-[#3B82F6] px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-[#2563EB]",
                            (pendingAssignId === lead.id || !selections[lead.id]) &&
                              "opacity-50"
                          )}
                        >
                          {pendingAssignId === lead.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <UserPlus className="size-3" />
                          )}
                          Assign
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}
