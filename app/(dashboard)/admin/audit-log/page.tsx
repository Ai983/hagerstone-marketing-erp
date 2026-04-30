"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  Shield,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

import { createClient } from "@/lib/supabase/client"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AuditLog } from "@/lib/types"

const PAGE_SIZE = 50
const ALLOWED_ROLES = new Set(["admin", "founder"])
const ALL_FILTER_VALUE = "__all__"

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  created: { bg: "#10B98120", color: "#10B981" },
  updated: { bg: "#3B82F620", color: "#3B82F6" },
  deleted: { bg: "#EF444420", color: "#EF4444" },
  archived: { bg: "#F59E0B20", color: "#F59E0B" },
  stage_changed: { bg: "#8B5CF620", color: "#8B5CF6" },
  login: { bg: "#06B6D420", color: "#06B6D4" },
  exported: { bg: "#EC489920", color: "#EC4899" },
}

const ACTION_OPTIONS = [
  "created",
  "updated",
  "deleted",
  "archived",
  "stage_changed",
  "login",
  "exported",
]

const ENTITY_OPTIONS = [
  "lead",
  "campaign",
  "task",
  "user",
  "pipeline_stage",
  "interaction",
]

type AuditLogExportRow = AuditLog & {
  actor?: {
    full_name: string
    role: string
  } | null
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export default function AuditLogPage() {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [filterEntity, setFilterEntity] = useState("")
  const [filterActorId, setFilterActorId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const { data: canAccess, isLoading: checkingAccess } = useQuery({
    queryKey: ["audit-log-access"],
    queryFn: async () => {
      const { user, profile } = await getCachedUserAndProfile()
      if (!user) return false
      return ALLOWED_ROLES.has((profile?.role as string | undefined) ?? "")
    },
  })

  useEffect(() => {
    if (checkingAccess) return
    if (canAccess === false) router.replace("/pipeline")
  }, [canAccess, checkingAccess, router])

  const { data, isLoading } = useQuery({
    queryKey: [
      "audit-log",
      page,
      search,
      filterAction,
      filterEntity,
      filterActorId,
      dateFrom,
      dateTo,
    ],
    enabled: canAccess === true,
    queryFn: async () => {
      const supabase = createClient()

      let query = supabase
        .from("audit_log")
        .select(
          `
          *,
          actor:profiles!actor_id(id, full_name, role)
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (search.trim()) {
        const safeSearch = search.trim().replace(/[%_,]/g, "")
        query = query.or(
          `action.ilike.%${safeSearch}%,` +
            `entity_type.ilike.%${safeSearch}%,` +
            `new_values->>lead_name.ilike.%${safeSearch}%,` +
            `old_values->>lead_name.ilike.%${safeSearch}%,` +
            `new_values->>company.ilike.%${safeSearch}%`
        )
      }
      if (filterAction) query = query.eq("action", filterAction)
      if (filterEntity) query = query.eq("entity_type", filterEntity)
      if (filterActorId) query = query.eq("actor_id", filterActorId)
      if (dateFrom) query = query.gte("created_at", dateFrom)
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`)

      const { data, count, error } = await query
      if (error) throw error
      return { logs: (data ?? []) as AuditLog[], total: count ?? 0 }
    },
  })

  const { data: stats } = useQuery({
    queryKey: ["audit-stats"],
    enabled: canAccess === true,
    queryFn: async () => {
      const supabase = createClient()
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [todayCount, weekCount, actors] = await Promise.all([
        supabase
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .gte("created_at", today.toISOString()),
        supabase
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .gte(
            "created_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          ),
        supabase.from("audit_log").select("actor_id").not("actor_id", "is", null),
      ])

      return {
        today: todayCount.count ?? 0,
        week: weekCount.count ?? 0,
        uniqueActors: new Set((actors.data ?? []).map((a) => a.actor_id)).size,
      }
    },
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  const hasActiveFilters = Boolean(
    search || filterAction || filterEntity || filterActorId || dateFrom || dateTo
  )
  const showingStart = data?.total ? page * PAGE_SIZE + 1 : 0
  const showingEnd = Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)

  const setFilterAndResetPage = (setter: (value: string) => void, value: string) => {
    setter(value)
    setPage(0)
  }

  const applyQuickDate = (label: string) => {
    const now = new Date()
    const start = new Date()

    if (label === "Today") {
      start.setHours(0, 0, 0, 0)
    } else if (label === "This Week") {
      start.setDate(now.getDate() - 7)
    } else {
      start.setDate(1)
    }

    setDateFrom(format(start, "yyyy-MM-dd"))
    setDateTo(format(now, "yyyy-MM-dd"))
    setPage(0)
  }

  const clearFilters = () => {
    setSearch("")
    setFilterAction("")
    setFilterEntity("")
    setFilterActorId("")
    setDateFrom("")
    setDateTo("")
    setPage(0)
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExportCSV = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("audit_log")
      .select("*, actor:profiles!actor_id(full_name, role)")
      .order("created_at", { ascending: false })
      .limit(5000)

    if (!data) return

    const headers = [
      "Timestamp",
      "User",
      "Role",
      "Action",
      "Entity Type",
      "Entity ID",
      "IP Address",
    ]
    const rows = (data as AuditLogExportRow[]).map((log) => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
      log.actor?.full_name ?? "System",
      log.actor?.role ?? log.actor_type ?? "",
      log.action,
      log.entity_type,
      log.entity_id ?? "",
      log.ip_address ?? "",
    ])

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => csvEscape(String(value))).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-log-${format(new Date(), "dd-MM-yyyy")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const rows = useMemo(() => data?.logs ?? [], [data?.logs])

  if (checkingAccess || canAccess !== true) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <div className="text-sm text-[#9090A8]">Loading audit log...</div>
      </main>
    )
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Shield size={22} color="#8B5CF6" />
              <div>
                <h1 className="m-0 font-[family-name:var(--font-heading)] text-xl font-medium text-[#F0F0FA]">
                  Audit Log
                </h1>
                <p className="m-0 text-xs text-[#9090A8]">
                  Complete record of all system actions
                </p>
              </div>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-md border border-[#2A2A3C] bg-[#1A1A24] px-3.5 py-2 text-xs text-[#9090A8] transition hover:text-[#F0F0FA]"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            ["Today", stats?.today ?? 0, "actions"],
            ["This Week", stats?.week ?? 0, "actions"],
            ["Unique Users", stats?.uniqueActors ?? 0, "actors"],
          ].map(([label, value, suffix]) => (
            <div
              key={label}
              className="rounded-lg border border-[#2A2A3C] bg-[#111118] p-3.5"
            >
              <p className="mb-1 text-[11px] uppercase text-[#9090A8]">{label}</p>
              <p className="m-0 text-2xl font-medium text-[#F0F0FA]">{value}</p>
              <p className="m-0 mt-0.5 text-[11px] text-[#5A5A72]">{suffix}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 rounded-lg border border-[#2A2A3C] bg-[#111118] px-3.5 py-3">
          <div className="mb-2 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5A72]"
              />
              <input
                value={search}
                onChange={(e) => setFilterAndResetPage(setSearch, e.target.value)}
                placeholder="Search actions, entities..."
                className="w-full rounded-md border border-[#2A2A3C] bg-[#1F1F2E] py-2 pl-8 pr-2.5 text-xs text-[#F0F0FA] outline-none"
              />
            </div>

            <Select
              value={filterAction || ALL_FILTER_VALUE}
              onValueChange={(value) =>
                setFilterAndResetPage(
                  setFilterAction,
                  value === ALL_FILTER_VALUE ? "" : value
                )
              }
            >
              <SelectTrigger className="h-9 w-[150px] rounded-md bg-[#1F1F2E] text-xs">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All Actions</SelectItem>
                {ACTION_OPTIONS.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterEntity || ALL_FILTER_VALUE}
              onValueChange={(value) =>
                setFilterAndResetPage(
                  setFilterEntity,
                  value === ALL_FILTER_VALUE ? "" : value
                )
              }
            >
              <SelectTrigger className="h-9 w-[160px] rounded-md bg-[#1F1F2E] text-xs">
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All Entities</SelectItem>
                {ENTITY_OPTIONS.map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {entity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {["Today", "This Week", "This Month"].map((label) => (
              <button
                key={label}
                onClick={() => applyQuickDate(label)}
                className="rounded-md border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-1.5 text-[11px] text-[#9090A8]"
              >
                {label}
              </button>
            ))}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setFilterAndResetPage(setDateFrom, e.target.value)}
              className="rounded-md border border-[#2A2A3C] bg-[#1F1F2E] px-2.5 py-1.5 text-xs text-[#F0F0FA] outline-none"
            />
            <span className="self-center text-xs text-[#5A5A72]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setFilterAndResetPage(setDateTo, e.target.value)}
              className="rounded-md border border-[#2A2A3C] bg-[#1F1F2E] px-2.5 py-1.5 text-xs text-[#F0F0FA] outline-none"
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-md border border-[#EF4444] bg-transparent px-3 py-1.5 text-[11px] text-[#EF4444]"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <p className="mb-2.5 text-xs text-[#9090A8]">
          Showing {showingStart}-{showingEnd} of {data?.total ?? 0} entries
        </p>

        <div className="overflow-hidden rounded-lg border border-[#2A2A3C] bg-[#111118]">
          <div className="thin-scrollbar overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#2A2A3C] bg-[#0A0A0F]">
                  {["Timestamp", "User", "Action", "Entity", "Changes", "IP"].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-3.5 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[#5A5A72]"
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-[#1A1A24]">
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-3.5 py-3">
                            <div
                              className="h-3.5 rounded bg-[#1A1A24]"
                              style={{
                                width: j === 0 ? 120 : j === 4 ? 160 : 80,
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  : rows.map((log) => {
                      const leadName =
                        log.new_values?.lead_name ?? log.old_values?.lead_name
                      const company =
                        log.new_values?.company ?? log.old_values?.company
                      const hasStageChangeSummary = Boolean(
                        log.action === "stage_changed" &&
                          (log.old_values?.stage_name ||
                            log.new_values?.stage_name)
                      )

                      return (
                        <tr
                          key={log.id}
                          className="border-b border-[#1A1A24] transition hover:bg-[#1A1A24]"
                        >
                        <td className="whitespace-nowrap px-3.5 py-2.5">
                          <p className="m-0 text-xs text-[#F0F0FA]">
                            {format(new Date(log.created_at), "dd MMM yyyy")}
                          </p>
                          <p className="m-0 text-[10px] text-[#5A5A72]">
                            {format(new Date(log.created_at), "hh:mm:ss a")}
                          </p>
                          <p className="m-0 text-[10px] text-[#3A3A52]">
                            {formatDistanceToNow(new Date(log.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </td>

                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]/20 text-[11px] font-semibold text-[#3B82F6]">
                              {log.actor?.full_name?.charAt(0)?.toUpperCase() ??
                                "S"}
                            </div>
                            <div>
                              <p className="m-0 text-xs text-[#F0F0FA]">
                                {log.actor?.full_name ?? "System"}
                              </p>
                              <p className="m-0 text-[10px] text-[#5A5A72]">
                                {log.actor?.role ?? log.actor_type ?? "automated"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5">
                          <span
                            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium"
                            style={{
                              background:
                                ACTION_COLORS[log.action]?.bg ?? "#1F1F2E",
                              color:
                                ACTION_COLORS[log.action]?.color ?? "#9090A8",
                            }}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5">
                          <span className="block w-fit rounded bg-[#1F1F2E] px-2 py-0.5 text-[11px] text-[#9090A8]">
                            {log.entity_type}
                          </span>
                          {leadName && (
                            <p className="m-0 mt-1 text-xs font-medium text-[#F0F0FA]">
                              {leadName}
                            </p>
                          )}
                          {company && (
                            <p className="m-0 text-[11px] text-[#5A5A72]">
                              {company}
                            </p>
                          )}
                          {log.entity_id && (
                            <p className="m-0 mt-1 font-mono text-[10px] text-[#3A3A52]">
                              {log.entity_id.slice(0, 8)}...
                            </p>
                          )}
                        </td>

                        <td className="max-w-[220px] px-3.5 py-2.5">
                          {hasStageChangeSummary ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="rounded-full bg-[#EF4444]/20 px-2 py-0.5 text-[11px] text-[#EF4444]">
                                {log.old_values?.stage_name ?? "—"}
                              </span>
                              <span className="text-[#5A5A72]">→</span>
                              <span className="rounded-full bg-[#10B981]/20 px-2 py-0.5 text-[11px] text-[#10B981]">
                                {log.new_values?.stage_name ?? "—"}
                              </span>
                            </div>
                          ) : log.old_values || log.new_values ? (
                            <div>
                              <button
                                onClick={() => toggleExpand(log.id)}
                                className="flex items-center gap-1 border-0 bg-transparent p-0 text-[11px] text-[#3B82F6]"
                              >
                                {expandedIds.has(log.id) ? (
                                  <ChevronUp size={11} />
                                ) : (
                                  <ChevronDown size={11} />
                                )}
                                View changes
                              </button>

                              {expandedIds.has(log.id) && (
                                <div className="mt-1.5 rounded-md border border-[#2A2A3C] bg-[#0A0A0F] p-2">
                                  {log.old_values && (
                                    <JsonBlock
                                      label="Before"
                                      color="#EF4444"
                                      value={log.old_values}
                                    />
                                  )}
                                  {log.new_values && (
                                    <JsonBlock
                                      label="After"
                                      color="#10B981"
                                      value={log.new_values}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#3A3A52]">-</span>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5">
                          <span className="font-mono text-[10px] text-[#5A5A72]">
                            {log.ip_address ?? "-"}
                          </span>
                        </td>
                      </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-[#2A2A3C] bg-[#1A1A24] px-4 py-2 text-xs text-[#9090A8] disabled:cursor-not-allowed disabled:text-[#3A3A52]"
          >
            Previous
          </button>

          <span className="text-xs text-[#5A5A72]">
            Page {page + 1} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * PAGE_SIZE >= (data?.total ?? 0)}
            className="rounded-md border border-[#2A2A3C] bg-[#1A1A24] px-4 py-2 text-xs text-[#9090A8] disabled:cursor-not-allowed disabled:text-[#3A3A52]"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  )
}

function JsonBlock({
  label,
  color,
  value,
}: {
  label: string
  color: string
  value: Record<string, unknown>
}) {
  return (
    <div className="mb-1.5 last:mb-0">
      <p
        className="mb-1 text-[9px] uppercase tracking-[0.06em]"
        style={{ color }}
      >
        {label}
      </p>
      <pre className="m-0 whitespace-pre-wrap break-all font-mono text-[10px] text-[#9090A8]">
        {JSON.stringify(value, null, 2).slice(0, 200)}
      </pre>
    </div>
  )
}
