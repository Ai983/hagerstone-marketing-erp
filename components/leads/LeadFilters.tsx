"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Filter, Search, X } from "lucide-react"

import type { LeadSource, PipelineStage, Profile, ServiceLine } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface LeadsFilterState {
  search: string
  stages: string[]
  sources: LeadSource[]
  serviceLines: ServiceLine[]
  assignedTo: string[]
  category: "all" | "hot" | "warm" | "lukewarm" | "cold" | "uncategorized"
}

interface LeadFiltersProps {
  filters: LeadsFilterState
  onFiltersChange: (filters: LeadsFilterState) => void
  stages: Pick<PipelineStage, "id" | "name" | "slug" | "color">[]
  teamMembers: Pick<Profile, "id" | "full_name">[]
  canFilterAssignedTo: boolean
}

interface MultiSelectOption {
  label: string
  value: string
  color?: string
}

const sourceOptions: MultiSelectOption[] = [
  { label: "Website", value: "website" },
  { label: "Manual Sales", value: "manual_sales" },
  { label: "WhatsApp Inbound", value: "whatsapp_inbound" },
  { label: "Referral", value: "referral" },
  { label: "Google Ads", value: "google_ads" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "JustDial", value: "justdial" },
  { label: "Other", value: "other" },
]

const serviceLineOptions: MultiSelectOption[] = [
  { label: "Office Interiors", value: "office_interiors" },
  { label: "MEP", value: "mep" },
  { label: "Facade & Glazing", value: "facade_glazing" },
  { label: "PEB Construction", value: "peb_construction" },
  { label: "Civil Works", value: "civil_works" },
  { label: "Multiple", value: "multiple" },
  { label: "Unknown", value: "unknown" },
]

function useOutsideClick<T extends HTMLElement>(
  ref: React.RefObject<T>,
  onOutsideClick: () => void
) {
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onOutsideClick()
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [onOutsideClick, ref])
}

function MultiSelectDropdown({
  label,
  values,
  options,
  onChange,
}: {
  label: string
  values: string[]
  options: MultiSelectOption[]
  onChange: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useOutsideClick(containerRef, () => setOpen(false))

  const selectedCount = values.length

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] transition hover:border-[#4A4A62] sm:min-w-[160px]"
      >
        <span className="truncate">
          {label}
          {selectedCount ? ` (${selectedCount})` : ""}
        </span>
        <ChevronDown className="ml-2 size-4 shrink-0 text-[#9090A8]" />
      </button>

      <div
        className={cn(
          "absolute left-0 top-12 z-30 w-full min-w-[220px] rounded-xl border border-[#2A2A3C] bg-[#111118] p-2 transition duration-200",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        )}
      >
        <div className="max-h-64 overflow-y-auto">
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
                {option.color ? (
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                ) : null}
                <span className="truncate">{option.label}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function LeadFilters({
  filters,
  onFiltersChange,
  stages,
  teamMembers,
  canFilterAssignedTo,
}: LeadFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  useEffect(() => {
    setSearchInput(filters.search)
  }, [filters.search])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput })
      }
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [filters, onFiltersChange, searchInput])

  const stageOptions = useMemo<MultiSelectOption[]>(
    () =>
      stages.map((stage) => ({
        label: stage.name,
        value: stage.slug,
        color: stage.color,
      })),
    [stages]
  )

  const assignedOptions = useMemo<MultiSelectOption[]>(
    () =>
      teamMembers.map((member) => ({
        label: member.full_name,
        value: member.id,
      })),
    [teamMembers]
  )

  const activeFilterCount =
    filters.stages.length +
    filters.sources.length +
    filters.serviceLines.length +
    filters.assignedTo.length +
    (filters.category !== "all" ? 1 : 0) +
    (filters.search ? 1 : 0)

  const hasActiveFilters = activeFilterCount > 0

  const update = (patch: Partial<LeadsFilterState>) => onFiltersChange({ ...filters, ...patch })

  return (
    <section className="border-b border-[#2A2A3C] bg-[#111118] px-6 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9090A8]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search leads"
              className="h-10 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] pl-10 pr-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowMobileFilters((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA]"
          >
            <Filter className="size-4" />
            Filters
            {activeFilterCount ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#3B82F6] px-1.5 text-xs text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9090A8]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, company, or phone"
              className="h-10 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] pl-10 pr-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </div>
          <MultiSelectDropdown
            label="Stage"
            values={filters.stages}
            options={stageOptions}
            onChange={(values) => update({ stages: values })}
          />
          <MultiSelectDropdown
            label="Source"
            values={filters.sources}
            options={sourceOptions}
            onChange={(values) => update({ sources: values as LeadSource[] })}
          />
          <MultiSelectDropdown
            label="Service Line"
            values={filters.serviceLines}
            options={serviceLineOptions}
            onChange={(values) => update({ serviceLines: values as ServiceLine[] })}
          />
          <select
            value={filters.category}
            onChange={(event) =>
              update({
                category: event.target.value as LeadsFilterState["category"],
              })
            }
            className="h-10 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition hover:border-[#4A4A62] sm:min-w-[160px]"
          >
            <option value="all">All Categories</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="lukewarm">Lukewarm</option>
            <option value="cold">Cold</option>
            <option value="uncategorized">Uncategorized</option>
          </select>
          {canFilterAssignedTo ? (
            <MultiSelectDropdown
              label="Assigned To"
              values={filters.assignedTo}
              options={assignedOptions}
              onChange={(values) => update({ assignedTo: values })}
            />
          ) : null}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() =>
                onFiltersChange({
                  search: "",
                  stages: [],
                  sources: [],
                  serviceLines: [],
                  assignedTo: [],
                  category: "all",
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24]"
            >
              <X className="size-4" />
              Clear Filters
            </button>
          ) : null}
        </div>

        {showMobileFilters ? (
          <div className="grid grid-cols-1 gap-3 md:hidden">
            <MultiSelectDropdown
              label="Stage"
              values={filters.stages}
              options={stageOptions}
              onChange={(values) => update({ stages: values })}
            />
            <MultiSelectDropdown
              label="Source"
              values={filters.sources}
              options={sourceOptions}
              onChange={(values) => update({ sources: values as LeadSource[] })}
            />
            <MultiSelectDropdown
              label="Service Line"
              values={filters.serviceLines}
              options={serviceLineOptions}
              onChange={(values) => update({ serviceLines: values as ServiceLine[] })}
            />
            <select
              value={filters.category}
              onChange={(event) =>
                update({
                  category: event.target.value as LeadsFilterState["category"],
                })
              }
              className="h-10 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition hover:border-[#4A4A62]"
            >
              <option value="all">All Categories</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="lukewarm">Lukewarm</option>
              <option value="cold">Cold</option>
              <option value="uncategorized">Uncategorized</option>
            </select>
            {canFilterAssignedTo ? (
              <MultiSelectDropdown
                label="Assigned To"
                values={filters.assignedTo}
                options={assignedOptions}
                onChange={(values) => update({ assignedTo: values })}
              />
            ) : null}
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() =>
                  onFiltersChange({
                    search: "",
                    stages: [],
                    sources: [],
                    serviceLines: [],
                    assignedTo: [],
                    category: "all",
                  })
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA]"
              >
                <X className="size-4" />
                Clear Filters
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
