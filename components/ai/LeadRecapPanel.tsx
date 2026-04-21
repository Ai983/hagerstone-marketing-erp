"use client"

import { formatDistanceToNow } from "date-fns"
import { RefreshCw, Loader2, Sparkles, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LeadRecapData {
  summary: string
  sentiment: "hot" | "warm" | "cold" | "dead"
  next_action: string
  message_angle: string
  cached?: boolean
  generated_at?: string
}

const sentimentStyles: Record<LeadRecapData["sentiment"], { bg: string; text: string; label: string }> = {
  hot: { bg: "bg-[#3F161A]", text: "text-[#F87171]", label: "Hot" },
  warm: { bg: "bg-[#3F2A12]", text: "text-[#F59E0B]", label: "Warm" },
  cold: { bg: "bg-[#1E3A5F]", text: "text-[#60A5FA]", label: "Cold" },
  dead: { bg: "bg-[#1A1A24]", text: "text-[#9090A8]", label: "Dead" },
}

interface LeadRecapPanelProps {
  recap: LeadRecapData | null
  loading: boolean
  onGenerate: () => void
  onRegenerate?: () => void
  score?: number | null
}

export function LeadRecapPanel({
  recap,
  loading,
  onGenerate,
  onRegenerate,
  score,
}: LeadRecapPanelProps) {
  if (!recap && !loading) {
    return (
      <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-6 text-center">
        <Sparkles className="mx-auto mb-2 size-6 text-[#F59E0B]" />
        <p className="text-sm text-[#F0F0FA]">
          Generate an AI-powered recap for this lead.
        </p>
        <p className="mt-1 text-xs text-[#9090A8]">
          Summary, sentiment, and next best action from the interaction history.
        </p>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
        >
          <Sparkles className="size-3" />
          Generate Recap
        </button>
      </div>
    )
  }

  if (loading && !recap) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[#2A2A3C] bg-[#111118] p-8">
        <Loader2 className="size-5 animate-spin text-[#9090A8]" />
        <span className="ml-2 text-xs text-[#9090A8]">
          Reading interaction history…
        </span>
      </div>
    )
  }

  if (!recap) return null

  const sentimentStyle = sentimentStyles[recap.sentiment] ?? sentimentStyles.cold

  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[#F59E0B]" />
          <h4 className="text-sm font-semibold text-[#F0F0FA]">Lead Recap</h4>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
              sentimentStyle.bg,
              sentimentStyle.text
            )}
          >
            {sentimentStyle.label}
          </span>
          {score != null && score > 0 && (
            <span className="inline-flex rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-semibold text-[#3B82F6]">
              Score {score}
            </span>
          )}
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
      <p className="text-sm leading-relaxed text-[#F0F0FA]">{recap.summary}</p>

      {/* Next action */}
      <div className="mt-4 rounded-lg border border-[#3B82F6]/30 bg-[#1E3A5F]/40 p-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#3B82F6]">
          <ArrowRight className="mr-1 inline size-3" />
          Next Action
        </p>
        <p className="text-sm text-[#F0F0FA]">{recap.next_action}</p>
      </div>

      {/* Message angle */}
      <div className="mt-2 rounded-lg border border-[#2A2A3C] bg-[#0F0F15] p-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
          WhatsApp Angle
        </p>
        <p className="text-xs leading-relaxed text-[#9090A8]">{recap.message_angle}</p>
      </div>

      {/* Cache indicator */}
      {recap.generated_at && (
        <p className="mt-3 text-[11px] text-[#9090A8]">
          {recap.cached ? "Cached · " : "Generated · "}
          {formatDistanceToNow(new Date(recap.generated_at), { addSuffix: true })}
        </p>
      )}
    </div>
  )
}
