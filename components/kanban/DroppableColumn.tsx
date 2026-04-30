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

  return (
    <div
      ref={setNodeRef}
      className="h-full shrink-0"
      style={{
        scrollSnapAlign: "start",
        width: "85vw",
        maxWidth: "280px",
      }}
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
