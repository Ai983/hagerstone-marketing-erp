"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { formatDistanceToNowStrict, isAfter, subDays } from "date-fns"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { LeadFilters, type LeadsFilterState } from "@/components/leads/LeadFilters"
import { LeadTable, type SortDirection, type SortKey } from "@/components/leads/LeadTable"
import { useLeads } from "@/lib/hooks/useLeads"
import type { LeadSource, ServiceLine, UserRole } from "@/lib/types"

const PAGE_SIZE = 25
const PRIVILEGED_ROLES: UserRole[] = ["manager", "admin", "founder"]

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value)
}

export function LeadsPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [sortKey, setSortKey] = useState<SortKey>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [currentPage, setCurrentPage] = useState(1)

  const { getLeads, getStages, getCurrentProfile, getTeamMembers, getOverdueLeadIds } = useLeads()

  const leadsQuery = useQuery({
    queryKey: ["leads"],
    queryFn: getLeads,
  })

  const stagesQuery = useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: getStages,
  })

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile,
  })

  const canFilterAssignedTo = PRIVILEGED_ROLES.includes(
    (profileQuery.data?.role ?? "sales_rep") as UserRole
  )

  const teamMembersQuery = useQuery({
    queryKey: ["team-members"],
    queryFn: getTeamMembers,
    enabled: canFilterAssignedTo,
  })

  const overdueLeadIdsQuery = useQuery({
    queryKey: ["overdue-lead-ids"],
    queryFn: getOverdueLeadIds,
  })

  const filters = useMemo<LeadsFilterState>(
    () => ({
      search: searchParams.get("q") ?? "",
      stages: searchParams.getAll("stage"),
      sources: searchParams.getAll("source") as LeadSource[],
      serviceLines: searchParams.getAll("service") as ServiceLine[],
      assignedTo: searchParams.getAll("assigned"),
      category:
        (searchParams.get("category") as LeadsFilterState["category"] | null) ??
        "all",
    }),
    [searchParams]
  )

  const updateFilters = (nextFilters: LeadsFilterState) => {
    const nextParams = new URLSearchParams()

    if (nextFilters.search.trim()) {
      nextParams.set("q", nextFilters.search.trim())
    }

    nextFilters.stages.forEach((value) => nextParams.append("stage", value))
    nextFilters.sources.forEach((value) => nextParams.append("source", value))
    nextFilters.serviceLines.forEach((value) => nextParams.append("service", value))
    if (canFilterAssignedTo) {
      nextFilters.assignedTo.forEach((value) => nextParams.append("assigned", value))
    }
    if (nextFilters.category !== "all") {
      nextParams.set("category", nextFilters.category)
    }

    const queryString = nextParams.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    setCurrentPage(1)
  }

  const filteredLeads = useMemo(() => {
    const allLeads = leadsQuery.data ?? []
    const normalizedSearch = filters.search.trim().toLowerCase()

    return allLeads.filter((lead) => {
      const matchesSearch =
        !normalizedSearch ||
        [lead.full_name, lead.company_name, lead.phone]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch))

      const matchesStage =
        filters.stages.length === 0 || filters.stages.includes(lead.stage?.slug ?? "")

      const matchesSource =
        filters.sources.length === 0 || filters.sources.includes(lead.source)

      const matchesServiceLine =
        filters.serviceLines.length === 0 ||
        (lead.service_line ? filters.serviceLines.includes(lead.service_line) : false)

      const matchesAssignedTo =
        filters.assignedTo.length === 0 ||
        filters.assignedTo.includes(lead.assigned_to ?? "")
      const matchesCategory =
        filters.category === "all" ||
        (filters.category === "uncategorized"
          ? lead.category == null
          : lead.category === filters.category)

      return (
        matchesSearch &&
        matchesStage &&
        matchesSource &&
        matchesServiceLine &&
        matchesAssignedTo &&
        matchesCategory
      )
    })
  }, [filters, leadsQuery.data])

  const sortedLeads = useMemo(() => {
    const leads = [...filteredLeads]

    leads.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1

      const values: Record<SortKey, number> = {
        full_name: a.full_name.localeCompare(b.full_name),
        phone: (a.phone ?? "").localeCompare(b.phone ?? ""),
        stage: (a.stage?.name ?? "").localeCompare(b.stage?.name ?? ""),
        service_line: (a.service_line ?? "").localeCompare(b.service_line ?? ""),
        source: a.source.localeCompare(b.source),
        city: (a.city ?? "").localeCompare(b.city ?? ""),
        assigned_to: (a.assignee?.full_name ?? "").localeCompare(b.assignee?.full_name ?? ""),
        created_at: new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      }

      return values[sortKey] * direction
    })

    return leads
  }, [filteredLeads, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const overdueLeadIds = useMemo(
    () => new Set(overdueLeadIdsQuery.data ?? []),
    [overdueLeadIdsQuery.data]
  )

  const stats = useMemo(() => {
    const oneWeekAgo = subDays(new Date(), 7)
    const newThisWeek = filteredLeads.filter((lead) =>
      isAfter(new Date(lead.created_at), oneWeekAgo)
    ).length
    const unassigned = filteredLeads.filter((lead) => !lead.assigned_to).length
    const overdue = filteredLeads.filter((lead) => overdueLeadIds.has(lead.id)).length

    return [
      { label: "Total Leads", value: formatNumber(filteredLeads.length) },
      { label: "New This Week", value: formatNumber(newThisWeek) },
      { label: "Unassigned", value: formatNumber(unassigned) },
      { label: "Overdue Follow-ups", value: formatNumber(overdue) },
    ]
  }, [filteredLeads, overdueLeadIds])

  const handleSortChange = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(key)
    setSortDirection(key === "created_at" ? "desc" : "asc")
  }

  const isLoading =
    leadsQuery.isLoading ||
    stagesQuery.isLoading ||
    profileQuery.isLoading ||
    overdueLeadIdsQuery.isLoading ||
    (canFilterAssignedTo && teamMembersQuery.isLoading)

  if (leadsQuery.isError || stagesQuery.isError || profileQuery.isError || overdueLeadIdsQuery.isError) {
    if (leadsQuery.error) console.error("Leads fetch error (leads):", leadsQuery.error)
    if (stagesQuery.error) console.error("Leads fetch error (stages):", stagesQuery.error)
    if (profileQuery.error) console.error("Leads fetch error (profile):", profileQuery.error)
    if (overdueLeadIdsQuery.error)
      console.error("Leads fetch error (overdue):", overdueLeadIdsQuery.error)
    return (
      <main className="px-6 py-8 sm:px-8">
        <div className="rounded-xl border border-[#7F1D1D] bg-[#2A1215] px-4 py-3 text-sm text-[#F87171]">
          Unable to load leads right now. Please refresh and try again.
        </div>
      </main>
    )
  }

  return (
    <main className="px-6 py-8 sm:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-[#F0F0FA]">
            All Leads
          </h1>
          <p className="mt-2 text-sm text-[#9090A8]">
            {filteredLeads.length > 0
              ? `Updated ${formatDistanceToNowStrict(new Date(sortedLeads[0]?.created_at ?? new Date()), {
                  addSuffix: true,
                })}`
              : "Review every lead currently visible to you."}
          </p>
        </div>
        <Link
          href="/leads/new"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB]"
        >
          + New Lead
        </Link>
      </div>

      <LeadFilters
        filters={filters}
        onFiltersChange={updateFilters}
        stages={(stagesQuery.data ?? []).map((stage) => ({
          id: stage.id,
          name: stage.name,
          slug: stage.slug,
          color: stage.color,
        }))}
        teamMembers={(teamMembersQuery.data ?? []).map((member) => ({
          id: member.id,
          full_name: member.full_name,
        }))}
        canFilterAssignedTo={canFilterAssignedTo}
      />

      <section className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[#2A2A3C] bg-[#111118] p-4"
          >
            <p className="text-xs uppercase tracking-[0.05em] text-[#9090A8]">{stat.label}</p>
            <p className="mt-3 text-2xl font-semibold text-[#F0F0FA]">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="mt-6">
        <LeadTable
          leads={sortedLeads}
          loading={isLoading}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </main>
  )
}
