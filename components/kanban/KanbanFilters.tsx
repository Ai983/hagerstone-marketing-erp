"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Filter } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useKanbanStore } from "@/lib/stores/kanbanStore"
import type { LeadSource, Profile, ServiceLine } from "@/lib/types"
import { cn } from "@/lib/utils"

interface KanbanFiltersProps {
  canFilterAssignedTo: boolean
  currentUserId?: string
  teamMembers: Profile[]
}

// Radix Select reserves "" for the empty/placeholder state, so a
// SelectItem can't use "" as its value. We use this sentinel for
// the "All …" option and translate it to an empty filter array.
const ALL = "__all__"

const serviceLineOptions: Array<{ label: string; value: ServiceLine }> = [
  { label: "Office Interiors", value: "office_interiors" },
  { label: "MEP", value: "mep" },
  { label: "Facade / Glazing", value: "facade_glazing" },
  { label: "PEB Construction", value: "peb_construction" },
  { label: "Civil Works", value: "civil_works" },
  { label: "Multiple", value: "multiple" },
  { label: "Unknown", value: "unknown" },
]

const sourceOptions: Array<{ label: string; value: LeadSource }> = [
  { label: "Website", value: "website" },
  { label: "Manual Sales", value: "manual_sales" },
  { label: "WhatsApp", value: "whatsapp_inbound" },
  { label: "Referral", value: "referral" },
  { label: "Google Ads", value: "google_ads" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "JustDial", value: "justdial" },
  { label: "Other", value: "other" },
]

