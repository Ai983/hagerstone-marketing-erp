"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Loader2, Search, UserMinus } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface AssignableProfile {
  id: string
  full_name: string
  role: string
  avatar_url: string | null
}

async function fetchAssignableProfiles(): Promise<AssignableProfile[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .eq("is_active", true)
    .order("full_name", { ascending: true })

  if (error) throw error
  return (data ?? []) as AssignableProfile[]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

const roleColors: Record<string, string> = {
  admin: "bg-[#3F161A] text-[#F87171]",
  manager: "bg-[#1E3A5F] text-[#3B82F6]",
  founder: "bg-[#2E1A47] text-[#C084FC]",
  marketing: "bg-[#3F2A12] text-[#F59E0B]",
  sales_rep: "bg-[#163322] text-[#34D399]",
}

interface ReassignPopoverProps {
  currentAssigneeId: string | null
  onSelect: (profileId: string | null, profileName: string | null) => Promise<void> | void
  onClose: () => void
  pending: boolean
}

export function ReassignPopover({
  currentAssigneeId,
  onSelect,
  onClose,
  pending,
}: ReassignPopoverProps) {
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["assignable-profiles"],
    queryFn: fetchAssignableProfiles,
  })

  // Click-outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const filtered = useMemo(() => {
    if (!profiles) return []
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
    )
  }, [profiles, query])

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-[#2A2A3C] bg-[#111118] shadow-2xl"
    >
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-[#2A2A3C] px-3 py-2">
        <Search className="size-3.5 text-[#9090A8]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reps…"
          autoFocus
          className="w-full bg-transparent text-xs text-[#F0F0FA] placeholder-[#9090A8] outline-none"
        />
      </div>

      {/* Options */}
      <div className="thin-scrollbar max-h-72 overflow-y-auto py-1">
        {/* Unassigned */}
        <button
          type="button"
          onClick={() => onSelect(null, null)}
          disabled={pending}
          className={cn(
            "flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#1A1A24] disabled:opacity-50",
            currentAssigneeId === null && "bg-[#1E3A5F]/40"
          )}
        >
          <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-[#2A2A3C] text-[#9090A8]">
            <UserMinus className="size-3.5" />
          </span>
          <span className="flex-1 text-xs font-medium text-[#F0F0FA]">Unassigned</span>
          {currentAssigneeId === null && (
            <Check className="size-3.5 text-[#3B82F6]" />
          )}
        </button>

        <div className="my-1 border-t border-[#2A2A3C]/60" />

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 animate-spin text-[#9090A8]" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#9090A8]">
            {query ? `No reps match "${query}"` : "No active reps"}
          </p>
        ) : (
          filtered.map((p) => {
            const isCurrent = p.id === currentAssigneeId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id, p.full_name)}
                disabled={pending}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#1A1A24] disabled:opacity-50",
                  isCurrent && "bg-[#1E3A5F]/40"
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-semibold text-[#3B82F6]">
                  {getInitials(p.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[#F0F0FA]">
                    {p.full_name}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                    roleColors[p.role] ?? "bg-[#1A1A24] text-[#9090A8]"
                  )}
                >
                  {p.role.replace("_", " ")}
                </span>
                {isCurrent && <Check className="size-3.5 text-[#3B82F6]" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
