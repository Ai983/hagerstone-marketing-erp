"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  Download,
  Loader2,
  MessageSquare,
  Send,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { createClient } from "@/lib/supabase/client"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { useUIStore } from "@/lib/stores/uiStore"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"

// ── Types ──────────────────────────────────────────────────────────

const ALLOWED_ROLES: UserRole[] = ["admin", "manager", "founder", "marketing"]

type EnrollmentStatus = "active" | "completed" | "paused" | "opted_out"

interface StageSummary {
  name: string | null
  color: string | null
  slug: string | null
}

interface EnrolledLead {
  id: string
  full_name: string
  company_name: string | null
  phone: string | null
  closed_at: string | null
  stage: StageSummary | StageSummary[] | null
}

interface EnrollmentRow {
  id: string
  lead_id: string
  status: EnrollmentStatus
  current_message_position: number
  enrolled_at: string
  completed_at: string | null
  lead: EnrolledLead | EnrolledLead[] | null
}

interface MessageRow {
  id: string
  position: number
  delay_days: number
  message_template: string
}

interface CampaignSummary {
  id: string
  name: string
  type: string
  status: string
  created_at: string
  total_replies: number
  total_sent: number
}

interface ReportData {
  campaign: CampaignSummary
  enrollments: EnrollmentRow[]
  messages: MessageRow[]
  lastActivityByLead: Record<string, string>
}

// ── Helpers ────────────────────────────────────────────────────────

function pickStage(
  stage: StageSummary | StageSummary[] | null
): StageSummary | null {
  if (!stage) return null
  return Array.isArray(stage) ? stage[0] ?? null : stage
}

