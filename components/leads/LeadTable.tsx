"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  PenSquare,
  Trash2,
  UserRound,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { LeadSource, ServiceLine } from "@/lib/types"
import type { LeadListItem } from "@/lib/hooks/useLeads"
import { categoryConfig } from "@/lib/utils/lead-category"
import { cn } from "@/lib/utils"

export type SortKey =
  | "full_name"
  | "phone"
  | "stage"
  | "service_line"
  | "source"
  | "city"
  | "assigned_to"
  | "created_at"

export type SortDirection = "asc" | "desc"

interface LeadTableProps {
  leads: LeadListItem[]
  loading: boolean
  sortKey: SortKey
  sortDirection: SortDirection
  onSortChange: (key: SortKey) => void
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

const PAGE_SIZE = 25

const sourceStyles: Record<LeadSource | "default", string> = {
  website: "bg-[#1E3A5F] text-[#60A5FA]",
  manual_sales: "bg-[#1A1A24] text-[#9090A8]",
  referral: "bg-[#2E1A47] text-[#C084FC]",
  google_ads: "bg-[#3A2413] text-[#FB923C]",
  whatsapp_inbound: "bg-[#1D3A2A] text-[#34D399]",
  linkedin: "bg-[#0F2740] text-[#60A5FA]",
  justdial: "bg-[#1A1A24] text-[#9090A8]",
  ai_suggested: "bg-[#1A1A24] text-[#9090A8]",
  other: "bg-[#1A1A24] text-[#9090A8]",
  default: "bg-[#1A1A24] text-[#9090A8]",
}

function formatServiceLine(serviceLine?: ServiceLine | null) {
  if (!serviceLine) {
    return "Unknown"
  }

  return serviceLine
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace("Mep", "MEP")
}

function getInitials(name?: string | null) {
  if (!name) {
    return "U"
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  activeSortKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = activeSortKey === sortKey

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "flex items-center gap-1 text-left text-xs font-medium uppercase tracking-[0.05em] text-[#9090A8] transition hover:text-[#F0F0FA]",
        className
      )}
    >
      {label}
      <ChevronDown
        className={cn(
          "size-3.5 transition",
          isActive ? "opacity-100" : "opacity-40",
          isActive && direction === "asc" ? "rotate-180" : ""
        )}
      />
    </button>
  )
}

function ActionsMenu({ leadId }: { leadId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        className="flex size-8 items-center justify-center rounded-lg border border-[#2A2A3C] bg-[#111118] text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
        aria-label="Open lead actions"
      >
        <MoreHorizontal className="size-4" />
      </button>

      <div
        className={cn(
          "absolute right-0 top-10 z-30 min-w-[160px] rounded-xl border border-[#2A2A3C] bg-[#111118] p-1.5 transition duration-200",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        )}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            router.push(`/leads/${leadId}`)
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24]"
        >
          <UserRound className="size-4" />
          View Lead
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            router.push(`/leads/${leadId}?mode=edit`)
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24]"
        >
          <PenSquare className="size-4" />
          Edit Lead
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            toast.info("Delete lead will be available in a later step.")
            setOpen(false)
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      </div>
    </div>
  )
}

function LoadingRows() {
  return Array.from({ length: 8 }).map((_, index) => (
    <tr key={index} className="border-b border-[#2A2A3C]">
      {Array.from({ length: 10 }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-4 py-4">
          <div className="h-4 animate-pulse rounded bg-[#1A1A24]" />
        </td>
      ))}
    </tr>
  ))
}

