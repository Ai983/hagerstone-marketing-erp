"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowLeft,
  UserPlus,
  Loader2,
  Power,
  Send,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
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
  const queryClient = useQueryClient()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)

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

  const handleInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    setInviting(true)
    try {
      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Invite failed")
      toast.success(`Invite sent to ${email}`)
      setInviteEmail("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed")
    } finally {
      setInviting(false)
    }
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/admin"
            className="flex size-8 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#9090A8] transition hover:text-[#F0F0FA]"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
              Users
            </h1>
            <p className="text-sm text-[#9090A8]">Manage team members and roles.</p>
          </div>
        </div>

        {/* Invite */}
        <div className="mb-6 rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
          <div className="mb-2 flex items-center gap-2">
            <UserPlus className="size-4 text-[#3B82F6]" />
            <h2 className="text-sm font-semibold text-[#F0F0FA]">Invite User</h2>
          </div>
          <p className="mb-3 text-xs text-[#9090A8]">
            Sends a magic-link invitation via Supabase Auth.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@hagerstone.com"
              className="min-w-[240px] flex-1 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
            >
              {inviting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              Send Invite
            </button>
          </div>
        </div>

        {/* Users table */}
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
      </div>
    </main>
  )
}
