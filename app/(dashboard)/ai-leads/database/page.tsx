"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  Database,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { useUIStore } from "@/lib/stores/uiStore"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"

const ALLOWED_ROLES: UserRole[] = ["admin", "manager", "founder", "marketing"]
const PAGE_SIZE = 25
const VALID_SERVICE_LINES = new Set([
  "office_interiors",
  "mep",
  "facade_glazing",
  "peb_construction",
  "civil_works",
  "multiple",
  "unknown",
])

const SERVICE_LINE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any service" },
  { value: "office_interiors", label: "Office Interiors" },
  { value: "mep", label: "MEP" },
  { value: "facade_glazing", label: "Facade / Glazing" },
  { value: "peb_construction", label: "PEB Construction" },
  { value: "civil_works", label: "Civil Works" },
  { value: "multiple", label: "Multiple" },
]

type LeadStatus = "new" | "added" | "skipped" | "duplicate"

interface DbLead {
  id: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  website: string | null
  linkedin_url: string | null
  city: string | null
  industry: string | null
  service_line: string | null
  company_size: string | null
  estimated_budget: string | null
  score: number | null
  ai_insight: string | null
  source_url: string | null
  status: LeadStatus
  pipeline_lead_id: string | null
  created_at: string
}

const statusStyles: Record<LeadStatus, { bg: string; color: string; label: string }> = {
  new: { bg: "#1E3A5F", color: "#60A5FA", label: "New" },
  added: { bg: "#163322", color: "#34D399", label: "Added" },
  skipped: { bg: "#1A1A24", color: "#9090A8", label: "Skipped" },
  duplicate: { bg: "#1A1A24", color: "#9090A8", label: "Duplicate" },
}

