"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { toast } from "sonner"

import { DroppableColumn } from "@/components/kanban/DroppableColumn"
import { KanbanFilters } from "@/components/kanban/KanbanFilters"
import { LeadCardSkeleton } from "@/components/kanban/LeadCardSkeleton"
import { LeadCard } from "@/components/kanban/LeadCard"
import { StageChangeModal } from "@/components/kanban/StageChangeModal"
import { useKanban } from "@/lib/hooks/useKanban"
import { useKanbanStore } from "@/lib/stores/kanbanStore"
import { useRealtime } from "@/lib/hooks/useRealtime"

function LoadingState() {
  return (
    <div className="thin-scrollbar flex h-full gap-3 overflow-x-auto overflow-y-hidden p-4">
      {Array.from({ length: 3 }).map((_, columnIndex) => (
        <div
          key={columnIndex}
          className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]"
        >
          <div className="border-b border-[#2A2A3C] bg-[#0F0F15] px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-[#1A1A24]" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-[#1A1A24]" />
          </div>
          <div className="space-y-3 p-3">
            {Array.from({ length: 4 }).map((__, cardIndex) => (
              <LeadCardSkeleton key={cardIndex} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function KanbanBoard() {
  const { columns, leads, currentProfile, teamMembers, isLoading, isError, canFilterAssignedTo, updateLeadStage } =
    useKanban()
  const {
    pendingStageChange,
    setPendingStageChange,
    clearPendingStageChange,
    moveLeadToStage,
    revertLeadStage,
  } = useKanbanStore()
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [overStageId, setOverStageId] = useState<string | null>(null)
  const [isSubmittingMove, setIsSubmittingMove] = useState(false)
  const [recentlyMovedLeadId, setRecentlyMovedLeadId] = useState<string | null>(null)
  const [realtimeInsertedId, setRealtimeInsertedId] = useState<string | null>(null)
  const [realtimeFlashedId, setRealtimeFlashedId] = useState<string | null>(null)

  // ── Realtime callbacks ────────────────────────────────────────────
  const onLeadInserted = useCallback((leadId: string) => {
    setRealtimeInsertedId(leadId)
    window.setTimeout(() => setRealtimeInsertedId((c) => (c === leadId ? null : c)), 1200)
  }, [])

  const onLeadUpdated = useCallback((leadId: string) => {
    setRealtimeFlashedId(leadId)
    window.setTimeout(() => setRealtimeFlashedId((c) => (c === leadId ? null : c)), 600)
  }, [])

  const onLeadDeleted = useCallback(() => {
    // Store removal is handled inside useRealtime
  }, [])

  useRealtime({
    onLeadInserted,
    onLeadUpdated,
    onLeadDeleted,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const activeLead = useMemo(
    () => (activeLeadId ? leads.find((lead) => lead.id === activeLeadId) ?? null : null),
    [activeLeadId, leads]
  )

  const pendingLead = useMemo(
    () =>
      pendingStageChange
        ? leads.find((lead) => lead.id === pendingStageChange.leadId) ?? null
        : null,
    [leads, pendingStageChange]
  )

  const pendingFromStage = useMemo(
    () =>
      pendingStageChange
        ? columns.find((column) => column.stage.id === pendingStageChange.fromStageId)?.stage ?? null
        : null,
    [columns, pendingStageChange]
  )

  const pendingToStage = useMemo(
    () =>
      pendingStageChange
        ? columns.find((column) => column.stage.id === pendingStageChange.toStageId)?.stage ?? null
        : null,
    [columns, pendingStageChange]
  )

  useEffect(() => {
    document.body.classList.toggle("kanban-dragging", Boolean(activeLeadId))
    return () => {
      document.body.classList.remove("kanban-dragging")
    }
  }, [activeLeadId])

  const clearDragState = () => {
    setActiveLeadId(null)
    setOverStageId(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLeadId(String(event.active.id))
    setOverStageId(event.active.data.current?.stageId ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverStageId(event.over ? String(event.over.id) : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const leadId = String(event.active.id)
    const fromStageId = event.active.data.current?.stageId as string | undefined
    const toStageId = event.over ? String(event.over.id) : null

    clearDragState()

    if (!fromStageId || !toStageId || fromStageId === toStageId) {
      return
    }

    setPendingStageChange({
      leadId,
      fromStageId,
      toStageId,
    })
  }

  const handleModalCancel = () => {
    clearPendingStageChange()
  }

  const handleModalConfirm = async (values: {
    note?: string
    closureValue?: number
    lossReason?: string
  }) => {
    if (!pendingStageChange || !pendingLead || !pendingToStage) {
      clearPendingStageChange()
      return
    }

    setIsSubmittingMove(true)
    moveLeadToStage(pendingStageChange.leadId, pendingStageChange.toStageId)

    try {
      await updateLeadStage(
        pendingStageChange.leadId,
        pendingStageChange.toStageId,
        values.note,
        values.closureValue,
        values.lossReason
      )

      toast.success(`${pendingLead.full_name} moved to ${pendingToStage.name}`)
      setRecentlyMovedLeadId(pendingStageChange.leadId)
      window.setTimeout(() => {
        setRecentlyMovedLeadId((current) =>
          current === pendingStageChange.leadId ? null : current
        )
      }, 600)
      clearPendingStageChange()
    } catch (error) {
      revertLeadStage(pendingStageChange.leadId, pendingStageChange.fromStageId)
      toast.error(error instanceof Error ? error.message : "Unable to move lead right now.")
    } finally {
      setIsSubmittingMove(false)
    }
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <KanbanFilters
          canFilterAssignedTo={canFilterAssignedTo}
          currentUserId={currentProfile?.id}
          teamMembers={teamMembers}
        />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="rounded-xl border border-[#7F1D1D] bg-[#2A1215] px-4 py-3 text-sm text-[#F87171]">
            Unable to load pipeline data right now. Please refresh and try again.
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <KanbanFilters
          canFilterAssignedTo={canFilterAssignedTo}
          currentUserId={currentProfile?.id}
          teamMembers={teamMembers}
        />
        <LoadingState />
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <KanbanFilters
          canFilterAssignedTo={canFilterAssignedTo}
          currentUserId={currentProfile?.id}
          teamMembers={teamMembers}
        />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-[#F0F0FA]">No leads in pipeline</h2>
            <p className="mt-2 text-sm text-[#9090A8]">
              Add your first lead to start using the Kanban board.
            </p>
            <Link
              href="/leads/new"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB]"
            >
              + Add First Lead
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        <KanbanFilters
          canFilterAssignedTo={canFilterAssignedTo}
          currentUserId={currentProfile?.id}
          teamMembers={teamMembers}
        />
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={clearDragState}
        >
          <div className="thin-scrollbar flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full gap-3 p-4">
              {columns.map((column) => (
                <DroppableColumn
                  key={column.stage.id}
                  column={column}
                  isActiveDropTarget={overStageId === column.stage.id}
                  recentlyMovedLeadId={recentlyMovedLeadId}
                  realtimeInsertedId={realtimeInsertedId}
                  realtimeFlashedId={realtimeFlashedId}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeLead ? (
              <div className="rotate-2 opacity-95">
                <LeadCard lead={activeLead} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <StageChangeModal
        open={Boolean(pendingStageChange && pendingLead && pendingFromStage && pendingToStage)}
        lead={pendingLead}
        fromStage={pendingFromStage}
        toStage={pendingToStage}
        currentUserRole={currentProfile?.role}
        isSubmitting={isSubmittingMove}
        onCancel={handleModalCancel}
        onConfirm={handleModalConfirm}
      />
    </>
  )
}