function pickLead(
  lead: EnrolledLead | EnrolledLead[] | null
): EnrolledLead | null {
  if (!lead) return null
  return Array.isArray(lead) ? lead[0] ?? null : lead
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return ""
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

async function fetchReport(id: string): Promise<ReportData> {
  const supabase = createClient()

  const [campaignRes, enrollmentsRes, messagesRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, type, status, created_at, total_replies, total_sent")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("campaign_enrollments")
      .select(
        "id, lead_id, status, current_message_position, enrolled_at, completed_at, lead:lead_id(id, full_name, company_name, phone, closed_at, stage:stage_id(name, color, slug))"
      )
      .eq("campaign_id", id)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("campaign_messages")
      .select("id, position, delay_days, message_template")
      .eq("campaign_id", id)
      .order("position", { ascending: true }),
  ])

  if (campaignRes.error || !campaignRes.data) {
    throw new Error(campaignRes.error?.message ?? "Campaign not found")
  }
  if (enrollmentsRes.error) throw enrollmentsRes.error
  if (messagesRes.error) throw messagesRes.error

  const enrollments = (enrollmentsRes.data ?? []) as EnrollmentRow[]

  // Fetch latest interaction timestamp per enrolled lead
  const leadIds = Array.from(new Set(enrollments.map((e) => e.lead_id)))
  const lastActivityByLead: Record<string, string> = {}

  if (leadIds.length > 0) {
    const { data: interactions } = await supabase
      .from("interactions")
      .select("lead_id, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false })

    for (const row of (interactions ?? []) as Array<{
      lead_id: string
      created_at: string
    }>) {
      if (!lastActivityByLead[row.lead_id]) {
        lastActivityByLead[row.lead_id] = row.created_at
      }
    }
  }

  return {
    campaign: campaignRes.data as CampaignSummary,
    enrollments,
    messages: (messagesRes.data ?? []) as MessageRow[],
    lastActivityByLead,
  }
}

const statusStyles: Record<
  EnrollmentStatus | string,
  { bg: string; color: string; label: string }
> = {
  active: { bg: "#163322", color: "#34D399", label: "Active" },
  completed: { bg: "#1E3A5F", color: "#60A5FA", label: "Completed" },
  paused: { bg: "#3F2A12", color: "#F59E0B", label: "Paused" },
  opted_out: { bg: "#3F161A", color: "#F87171", label: "Opted Out" },
}

// ── Page ───────────────────────────────────────────────────────────

export default function CampaignReportPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id ?? ""
  const setLeadDrawerId = useUIStore((s) => s.setLeadDrawerId)

  const [accessChecked, setAccessChecked] = useState(false)
  const [denied, setDenied] = useState(false)

  // Role gate
  useEffect(() => {
    let mounted = true
    const check = async () => {
      const { user, profile } = await getCachedUserAndProfile()
      if (!mounted) return
      if (!user || !profile) {
        router.replace("/login")
        return
      }
      const role = (profile as { role?: UserRole }).role
      if (!role || !ALLOWED_ROLES.includes(role)) {
        setDenied(true)
        router.replace("/pipeline")
        return
      }
      setAccessChecked(true)
    }
    check()
    return () => {
      mounted = false
    }
  }, [router])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["campaign-report", id],
    queryFn: () => fetchReport(id),
    enabled: Boolean(id) && accessChecked,
  })

  // ── Table UI state ───────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<"all" | EnrollmentStatus>(
    "all"
  )
  const [sortBy, setSortBy] = useState<"enrolled_at" | "progress" | "status">(
    "enrolled_at"
  )
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const totalMessages = data?.messages.length ?? 0

  const enrichedEnrollments = useMemo(() => {
    return (data?.enrollments ?? []).map((e) => {
      const lead = pickLead(e.lead)
      const stage = pickStage(lead?.stage ?? null)
      return {
        ...e,
        _lead: lead,
        _stage: stage,
        _lastActivity: data?.lastActivityByLead[e.lead_id] ?? null,
      }
    })
  }, [data])

  const filteredSorted = useMemo(() => {
    let rows = enrichedEnrollments
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter)
    }
    const dir = sortDir === "asc" ? 1 : -1
    rows = [...rows].sort((a, b) => {
      if (sortBy === "enrolled_at") {
        return (
          (new Date(a.enrolled_at).getTime() -
            new Date(b.enrolled_at).getTime()) *
          dir
        )
      }
      if (sortBy === "progress") {
        return (a.current_message_position - b.current_message_position) * dir
      }
      return a.status.localeCompare(b.status) * dir
    })
    return rows
  }, [enrichedEnrollments, statusFilter, sortBy, sortDir])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredSorted.slice(start, start + PAGE_SIZE)
  }, [filteredSorted, page])

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))

  // Reset to page 1 if filter change pushes us past the end
  useEffect(() => {
    if (page > totalPages) setPage(1)
  }, [page, totalPages])

  // ── KPI calcs ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const enrollments = data?.enrollments ?? []
    const totalEnrolled = enrollments.length
    const messagesSent = enrollments.reduce(
      (sum, e) => sum + (e.current_message_position ?? 0),
      0
    )
    const replies = data?.campaign?.total_replies ?? 0

    // Converted = enrollments marked completed OR lead is in Won stage
    const converted = enrollments.reduce((count, e) => {
      const lead = pickLead(e.lead)
      const stage = pickStage(lead?.stage ?? null)
      if (e.status === "completed" || stage?.slug === "won") return count + 1
      return count
    }, 0)

    return { totalEnrolled, messagesSent, replies, converted }
  }, [data])

  // ── Delivery funnel data ─────────────────────────────────────────
  const funnelData = useMemo(() => {
    // Sent / Delivered proxied from messagesSent — we don't track
    // delivery receipts separately, so they collapse to the same value.
    const sent = kpis.messagesSent
    return [
      { label: "Enrolled", value: kpis.totalEnrolled, color: "#3B82F6" },
      { label: "Sent", value: sent, color: "#A855F7" },
      { label: "Delivered", value: sent, color: "#34D399" },
      { label: "Replied", value: kpis.replies, color: "#F59E0B" },
      { label: "Converted", value: kpis.converted, color: "#10B981" },
    ]
  }, [kpis])

  // ── Status pie data ──────────────────────────────────────────────
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {
      active: 0,
      completed: 0,
      paused: 0,
      opted_out: 0,
    }
    for (const e of data?.enrollments ?? []) counts[e.status] = (counts[e.status] ?? 0) + 1
    return [
      { name: "Active", value: counts.active, color: "#3B82F6" },
      { name: "Completed", value: counts.completed, color: "#34D399" },
      { name: "Paused", value: counts.paused, color: "#F59E0B" },
      { name: "Opted Out", value: counts.opted_out, color: "#F87171" },
    ].filter((d) => d.value > 0)
  }, [data])

  // ── Per-message stats (estimated via current_message_position) ───
  const messageStats = useMemo(() => {
    const enrollments = data?.enrollments ?? []
    return (data?.messages ?? []).map((m) => {
      // Leads whose current_message_position >= this message's position
      // have (at least) received it.
      const sent = enrollments.filter(
        (e) => e.current_message_position >= m.position
      ).length
      return {
        ...m,
        sent,
        delivered: sent, // proxy — no per-message delivery tracking
      }
    })
  }, [data])

  // ── CSV export ───────────────────────────────────────────────────
  const handleExportCsv = () => {
    const campaign = data?.campaign
    if (!campaign) return

    const headers = [
      "Lead Name",
      "Company",
      "Phone",
      "Stage",
      "Enrolled Date",
      "Progress",
      "Status",
      "Last Activity",
    ]
    const rows = enrichedEnrollments.map((e) => [
      e._lead?.full_name ?? "",
      e._lead?.company_name ?? "",
      e._lead?.phone ?? "",
      e._stage?.name ?? "",
      format(new Date(e.enrolled_at), "yyyy-MM-dd"),
      `${e.current_message_position}/${totalMessages}`,
      e.status,
      e._lastActivity
        ? format(new Date(e._lastActivity), "yyyy-MM-dd HH:mm")
        : "",
    ])

    const csv = [headers, ...rows]
      .map((r) => r.map(escapeCsvCell).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const safeName = campaign.name.replace(/[^a-z0-9-_]+/gi, "_")
    a.download = `${safeName}-report-${format(new Date(), "yyyyMMdd")}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Render guards ────────────────────────────────────────────────
  if (denied) {
    return null
  }

  if (!accessChecked || isLoading || !data) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  if (isError) {
    return (
      <main className="flex h-full flex-col items-center justify-center bg-[#0A0A0F] p-6">
        <div className="rounded-xl border border-[#7F1D1D]/50 bg-[#2A1215]/40 p-4 text-sm text-[#F87171]">
          {error instanceof Error ? error.message : "Failed to load report"}
        </div>
        <Link
          href={`/campaigns/${id}`}
          className="mt-4 text-xs text-[#9090A8] underline transition hover:text-[#F0F0FA]"
        >
          Back to campaign
        </Link>
      </main>
    )
  }

  const { campaign } = data

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/campaigns/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#9090A8] transition hover:text-[#F0F0FA]"
        >
          <ArrowLeft className="size-4" />
          Back to campaign
        </Link>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
                {campaign.name}
              </h1>
              <span className="rounded-full bg-[#1A1A24] px-2 py-0.5 text-[11px] font-semibold capitalize text-[#9090A8]">
                {campaign.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#9090A8]">
              {campaign.type.replace(/_/g, " ")} · Created{" "}
              {format(new Date(campaign.created_at), "MMM d, yyyy")}
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#111118] px-3 py-2 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1A1A24]"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
        </div>

        {/* KPI cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Total Enrolled"
            value={kpis.totalEnrolled}
            icon={Users}
            accent="#3B82F6"
            sublabel="Leads in this sequence"
          />
          <KpiCard
            label="Messages Sent"
            value={kpis.messagesSent}
            icon={Send}
            accent="#A855F7"
            sublabel={`Across ${totalMessages || 0} message${totalMessages === 1 ? "" : "s"}`}
          />
          <KpiCard
            label="Replies Received"
            value={kpis.replies}
            icon={MessageSquare}
            accent="#F59E0B"
            sublabel={
              kpis.messagesSent > 0
                ? `${((kpis.replies / kpis.messagesSent) * 100).toFixed(1)}% reply rate`
                : "No sends yet"
            }
          />
          <KpiCard
            label="Converted"
            value={kpis.converted}
            icon={CheckCircle2}
            accent="#10B981"
            sublabel={
              kpis.totalEnrolled > 0
                ? `${((kpis.converted / kpis.totalEnrolled) * 100).toFixed(1)}% conversion`
                : "—"
            }
          />
        </div>

        {/* Funnel + Pie grid */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <BarChart2 className="size-4 text-[#9090A8]" />
              <h2 className="text-sm font-semibold text-[#F0F0FA]">
                Delivery Funnel
              </h2>
            </div>
            <DeliveryFunnel data={funnelData} />
          </div>

          <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
            <h2 className="mb-4 text-sm font-semibold text-[#F0F0FA]">
              Enrollment Status
            </h2>
            <StatusDonut
              data={pieData}
              total={kpis.totalEnrolled}
            />
          </div>
        </div>

        {/* Enrolled leads table */}
        <section className="mb-6 rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#F0F0FA]">
              Enrolled Leads
            </h2>
            <div className="flex items-center gap-1 rounded-lg border border-[#2A2A3C] bg-[#0F0F15] p-1">
              {(["all", "active", "completed", "opted_out"] as const).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatusFilter(s)
                      setPage(1)
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition",
                      statusFilter === s
                        ? "bg-[#1E3A5F] text-[#3B82F6]"
                        : "text-[#9090A8] hover:text-[#F0F0FA]"
                    )}
                  >
                    {s === "opted_out" ? "Opted Out" : s}
                  </button>
                )
              )}
            </div>
          </div>

          {paginated.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#9090A8]">
              No enrollments match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-[#9090A8]">
                  <tr className="border-b border-[#2A2A3C]">
                    <th className="px-3 py-2 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th
                      className="cursor-pointer px-3 py-2 font-medium hover:text-[#F0F0FA]"
                      onClick={() => toggleSort("enrolled_at")}
                    >
                      Enrolled {sortIndicator("enrolled_at", sortBy, sortDir)}
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 font-medium hover:text-[#F0F0FA]"
                      onClick={() => toggleSort("progress")}
                    >
                      Progress {sortIndicator("progress", sortBy, sortDir)}
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 font-medium hover:text-[#F0F0FA]"
                      onClick={() => toggleSort("status")}
                    >
                      Status {sortIndicator("status", sortBy, sortDir)}
                    </th>
                    <th className="px-3 py-2 font-medium">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((e) => {
                    const pct =
                      totalMessages > 0
                        ? Math.min(
                            100,
                            (e.current_message_position / totalMessages) * 100
                          )
                        : 0
                    const style =
                      statusStyles[e.status] ?? statusStyles.active
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-[#2A2A3C]/60 transition hover:bg-[#1A1A24]/60"
                      >
                        <td className="px-3 py-2.5">
                          {e._lead ? (
                            <button
                              type="button"
                              onClick={() => setLeadDrawerId(e._lead!.id)}
                              className="truncate text-left font-medium text-[#F0F0FA] hover:text-[#3B82F6] hover:underline"
                            >
                              {e._lead.full_name}
                            </button>
                          ) : (
                            <span className="text-[#9090A8]">Unknown lead</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[#9090A8]">
                          {e._lead?.company_name ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[#9090A8]">
                          {e._lead?.phone ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {e._stage?.name ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs"
                              style={{ color: e._stage.color ?? "#9090A8" }}
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={{
                                  backgroundColor: e._stage.color ?? "#9090A8",
                                }}
                              />
                              {e._stage.name}
                            </span>
                          ) : (
                            <span className="text-[#9090A8]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-[#9090A8]">
                          {formatDistanceToNow(new Date(e.enrolled_at), {
                            addSuffix: true,
                          })}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#1A1A24]">
                              <div
                                className="h-full rounded-full bg-[#3B82F6]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-[#9090A8]">
                              {e.current_message_position}/{totalMessages || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: style.bg, color: style.color }}
                          >
                            {style.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-[#9090A8]">
                          {e._lastActivity
                            ? formatDistanceToNow(new Date(e._lastActivity), {
                                addSuffix: true,
                              })
                            : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-[#9090A8]">
              <span>
                Page {page} of {totalPages} · {filteredSorted.length} lead
                {filteredSorted.length === 1 ? "" : "s"}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md border border-[#2A2A3C] bg-[#0F0F15] px-3 py-1 transition hover:bg-[#1A1A24] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
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
        </section>

        {/* Message performance */}
        <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#F0F0FA]">
              Message Performance
            </h2>
            <p className="mt-1 text-[11px] text-[#5A5A72]">
              Sent counts estimated from each enrollment&apos;s current
              position. Delivery receipts aren&apos;t tracked per message in
              the current schema.
            </p>
          </div>

          {messageStats.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#9090A8]">
              This campaign has no messages yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-[#9090A8]">
                  <tr className="border-b border-[#2A2A3C]">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Preview</th>
                    <th className="px-3 py-2 font-medium">Delay</th>
                    <th className="px-3 py-2 font-medium">Sent</th>
                    <th className="px-3 py-2 font-medium">Delivered</th>
                    <th className="px-3 py-2 font-medium">Reply Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {messageStats.map((m) => {
                    // Reply rate estimated as campaign's total_replies spread
                    // proportionally across messages by sent volume.
                    const replyRate =
                      m.sent > 0
                        ? ((kpis.replies / Math.max(1, kpis.messagesSent)) *
                            100) // overall — shown the same across rows
                        : 0
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-[#2A2A3C]/60 transition hover:bg-[#1A1A24]/60"
                      >
                        <td className="px-3 py-2.5 font-mono text-xs text-[#9090A8]">
                          {m.position}
                        </td>
                        <td className="max-w-md px-3 py-2.5">
                          <p className="truncate text-xs text-[#F0F0FA]">
                            {m.message_template.slice(0, 60)}
                            {m.message_template.length > 60 ? "…" : ""}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#9090A8]">
                          {m.delay_days}d
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#F0F0FA]">
                          {m.sent}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#F0F0FA]">
                          {m.delivered}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#F0F0FA]">
                          {replyRate.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )

  // ── Local helpers (scoped to component) ──────────────────────────
  function toggleSort(col: "enrolled_at" | "progress" | "status") {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir(col === "enrolled_at" ? "desc" : "asc")
    }
  }
}

function sortIndicator(
  col: string,
  sortBy: string,
  sortDir: "asc" | "desc"
): string {
  if (col !== sortBy) return ""
  return sortDir === "asc" ? "↑" : "↓"
}

// ── KPI card ───────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  sublabel,
}: {
  label: string
  value: number
  icon: typeof Users
  accent: string
  sublabel?: string
}) {
  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
            {label}
          </p>
          <p
            className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold tabular-nums"
            style={{ color: accent }}
          >
            {value.toLocaleString()}
          </p>
          {sublabel && (
            <p className="mt-0.5 text-[11px] text-[#5A5A72]">{sublabel}</p>
          )}
        </div>
        <div
          className="flex size-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  )
}

// ── Delivery funnel (horizontal bars) ──────────────────────────────

function DeliveryFunnel({
  data,
}: {
  data: Array<{ label: string; value: number; color: string }>
}) {
  // Compute step-over-step conversion %
  const withPct = data.map((row, i) => {
    const prev = i > 0 ? data[i - 1].value : null
    const pct = prev && prev > 0 ? Math.round((row.value / prev) * 100) : null
    return { ...row, conversionPct: pct }
  })

  return (
    <div className="space-y-2">
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={withPct}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
          >
            <XAxis type="number" stroke="#5A5A72" fontSize={11} />
            <YAxis
              type="category"
              dataKey="label"
              stroke="#9090A8"
              fontSize={12}
              width={80}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111118",
                border: "1px solid #2A2A3C",
                borderRadius: 8,
                color: "#F0F0FA",
              }}
              labelStyle={{ color: "#9090A8" }}
              cursor={{ fill: "#1A1A24" }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {withPct.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#9090A8]">
        {withPct.slice(1).map((row, i) => (
          <span key={row.label}>
            {data[i].label} → {row.label}:{" "}
            <span className="text-[#F0F0FA]">
              {row.conversionPct != null ? `${row.conversionPct}%` : "—"}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Status donut ───────────────────────────────────────────────────

function StatusDonut({
  data,
  total,
}: {
  data: Array<{ name: string; value: number; color: string }>
  total: number
}) {
  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-[#9090A8]">
        No enrollments yet
      </div>
    )
  }

  return (
    <div>
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#111118",
                border: "1px solid #2A2A3C",
                borderRadius: 8,
                color: "#F0F0FA",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-[#F0F0FA]">{d.name}</span>
            </span>
            <span className="text-[#9090A8]">
              {d.value} · {((d.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
