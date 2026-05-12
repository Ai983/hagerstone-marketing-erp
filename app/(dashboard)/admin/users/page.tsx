"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowLeft,
  Loader2,
  Power,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import type { Profile, UserRole } from "@/lib/types"
import { cn } from "@/lib/utils"

interface UserRow extends Profile {
  assigned_leads: number
}

const roles: UserRole[] = ["admin", "manager", "founder", "marketing", "sales_rep"]

async function fetchUsers(): Promise<UserRow[]> {
  const supabase = createClient()
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true })

  if (error) throw error

  const { data: leadCounts } = await supabase
    .from("leads")
    .select("assigned_to")

  const countMap = new Map<string, number>()
  for (const l of leadCounts ?? []) {
    if (l.assigned_to) countMap.set(l.assigned_to, (countMap.get(l.assigned_to) ?? 0) + 1)
  }

  return (profiles ?? []).map((p) => ({
    ...(p as Profile),
    assigned_leads: countMap.get(p.id) ?? 0,
  }))
}

export default function AdminUsersPage() {
  const router = useRouter()
  const isMobile = useMediaQuery("(max-width: 768px)")
  const queryClient = useQueryClient()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
  })

  const updateProfile = async (id: string, patch: Partial<Profile>) => {
    setUpdatingId(id)
    const supabase = createClient()
    try {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id)
      if (error) throw error
      toast.success("Updated")
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] pb-20 md:p-6 md:pb-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="mx-4 mb-4 mt-4 rounded-lg bg-[#1A1A24] p-2 text-[#9090A8] md:hidden"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="px-4 pb-4 md:mb-5 md:flex md:items-center md:gap-3 md:px-0 md:pb-0">
          <Link
            href="/admin"
            className="hidden size-8 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#9090A8] transition hover:text-[#F0F0FA] md:flex"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
              <h1 className="text-xl font-bold text-[#F0F0FA] md:font-[family-name:var(--font-heading)] md:text-2xl md:font-semibold">
              Users
            </h1>
            <p className="text-sm text-[#9090A8]">Manage team members and roles.</p>
          </div>
        </div>

        {/* Users table */}
        {isMobile ? (
          <div className="space-y-3 px-4 py-3">
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-[#9090A8]" />
              </div>
            ) : !users || users.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#9090A8]">No users found</div>
            ) : (
              users.map((u) => (
                <div key={u.id} className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-[#3B82F6] font-bold text-white">
                      {u.full_name?.[0] ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#F0F0FA]">{u.full_name}</p>
                      <p className="truncate text-xs text-[#9090A8]">{u.email}</p>
                    </div>
                    <span className={cn("size-2 flex-shrink-0 rounded-full", u.is_active ? "bg-[#10B981]" : "bg-[#EF4444]")} />
                  </div>
                  <div className="mb-3 flex items-center gap-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateProfile(u.id, { role: e.target.value as UserRole })}
                      disabled={updatingId === u.id}
                      className="flex-1 rounded-xl border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2.5 text-base text-[#F0F0FA] outline-none disabled:opacity-50"
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>{r.replace("_", " ")}</option>
                      ))}
                    </select>
                    <div className="px-3 text-center">
                      <p className="text-lg font-bold text-[#F0F0FA]">{u.assigned_leads}</p>
                      <p className="text-[10px] text-[#9090A8]">Leads</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateProfile(u.id, { is_active: !u.is_active })}
                    disabled={updatingId === u.id}
                    className={cn(
                      "w-full rounded-xl py-2.5 text-xs font-medium disabled:opacity-50",
                      u.is_active ? "bg-[#EF4444]/10 text-[#EF4444]" : "bg-[#10B981]/10 text-[#10B981]"
                    )}
                  >
                    {u.is_active ? "Deactivate User" : "Activate User"}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
        <div className="overflow-x-auto rounded-xl border border-[#2A2A3C] bg-[#111118]">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-[#9090A8]" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#9090A8]">No users found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A3C] text-[11px] uppercase tracking-wider text-[#9090A8]">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Assigned Leads</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[#2A2A3C]/60 transition hover:bg-[#1A1A24]/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#F0F0FA]">{u.full_name}</p>
                    </td>
                    <td className="px-4 py-3 text-[#9090A8]">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          updateProfile(u.id, { role: e.target.value as UserRole })
                        }
                        disabled={updatingId === u.id}
                        className="rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6] disabled:opacity-50"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                          u.is_active
                            ? "bg-[#163322] text-[#34D399]"
                            : "bg-[#1A1A24] text-[#9090A8]"
                        )}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#F0F0FA]">
                      {u.assigned_leads}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => updateProfile(u.id, { is_active: !u.is_active })}
                          disabled={updatingId === u.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition disabled:opacity-50",
                            u.is_active
                              ? "border-[#2A2A3C] text-[#9090A8] hover:text-[#F87171]"
                              : "border-[#2A2A3C] text-[#34D399] hover:bg-[#163322]"
                          )}
                        >
                          <Power className="size-3" />
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        )}
      </div>
    </main>
  )
}
