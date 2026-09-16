"use client"

import type { ButtonHTMLAttributes, CSSProperties, MouseEvent } from "react"
import { useRef, useState } from "react"
import {
  differenceInDays,
  format,
  isPast,
  isToday,
  isTomorrow,
} from "date-fns"
import {
  ArrowRight,
  Briefcase,
  Clock,
  IndianRupee,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react"

import type { KanbanLead } from "@/lib/hooks/useKanban"
import type { PipelineStage } from "@/lib/types"
import { useKanbanStore } from "@/lib/stores/kanbanStore"
import { useUIStore } from "@/lib/stores/uiStore"
import { PriorityBadge, SourceTag } from "@/components/data/DataSetBadge"
import { formatInrShort, leadValue } from "@/components/kanban/lead-value"
import { useDataSets } from "@/lib/hooks/useDataSets"
import { categoryConfig } from "@/lib/utils/lead-category"
import { cn } from "@/lib/utils"

function getInitials(name?: string | null) {
  if (!name) {
    return "U"
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

interface MobileLeadCardProps {
  lead: KanbanLead
  stages: PipelineStage[]
  onMoveStage: (leadId: string, stageId: string) => void
}

export function MobileLeadCard({
  lead,
  stages,
  onMoveStage,
}: MobileLeadCardProps) {
  const {
    setLeadDrawerId,
    setDrawerActiveTab,
    setDrawerOpenLogCall,
  } = useUIStore()
  const { setSelectedLeadId } = useKanbanStore()
  const [showStagePicker, setShowStagePicker] = useState(false)
  const [showCallTip, setShowCallTip] = useState(true)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)
  const currentStage = stages.find((stage) => stage.id === lead.stage_id)

  const openLeadDrawer = (tab: string) => {
    setSelectedLeadId(lead.id)
    setLeadDrawerId(lead.id)
    setDrawerActiveTab(tab)
  }

  const clearCallTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleCallPressStart = () => {
    longPressTriggered.current = false
    clearCallTimer()
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      if (lead.phone) {
        window.location.href = `tel:${lead.phone}`
      }
      setShowCallTip(false)
    }, 500)
  }

  const handleCallPressEnd = () => {
    clearCallTimer()
  }

  const handleCallTap = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    clearCallTimer()
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    setShowCallTip(false)
    setDrawerOpenLogCall(true)
    openLeadDrawer("Overview")
  }

  const categoryClass =
    lead.category === "hot"
      ? "bg-red-500/20 text-red-400"
      : lead.category === "warm"
        ? "bg-amber-500/20 text-amber-400"
        : lead.category === "lukewarm"
          ? "bg-yellow-500/20 text-yellow-400"
          : "bg-blue-500/20 text-blue-400"
  const categoryIcon =
    lead.category === "hot"
      ? "Hot"
      : lead.category === "warm"
        ? "Warm"
        : lead.category === "lukewarm"
          ? "Lukewarm"
          : "Cold"

  return (
    <div
      className="overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118] transition-transform active:scale-[0.99]"
      onClick={() => setLeadDrawerId(lead.id)}
    >
      <div
        className="h-1 w-full"
        style={{ backgroundColor: currentStage?.color }}
      />

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <div className="mr-2 min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-[#F0F0FA]">
              {lead.full_name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5">
              <SourceTag dataSetId={lead.data_set_id} />
              {lead.company_name && lead.company_name !== lead.full_name ? (
                <p className="truncate text-xs text-[#9090A8]">{lead.company_name}</p>
              ) : null}
            </div>
          </div>
          {/* One importance signal: field priority, else category. */}
          {lead.priority ? (
            <PriorityBadge priority={lead.priority} note={lead.priority_note} />
          ) : lead.category ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${categoryClass}`}
            >
              {categoryIcon}
            </span>
          ) : null}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {lead.city && (
            <span className="flex items-center gap-1 text-xs text-[#9090A8]">
              <MapPin size={11} />
              {lead.city}
            </span>
          )}
          {lead.service_line && (
            <span className="flex items-center gap-1 text-xs text-[#9090A8]">
              <Briefcase size={11} />
              {lead.service_line.replace(/_/g, " ")}
            </span>
          )}
          {lead.estimated_budget && (
            <span className="flex items-center gap-1 text-xs text-[#9090A8]">
              <IndianRupee size={11} />
              {lead.estimated_budget}
            </span>
          )}
        </div>

        <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1A1A24] py-2.5 text-xs font-medium text-[#10B981] active:bg-[#10B981]/20"
            onMouseDown={handleCallPressStart}
            onMouseUp={handleCallPressEnd}
            onMouseLeave={handleCallPressEnd}
            onTouchStart={handleCallPressStart}
            onTouchEnd={handleCallPressEnd}
            onClick={handleCallTap}
          >
            <Phone size={13} />
            Call
          </button>

          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1A1A24] py-2.5 text-xs font-medium text-[#25D366] active:bg-[#25D366]/20"
            onClick={(event) => {
              event.stopPropagation()
              openLeadDrawer("WhatsApp")
            }}
          >
            <MessageCircle size={13} />
            WhatsApp
          </button>

          <button
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#3B82F6]/10 py-2.5 text-xs font-medium text-[#3B82F6] active:bg-[#3B82F6]/20"
            onClick={(event) => {
              event.stopPropagation()
              setShowStagePicker((open) => !open)
            }}
          >
            <ArrowRight size={13} />
            Move
          </button>
        </div>

        {showCallTip && (
          <p className="mt-2 text-[10px] text-[#5A5A72]">
            Tip: Long press Call to dial directly
          </p>
        )}

        {showStagePicker && (
          <div
            className="mt-3 flex gap-2 overflow-x-auto"
            onClick={(event) => event.stopPropagation()}
          >
            {stages
              .filter((stage) => stage.id !== lead.stage_id)
              .map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => {
                    setShowStagePicker(false)
                    onMoveStage(lead.id, stage.id)
                  }}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-white"
                  style={{ backgroundColor: stage.color }}
                >
                  {stage.name}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}


function stageAgeClass(days: number) {
  if (days > 7) return "bg-[#3F161A] text-[#F87171]"
  if (days >= 3) return "bg-[#3F2A12] text-[#F59E0B]"
  return "bg-[#1A1A24] text-[#9090A8]"
}

interface LeadCardProps {
  lead: KanbanLead
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>
  className?: string
  style?: CSSProperties
  isDraggingGhost?: boolean
  isOverlay?: boolean
  isRecentlyMoved?: boolean
}

/**
 * Desktop board card. Kept to four short lines so a column shows 6–8
 * leads instead of 2–3: only facts that exist are rendered — no
 * "Location not set" / "Unassigned" / "No follow-up set" placeholders.
 */
export function LeadCard({
  lead,
  buttonProps,
  className,
  style,
  isDraggingGhost = false,
  isOverlay = false,
  isRecentlyMoved = false,
}: LeadCardProps) {
  const { setLeadDrawerId } = useUIStore()
  const { setSelectedLeadId } = useKanbanStore()
  const { byId: dataSetById } = useDataSets()
  const dataSet = lead.data_set_id ? dataSetById.get(lead.data_set_id) : undefined

  // Stage colour only. Overdue used to turn this amber, which clashed with
  // the amber FOUNDER tag; overdue is now the red clock text in the footer.
  const leftAccentColor = lead.stage?.color ?? "#6B7280"
  const shadows = [
    isOverlay ? "0 16px 40px rgba(0, 0, 0, 0.45)" : null,
    isRecentlyMoved ? "0 0 0 1px rgba(34, 197, 94, 0.65)" : null,
  ]
    .filter(Boolean)
    .join(", ")

  const value = leadValue(lead)
  const owner = lead.owner_name || null

  const nextTask = lead.next_task ?? lead.next_follow_up ?? null
  const followUp = (() => {
    if (!nextTask) return null
    const due = new Date(nextTask.due_at)
    if (isPast(due)) return { text: `Overdue ${format(due, "d MMM")}`, className: "text-[#F87171]" }
    if (isToday(due)) return { text: `Today ${format(due, "h:mm a")}`, className: "text-[#F59E0B]" }
    if (isTomorrow(due)) return { text: "Tomorrow", className: "text-[#F59E0B]" }
    return { text: format(due, "d MMM"), className: "text-[#9090A8]" }
  })()

  const boqDaysLeft = lead.boq_deadline != null ? differenceInDays(new Date(lead.boq_deadline), new Date()) : null
  // One importance signal per card: the field priority (P1–P4) when set,
  // otherwise the Hot/Warm category. Score stays in the lead drawer.
  const category = !lead.priority && lead.category && categoryConfig[lead.category] ? categoryConfig[lead.category] : null
  const subtitle = [lead.company_name && lead.company_name !== lead.full_name ? lead.company_name : null, lead.city]
    .filter(Boolean)
    .join(" · ")

  // Imported deals entered their stage in the ERP on import day — Dhruv
  // sir's sheet never recorded when a deal reached its status — so "1d in
  // stage" would be wrong. Show the date the ERP has instead.
  const importedSource = dataSet && dataSet.kind !== "erp_native"
  const stageAgeLabel = importedSource ? `since ${format(new Date(lead.stage_entered_at), "d MMM")}` : `${lead.stage_age_days}d`
  const stageAgeTitle = importedSource
    ? `In this stage in the ERP since ${format(new Date(lead.stage_entered_at), "d MMM yyyy")}. The source didn't record when it first reached this stage.`
    : `${lead.stage_age_days} day${lead.stage_age_days === 1 ? "" : "s"} in this stage`

  return (
    <button
      type="button"
      onClick={() => {
        setSelectedLeadId(lead.id)
        setLeadDrawerId(lead.id)
      }}
      className={cn(
        "group w-full rounded-lg border border-[#2A2A3C] bg-[#15151D] px-2.5 py-2 text-left transition duration-150 hover:border-[#3A3A52] hover:bg-[#1A1A24]",
        isDraggingGhost && "border-dashed opacity-30 hover:bg-[#15151D]",
        isRecentlyMoved && "border-green-500",
        className
      )}
      style={{
        boxShadow: shadows || undefined,
        borderLeftWidth: "3px",
        borderLeftColor: leftAccentColor,
        ...style,
      }}
      {...buttonProps}
    >
      {/* Name + value */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[13px] font-semibold leading-5 text-[#F0F0FA]">{lead.full_name}</p>
        {value > 0 ? (
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#34D399]">{formatInrShort(value)}</span>
        ) : lead.estimated_budget ? (
          <span className="max-w-[40%] shrink-0 truncate text-[11px] text-[#9090A8]" title={lead.estimated_budget}>
            {lead.estimated_budget}
          </span>
        ) : null}
      </div>

      {/* Source tag · company · city */}
      {subtitle || dataSet ? (
        <div className="mt-1 flex items-center gap-1.5">
          <SourceTag dataSetId={lead.data_set_id} />
          {subtitle ? <p className="truncate text-[11px] leading-4 text-[#9090A8]">{subtitle}</p> : null}
        </div>
      ) : null}

      {/* Signals — only the ones that apply */}
      {lead.priority || category || (boqDaysLeft !== null && boqDaysLeft <= 3) ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <PriorityBadge priority={lead.priority} note={lead.priority_note} />
          {category ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: category.bg, color: category.color }}
            >
              {category.label}
            </span>
          ) : null}
          {boqDaysLeft !== null && boqDaysLeft <= 3 ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                background: boqDaysLeft < 0 ? "#7F1D1D" : "#78350F",
                color: boqDaysLeft < 0 ? "#FCA5A5" : "#FCD34D",
              }}
            >
              {boqDaysLeft < 0 ? "BOQ overdue" : `BOQ in ${boqDaysLeft}d`}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Owner · follow-up · age */}
      <div className="mt-1.5 flex items-center gap-1.5 border-t border-[#22222F] pt-1.5">
        {owner ? (
          <>
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] text-[8px] font-semibold text-[#60A5FA]">
              {getInitials(owner)}
            </span>
            <span className="min-w-0 truncate text-[11px] text-[#9090A8]">{owner}</span>
          </>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {followUp ? (
            <span className={cn("inline-flex items-center gap-0.5 text-[10px]", followUp.className)}>
              <Clock size={10} className="shrink-0" />
              {followUp.text}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded px-1 py-px text-[10px] tabular-nums",
              importedSource ? "bg-[#1A1A24] text-[#5A5A72]" : stageAgeClass(lead.stage_age_days)
            )}
            title={stageAgeTitle}
          >
            {stageAgeLabel}
          </span>
        </span>
      </div>
    </button>
  )
}
