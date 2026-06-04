"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNow } from "date-fns"
import {
  Activity,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  SkipForward,
  XCircle,
} from "lucide-react"
import Link from "next/link"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type FilterDate = "today" | "week" | "all"

interface CampaignSendLog {
  id: string
  campaign_id: string | null
  enrollment_id: string | null
  lead_id: string | null
  lead_name: string | null
  phone: string | null
  message_position: number | null
  message_preview: string | null
  status: "sent" | "failed" | "skipped"
  error_message: string | null
  sleep_seconds: number | null
  sent_at: string
  campaign: { id: string; name: string } | { id: string; name: string }[] | null
}

interface Stats {
  sentToday: number
  failedToday: number
  skippedToday: number
  lastRunAt: string | null
}

function getCampaign(row: CampaignSendLog) {
  return Array.isArray(row.campaign) ? row.campaign[0] ?? null : row.campaign
}

function startOfTodayIso() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.toISOString()
}

async function fetchLogs(
  filterCampaign: string,
  filterDate: FilterDate
): Promise<CampaignSendLog[]> {
  const supabase = createClient()
  let query = supabase
    .from("campaign_send_log")
    .select(
      `
      *,
      campaign:campaigns(id, name)
    `
    )
    .order("sent_at", { ascending: false })
    .limit(200)

  if (filterCampaign) {
    query = query.eq("campaign_id", filterCampaign)
  }

  if (filterDate === "today") {
    query = query.gte("sent_at", startOfTodayIso())
  } else if (filterDate === "week") {
    query = query.gte(
      "sent_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CampaignSendLog[]
}

async function fetchStats(): Promise<Stats> {
  const supabase = createClient()
  const today = startOfTodayIso()

  const [sent, failed, skipped, lastRun] = await Promise.all([
    supabase
      .from("campaign_send_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", today),
    supabase
      .from("campaign_send_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("sent_at", today),
    supabase
      .from("campaign_send_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "skipped")
      .gte("sent_at", today),
    supabase
      .from("campaign_send_log")
      .select("sent_at")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const error = sent.error ?? failed.error ?? skipped.error ?? lastRun.error
  if (error) throw error

  return {
    sentToday: sent.count ?? 0,
    failedToday: failed.count ?? 0,
    skippedToday: skipped.count ?? 0,
    lastRunAt: lastRun.data?.sent_at ?? null,
  }
}

async function fetchCampaignOptions() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("campaign_send_log")
    .select(
      `
      campaign_id,
      campaign:campaigns(id, name)
    `
    )
    .not("campaign_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(500)

  if (error) throw error

  const options = new Map<string, string>()
  for (const row of data ?? []) {
    const campaign = Array.isArray(row.campaign)
      ? row.campaign[0] ?? null
      : row.campaign
    if (row.campaign_id && campaign?.name) {
      options.set(row.campaign_id, campaign.name)
    }
  }

  return Array.from(options, ([id, name]) => ({ id, name }))
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string | number
  tone?: "default" | "danger"
}) {
  return (
    <div className="rounded-lg border border-[#2A2A3C] bg-[#111118] p-4">
      <p className="text-[11px] uppercase tracking-wider text-[#9090A8]">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold text-[#F0F0FA]",
          tone === "danger" && "text-[#EF4444]"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function StatusCell({ row }: { row: CampaignSendLog }) {
  if (row.status === "sent") {
    return (
      <div className="flex items-center gap-1">
        <CheckCircle2 className="size-3.5 text-[#10B981]" />
        <span className="text-xs text-[#10B981]">Sent</span>
      </div>
    )
  }

  if (row.status === "failed") {
    return (
      <div>
        <div className="flex items-center gap-1">
          <XCircle className="size-3.5 text-[#EF4444]" />
          <span className="text-xs text-[#EF4444]">Failed</span>
        </div>
        {row.error_message ? (
          <p className="mt-0.5 max-w-[180px] truncate text-[10px] text-[#EF4444]/70">
            {row.error_message.slice(0, 50)}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <SkipForward className="size-3.5 text-[#F59E0B]" />
      <span className="text-xs text-[#F59E0B]">Skipped</span>
    </div>
  )
}

export default function CampaignSendMonitorPage() {
  const queryClient = useQueryClient()
  const [filterCampaign, setFilterCampaign] = useState("")
  const [filterDate, setFilterDate] = useState<FilterDate>("today")

  const { data = [], isLoading } = useQuery({
    queryKey: ["campaign-send-log", filterCampaign, filterDate],
    queryFn: () => fetchLogs(filterCampaign, filterDate),
    refetchInterval: 10000,
  })

  const { data: stats } = useQuery({
    queryKey: ["campaign-send-log-stats"],
    queryFn: fetchStats,
    refetchInterval: 10000,
  })

  const { data: campaignOptions = [] } = useQuery({
    queryKey: ["campaign-send-log-campaigns"],
    queryFn: fetchCampaignOptions,
    refetchInterval: 10000,
  })

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("send-log-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "marketing",
          table: "campaign_send_log",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["campaign-send-log"] })
          queryClient.invalidateQueries({ queryKey: ["campaign-send-log-stats"] })
          queryClient.invalidateQueries({
            queryKey: ["campaign-send-log-campaigns"],
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const todayRows = useMemo(() => {
    const today = new Date(startOfTodayIso()).getTime()
    return data.filter((row) => new Date(row.sent_at).getTime() >= today)
  }, [data])

  const sentToday = todayRows.filter((row) => row.status === "sent").length
  const failedToday = todayRows.filter((row) => row.status === "failed").length
  const skippedToday = todayRows.filter((row) => row.status === "skipped").length
  const totalToday = todayRows.length

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
              <Activity className="size-5" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
                Campaign Send Monitor
              </h1>
              <p className="mt-0.5 text-sm text-[#9090A8]">
                Real-time log of all campaign messages sent
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#14532D]/60 bg-[#052E16]/40 px-3 py-1.5 text-xs font-medium text-[#34D399]">
            <span className="size-2 rounded-full bg-[#10B981] animate-pulse" />
            Auto-refreshing every 10s
          </div>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Sent Today" value={stats?.sentToday ?? 0} />
          <StatCard
            label="Failed Today"
            value={stats?.failedToday ?? 0}
            tone={(stats?.failedToday ?? 0) > 0 ? "danger" : "default"}
          />
          <StatCard label="Skipped Today" value={stats?.skippedToday ?? 0} />
          <StatCard
            label="Last Run"
            value={
              stats?.lastRunAt
                ? formatDistanceToNow(new Date(stats.lastRunAt), {
                    addSuffix: true,
                  })
                : "Never"
            }
          />
        </section>

        {totalToday > 1 ? (
          <section className="mb-4 rounded-lg border border-[#2A2A3C] bg-[#111118] p-3.5">
            <div className="mb-2 flex justify-between gap-3">
              <span className="text-xs text-[#9090A8]">
                Today&apos;s batch progress
              </span>
              <span className="text-xs text-[#F0F0FA]">
                {sentToday} sent / {totalToday} total
              </span>
            </div>
            <div className="h-1.5 rounded bg-[#1F1F2E]">
              <div
                className={cn(
                  "h-1.5 rounded transition-[width] duration-300",
                  failedToday > 0 ? "bg-[#EF4444]" : "bg-[#10B981]"
                )}
                style={{
                  width:
                    totalToday > 0 ? `${(sentToday / totalToday) * 100}%` : "0%",
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-4">
              <span className="text-[11px] text-[#10B981]">{sentToday} sent</span>
              <span className="text-[11px] text-[#EF4444]">
                {failedToday} failed
              </span>
              <span className="text-[11px] text-[#F59E0B]">
                {skippedToday} skipped
              </span>
            </div>
          </section>
        ) : null}

        <section className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={filterCampaign}
            onChange={(event) => setFilterCampaign(event.target.value)}
            className="h-9 rounded-lg border border-[#2A2A3C] bg-[#111118] px-3 text-xs text-[#F0F0FA] outline-none transition focus:border-[#3B82F6]"
          >
            <option value="">All Campaigns</option>
            {campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-lg border border-[#2A2A3C] bg-[#111118]">
            {[
              ["today", "Today"],
              ["week", "This Week"],
              ["all", "All Time"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilterDate(value as FilterDate)}
                className={cn(
                  "h-9 px-3 text-xs font-medium transition",
                  filterDate === value
                    ? "bg-[#1E3A5F] text-[#3B82F6]"
                    : "text-[#9090A8] hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#2A2A3C] bg-[#111118]">
          {isLoading ? (
            <div className="flex h-60 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-[#9090A8]" />
            </div>
          ) : data.length === 0 ? (
            <div className="px-5 py-16 text-center text-[#5A5A72]">
              <MessageSquare className="mx-auto mb-3 size-8" />
              <p className="mb-1.5 text-sm">No messages sent yet</p>
              <p className="m-0 text-xs">
                Run the campaign drip from Admin page to start sending
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2A2A3C] text-[11px] uppercase tracking-wider text-[#9090A8]">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Lead</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Campaign</th>
                    <th className="px-4 py-3 font-medium">Msg #</th>
                    <th className="px-4 py-3 font-medium">Preview</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Sleep</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => {
                    const campaign = getCampaign(row)
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[#2A2A3C]/60 transition hover:bg-[#1A1A24]/60"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="text-xs text-[#F0F0FA]">
                            {format(new Date(row.sent_at), "HH:mm:ss")}
                          </p>
                          <p className="text-[10px] text-[#9090A8]">
                            {formatDistanceToNow(new Date(row.sent_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[13px] font-medium text-[#F0F0FA]">
                            {row.lead_name ?? "Unknown"}
                          </p>
                          <p className="text-[11px] text-[#9090A8]">
                            {row.phone ?? ""}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-[#9090A8]">
                          {row.phone ?? ""}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#F0F0FA]">
                          {campaign?.name ?? "Unknown campaign"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[#1F1F2E] px-2 py-0.5 text-[11px] text-[#9090A8]">
                            #{row.message_position ?? "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="line-clamp-2 max-w-[200px] text-[11px] text-[#9090A8]">
                            {row.message_preview ?? ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusCell row={row} />
                        </td>
                        <td className="px-4 py-3">
                          {(row.sleep_seconds ?? 0) > 0 ? (
                            <div className="flex items-center gap-1">
                              <Clock className="size-3 text-[#5A5A72]" />
                              <span className="text-[11px] text-[#5A5A72]">
                                {row.sleep_seconds}s
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#3A3A52]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {campaign?.id ? (
                            <Link
                              href={`/campaigns/${campaign.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-[#2A2A3C] px-2 py-1 text-[11px] font-medium text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
                            >
                              <ExternalLink className="size-3" />
                              Open
                            </Link>
                          ) : null}
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
}
