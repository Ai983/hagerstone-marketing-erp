"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

import { LeadCard } from "@/components/kanban/LeadCard"
import type { KanbanLead } from "@/lib/hooks/useKanban"

interface DraggableLeadCardProps {
  lead: KanbanLead
  isRecentlyMoved?: boolean
}

export function DraggableLeadCard({
  lead,
  isRecentlyMoved = false,
}: DraggableLeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: {
      type: "lead",
      leadId: lead.id,
      stageId: lead.stage_id,
    },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: isDragging || !transform ? undefined : CSS.Translate.toString(transform),
        transition: "transform 150ms ease",
      }}
    >
      <LeadCard
        lead={lead}
        buttonProps={{
          ...attributes,
          ...listeners,
        }}
        isDraggingGhost={isDragging}
        isRecentlyMoved={isRecentlyMoved}
      />
    </div>
  )
}
