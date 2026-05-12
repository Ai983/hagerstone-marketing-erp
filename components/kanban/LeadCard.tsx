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
import { categoryConfig } from "@/lib/utils/lead-category"
import { cn } from "@/lib/utils"

const sourceStyles = {
  website: "bg-[#1E3A5F] text-[#60A5FA]",
  manual_sales: "bg-[#1A1A24] text-[#9090A8]",
  referral: "bg-[#2E1A47] text-[#C084FC]",
  google_ads: "bg-[#3A2413] text-[#FB923C]",
  whatsapp_inbound: "bg-[#1D3A2A] text-[#34D399]",
  linkedin: "bg-[#1A1A24] text-[#9090A8]",
  justdial: "bg-[#1A1A24] text-[#9090A8]",
  ai_suggested: "bg-[#1A1A24] text-[#9090A8]",
  other: "bg-[#1A1A24] text-[#9090A8]",
} as const

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
            {lead.company_name && (
              <p className="mt-0.5 truncate text-xs text-[#9090A8]">
                {lead.company_name}
              </p>
            )}
          </div>
          {lead.category && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${categoryClass}`}
            >
              {categoryIcon}
            </span>
          )}
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

function getStageAgeStyles(days: number) {
  if (days > 7) {
    return "bg-[#3F161A] text-[#F87171]"
  }
  if (days >= 3) {
    return "bg-[#3F2A12] text-[#F59E0B]"
  }
  return "bg-[#163322] text-[#34D399]"
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

  const leftAccentColor = lead.has_overdue_follow_up ? "#F59E0B" : lead.stage?.color ?? "#6B7280"
  const shadows = [
    lead.stage_age_days > 7 ? "0 0 0 1px rgba(239, 68, 68, 0.25)" : null,
    isOverlay ? "0 16px 40px rgba(0, 0, 0, 0.45)" : null,
    isRecentlyMoved ? "0 0 0 1px rgba(34, 197, 94, 0.65)" : null,
  ]
    .filter(Boolean)
    .join(", ")

  const nextTask = lead.next_task ?? lead.next_follow_up ?? null
  const getFollowUpText = () => {
    if (!nextTask) return null
    const due = new Date(nextTask.due_at)

    if (isPast(due)) {
      return {
        text: `Overdue: ${format(due, "dd MMM")}`,
        color: "#EF4444",
        bg: "#7F1D1D",
      }
    }
    if (isToday(due)) {
      return {
        text: `Today ${format(due, "hh:mm a")}`,
        color: "#F59E0B",
        bg: "#78350F",
      }
    }
    if (isTomorrow(due)) {
      return {
        text: `Tomorrow ${format(due, "hh:mm a")}`,
        color: "#F59E0B",
        bg: "#78350F",
      }
    }
    return {
      text: format(due, "dd MMM, hh:mm a"),
      color: "#9090A8",
      bg: "transparent",
    }
  }
  const followUp = getFollowUpText()
  const daysLeft =
    lead.boq_deadline != null
      ? differenceInDays(new Date(lead.boq_deadline), new Date())
      : null

  return (
    <button
      type="button"
      onClick={() => {
        setSelectedLeadId(lead.id)
        setLeadDrawerId(lead.id)
      }}
      className={cn(
        "w-full rounded-[10px] border border-[#2A2A3C] bg-[#111118] p-3 text-left transition duration-150 hover:scale-[1.01] hover:bg-[#1A1A24]",
        isDraggingGhost && "border-dashed opacity-30 hover:scale-100 hover:bg-[#111118]",
        isRecentlyMoved && "border-green-500",
        className
      )}
      style={{
        boxShadow: shadows || undefined,
        borderLeftWidth: "4px",
        borderLeftColor: leftAccentColor,
        ...style,
      }}
      {...buttonProps}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#F0F0FA]">{lead.full_name}</p>
          <p className="truncate text-[12px] text-[#9090A8]">
            {lead.company_name || "No company"}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
            sourceStyles[lead.source]
          }`}
        >
          {lead.source
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ")}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1 text-[12px] text-[#9090A8]">
        <MapPin className="size-3.5 shrink-0" />
        <span className="truncate">{lead.city || "Location not set"}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-semibold text-[#3B82F6]">
          {getInitials(lead.assignee?.full_name)}
        </div>
        <span className="truncate text-[12px] text-[#9090A8]">
          {lead.assignee?.full_name || "Unassigned"}
        </span>
      </div>

      <div className="mt-3">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${getStageAgeStyles(
            lead.stage_age_days
          )}`}
        >
          {lead.stage_age_days} day{lead.stage_age_days === 1 ? "" : "s"} in stage
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#2A2A3C] pt-2">
        <div className="flex min-w-0 items-center gap-1">
          {followUp ? (
            <>
              <Clock size={10} color={followUp.color} className="shrink-0" />
              <span
                className="truncate text-[10px]"
                style={{
                  color: followUp.color,
                  background: followUp.bg,
                  padding: followUp.bg !== "transparent" ? "1px 6px" : "0",
                  borderRadius: 20,
                }}
              >
                {followUp.text}
              </span>
            </>
          ) : (
            <span className="text-[10px] text-[#3A3A52]">No follow-up set</span>
          )}
        </div>

        {lead.score != null && lead.score > 0 && (
          <div
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: "#1F1F2E",
              color: "#9090A8",
            }}
          >
            {lead.score}
          </div>
        )}
        {lead.category && categoryConfig[lead.category] && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: categoryConfig[lead.category].bg,
              color: categoryConfig[lead.category].color,
            }}
          >
            {categoryConfig[lead.category].label}
          </span>
        )}
        {daysLeft !== null && daysLeft <= 3 && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: daysLeft < 0 ? "#7F1D1D" : "#78350F",
              color: daysLeft < 0 ? "#FCA5A5" : "#FCD34D",
            }}
          >
            {daysLeft < 0 ? "⚠ BOQ overdue" : `⚠ BOQ due in ${daysLeft}d`}
          </span>
        )}
      </div>
    </button>
  )
}
