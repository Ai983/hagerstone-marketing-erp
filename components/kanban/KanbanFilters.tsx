"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { useKanbanStore } from "@/lib/stores/kanbanStore"
import type { Profile, ServiceLine } from "@/lib/types"
import { cn } from "@/lib/utils"

interface KanbanFiltersProps {
  canFilterAssignedTo: boolean
  currentUserId?: string
  teamMembers: Profile[]
}

interface Option {
  label: string
  value: string
}

const serviceLineOptions: Option[] = [
  { label: "Office Interiors", value: "office_interiors" },
  { label: "MEP", value: "mep" },
  { label: "Facade & Glazing", value: "facade_glazing" },
  { label: "PEB Construction", value: "peb_construction" },
  { label: "Civil Works", value: "civil_works" },
  { label: "Multiple", value: "multiple" },
  { label: "Unknown", value: "unknown" },
]

const sourceOptions: Option[] = [
  { label: "Website", value: "website" },
  { label: "Manual Sales", value: "manual_sales" },
  { label: "WhatsApp Inbound", value: "whatsapp_inbound" },
  { label: "Referral", value: "referral" },
  { label: "Google Ads", value: "google_ads" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "JustDial", value: "justdial" },
  { label: "Other", value: "other" },
]

function Dropdown({
  label,
  values,
  options,
  onChange,
}: {
  label: string
  values: string[]
  options: Option[]
  onChange: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = values.length > 0

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm transition",
          isActive
            ? "border-[#3B82F6] text-[#3B82F6]"
            : "border-[#3A3A52] bg-[#1F1F2E] text-[#F0F0FA] hover:bg-[#1A1A24]"
        )}
        style={isActive ? { backgroundColor: "#3B82F620" } : undefined}
      >
        {isActive && (
          <span className="size-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
        )}
        <span>
          {label}
          {values.length > 0 ? ` (${values.length})` : ""}
        </span>
        <ChevronDown
          className={cn("size-4", isActive ? "text-[#3B82F6]" : "text-[#9090A8]")}
        />
      </button>

      <div
        className={cn(
          "absolute left-0 top-11 z-30 min-w-[220px] rounded-xl border border-[#2A2A3C] bg-[#111118] p-2 transition duration-200",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        )}
      >
        {isActive && (
          <>
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium text-[#F87171] transition hover:bg-[#2A1215]/60"
            >
              Clear selection
            </button>
            <div className="my-1 border-t border-[#2A2A3C]" />
          </>
        )}
        <div className="thin-scrollbar max-h-64 overflow-y-auto">
          {options.map((option) => {
            const checked = values.includes(option.value)

            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...values, option.value])
                    } else {
                      onChange(values.filter((value) => value !== option.value))
                    }
                  }}
                  className="size-4 rounded border-[#3A3A52] bg-[#1F1F2E] accent-[#3B82F6]"
                />
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function KanbanFilters({
  canFilterAssignedTo,
  currentUserId,
  teamMembers,
}: KanbanFiltersProps) {
  const { filters, setFilter, clearFilters } = useKanbanStore()

  const activeFilterCount =
    (filters.myLeadsOnly ? 1 : 0) +
    (filters.overdueOnly ? 1 : 0) +
    filters.serviceLines.length +
    filters.sources.length +
    filters.assignedTo.length

  const hasFilters = activeFilterCount > 0

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#2A2A3C] bg-[#111118] px-4">
      <div className="thin-scrollbar flex items-center gap-2 overflow-x-auto">
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
        <Dropdown
          label="Service Line"
          values={filters.serviceLines}
          options={serviceLineOptions}
          onChange={(values) => {
            console.log("[KanbanFilters] Filter changed:", "serviceLines", values)
            setFilter("serviceLines", values as ServiceLine[])
          }}
        />
        <Dropdown
          label="Source"
          values={filters.sources}
          options={sourceOptions}
          onChange={(values) => {
            console.log("[KanbanFilters] Filter changed:", "sources", values)
            setFilter("sources", values as typeof filters.sources)
          }}
        />
        {canFilterAssignedTo ? (
          <Dropdown
            label="Assigned To"
            values={filters.assignedTo}
            options={teamMembers.map((member) => ({
              label: member.full_name,
              value: member.id,
            }))}
            onChange={(values) => {
              console.log("[KanbanFilters] Filter changed:", "assignedTo", values)
              setFilter("assignedTo", values)
            }}
          />
        ) : null}
      </div>

      <div className="ml-4 flex items-center gap-2">
        {hasFilters ? (
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#1E3A5F] px-2 text-xs font-medium text-[#3B82F6]">
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
        <div className="flex items-center rounded-lg border border-[#3A3A52] bg-[#1F1F2E] p-1">
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
  )
}
