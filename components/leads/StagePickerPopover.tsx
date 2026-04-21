"use client"

import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Loader2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { PipelineStage } from "@/lib/types"
import { cn } from "@/lib/utils"

async function fetchStages(): Promise<PipelineStage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("position", { ascending: true })
  if (error) throw error
  return (data ?? []) as PipelineStage[]
}

interface StagePickerPopoverProps {
  currentStageId: string | null
  onSelect: (stage: PipelineStage) => void
  onClose: () => void
}

export function StagePickerPopover({
  currentStageId,
  onSelect,
  onClose,
}: StagePickerPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: stages, isLoading } = useQuery({
    queryKey: ["pipeline-stages-picker"],
    queryFn: fetchStages,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-[#2A2A3C] bg-[#111118] shadow-2xl"
    >
      <div className="border-b border-[#2A2A3C] px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
          Move to Stage
        </p>
      </div>

      <div className="thin-scrollbar max-h-72 overflow-y-auto py-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 animate-spin text-[#9090A8]" />
          </div>
        ) : !stages || stages.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#9090A8]">
            No stages configured
          </p>
        ) : (
          stages.map((stage) => {
            const isCurrent = stage.id === currentStageId
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  if (isCurrent) return
                  onSelect(stage)
                }}
                disabled={isCurrent}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#1A1A24]",
                  isCurrent && "cursor-not-allowed opacity-60"
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="flex-1 truncate text-xs font-medium text-[#F0F0FA]">
                  {stage.name}
                </span>
                <span className="shrink-0 text-[10px] capitalize text-[#9090A8]">
                  {stage.stage_type}
                </span>
                {isCurrent && <Check className="size-3.5 text-[#3B82F6]" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
