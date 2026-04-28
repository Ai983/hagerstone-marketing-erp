"use client"

import type { ButtonHTMLAttributes, CSSProperties } from "react"
import { differenceInDays, formatDistanceToNow } from "date-fns"
import { CalendarClock, Clock3, MapPin } from "lucide-react"

import type { KanbanLead } from "@/lib/hooks/useKanban"
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

  const followUpLabel = lead.next_follow_up
    ? formatDistanceToNow(new Date(lead.next_follow_up.due_at), { addSuffix: true })
    : null
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

      <div className="mt-3 flex items-center justify-between gap-2">
        <div
          className={`flex min-w-0 items-center gap-1.5 text-[12px] ${
            lead.has_overdue_follow_up ? "text-[#F87171]" : "text-[#9090A8]"
          }`}
        >
          {lead.next_follow_up ? (
            <>
              {lead.has_overdue_follow_up ? (
                <Clock3 className="size-3.5 shrink-0" />
              ) : (
                <CalendarClock className="size-3.5 shrink-0" />
              )}
              <span className="truncate">
                {lead.has_overdue_follow_up ? "Overdue " : ""}
                {followUpLabel}
              </span>
            </>
          ) : (
            <span className="italic text-[#9090A8]">No follow-up set</span>
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
