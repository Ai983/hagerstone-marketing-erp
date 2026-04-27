"use client"

import { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { GripVertical } from "lucide-react"

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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: {
      type: "lead",
      leadId: lead.id,
      stageId: lead.stage_id,
    },
  })

  const [isPressing, setIsPressing] = useState(false)

  return (
    <div
      ref={setNodeRef}
      onPointerDown={() => setIsPressing(true)}
      onPointerUp={() => setIsPressing(false)}
      onPointerCancel={() => setIsPressing(false)}
      onPointerLeave={() => setIsPressing(false)}
      style={{
        position: "relative",
        // The CARD blocks touch so dnd-kit can take over after the
        // long-press delay. The COLUMN's scrollable container handles
        // vertical scroll via touchAction: 'pan-y' so users can still
        // swipe over cards to scroll the list.
        touchAction: "none",
        opacity: isDragging ? 0 : 1,
        outline:
          isPressing && !isDragging
            ? "2px solid #3B82F6"
            : "2px solid transparent",
        transform:
          isPressing && !isDragging ? "scale(0.97)" : "scale(1)",
        transition: isDragging
          ? "none"
          : "transform 1.5s ease, outline 1.5s ease",
        borderRadius: "8px",
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

      {/* Mobile-only drag-handle hint — pointer-events:none so touches
          fall through to the underlying draggable surface */}
      <div
        className="absolute right-2 top-2 md:hidden"
        style={{ opacity: 0.3, pointerEvents: "none" }}
      >
        <GripVertical size={14} color="#9090A8" />
      </div>
    </div>
  )
}
