"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { PipelineStage } from "@/lib/types"
import { cn } from "@/lib/utils"

interface HeatmapLead {
  id: string
  stage_id: string
  stage_entered_at: string
}

const buckets = [
  { label: "0–3d", min: 0, max: 3, slug: "0-3" },
  { label: "3–7d", min: 3, max: 7, slug: "3-7" },
  { label: "7–14d", min: 7, max: 14, slug: "7-14" },
  { label: "14d+", min: 14, max: Infinity, slug: "14+" },
] as const

async function fetchStagesAndLeads() {
  const supabase = createClient()

  const [stagesRes, leadsRes] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("position", { ascending: true }),
    supabase.from("leads").select("id, stage_id, stage_entered_at"),
  ])

  if (stagesRes.error) throw stagesRes.error
  if (leadsRes.error) throw leadsRes.error

  return {
    stages: (stagesRes.data ?? []) as PipelineStage[],
    leads: (leadsRes.data ?? []) as HeatmapLead[],
  }
}

function ageDays(stageEnteredAt: string): number {
  const diffMs = Date.now() - new Date(stageEnteredAt).getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

/** Interpolate color: green → amber → red based on bucket index and intensity */
function getCellColor(bucketIndex: number, count: number, maxCount: number): string {
  if (count === 0) return "#0F0F15"
  const intensity = Math.min(1, 0.3 + (count / Math.max(maxCount, 1)) * 0.7)
  const palette = ["#34D399", "#FBBF24", "#FB923C", "#F87171"]
  const base = palette[bucketIndex]
  // Convert hex to rgba with intensity
  const r = parseInt(base.slice(1, 3), 16)
  const g = parseInt(base.slice(3, 5), 16)
  const b = parseInt(base.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${intensity})`
}

export function StageAgeHeatmap() {
  const router = useRouter()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-stage-age-heatmap"],
    queryFn: fetchStagesAndLeads,
  })

  const grid = useMemo(() => {
    if (!data) return { rows: [], maxCount: 0 }
    const activeStages = data.stages.filter((s) => s.stage_type === "active")

    const rows = activeStages.map((stage) => {
      const stageLeads = data.leads.filter((l) => l.stage_id === stage.id)
      const counts = buckets.map(
        (b) => stageLeads.filter((l) => {
          const age = ageDays(l.stage_entered_at)
          return age >= b.min && age < b.max
        }).length
      )
      return { stage, counts }
    })

    const maxCount = Math.max(1, ...rows.flatMap((r) => r.counts))
    return { rows, maxCount }
  }, [data])

  const handleCellClick = (stageId: string, bucketSlug: string) => {
    const params = new URLSearchParams()
    params.set("stage", stageId)
    params.set("age", bucketSlug)
    router.push(`/leads?${params.toString()}`)
  }

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
        Failed to load heatmap
      </div>
    )
  }

  if (grid.rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#9090A8]">
        No stages or leads available
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-[#9090A8]">
            <th className="w-40 px-2 py-1.5 text-left font-medium">Stage</th>
            {buckets.map((b) => (
              <th key={b.slug} className="px-2 py-1.5 text-center font-medium">
                {b.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map(({ stage, counts }) => (
            <tr key={stage.id}>
              <td className="whitespace-nowrap px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="truncate text-xs font-medium text-[#F0F0FA]">
                    {stage.name}
                  </span>
                </div>
              </td>
              {counts.map((count, idx) => (
                <td key={idx} className="w-20">
                  <button
                    type="button"
                    disabled={count === 0}
                    onClick={() => handleCellClick(stage.id, buckets[idx].slug)}
                    className={cn(
                      "flex h-10 w-full items-center justify-center rounded-md border text-xs font-semibold transition",
                      count > 0
                        ? "cursor-pointer border-[#2A2A3C]/50 text-white hover:scale-105 hover:border-white/40"
                        : "cursor-default border-[#2A2A3C] text-[#9090A8]"
                    )}
                    style={{
                      backgroundColor: getCellColor(idx, count, grid.maxCount),
                    }}
                  >
                    {count}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-[#9090A8]">
        <span>Color intensity reflects lead count.</span>
        <span>·</span>
        <span>Click a cell to view those leads.</span>
      </div>
    </div>
  )
}
