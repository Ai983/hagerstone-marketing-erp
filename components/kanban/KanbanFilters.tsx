"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, Filter, Maximize2, Minimize2 } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { sourceShortLabel } from "@/components/data/DataSetBadge"
import { useDataSets } from "@/lib/hooks/useDataSets"
import { useKanbanStore } from "@/lib/stores/kanbanStore"
import { useUIStore } from "@/lib/stores/uiStore"
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
  { label: "Facade doors & Windows", value: "facade_glazing" },
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
  const { filters, setFilter, clearFilters, leads: boardLeads } = useKanbanStore()
  const isMobile = useMediaQuery("(max-width: 768px)")
  const { isFocusMode, setFocusMode } = useUIStore()

  // Full screen = hide the app's sidebar/top bar AND ask the browser for
  // fullscreen. Browser fullscreen can be refused (iframes, some
  // browsers); the in-app part still works on its own.
  const toggleFullScreen = () => {
    if (isFocusMode) {
      setFocusMode(false)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    } else {
      setFocusMode(true)
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }

  // Esc leaves browser fullscreen without going through our button —
  // follow it so the navigation comes back too.
  useEffect(() => {
    if (!isFocusMode) return
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFocusMode(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setFocusMode(false)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      window.removeEventListener("keydown", onKey)
    }
  }, [isFocusMode, setFocusMode])

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

  const { dataSets } = useDataSets()

  const activeFilterCount =
    (filters.dataSetId ? 1 : 0) +
    (filters.myLeadsOnly ? 1 : 0) +
    (filters.overdueOnly ? 1 : 0) +
    filters.serviceLines.length +
    filters.sources.length +
    filters.assignedTo.length +
    (filters.category ? 1 : 0)

  const hasFilters = activeFilterCount > 0

  // Helpers to translate between the store's string[] shape and the
  // single-value shape Select expects. "__all__" means "no filter".
  const serviceLineValue = filters.serviceLines[0] ?? ALL
  const sourceValue = filters.sources[0] ?? ALL
  const assignedToValue = filters.assignedTo[0] ?? ALL
  const categoryValue = filters.category ?? ALL

  const serviceLineActive = filters.serviceLines.length > 0
  const sourceActive = filters.sources.length > 0
  const assignedToActive = filters.assignedTo.length > 0
  const categoryActive = Boolean(filters.category)

  const activeTriggerClass = "border-[#3B82F6] text-[#3B82F6]"

  // Mobile-only: filters are hidden behind a Filters toggle. On md+
  // the filter row is always visible.
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Source tabs double as the colour legend for the card tags.
  const sourceTabs = [
    { id: null as string | null, label: "All", color: "#9090A8", count: boardLeads.length },
    ...dataSets
      .filter((d) => d.kind !== "founder_universe")
      .map((d) => ({
        id: d.id as string | null,
        label: sourceShortLabel(d),
        color: d.color,
        count: boardLeads.filter((l) => l.data_set_id === d.id).length,
      }))
      .filter((t) => t.count > 0),
  ]

  const sourceTabStrip = sourceTabs.length > 1 ? (
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[#2A2A3C] bg-[#0F0F15] p-0.5" role="tablist" aria-label="Lead source">
      {sourceTabs.map((t) => {
        const active = (filters.dataSetId ?? null) === t.id
        return (
          <button
            key={t.id ?? "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setFilter("dataSetId", t.id)}
            className={cn(
              "inline-flex h-8 shrink-0 touch-manipulation items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold tracking-wide transition",
              active ? "text-[#F0F0FA]" : "text-[#9090A8] hover:text-[#F0F0FA]"
            )}
            style={active ? { backgroundColor: `${t.color}2E`, boxShadow: `inset 0 0 0 1px ${t.color}66` } : undefined}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
            <span className="font-normal text-[#5A5A72]">{t.count}</span>
          </button>
        )
      })}
    </div>
  ) : null

  return (
    <div className="shrink-0 border-b border-[#2A2A3C] bg-[#111118]">
      {/* Source tabs — always visible on phones, outside the Filters toggle */}
      {sourceTabStrip ? (
        <div className="thin-scrollbar overflow-x-auto px-4 pt-2 md:hidden">{sourceTabStrip}</div>
      ) : null}
      {/* Mobile-only header — Filters toggle + view-mode switch */}
      <div className="flex h-12 items-center justify-between px-4 md:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((s) => !s)}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border bg-[#1A1A24] px-4 py-2.5 text-sm transition",
            hasFilters
              ? "border-[#3B82F6] text-[#3B82F6]"
              : "border-[#2A2A3C] text-[#9090A8]"
          )}
          aria-expanded={filtersOpen}
        >
          <Filter className="size-4" />
          Filters
          {hasFilters && (
            <span className="ml-auto rounded-full bg-[#3B82F6] px-2 py-0.5 text-xs text-white">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            size={15}
            className={cn("ml-auto transition-transform", filtersOpen && "rotate-180")}
          />
        </button>
        <div className="ml-2 flex items-center rounded-lg border border-[#3A3A52] bg-[#1F1F2E] p-1">
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
          "border-t border-[#2A2A3C] p-3 md:flex md:h-12 md:items-center md:justify-between md:border-t-0 md:p-0 md:px-4",
          isMobile ? (filtersOpen ? "block" : "hidden") : "flex"
        )}
      >
        <div className="thin-scrollbar flex flex-col items-stretch gap-2 md:flex-row md:flex-nowrap md:items-center md:overflow-x-auto">
        {sourceTabStrip ? <div className="hidden md:block">{sourceTabStrip}</div> : null}
        <button
          type="button"
          onClick={() => setFilter("myLeadsOnly", !filters.myLeadsOnly)}
          disabled={!currentUserId}
          className={cn(
            "h-9 w-full shrink-0 rounded-lg border px-3 text-sm transition md:w-auto",
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
            "h-9 w-full shrink-0 rounded-lg border px-3 text-sm transition md:w-auto",
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
              "h-9 w-full shrink-0 md:w-[160px]",
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
              "h-9 w-full shrink-0 md:w-[140px]",
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
                "h-9 w-full shrink-0 md:w-[160px]",
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

        <Select
          value={categoryValue}
          onValueChange={(value) => {
            setFilter("category", value === ALL ? null : value)
          }}
        >
          <SelectTrigger
            className={cn(
              "h-8 w-full shrink-0 border-[#2A2A3C] bg-[#111118] text-xs text-[#9090A8] md:w-[130px]",
              categoryActive && activeTriggerClass
            )}
          >
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="border-[#2A2A3C] bg-[#1A1A24]">
            <SelectItem value={ALL}>All Categories</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="lukewarm">Lukewarm</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 md:ml-4 md:mt-0">
        {hasFilters ? (
          <span className="hidden h-7 min-w-7 items-center justify-center rounded-full bg-[#1E3A5F] px-2 text-xs font-medium text-[#3B82F6] md:inline-flex">
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
        <button
          type="button"
          onClick={toggleFullScreen}
          title={isFocusMode ? "Exit full screen (Esc)" : "Full screen board"}
          className={cn(
            "hidden h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition md:inline-flex",
            isFocusMode
              ? "border-[#3B82F6] bg-[#1E3A5F] text-[#3B82F6]"
              : "border-[#3A3A52] bg-[#1F1F2E] text-[#F0F0FA] hover:bg-[#1A1A24]"
          )}
        >
          {isFocusMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          {isFocusMode ? "Exit" : "Full screen"}
        </button>
        {/* Board/List toggle — desktop only (mobile has it in the header) */}
        <div className="hidden items-center rounded-lg border border-[#3A3A52] bg-[#1F1F2E] p-1 md:flex">
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
