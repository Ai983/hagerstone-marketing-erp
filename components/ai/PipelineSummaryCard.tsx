"use client"

import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import {
  Activity,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  ChevronRight,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/lib/stores/uiStore"
import { getScoreLabel } from "@/lib/utils/lead-scoring"
import { cn } from "@/lib/utils"

export interface PipelineSummaryData {
  summary: string
  hot_lead_ids: string[]
  stale_alerts: string[]
  top_recommendation: string
  pipeline_health: "good" | "warning" | "critical"
  cached?: boolean
  generated_at?: string
}

interface PipelineSummaryCardProps {
  data: PipelineSummaryData | null
  loading: boolean
  onGenerate: () => void
  onRegenerate?: () => void
}

interface LeadLite {
  id: string
  full_name: string
  company_name: string | null
  score: number | null
}

async function fetchLeadsById(ids: string[]): Promise<LeadLite[]> {
  if (ids.length === 0) return []
  const supabase = createClient()
  const { data } = await supabase
    .from("leads")
    .select("id, full_name, company_name, score")
    .in("id", ids)
  return (data ?? []) as LeadLite[]
}

const healthStyles = {
  good: {
    bg: "bg-[#163322]",
    text: "text-[#34D399]",
    border: "border-[#34D399]/30",
    label: "Healthy",
    icon: TrendingUp,
  },
  warning: {
    bg: "bg-[#3F2A12]",
    text: "text-[#F59E0B]",
    border: "border-[#F59E0B]/30",
    label: "Needs Attention",
    icon: AlertTriangle,
  },
  critical: {
    bg: "bg-[#3F161A]",
    text: "text-[#F87171]",
    border: "border-[#F87171]/30",
    label: "Critical",
    icon: AlertTriangle,
  },
} as const

export function PipelineSummaryCard({
  data,
  loading,
  onGenerate,
  onRegenerate,
}: PipelineSummaryCardProps) {
  const { setLeadDrawerId } = useUIStore()

  const hotLeadsQuery = useQuery({
    queryKey: ["ai-hot-leads", data?.hot_lead_ids ?? []],
    queryFn: () => fetchLeadsById(data?.hot_lead_ids ?? []),
    enabled: Boolean(data?.hot_lead_ids?.length),
  })

  if (!data && !loading) {
    return (
      <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-8 text-center">
        <Activity className="mx-auto mb-3 size-8 text-[#3B82F6]" />
        <h3 className="text-sm font-semibold text-[#F0F0FA]">
          Pipeline Intelligence
        </h3>
        <p className="mt-1 text-xs text-[#9090A8]">
          Get an AI analysis of your pipeline health, stale leads, and
          the single most important action to take today.
        </p>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
        >
          <Sparkles className="size-3" />
          Generate Pipeline Summary
        </button>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[#2A2A3C] bg-[#111118] p-10">
        <Loader2 className="size-5 animate-spin text-[#9090A8]" />
        <span className="ml-2 text-xs text-[#9090A8]">Analyzing pipeline…</span>
      </div>
    )
  }

  if (!data) return null

  const health = healthStyles[data.pipeline_health] ?? healthStyles.warning
  const HealthIcon = health.icon

  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-[#3B82F6]" />
          <h3 className="text-sm font-semibold text-[#F0F0FA]">
            Pipeline Intelligence
          </h3>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              health.bg,
              health.text,
              health.border
            )}
          >
            <HealthIcon className="size-3" />
            {health.label}
          </span>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-[#9090A8] transition hover:text-[#F0F0FA] disabled:opacity-50"
            title="Regenerate (bypass cache)"
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Regenerate
          </button>
        )}
      </div>

      {/* Summary */}
      <p className="text-sm leading-relaxed text-[#F0F0FA]">{data.summary}</p>

      {/* Needs Attention Today */}
      {data.hot_lead_ids?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
            Needs Attention Today
          </p>
          <div className="space-y-1.5">
            {(hotLeadsQuery.data ?? []).map((lead) => {
              const scoreInfo = getScoreLabel(lead.score ?? 0)
              return (
                <button
                  key={lead.id}
                  onClick={() => setLeadDrawerId(lead.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2 text-left transition hover:border-[#3B82F6] hover:bg-[#1F1F2E]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[#F0F0FA]">
                      {lead.full_name}
                    </p>
                    <p className="truncate text-[11px] text-[#9090A8]">
                      {lead.company_name ?? "No company"}
                    </p>
                  </div>
                  {lead.score != null && lead.score > 0 && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: `${scoreInfo.color}20`,
                        color: scoreInfo.color,
                      }}
                    >
                      {lead.score}
                    </span>
                  )}
                  <ChevronRight className="size-3 shrink-0 text-[#9090A8]" />
                </button>
              )
            })}
            {hotLeadsQuery.isLoading && (
              <div className="h-8 animate-pulse rounded-lg bg-[#1A1A24]" />
            )}
          </div>
        </div>
      )}

      {/* Stale alerts */}
      {data.stale_alerts?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
            Stage Alerts
          </p>
          <ul className="space-y-1.5">
            {data.stale_alerts.map((alert, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-[#F0F0FA]"
              >
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-[#F59E0B]" />
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top recommendation */}
      <div className="mt-4 rounded-lg border border-[#F59E0B]/30 bg-[#3F2A12]/40 p-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#F59E0B]">
          <Sparkles className="mr-1 inline size-3" />
          Top Recommendation
        </p>
        <p className="text-sm leading-relaxed text-[#F0F0FA]">
          {data.top_recommendation}
        </p>
      </div>

      {/* Timestamp */}
      {data.generated_at && (
        <p className="mt-3 text-[11px] text-[#9090A8]">
          {data.cached ? "Cached · " : "Generated · "}
          {formatDistanceToNow(new Date(data.generated_at), { addSuffix: true })}
        </p>
      )}
    </div>
  )
}