function getScoreBadge(score: number | null) {
  return score ?? 0
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return ""
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function AiLeadsDatabasePage() {
  const router = useRouter()
  const setLeadDrawerId = useUIStore((s) => s.setLeadDrawerId)

  const [accessChecked, setAccessChecked] = useState(false)
  const [leads, setLeads] = useState<DbLead[]>([])
  const [loading, setLoading] = useState(true)
  const [newLeadStageId, setNewLeadStageId] = useState<string | null>(null)

  // Filter state
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all")
  const [contactFilter, setContactFilter] = useState<
    "all" | "phone" | "email" | "linkedin"
  >("all")
  const [serviceFilter, setServiceFilter] = useState("")
  const [scoreFilter, setScoreFilter] = useState<"all" | "hot" | "warm" | "cold">(
    "all"
  )
  const [cityFilter, setCityFilter] = useState("")
  const [sortBy, setSortBy] = useState<"score" | "newest" | "company">("newest")
  const [page, setPage] = useState(1)

  // Action state
  const [pendingId, setPendingId] = useState<string | null>(null)

  // ── Init ─────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    const init = async () => {
      const { user, profile } = await getCachedUserAndProfile()
      if (!mounted) return
      if (!user || !profile) {
        router.replace("/login")
        return
      }
      const role = (profile as { role?: UserRole }).role
      if (!role || !ALLOWED_ROLES.includes(role)) {
        router.replace("/pipeline")
        return
      }

      const supabase = createClient()
      const [{ data: rows }, { data: stage }] = await Promise.all([
        // Only contactable leads — at least one of phone / email /
        // linkedin_url must be present. Relies on the generated boolean
        // columns has_phone / has_email / has_linkedin on the table.
        supabase
          .from("ai_generated_leads")
          .select("*")
          .or("has_phone.eq.true,has_email.eq.true,has_linkedin.eq.true")
          .order("score", { ascending: false })
          .limit(2000),
        supabase
          .from("pipeline_stages")
          .select("id")
          .eq("slug", "new_lead")
          .maybeSingle(),
      ])
      if (!mounted) return
      setLeads((rows ?? []) as DbLead[])
      setNewLeadStageId((stage?.id as string | undefined) ?? null)
      setAccessChecked(true)
      setLoading(false)
    }
    init()
    return () => {
      mounted = false
    }
  }, [router])

  // ── Stats ────────────────────────────────────────────────────────
  // Every `leads` row is already contactable thanks to the `.or` filter
  // applied at fetch time, so `total` is the contactable count.
  const stats = useMemo(() => {
    const total = leads.length
    const scored = leads.filter((l) => typeof l.score === "number")
    const avgScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, l) => sum + (l.score ?? 0), 0) / scored.length
          )
        : 0
    const added = leads.filter((l) => l.status === "added").length
    const pending = leads.filter((l) => l.status === "new").length
    return { total, avgScore, added, pending }
  }, [leads])

  // ── Filter + sort ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const cityQ = cityFilter.trim().toLowerCase()
    let rows = leads.filter((l) => {
      if (q) {
        const inCompany = (l.company_name ?? "").toLowerCase().includes(q)
        const inContact = (l.contact_name ?? "").toLowerCase().includes(q)
        if (!inCompany && !inContact) return false
      }
      if (statusFilter !== "all" && l.status !== statusFilter) return false
      if (contactFilter === "phone" && !l.phone) return false
      if (contactFilter === "email" && !l.email) return false
      if (contactFilter === "linkedin" && !l.linkedin_url) return false
      if (serviceFilter && l.service_line !== serviceFilter) return false
      if (scoreFilter === "hot" && (l.score ?? 0) < 80) return false
      if (scoreFilter === "warm" && ((l.score ?? 0) < 60 || (l.score ?? 0) >= 80))
        return false
      if (scoreFilter === "cold" && (l.score ?? 0) >= 60) return false
      if (cityQ && !(l.city ?? "").toLowerCase().includes(cityQ)) return false
      return true
    })
    rows = [...rows]
    if (sortBy === "score") {
      rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    } else if (sortBy === "newest") {
      rows.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } else {
      rows.sort((a, b) => a.company_name.localeCompare(b.company_name))
    }
    return rows
  }, [
    leads,
    search,
    statusFilter,
    contactFilter,
    serviceFilter,
    scoreFilter,
    cityFilter,
    sortBy,
  ])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, contactFilter, serviceFilter, scoreFilter, cityFilter, sortBy])

  // ── Actions ──────────────────────────────────────────────────────
  const updateLeadLocal = (id: string, patch: Partial<DbLead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const handleAddToPipeline = async (lead: DbLead) => {
    if (!newLeadStageId) {
      toast.error("Pipeline stages not loaded")
      return
    }
    setPendingId(lead.id)
    try {
      const supabase = createClient()
      const serviceLineSafe =
        lead.service_line && VALID_SERVICE_LINES.has(lead.service_line)
          ? lead.service_line
          : null

      const { data: insertedRow, error: insertError } = await supabase
        .from("leads")
        .insert({
          full_name: lead.contact_name?.trim() || "Unknown Contact",
          company_name: lead.company_name,
          phone: lead.phone || null,
          email: lead.email || null,
          city: lead.city,
          service_line: serviceLineSafe,
          estimated_budget: lead.estimated_budget,
          source: "ai_suggested",
          stage_id: newLeadStageId,
          initial_notes: lead.ai_insight,
          score: Math.max(0, Math.min(100, Math.round(lead.score ?? 0))),
          is_sample_data: false,
        })
        .select("id")
        .maybeSingle()

      if (insertError) {
        toast.error(insertError.message)
        return
      }

      const newPipelineId = (insertedRow as { id: string } | null)?.id ?? null
      await supabase
        .from("ai_generated_leads")
        .update({
          status: "added",
          pipeline_lead_id: newPipelineId,
          added_to_pipeline_at: new Date().toISOString(),
        })
        .eq("id", lead.id)

      updateLeadLocal(lead.id, {
        status: "added",
        pipeline_lead_id: newPipelineId,
      })
      toast.success(`${lead.company_name} added to pipeline`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add lead")
    } finally {
      setPendingId(null)
    }
  }

  const handleStatusUpdate = async (lead: DbLead, status: LeadStatus) => {
    setPendingId(lead.id)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("ai_generated_leads")
        .update({ status })
        .eq("id", lead.id)
      if (error) {
        toast.error(error.message)
        return
      }
      updateLeadLocal(lead.id, { status })
    } finally {
      setPendingId(null)
    }
  }

  const handleClearSkipped = async () => {
    const skippedIds = leads.filter((l) => l.status === "skipped").map((l) => l.id)
    if (skippedIds.length === 0) {
      toast.info("No skipped leads to clear")
      return
    }
    if (
      !confirm(
        `Permanently delete ${skippedIds.length} skipped lead${skippedIds.length === 1 ? "" : "s"}?`
      )
    )
      return

    const supabase = createClient()
    const { error } = await supabase
      .from("ai_generated_leads")
      .delete()
      .in("id", skippedIds)
    if (error) {
      toast.error(error.message)
      return
    }
    setLeads((prev) => prev.filter((l) => l.status !== "skipped"))
    toast.success(`Cleared ${skippedIds.length} skipped lead${skippedIds.length === 1 ? "" : "s"}`)
  }

  const handleExportCsv = () => {
    const headers = [
      "Company",
      "Contact",
      "Phone",
      "Email",
      "LinkedIn",
      "City",
      "Industry",
      "Service Line",
      "Budget",
      "Score",
      "Status",
    ]
    const rows = filtered.map((l) => [
      l.company_name,
      l.contact_name ?? "",
      l.phone ?? "",
      l.email ?? "",
      l.linkedin_url ?? "",
      l.city ?? "",
      l.industry ?? "",
      l.service_line ?? "",
      l.estimated_budget ?? "",
      l.score ?? 0,
      l.status,
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map(escapeCsv).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hagerstone-ai-leads-${format(new Date(), "yyyyMMdd")}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Render ───────────────────────────────────────────────────────
  if (!accessChecked || loading) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
              <Database className="size-5" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
                AI Leads Database
              </h1>
              <p className="text-sm text-[#9090A8]">
                {stats.total.toLocaleString()} contactable lead
                {stats.total === 1 ? "" : "s"} saved
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearSkipped}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#7F1D1D]/40 bg-[#2A1215]/40 px-3 py-2 text-xs font-medium text-[#F87171] transition hover:bg-[#2A1215]/70"
            >
              <Trash2 className="size-3.5" />
              Clear Skipped
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#111118] px-3 py-2 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1A1A24]"
            >
              <Download className="size-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Contactable Leads"
            value={stats.total}
            accent="#3B82F6"
          />
          <StatCard label="Avg Score" value={stats.avgScore} accent="#34D399" />
          <StatCard
            label="Added to Pipeline"
            value={stats.added}
            accent="#A855F7"
          />
          <StatCard
            label="Pending Review"
            value={stats.pending}
            accent="#F59E0B"
          />
        </div>

        {/* Filters */}
        <div className="mb-4 space-y-2 rounded-xl border border-[#2A2A3C] bg-[#111118] p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company or contact..."
              className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | LeadStatus)
              }
              className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-2 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="added">Added</option>
              <option value="skipped">Skipped</option>
              <option value="duplicate">Duplicate</option>
            </select>
            <select
              value={contactFilter}
              onChange={(e) =>
                setContactFilter(
                  e.target.value as "all" | "phone" | "email" | "linkedin"
                )
              }
              className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-2 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
            >
              <option value="all">Any Contact</option>
              <option value="phone">Has Phone</option>
              <option value="email">Has Email</option>
              <option value="linkedin">Has LinkedIn</option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-2 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
            >
              {SERVICE_LINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={scoreFilter}
              onChange={(e) =>
                setScoreFilter(e.target.value as "all" | "hot" | "warm" | "cold")
              }
              className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-2 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
            >
              <option value="all">Any Score</option>
              <option value="hot">Hot 80+</option>
              <option value="warm">Warm 60+</option>
              <option value="cold">Cold</option>
            </select>
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="Filter by city..."
              className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
            />
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "score" | "newest" | "company")
              }
              className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-2 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
            >
              <option value="newest">Newest First</option>
              <option value="score">Highest Score</option>
              <option value="company">Company A–Z</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[#2A2A3C] bg-[#111118]">
          {paginated.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#9090A8]">
              No leads match these filters.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#0A0A0F] text-[11px] uppercase tracking-wider text-[#9090A8]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Company</th>
                  <th className="px-3 py-2 text-left font-medium">Contact</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-center font-medium">LinkedIn</th>
                  <th className="px-3 py-2 text-left font-medium">AI Insight</th>
                  <th className="px-3 py-2 text-left font-medium">Score</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((lead) => {
                  const score = getScoreBadge(lead.score)
                  const status = statusStyles[lead.status]
                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-[#2A2A3C]/60 transition hover:bg-[#1A1A24]/60"
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-[#F0F0FA]">
                          {lead.company_name}
                        </p>
                        {lead.industry && (
                          <p className="text-[11px] text-[#9090A8]">
                            {lead.industry}
                          </p>
                        )}
                        {lead.website && (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#3B82F6] hover:underline"
                          >
                            {lead.website
                              .replace(/^https?:\/\//, "")
                              .replace(/^www\./, "")}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#F0F0FA]">
                        {lead.contact_name ?? (
                          <span className="text-[#5A5A72]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {lead.phone ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-[#10B981]">
                            <Phone size={11} />
                            {lead.phone}
                          </span>
                        ) : (
                          <span className="text-[#5A5A72]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {lead.email ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[#3B82F6]">
                            <Mail size={11} />
                            {lead.email}
                          </span>
                        ) : (
                          <span className="text-[#5A5A72]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {lead.linkedin_url ? (
                          <a
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0A66C2] hover:underline"
                          >
                            <ExternalLink size={13} />
                          </a>
                        ) : (
                          <span className="text-[#5A5A72]">—</span>
                        )}
                      </td>
                      {/* AI Insight — 2-line clamp, full text on hover.
                          Source link tucked underneath when present. */}
                      <td className="px-3 py-3">
                        <div
                          title={lead.ai_insight ?? ""}
                          className="text-[11px] text-[#9090A8]"
                          style={{
                            maxWidth: 220,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            cursor: lead.ai_insight ? "help" : "default",
                          }}
                        >
                          {lead.ai_insight ?? "—"}
                        </div>
                        {lead.source_url && (
                          <a
                            href={lead.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-[10px] text-[#5A5A72] hover:text-[#9090A8] hover:underline"
                          >
                            Source ↗
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: "#1F1F2E", color: "#9090A8" }}
                        >
                          {score}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: status.bg,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <ActionCell
                          lead={lead}
                          pending={pendingId === lead.id}
                          onAdd={() => handleAddToPipeline(lead)}
                          onSkip={() => handleStatusUpdate(lead, "skipped")}
                          onRestore={() => handleStatusUpdate(lead, "new")}
                          onView={() => {
                            if (lead.pipeline_lead_id) {
                              setLeadDrawerId(lead.pipeline_lead_id)
                              router.push("/pipeline")
                            }
                          }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-[#9090A8]">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length} lead{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-[#2A2A3C] bg-[#0F0F15] px-3 py-1 transition hover:bg-[#1A1A24] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-[#2A2A3C] bg-[#0F0F15] px-3 py-1 transition hover:bg-[#1A1A24] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
        {label}
      </p>
      <p
        className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold tabular-nums"
        style={{ color: accent }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function ActionCell({
  lead,
  pending,
  onAdd,
  onSkip,
  onRestore,
  onView,
}: {
  lead: DbLead
  pending: boolean
  onAdd: () => void
  onSkip: () => void
  onRestore: () => void
  onView: () => void
}) {
  const baseBtn =
    "inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium transition"

  if (pending) {
    return <Loader2 className="ml-auto size-4 animate-spin text-[#9090A8]" />
  }

  if (lead.status === "new") {
    return (
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onAdd}
          className={cn(baseBtn, "bg-[#3B82F6] text-white hover:bg-[#2563EB]")}
        >
          + Pipeline
        </button>
        <button
          type="button"
          onClick={onSkip}
          className={cn(
            baseBtn,
            "border border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8] hover:text-[#F87171]"
          )}
        >
          Skip
        </button>
      </div>
    )
  }

  if (lead.status === "added") {
    return (
      <button
        type="button"
        onClick={onView}
        disabled={!lead.pipeline_lead_id}
        className={cn(
          baseBtn,
          "border border-[#2A2A3C] bg-[#1A1A24] text-[#34D399] hover:bg-[#1F1F2E] disabled:opacity-40"
        )}
      >
        View →
      </button>
    )
  }

  if (lead.status === "skipped") {
    return (
      <button
        type="button"
        onClick={onRestore}
        className={cn(
          baseBtn,
          "border border-[#2A2A3C] bg-[#1A1A24] text-[#F0F0FA] hover:bg-[#1F1F2E]"
        )}
      >
        Restore
      </button>
    )
  }

  // duplicate
  return (
    <button
      type="button"
      onClick={onView}
      disabled={!lead.pipeline_lead_id}
      className={cn(
        baseBtn,
        "border border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8] hover:bg-[#1F1F2E] disabled:opacity-40"
      )}
    >
      View Original
    </button>
  )
}
