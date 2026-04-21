"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  Phone,
  MessageSquare,
  ArrowRightLeft,
  Pencil,
  Mail,
  MapPin,
  UserPlus,
  Bot,
  Megaphone,
  Clock,
  Send,
  Loader2,
} from "lucide-react"
import type { InteractionType } from "@/lib/types"
import type { TimelineInteraction } from "@/lib/hooks/useActivities"

// ── Icon map ────────────────────────────────────────────────────────

const typeIconMap: Record<string, typeof Phone> = {
  call_outbound: Phone,
  call_inbound: Phone,
  call_missed: Phone,
  whatsapp_sent: MessageSquare,
  whatsapp_received: MessageSquare,
  email_sent: Mail,
  email_received: Mail,
  site_visit: MapPin,
  meeting: MapPin,
  note: Pencil,
  stage_change: ArrowRightLeft,
  assignment_change: UserPlus,
  campaign_enrolled: Megaphone,
  campaign_message_sent: Megaphone,
  campaign_responded: Megaphone,
  lead_created: UserPlus,
  ai_suggestion_generated: Bot,
}

function getIcon(type: InteractionType) {
  return typeIconMap[type] ?? Pencil
}

function getTypeLabel(type: InteractionType): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

// ── Outcome badge ───────────────────────────────────────────────────

const outcomeStyles: Record<string, string> = {
  interested: "bg-[#163322] text-[#34D399]",
  very_interested: "bg-[#163322] text-[#34D399]",
  callback_requested: "bg-[#163322] text-[#34D399]",
  not_interested: "bg-[#3F161A] text-[#F87171]",
  rejected: "bg-[#3F161A] text-[#F87171]",
  no_answer: "bg-[#1A1A24] text-[#9090A8]",
  busy: "bg-[#1A1A24] text-[#9090A8]",
  voicemail: "bg-[#1A1A24] text-[#9090A8]",
  follow_up_needed: "bg-[#3F2A12] text-[#F59E0B]",
  neutral: "bg-[#1A1A24] text-[#9090A8]",
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const style = outcomeStyles[outcome] ?? "bg-[#1A1A24] text-[#9090A8]"
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {outcome
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")}
    </span>
  )
}

// ── Stage change divider ────────────────────────────────────────────

function StagePill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-[#1A1A24]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-[#1A1A24]" />
            <div className="h-3 w-48 animate-pulse rounded bg-[#1A1A24]" />
            <div className="h-2 w-20 animate-pulse rounded bg-[#1A1A24]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────

interface LeadTimelineProps {
  interactions: TimelineInteraction[]
  isLoading: boolean
  onAddNote: (notes: string) => Promise<void>
  isAddingNote: boolean
}

export function LeadTimeline({ interactions, isLoading, onAddNote, isAddingNote }: LeadTimelineProps) {
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState("")

  const handleSubmitNote = async () => {
    const trimmed = noteText.trim()
    if (!trimmed) return
    await onAddNote(trimmed)
    setNoteText("")
    setShowNoteInput(false)
  }

  if (isLoading) return <TimelineSkeleton />

  return (
    <div className="flex h-full flex-col">
      {/* Add Note button / inline form */}
      <div className="border-b border-[#2A2A3C] p-4">
        {showNoteInput ? (
          <div className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a note..."
              className="h-20 w-full resize-none rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitNote}
                disabled={isAddingNote || !noteText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
              >
                {isAddingNote ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Send className="size-3" />
                )}
                Save Note
              </button>
              <button
                onClick={() => {
                  setShowNoteInput(false)
                  setNoteText("")
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-[#9090A8] transition hover:text-[#F0F0FA]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNoteInput(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
          >
            <Pencil className="size-3" />
            Add Note
          </button>
        )}
      </div>

      {/* Timeline entries */}
      <div className="thin-scrollbar flex-1 overflow-y-auto">
        {interactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="mb-3 size-10 text-[#9090A8]" />
            <p className="text-sm font-medium text-[#F0F0FA]">No activity yet</p>
            <p className="mt-1 text-xs text-[#9090A8]">
              Interactions will appear here as they happen.
            </p>
          </div>
        ) : (
          <div className="relative p-4">
            {/* Vertical line */}
            <div className="absolute bottom-0 left-[31px] top-4 w-px bg-[#2A2A3C]" />

            <div className="space-y-0">
              {interactions.map((interaction) => {
                const isStageChange = interaction.type === "stage_change"
                const Icon = getIcon(interaction.type)

                if (isStageChange && interaction.stage_from && interaction.stage_to) {
                  return (
                    <div key={interaction.id} className="relative mb-4 flex items-center gap-3 pl-0">
                      <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-[#2A2A3C] bg-[#1A1A24]">
                        <ArrowRightLeft className="size-3.5 text-[#9090A8]" />
                      </div>
                      <div className="flex flex-1 flex-wrap items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#0F0F15] px-3 py-2">
                        <StagePill
                          name={interaction.stage_from.name}
                          color={interaction.stage_from.color}
                        />
                        <ArrowRightLeft className="size-3 text-[#9090A8]" />
                        <StagePill
                          name={interaction.stage_to.name}
                          color={interaction.stage_to.color}
                        />
                        <span className="ml-auto text-[11px] text-[#9090A8]">
                          {formatDistanceToNow(new Date(interaction.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={interaction.id} className="relative mb-4 flex gap-3 pl-0">
                    <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-[#2A2A3C] bg-[#1A1A24]">
                      <Icon className="size-3.5 text-[#9090A8]" />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#F0F0FA]">
                          {getTypeLabel(interaction.type)}
                        </span>
                        {interaction.outcome && (
                          <OutcomeBadge outcome={interaction.outcome} />
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#9090A8]">
                        <span>
                          {interaction.user?.full_name ??
                            (interaction.is_automated ? "System" : "Unknown")}
                        </span>
                        <span>·</span>
                        <span>
                          {formatDistanceToNow(new Date(interaction.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                        {interaction.duration_minutes != null && interaction.duration_minutes > 0 && (
                          <>
                            <span>·</span>
                            <span>{interaction.duration_minutes}m</span>
                          </>
                        )}
                      </div>
                      {interaction.notes && (
                        <p className="mt-1.5 text-xs leading-relaxed text-[#9090A8]">
                          {interaction.notes}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
