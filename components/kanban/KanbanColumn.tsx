"use client"

import { AnimatePresence, motion } from "framer-motion"

import type { KanbanBoardColumn, KanbanLead } from "@/lib/hooks/useKanban"
import { DraggableLeadCard } from "@/components/kanban/DraggableLeadCard"
import { formatInrShort, leadValue } from "@/components/kanban/lead-value"
import { cn } from "@/lib/utils"

/**
 * One number per column. The old summary listed raw budget strings
 * ("₹5Cr+, ₹1Cr - ₹2Cr +53 more"), which can't be added up or compared.
 */
function getColumnValue(leads: KanbanLead[]) {
  let total = 0
  let valued = 0
  for (const lead of leads) {
    const v = leadValue(lead)
    if (v > 0) {
      total += v
      valued++
    }
  }
  return { total, valued }
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
  const isEmpty = column.leads.length === 0
  const { total, valued } = getColumnValue(column.leads)

  return (
    <section
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl border transition-colors duration-150",
        isDragOver ? "bg-[#161620]" : "bg-[#111118]/90"
      )}
      style={{ borderColor: isDragOver ? column.stage.color : "#2A2A3C" }}
    >
      <div
        className="border-b border-[#2A2A3C] bg-[#0F0F15] px-3 py-2.5"
        style={{ boxShadow: `inset 0 2px 0 ${column.stage.color}` }}
      >
        <div className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.stage.color }} />
          <h2 className="truncate text-[13px] font-semibold text-[#F0F0FA]">{column.stage.name}</h2>
          <span className="ml-auto shrink-0 rounded-full bg-[#1A1A24] px-2 py-0.5 text-[11px] tabular-nums text-[#9090A8]">
            {column.leads.length}
          </span>
        </div>
        {!isEmpty ? (
          <p className="mt-1 truncate text-[11px] text-[#9090A8]">
            {total > 0 ? (
              <>
                <span className="font-medium text-[#F0F0FA]">{formatInrShort(total)}</span>
                {valued < column.leads.length ? ` · ${column.leads.length - valued} without value` : ""}
              </>
            ) : (
              "No values yet"
            )}
          </p>
        ) : null}
      </div>

      <div
        data-scrollable
        className="thin-scrollbar flex-1 overflow-y-auto p-2"
        style={{
          overflowY: "auto",
          touchAction: "pan-y",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        }}
      >
        {!isEmpty ? (
          <AnimatePresence initial={false} mode="popLayout">
            <div className="space-y-2">
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
                    <DraggableLeadCard lead={lead} isRecentlyMoved={recentlyMovedLeadId === lead.id} />
                  </motion.div>
                )
              })}
            </div>
          </AnimatePresence>
        ) : (
          <div
            className={cn(
              "flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed px-2 text-center text-xs transition-colors",
              isDragOver ? "text-[#F0F0FA]" : "border-[#2A2A3C] text-[#5A5A72]"
            )}
            style={isDragOver ? { borderColor: column.stage.color } : undefined}
          >
            {isDragOver ? "Drop here" : "No leads"}
          </div>
        )}
      </div>
    </section>
  )
}