export function KanbanFilters({
  canFilterAssignedTo,
  currentUserId,
  teamMembers,
}: KanbanFiltersProps) {
  const { filters, setFilter, clearFilters } = useKanbanStore()

  // Self-fetch active profiles so the Assigned To dropdown works
  // regardless of parent prop load order. Falls back to teamMembers
  // while the self-fetch is in flight.
  const [profiles, setProfiles] = useState<
    Array<Pick<Profile, "id" | "full_name" | "role">>
  >([])

  useEffect(() => {
    if (!canFilterAssignedTo) return
    let mounted = true
    const fetchProfiles = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("is_active", true)
        .order("full_name", { ascending: true })
      if (!mounted) return
      if (error) {
        console.error("[KanbanFilters] profiles fetch error:", error)
        return
      }
      setProfiles(
        (data ?? []) as Array<Pick<Profile, "id" | "full_name" | "role">>
      )
    }
    fetchProfiles()
    return () => {
      mounted = false
    }
  }, [canFilterAssignedTo])

  const assignableMembers = profiles.length > 0 ? profiles : teamMembers

  const activeFilterCount =
    (filters.myLeadsOnly ? 1 : 0) +
    (filters.overdueOnly ? 1 : 0) +
    filters.serviceLines.length +
    filters.sources.length +
    filters.assignedTo.length

  const hasFilters = activeFilterCount > 0

  // Helpers to translate between the store's string[] shape and the
  // single-value shape Select expects. "__all__" means "no filter".
  const serviceLineValue = filters.serviceLines[0] ?? ALL
  const sourceValue = filters.sources[0] ?? ALL
  const assignedToValue = filters.assignedTo[0] ?? ALL

  const serviceLineActive = filters.serviceLines.length > 0
  const sourceActive = filters.sources.length > 0
  const assignedToActive = filters.assignedTo.length > 0

  const activeTriggerClass = "border-[#3B82F6] text-[#3B82F6]"

  // Mobile-only: filters are hidden behind a Filters toggle. On lg+
  // the filter row is always visible.
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  return (
    <div className="shrink-0 border-b border-[#2A2A3C] bg-[#111118]">
      {/* Mobile-only header — Filters toggle + view-mode switch */}
      <div className="flex h-12 items-center justify-between px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setShowMobileFilters((s) => !s)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition",
            hasFilters
              ? "border-[#3B82F6] bg-[#1E3A5F] text-[#3B82F6]"
              : "border-[#3A3A52] bg-[#1F1F2E] text-[#F0F0FA]"
          )}
          aria-expanded={showMobileFilters}
        >
          <Filter className="size-4" />
          Filters
          {hasFilters && (
            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#3B82F6] px-1.5 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="flex items-center rounded-lg border border-[#3A3A52] bg-[#1F1F2E] p-1">
          <span className="inline-flex h-7 items-center rounded-md bg-[#1E3A5F] px-3 text-xs text-[#3B82F6]">
            Board
          </span>
          <Link
            href="/leads"
            className="inline-flex h-7 items-center rounded-md px-3 text-xs text-[#9090A8] transition hover:text-[#F0F0FA]"
          >
            List
          </Link>
        </div>
      </div>

      {/* Filter row — always visible on lg+, conditional on mobile */}
      <div
        className={cn(
          "border-t border-[#2A2A3C] p-3 lg:flex lg:h-12 lg:items-center lg:justify-between lg:border-t-0 lg:p-0 lg:px-4",
          showMobileFilters ? "block" : "hidden lg:flex"
        )}
      >
        <div className="thin-scrollbar flex flex-wrap items-center gap-2 lg:flex-nowrap lg:overflow-x-auto">
        <button
          type="button"
          onClick={() => setFilter("myLeadsOnly", !filters.myLeadsOnly)}
          disabled={!currentUserId}
          className={cn(
            "h-9 shrink-0 rounded-lg border px-3 text-sm transition",
            filters.myLeadsOnly
              ? "border-[#3B82F6] bg-[#1E3A5F] text-[#3B82F6]"
              : "border-[#3A3A52] bg-[#1F1F2E] text-[#F0F0FA] hover:bg-[#1A1A24]"
          )}
        >
          My Leads
        </button>
        <button
          type="button"
          onClick={() => setFilter("overdueOnly", !filters.overdueOnly)}
          className={cn(
            "h-9 shrink-0 rounded-lg border px-3 text-sm transition",
            filters.overdueOnly
              ? "border-[#3B82F6] bg-[#1E3A5F] text-[#3B82F6]"
              : "border-[#3A3A52] bg-[#1F1F2E] text-[#F0F0FA] hover:bg-[#1A1A24]"
          )}
        >
          Overdue Only
        </button>

        {/* Service Line */}
        <Select
          value={serviceLineValue}
          onValueChange={(next) => {
            console.log("[KanbanFilters] Filter changed: serviceLines", next)
            if (next === ALL) {
              setFilter("serviceLines", [])
            } else {
              setFilter("serviceLines", [next as ServiceLine])
            }
          }}
        >
          <SelectTrigger
            className={cn(
              "h-9 w-[160px] shrink-0",
              serviceLineActive && activeTriggerClass
            )}
          >
            <SelectValue placeholder="Service Line" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Service Lines</SelectItem>
            {serviceLineOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Source */}
        <Select
          value={sourceValue}
          onValueChange={(next) => {
            console.log("[KanbanFilters] Filter changed: sources", next)
            if (next === ALL) {
              setFilter("sources", [])
            } else {
              setFilter("sources", [next as LeadSource])
            }
          }}
        >
          <SelectTrigger
            className={cn(
              "h-9 w-[140px] shrink-0",
              sourceActive && activeTriggerClass
            )}
          >
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Sources</SelectItem>
            {sourceOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Assigned To — manager/admin only */}
        {canFilterAssignedTo ? (
          <Select
            value={assignedToValue}
            onValueChange={(next) => {
              console.log("[KanbanFilters] Filter changed: assignedTo", next)
              if (next === ALL) {
                setFilter("assignedTo", [])
              } else {
                setFilter("assignedTo", [next])
              }
            }}
          >
            <SelectTrigger
              className={cn(
                "h-9 w-[160px] shrink-0",
                assignedToActive && activeTriggerClass
              )}
            >
              <SelectValue placeholder="Assigned To" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Reps</SelectItem>
              {assignableMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 lg:ml-4 lg:mt-0">
        {hasFilters ? (
          <span className="hidden h-7 min-w-7 items-center justify-center rounded-full bg-[#1E3A5F] px-2 text-xs font-medium text-[#3B82F6] lg:inline-flex">
            {activeFilterCount}
          </span>
        ) : null}
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24]"
          >
            Clear
          </button>
        ) : null}
        {/* Board/List toggle — desktop only (mobile has it in the header) */}
        <div className="hidden items-center rounded-lg border border-[#3A3A52] bg-[#1F1F2E] p-1 lg:flex">
          <span className="inline-flex h-7 items-center rounded-md bg-[#1E3A5F] px-3 text-sm text-[#3B82F6]">
            Board
          </span>
          <Link
            href="/leads"
            className="inline-flex h-7 items-center rounded-md px-3 text-sm text-[#9090A8] transition hover:text-[#F0F0FA]"
          >
            List
          </Link>
        </div>
      </div>
      </div>
    </div>
  )
}
