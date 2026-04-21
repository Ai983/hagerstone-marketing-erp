"use client"

import { AnimatePresence, motion } from "framer-motion"

import type { KanbanBoardColumn, KanbanLead } from "@/lib/hooks/useKanban"
import { DraggableLeadCard } from "@/components/kanban/DraggableLeadCard"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

function getPipelineValueSummary(leads: KanbanLead[]) {
  const numericTotal = leads.reduce((sum, lead) => sum + (lead.closure_value ?? 0), 0)
  const estimatedBudgets = leads
    .filter((lead) => !lead.closure_value && lead.estimated_budget)
    .map((lead) => lead.estimated_budget as string)

  const parts: string[] = []

  if (numericTotal > 0) {
    parts.push(formatCurrency(numericTotal))
  }

  if (estimatedBudgets.length > 0) {
    const visible = estimatedBudgets.slice(0, 2).join(", ")
    const moreCount = estimatedBudgets.length - 2
    parts.push(moreCount > 0 ? `${visible} +${moreCount} more` : visible)
  }

  return parts.length > 0 ? parts.join(" + ") : "No value set"
}

interface KanbanColumnProps {
  column: KanbanBoardColumn
  isDragOver?: boolean
  recentlyMovedLeadId?: string | null
  realtimeInsertedId?: string | null
  realtimeFlashedId?: string | null
}

export function KanbanColumn({
  column,
  isDragOver = false,
  recentlyMovedLeadId = null,
  realtimeInsertedId = null,
  realtimeFlashedId = null,
}: KanbanColumnProps) {
  return (
    <section
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border bg-[#111118] transition-colors duration-150",
        isDragOver ? "bg-[#161620]" : "bg-[#111118]"
      )}
      style={{
        borderColor: isDragOver ? column.stage.color : "#2A2A3C",
      }}
    >
      <div className="border-b border-[#2A2A3C] bg-[#0F0F15] px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: column.stage.color }}
          />
          <h2 className="truncate text-sm font-medium text-[#F0F0FA]">{column.stage.name}</h2>
          <span className="ml-auto rounded-full bg-[#1A1A24] px-2 py-0.5 text-[11px] text-[#9090A8]">
            {column.leads.length}
          </span>
        </div>
        <p className="mt-2 truncate text-xs text-[#9090A8]">
          {getPipelineValueSummary(column.leads)}
        </p>
      </div>

      <div className="thin-scrollbar flex-1 overflow-y-auto p-3">
        {column.leads.length > 0 ? (
          <AnimatePresence initial={false} mode="popLayout">
            <div className="space-y-3">
              {column.leads.map((lead) => {
                const isNewInsert = realtimeInsertedId === lead.id
                const isFlashed = realtimeFlashedId === lead.id

                return (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={isNewInsert ? { opacity: 0, y: -40, scale: 0.95 } : false}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      boxShadow: isFlashed
                        ? "0 0 0 2px rgba(34, 197, 94, 0.7)"
                        : "0 0 0 0px rgba(34, 197, 94, 0)",
                    }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    transition={{
                      layout: { duration: 0.3, ease: "easeOut" },
                      opacity: { duration: 0.25 },
                      y: { duration: 0.3, ease: "easeOut" },
                      scale: { duration: 0.2 },
                      boxShadow: { duration: 0.3 },
                    }}
                    style={{ borderRadius: 10 }}
                  >
                    <DraggableLeadCard
                      lead={lead}
                      isRecentlyMoved={recentlyMovedLeadId === lead.id}
                    />
                  </motion.div>
                )
              })}
            </div>
          </AnimatePresence>
        ) : (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[#2A2A3C] text-sm text-[#9090A8]">
            No leads
          </div>
        )}
      </div>
    </section>
  )
}
