"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  startOfWeek,
  startOfMonth,
  subMonths,
  startOfYear,
  startOfDay,
  endOfDay,
  format,
} from "date-fns"
import {
  Users,
  UserPlus,
  Trophy,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { FunnelChart } from "@/components/analytics/FunnelChart"
import { LeadSourceChart } from "@/components/analytics/LeadSourceChart"
import { RepProductivityTable } from "@/components/analytics/RepProductivityTable"
import { StageAgeHeatmap } from "@/components/analytics/StageAgeHeatmap"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"

// ── Date range ──────────────────────────────────────────────────────

type RangeKey = "this_week" | "this_month" | "last_3_months" | "this_year" | "custom"

const rangeLabels: Record<RangeKey, string> = {
  this_week: "This Week",
  this_month: "This Month",
  last_3_months: "Last 3 Months",
  this_year: "This Year",
  custom: "Custom",
}

function getRange(key: RangeKey, customStart: string, customEnd: string): { from: Date; to: Date } {
  const now = new Date()
  switch (key) {
    case "this_week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) }
    case "this_month":
      return { from: startOfMonth(now), to: endOfDay(now) }
    case "last_3_months":
      return { from: startOfDay(subMonths(now, 3)), to: endOfDay(now) }
    case "this_year":
      return { from: startOfYear(now), to: endOfDay(now) }
    case "custom":
      return {
        from: customStart ? startOfDay(new Date(customStart)) : startOfMonth(now),
        to: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now),
      }
  }
}

// ── Fetchers ────────────────────────────────────────────────────────

async function fetchKpis(from: Date, to: Date) {
  const supabase = createClient()

  const [activeLeadsRes, newLeadsRes, wonRes, lostRes, tasksRes] = await Promise.all([
    supabase.from("leads").select("id, stage:stage_id(stage_type)").eq("is_archived", false),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString()),
    supabase
      .from("leads")
      .select("id, closure_value, stage:stage_id(slug)")
      .eq("stage.slug", "won")
      .eq("is_archived", false)
      .gte("closed_at", from.toISOString())
      .lte("closed_at", to.toISOString()),
    supabase
      .from("leads")
      .select("id, closure_reason, stage:stage_id(slug)")
      .eq("stage.slug", "lost")
      .eq("is_archived", false)
      .gte("closed_at", from.toISOString())
      .lte("closed_at", to.toISOString()),
    supabase
      .from("tasks")
      .select("id, completed_at, due_at, is_overdue")
      .gte("due_at", from.toISOString())
      .lte("due_at", to.toISOString()),
  ])

  // Active leads (stage_type = active)
  const activeLeads = (activeLeadsRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return stage?.stage_type === "active"
  }).length

  const newLeads = newLeadsRes.count ?? 0

  const wonLeads = (wonRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return stage?.slug === "won"
  })
  const wonCount = wonLeads.length
  const wonValue = wonLeads.reduce((sum, l) => sum + (l.closure_value ?? 0), 0)

  const lostLeads = (lostRes.data ?? []).filter((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return stage?.slug === "lost"
  })
  const lostCount = lostLeads.length
  const lossReasons = new Map<string, number>()
  for (const lead of lostLeads) {
    const reason = lead.closure_reason || "Unspecified"
    lossReasons.set(reason, (lossReasons.get(reason) ?? 0) + 1)
  }
  const topLossReasons = Array.from(lossReasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // Follow-up compliance: completed on time vs total due in window
  const tasks = tasksRes.data ?? []
  const totalTasksDue = tasks.length
  const completedOnTime = tasks.filter(
    (t) => t.completed_at && new Date(t.completed_at) <= new Date(t.due_at)
  ).length
  const compliance =
    totalTasksDue > 0 ? Math.round((completedOnTime / totalTasksDue) * 100) : null

  return {
    activeLeads,
    newLeads,
    wonCount,
    wonValue,
    lostCount,
    topLossReasons,
    compliance,
  }
}

async function fetchEmailStats() {
  const supabase = createClient()
  const from = startOfMonth(new Date()).toISOString()
  const { data, error } = await supabase
    .from("email_logs")
    .select("id, status, opened_count, clicked_count")
    .gte("created_at", from)

  if (error) throw error

  const logs = data ?? []
  const totalSent = logs.length
  const opened = logs.filter((log) => (log.opened_count ?? 0) > 0 || log.status === "opened" || log.status === "clicked").length
  const clicked = logs.filter((log) => (log.clicked_count ?? 0) > 0 || log.status === "clicked").length
  const bounced = logs.filter((log) => log.status === "bounced").length

  return {
    totalSent,
    openRate: totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0,
    clickRate: totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0,
    bounced,
  }
}

