"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface FunnelStageRow {
  stage_id: string
  stage_name: string
  stage_color: string
  stage_position: number
  stage_type: string
  lead_count: number
}

async function fetchPipelineOverview(): Promise<FunnelStageRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pipeline_overview")
    .select("*")
    .order("stage_position", { ascending: true })

  if (error) throw error
  return (data ?? []) as FunnelStageRow[]
}

export function FunnelChart() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-funnel"],
    queryFn: fetchPipelineOverview,
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-[#7F1D1D]/50 bg-[#2A1215]/40 p-4 text-sm text-[#F87171]">
        Failed to load pipeline funnel
      </div>
    )
  }

  // Filter to active stages for the funnel (exclude lost/on_hold/reengagement)
  const activeStages = data.filter(
    (s) => s.stage_type === "active" || s.stage_type === "won"
  )

  const maxCount = Math.max(...activeStages.map((s) => s.lead_count), 1)

  return (
    <div className="space-y-2">
      {activeStages.map((stage, idx) => {
        const widthPct = (stage.lead_count / maxCount) * 100
        const nextStage = activeStages[idx + 1]
        const conversionPct =
          nextStage && stage.lead_count > 0
            ? Math.round((nextStage.lead_count / stage.lead_count) * 100)
            : null

        return (
          <div key={stage.stage_id}>
            <div className="flex items-center gap-3">
              {/* Stage label */}
              <div className="w-32 shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.stage_color }}
                  />
                  <span className="truncate text-xs font-medium text-[#F0F0FA]">
                    {stage.stage_name}
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="relative flex-1">
                <div className="h-8 w-full overflow-hidden rounded-md bg-[#0F0F15]">
                  <div
                    className="flex h-full items-center justify-end px-3 text-xs font-semibold text-white transition-all duration-500"
                    style={{
                      width: `${Math.max(widthPct, 4)}%`,
                      backgroundColor: stage.stage_color,
                    }}
                  >
                    {stage.lead_count}
                  </div>
                </div>
              </div>
            </div>

            {/* Conversion indicator between bars */}
            {conversionPct !== null && (
              <div className="ml-32 flex items-center gap-1 py-1 pl-3 text-[11px] text-[#9090A8]">
                <ChevronRight className="size-3" />
                <span>{conversionPct}% conversion</span>
              </div>
            )}
          </div>
        )
      })}

      {activeStages.length === 0 && (
        <div className="py-8 text-center text-sm text-[#9090A8]">
          No pipeline data available
        </div>
      )}
    </div>
  )
}
