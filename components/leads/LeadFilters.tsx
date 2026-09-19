"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Filter, Search, X } from "lucide-react"

import { PRIORITY_OPTIONS, priorityLabel } from "@/components/data/DataSetBadge"
import type { DataSet, LeadSource, PipelineStage, ServiceLine } from "@/lib/types"
import { cn } from "@/lib/utils"
import { LEAD_GROUP_ORDER, LEAD_GROUPS } from "@/lib/utils/relationship-group"

export type ProfileCategoryFilter =
  | "all"
  | "office_interiors"
  | "mep"
  | "facade_glazing"
  | "peb_construction"
  | "civil_works"
  | "hospitality"

export interface LeadsFilterState {
  search: string
  stages: string[]
  sources: LeadSource[]
  serviceLines: ServiceLine[]
  category: "all" | "hot" | "warm" | "lukewarm" | "cold" | "uncategorized"
  profile: ProfileCategoryFilter
  /** Data set keys — "architect-meetings-dec-2025", "founder-pipeline"… */
  dataSets: string[]
  priorities: string[]
  /** Relationship groups — "gone_quiet", "proposal_pending"… */
  groups: string[]
}

export const EMPTY_LEAD_FILTERS: LeadsFilterState = {
  search: "",
  stages: [],
  sources: [],
  serviceLines: [],
  category: "all",
  profile: "all",
  dataSets: [],
  priorities: [],
  groups: [],
}

const priorityOptions = PRIORITY_OPTIONS.map((p) => ({
  value: p,
  label: p === "dropped" ? "Dropped" : `${priorityLabel(p)} priority`,
}))

const groupOptions = LEAD_GROUP_ORDER.map((g) => ({
  value: g,
  label: LEAD_GROUPS[g].label,
  color: LEAD_GROUPS[g].color,
}))

const profileFilterOptions: { value: ProfileCategoryFilter; label: string }[] = [
  { value: "all", label: "All Profiles" },
  { value: "office_interiors", label: "Office Interiors" },
  { value: "mep", label: "MEP" },
  { value: "facade_glazing", label: "Facade & Glazing" },
  { value: "peb_construction", label: "PEB & Construction" },
  { value: "civil_works", label: "Civil Works" },
  { value: "hospitality", label: "Hospitality" },
]

interface LeadFiltersProps {
  filters: LeadsFilterState
  onFiltersChange: (filters: LeadsFilterState) => void
  stages: Pick<PipelineStage, "id" | "name" | "slug" | "color">[]
  dataSets: DataSet[]
  /** Lead count per data set key, for the tab labels. */
  dataSetCounts: Record<string, number>
  totalCount: number
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
  { label: "Facade doors & Windows", value: "facade_glazing" },
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
        className="flex h-11 w-full items-center justify-between rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-base text-[#F0F0FA] transition hover:border-[#4A4A62] md:h-10 md:text-sm sm:min-w-[160px]"
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
  dataSets,
  dataSetCounts,
  totalCount,
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

  const activeFilterCount =
    filters.stages.length +
    filters.sources.length +
    filters.serviceLines.length +
    (filters.category !== "all" ? 1 : 0) +
    (filters.profile !== "all" ? 1 : 0) +
    filters.priorities.length +
    filters.groups.length +
    (filters.search ? 1 : 0)

  const hasActiveFilters = activeFilterCount > 0

  const update = (patch: Partial<LeadsFilterState>) => onFiltersChange({ ...filters, ...patch })

  return (
    <section className="border-y border-[#2A2A3C] bg-[#111118] px-4 py-3 md:border-b md:border-t-0 md:px-6">
      <div className="flex flex-col gap-3">
        {/* Which body of data — ERP, Architect Drive, Founder Pipeline. */}
        {dataSets.length > 0 ? (
          <div className="thin-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {[{ key: "", name: "All data", color: "#9090A8" }, ...dataSets]
              .filter((ds) => ds.key === "" || (dataSetCounts[ds.key] ?? 0) > 0)
              .map((ds) => {
                const active = ds.key === "" ? filters.dataSets.length === 0 : filters.dataSets.includes(ds.key)
                const count = ds.key === "" ? totalCount : dataSetCounts[ds.key] ?? 0
                return (
                  <button
                    key={ds.key || "all"}
                    type="button"
                    onClick={() => update({ dataSets: ds.key === "" ? [] : [ds.key] })}
                    className={cn(
                      "inline-flex h-9 shrink-0 touch-manipulation items-center gap-2 rounded-full border px-3 text-sm font-medium transition",
                      active ? "text-[#F0F0FA]" : "border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8] hover:text-[#F0F0FA]"
                    )}
                    style={active ? { borderColor: ds.color, backgroundColor: `${ds.color}22` } : undefined}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: ds.color }} />
                    {ds.name}
                    <span className="text-xs text-[#9090A8]">{count}</span>
                  </button>
                )
              })}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9090A8]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search leads"
              className="h-11 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] pl-10 pr-3 text-base text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowMobileFilters((current) => !current)}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA]"
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

        <div className="hidden flex-wrap items-center gap-3 md:flex">
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
            label="Group"
            values={filters.groups}
            options={groupOptions}
            onChange={(values) => update({ groups: values })}
          />
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
          <MultiSelectDropdown
            label="Priority"
            values={filters.priorities}
            options={priorityOptions}
            onChange={(values) => update({ priorities: values })}
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
          <select
            value={filters.profile}
            onChange={(event) =>
              update({ profile: event.target.value as ProfileCategoryFilter })
            }
            className="h-10 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition hover:border-[#4A4A62] sm:min-w-[160px]"
          >
            {profileFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => onFiltersChange({ ...EMPTY_LEAD_FILTERS, dataSets: filters.dataSets })}
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
              label="Group"
              values={filters.groups}
              options={groupOptions}
              onChange={(values) => update({ groups: values })}
            />
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
            <MultiSelectDropdown
              label="Priority"
              values={filters.priorities}
              options={priorityOptions}
              onChange={(values) => update({ priorities: values })}
            />
            <select
              value={filters.category}
              onChange={(event) =>
                update({
                  category: event.target.value as LeadsFilterState["category"],
                })
              }
            className="h-11 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-base text-[#F0F0FA] outline-none transition hover:border-[#4A4A62]"
            >
              <option value="all">All Categories</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="lukewarm">Lukewarm</option>
              <option value="cold">Cold</option>
              <option value="uncategorized">Uncategorized</option>
            </select>
            <select
              value={filters.profile}
              onChange={(event) =>
                update({ profile: event.target.value as ProfileCategoryFilter })
              }
              className="h-11 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-base text-[#F0F0FA] outline-none transition hover:border-[#4A4A62]"
            >
              {profileFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => onFiltersChange({ ...EMPTY_LEAD_FILTERS, dataSets: filters.dataSets })}
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