async function fetchCurrentProfile(): Promise<Profile | null> {
  const { user, profile } = await getCachedUserAndProfile()
  if (!user) return null
  return (profile as Profile | null) ?? null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

// ── KPI Card ────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sublabel?: string
  icon: typeof Users
  accent?: string
}

function KpiCard({ label, value, sublabel, icon: Icon, accent = "#3B82F6" }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
            {label}
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
            {value}
          </p>
          {sublabel && <p className="mt-0.5 text-xs text-[#9090A8]">{sublabel}</p>}
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

// ── Section shell ───────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[#2A2A3C] bg-[#111118] p-5",
        className
      )}
    >
      <div className="mb-4">
        <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[#F0F0FA]">
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-[#9090A8]">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

// ── Page ────────────────────────────────────────────────────────────

function MiniEmailMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Users
}) {
  return (
    <div className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3">
      <div className="mb-2 flex items-center gap-2 text-[#9090A8]">
        <Icon className="size-3.5" />
        <span className="text-[11px] font-medium uppercase">{label}</span>
      </div>
      <p className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[#F0F0FA]">
        {value}
      </p>
    </div>
  )
}

export default function AnalyticsPage() {
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [rangeKey, setRangeKey] = useState<RangeKey>("this_month")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const range = useMemo(
    () => getRange(rangeKey, customStart, customEnd),
    [rangeKey, customStart, customEnd]
  )

  const profileQuery = useQuery({
    queryKey: ["analytics-profile"],
    queryFn: fetchCurrentProfile,
  })

  const kpiQuery = useQuery({
    queryKey: ["analytics-kpis", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => fetchKpis(range.from, range.to),
  })

  const emailStatsQuery = useQuery({
    queryKey: ["analytics-email-stats"],
    queryFn: fetchEmailStats,
  })

  const canSeeRepTable =
    profileQuery.data?.role === "manager" ||
    profileQuery.data?.role === "admin" ||
    profileQuery.data?.role === "founder"

  const kpis = kpiQuery.data

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] pb-20 md:p-6 md:pb-6">
      {/* Header + Date Range */}
      <div className="px-4 py-4 md:mb-6 md:flex md:flex-wrap md:items-center md:justify-between md:gap-4 md:px-0 md:py-0">
        <div>
          <h1 className="text-xl font-bold text-[#F0F0FA] md:font-[family-name:var(--font-heading)] md:text-2xl md:font-semibold">
            Analytics
          </h1>
          <p className="mt-0.5 text-sm text-[#9090A8]">
            {format(range.from, "MMM d, yyyy")} — {format(range.to, "MMM d, yyyy")}
          </p>
        </div>

        {isMobile ? (
          <select
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value as RangeKey)}
            className="mt-3 w-full rounded-xl border border-[#2A2A3C] bg-[#1F1F2E] px-4 py-3 text-base text-[#F0F0FA] outline-none"
          >
            {(["this_week", "this_month", "last_3_months", "this_year"] as RangeKey[]).map((key) => (
              <option key={key} value={key}>
                {rangeLabels[key]}
              </option>
            ))}
          </select>
        ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#2A2A3C] bg-[#111118] p-1">
            {(["this_week", "this_month", "last_3_months", "this_year", "custom"] as RangeKey[]).map(
              (key) => (
                <button
                  key={key}
                  onClick={() => setRangeKey(key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition",
                    rangeKey === key
                      ? "bg-[#1E3A5F] text-[#3B82F6]"
                      : "text-[#9090A8] hover:text-[#F0F0FA]"
                  )}
                >
                  {rangeLabels[key]}
                </button>
              )
            )}
          </div>

          {rangeKey === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              />
              <span className="text-[11px] text-[#9090A8]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              />
            </div>
          )}
        </div>
        )}
      </div>

      <div className="mb-6 px-4 md:px-0">
        <SectionCard title="Email Performance" subtitle="This month">
          {emailStatsQuery.isLoading || !emailStatsQuery.data ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-[#9090A8]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniEmailMetric
                label="Total Sent"
                value={emailStatsQuery.data.totalSent.toString()}
                icon={Mail}
              />
              <MiniEmailMetric
                label="Open Rate"
                value={`${emailStatsQuery.data.openRate}%`}
                icon={CheckCircle2}
              />
              <MiniEmailMetric
                label="Click Rate"
                value={`${emailStatsQuery.data.clickRate}%`}
                icon={UserPlus}
              />
              <MiniEmailMetric
                label="Bounced"
                value={emailStatsQuery.data.bounced.toString()}
                icon={XCircle}
              />
            </div>
          )}
        </SectionCard>
      </div>

      {/* 1. KPI Row */}
      <div className="mb-6 grid grid-cols-2 gap-3 px-4 md:grid-cols-4 md:px-0">
        {kpiQuery.isLoading || !kpis ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-[#2A2A3C] bg-[#111118]"
            />
          ))
        ) : (
          <>
            <KpiCard
              label="Active Leads"
              value={kpis.activeLeads.toString()}
              icon={Users}
              accent="#3B82F6"
            />
            <KpiCard
              label="New This Period"
              value={kpis.newLeads.toString()}
              icon={UserPlus}
              accent="#C084FC"
            />
            <KpiCard
              label="Won This Period"
              value={kpis.wonCount.toString()}
              sublabel={kpis.wonValue > 0 ? formatCurrency(kpis.wonValue) : "No closed value"}
              icon={Trophy}
              accent="#34D399"
            />
            <KpiCard
              label="Follow-up Compliance"
              value={kpis.compliance != null ? `${kpis.compliance}%` : "—"}
              sublabel={kpis.compliance != null ? "Tasks on time" : "No tasks due"}
              icon={CheckCircle2}
              accent={kpis.compliance != null && kpis.compliance >= 80 ? "#34D399" : "#F59E0B"}
            />
          </>
        )}
      </div>

      {/* 2. Funnel + 3. Source Volume */}
      <div className="mb-6 grid grid-cols-1 gap-4 px-4 md:px-0 xl:grid-cols-2">
        <SectionCard
          title="Pipeline Funnel"
          subtitle="Lead count per stage with conversion rates"
        >
          <FunnelChart />
        </SectionCard>

        <SectionCard
          title="Lead Volume by Source"
          subtitle="Last 30 days"
        >
          <LeadSourceChart />
        </SectionCard>
      </div>

      {/* 4. Rep Productivity (manager/admin/founder only) */}
      {canSeeRepTable && (
        <div className="mb-6 px-4 md:px-0">
          <SectionCard
            title="Rep Productivity"
            subtitle="Individual performance across the team"
          >
            <RepProductivityTable />
          </SectionCard>
        </div>
      )}

      {/* 5. Stage Age Heatmap */}
      <div className="mb-6 px-4 md:px-0">
        <SectionCard
          title="Stage Age Heatmap"
          subtitle="How long leads have been sitting in each stage"
        >
          <StageAgeHeatmap />
        </SectionCard>
      </div>

      {/* 6. Won vs Lost This Month */}
      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-2 md:gap-4 md:px-0">
        <SectionCard title="Won" subtitle="Deals closed in this period">
          {kpiQuery.isLoading || !kpis ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-[#9090A8]" />
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex size-14 items-center justify-center rounded-xl bg-[#163322] text-[#34D399]">
                <Trophy className="size-6" />
              </div>
              <div>
                <p className="font-[family-name:var(--font-heading)] text-3xl font-semibold text-[#F0F0FA]">
                  {kpis.wonCount}
                </p>
                <p className="text-sm text-[#9090A8]">deals won</p>
                {kpis.wonValue > 0 && (
                  <p className="mt-1 text-sm font-medium text-[#34D399]">
                    {formatCurrency(kpis.wonValue)}
                  </p>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Lost" subtitle="Top reasons this period">
          {kpiQuery.isLoading || !kpis ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-[#9090A8]" />
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#3F161A] text-[#F87171]">
                <XCircle className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-heading)] text-3xl font-semibold text-[#F0F0FA]">
                  {kpis.lostCount}
                </p>
                <p className="text-sm text-[#9090A8]">deals lost</p>
                {kpis.topLossReasons.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {kpis.topLossReasons.map(([reason, count]) => (
                      <li
                        key={reason}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate text-[#F0F0FA]">{reason}</span>
                        <span className="ml-2 shrink-0 rounded-full bg-[#1A1A24] px-2 py-0.5 text-[11px] text-[#9090A8]">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  )
}