export function LeadTable({
  leads,
  loading,
  sortKey,
  sortDirection,
  onSortChange,
  currentPage,
  totalPages,
  onPageChange,
}: LeadTableProps) {
  const router = useRouter()
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null)

  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return leads.slice(startIndex, startIndex + PAGE_SIZE)
  }, [currentPage, leads])

  const copyPhone = async (event: React.MouseEvent, leadId: string, phone?: string | null) => {
    event.stopPropagation()
    if (!phone) {
      return
    }

    await navigator.clipboard.writeText(phone)
    setCopiedLeadId(leadId)
    window.setTimeout(() => setCopiedLeadId((current) => (current === leadId ? null : current)), 1200)
  }

  if (!loading && leads.length === 0) {
    return (
      <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] px-6 py-16 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full border border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8]">
            <UserRound className="size-7" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-[#F0F0FA]">No leads found</h3>
            <p className="mt-2 text-sm text-[#9090A8]">
              Try adjusting your filters or create a new lead to get started.
            </p>
          </div>
          <Link
            href="/leads/new"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB]"
          >
            + New Lead
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-[#1A1A24]">
            <tr>
              <th className="px-4 py-3">
                <SortableHeader
                  label="Name + Company"
                  sortKey="full_name"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSortChange}
                />
              </th>
              <th className="px-4 py-3">
                <SortableHeader
                  label="Phone"
                  sortKey="phone"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSortChange}
                />
              </th>
              <th className="px-4 py-3">
                <SortableHeader
                  label="Stage"
                  sortKey="stage"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSortChange}
                />
              </th>
              <th className="px-4 py-3">
                <SortableHeader
                  label="Service Line"
                  sortKey="service_line"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSortChange}
                />
              </th>
              <th className="px-4 py-3">
                <SortableHeader
                  label="Source"
                  sortKey="source"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSortChange}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.05em] text-[#9090A8]">
                Category
              </th>
              <th className="hidden px-4 py-3 md:table-cell">
                <SortableHeader
                  label="City"
                  sortKey="city"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSortChange}
                />
              </th>
              <th className="hidden px-4 py-3 md:table-cell">
                <SortableHeader
                  label="Assigned To"
                  sortKey="assigned_to"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSortChange}
                />
              </th>
              <th className="hidden px-4 py-3 md:table-cell">
                <SortableHeader
                  label="Created"
                  sortKey="created_at"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSortChange}
                />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.05em] text-[#9090A8]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows />
            ) : (
              paginatedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="cursor-pointer border-b border-[#2A2A3C] transition hover:bg-[#1A1A24]"
                >
                  <td className="px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-medium text-[#F0F0FA]">{lead.full_name}</p>
                      <p className="mt-1 text-sm text-[#9090A8]">
                        {lead.company_name || "No company"}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={(event) => copyPhone(event, lead.id, lead.phone)}
                      className="relative inline-flex items-center gap-2 font-mono text-sm text-[#F0F0FA] transition hover:text-[#60A5FA]"
                    >
                      <span>{lead.phone || "N/A"}</span>
                      <Copy className="size-3.5 text-[#9090A8]" />
                      {copiedLeadId === lead.id ? (
                        <span className="absolute -top-8 left-0 rounded-md border border-[#2A2A3C] bg-[#111118] px-2 py-1 text-[11px] text-[#F0F0FA]">
                          <Check className="mr-1 inline size-3" />
                          Copied!
                        </span>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: `${lead.stage?.color ?? "#6B7280"}33`,
                        color: lead.stage?.color ?? "#6B7280",
                      }}
                    >
                      {lead.stage?.name ?? "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#F0F0FA]">
                    {formatServiceLine(lead.service_line ?? undefined)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                        sourceStyles[lead.source] ?? sourceStyles.default
                      )}
                    >
                      {lead.source
                        .split("_")
                        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(" ")}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {lead.category ? (
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{
                          background: categoryConfig[lead.category].bg,
                          color: categoryConfig[lead.category].color,
                        }}
                      >
                        {categoryConfig[lead.category].label}
                      </span>
                    ) : (
                      <span className="text-xs text-[#5A5A72]">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-4 text-sm text-[#9090A8] md:table-cell">
                    {lead.city || "—"}
                  </td>
                  <td className="hidden px-4 py-4 md:table-cell">
                    {lead.assignee ? (
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-[#1E3A5F] text-xs font-semibold text-[#3B82F6]">
                          {getInitials(lead.assignee.full_name)}
                        </div>
                        <span className="text-sm text-[#F0F0FA]">{lead.assignee.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-[#9090A8]">Unassigned</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-4 text-sm text-[#9090A8] md:table-cell">
                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-4">
                    <div
                      className="flex justify-end"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ActionsMenu leadId={lead.id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-[#2A2A3C] px-4 py-3">
          <p className="text-sm text-[#9090A8]">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="size-4" />
              Prev
            </button>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
