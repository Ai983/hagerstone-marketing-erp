"use client"

import { useDroppable } from "@dnd-kit/core"

import { KanbanColumn } from "@/components/kanban/KanbanColumn"
import type { KanbanBoardColumn } from "@/lib/hooks/useKanban"

interface DroppableColumnProps {
  column: KanbanBoardColumn
  isActiveDropTarget?: boolean
  recentlyMovedLeadId?: string | null
  realtimeInsertedId?: string | null
  realtimeFlashedId?: string | null
}

export function DroppableColumn({
  column,
  isActiveDropTarget = false,
  recentlyMovedLeadId = null,
  realtimeInsertedId = null,
  realtimeFlashedId = null,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.stage.id,
    data: {
      type: "stage",
      stageId: column.stage.id,
    },
  })

  // Stages with leads share the free width (so a wide screen shows more
  // of every column instead of empty space on the right); empty stages
  // collapse to a narrow drop strip so they don't cost a full column.
  const isEmpty = column.leads.length === 0

  return (
    <div
      ref={setNodeRef}
      className="h-full"
      style={
        isEmpty
          ? { flex: "0 0 168px" }
          : { flex: "1 0 264px", maxWidth: "380px" }
      }
    >
      <KanbanColumn
        column={column}
        isDragOver={isOver || isActiveDropTarget}
        recentlyMovedLeadId={recentlyMovedLeadId}
        realtimeInsertedId={realtimeInsertedId}
        realtimeFlashedId={realtimeFlashedId}
      />
    </div>
  )
}
