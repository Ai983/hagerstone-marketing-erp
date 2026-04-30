"use client"

import { useEffect, useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { GripHorizontal } from "lucide-react"

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
  const { attributes, listeners, setNodeRef, isDragging, transform } =
    useDraggable({
      id: lead.id,
      data: {
        type: "lead",
        leadId: lead.id,
        stageId: lead.stage_id,
      },
    })

  const [isPressing, setIsPressing] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    const updateIsDesktop = () => setIsDesktop(media.matches)
    updateIsDesktop()
    media.addEventListener("change", updateIsDesktop)
    return () => media.removeEventListener("change", updateIsDesktop)
  }, [])

  const desktopDragProps = isDesktop
    ? {
        ...attributes,
        ...listeners,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      onPointerDown={() => {
        if (isDesktop) setIsPressing(true)
      }}
      onPointerUp={() => setIsPressing(false)}
      onPointerCancel={() => setIsPressing(false)}
      onPointerLeave={() => setIsPressing(false)}
      style={{
        position: "relative",
        touchAction: "pan-y pan-x",
        opacity: isDragging ? 0 : 1,
        outline:
          isPressing && !isDragging
            ? "2px solid #3B82F6"
            : "2px solid transparent",
        transform: transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : isPressing && !isDragging
            ? "scale(0.97)"
            : "scale(1)",
        transition: isDragging
          ? "none"
          : "transform 1.5s ease, outline 1.5s ease",
        borderRadius: "8px",
      }}
    >
      <div
        {...listeners}
        {...attributes}
        className="md:hidden"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 0 2px",
          cursor: "grab",
          touchAction: "none",
          marginBottom: 4,
          opacity: 0.4,
        }}
      >
        <GripHorizontal size={16} color="#9090A8" />
      </div>

      <div style={{ touchAction: "pan-y pan-x" }}>
        <LeadCard
          lead={lead}
          buttonProps={desktopDragProps}
          isDraggingGhost={isDragging}
          isRecentlyMoved={isRecentlyMoved}
        />
      </div>
    </div>
  )
}
