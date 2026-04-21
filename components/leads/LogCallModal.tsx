"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { X, Phone, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const callTypes = [
  { value: "call_outbound", label: "Outbound" },
  { value: "call_inbound", label: "Inbound" },
  { value: "call_missed", label: "Missed" },
] as const

const outcomes = [
  "interested",
  "not_interested",
  "callback_requested",
  "no_answer",
  "busy",
  "wrong_number",
  "voicemail",
  "other",
] as const

const followUpTypes = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "site_visit", label: "Site Visit" },
  { value: "meeting", label: "Meeting" },
] as const

function outcomeLabel(o: string) {
  return o
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

interface LogCallModalProps {
  open: boolean
  leadId: string
  leadName: string
  /** Rep currently assigned to this lead — used to notify them on hot outcomes. */
  leadAssignedTo?: string | null
  currentUserId: string | null
  onClose: () => void
  onSubmit: (data: {
    type: "call_outbound" | "call_inbound" | "call_missed"
    outcome: string
    notes: string
    duration_minutes: number | null
    follow_up?: { due_at: string; type: string }
  }) => Promise<void>
}

export function LogCallModal({
  open,
  leadId,
  leadName,
  leadAssignedTo,
  currentUserId,
  onClose,
  onSubmit,
}: LogCallModalProps) {
  const [callType, setCallType] = useState<"call_outbound" | "call_inbound" | "call_missed">("call_outbound")
  const [duration, setDuration] = useState("")
  const [outcome, setOutcome] = useState("")
  const [notes, setNotes] = useState("")
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false)
  const [followUpDate, setFollowUpDate] = useState("")
  const [followUpType, setFollowUpType] = useState("call")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requiresNotes = outcome === "interested" || outcome === "callback_requested"

  const canSubmit =
    outcome !== "" &&
    (!requiresNotes || notes.trim() !== "") &&
    (!scheduleFollowUp || followUpDate !== "")

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      const trimmedNotes = notes.trim()
      await onSubmit({
        type: callType,
        outcome,
        notes: trimmedNotes,
        duration_minutes: duration ? parseInt(duration, 10) : null,
        follow_up: scheduleFollowUp && followUpDate
          ? { due_at: new Date(followUpDate).toISOString(), type: followUpType }
          : undefined,
      })

      // Fire-and-forget "hot update" notification for promising outcomes.
      // Never awaited, never throws, never blocks the UI.
      if (
        (outcome === "interested" || outcome === "callback_requested") &&
        leadAssignedTo &&
        leadAssignedTo !== currentUserId
      ) {
        const outcomeLabel = outcome
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
        const bodyBase = `Outcome: ${outcomeLabel}`
        const bodyText = trimmedNotes
          ? `${bodyBase} — ${trimmedNotes.slice(0, 60)}`
          : bodyBase

        createClient()
          .from("notifications")
          .insert({
            user_id: leadAssignedTo,
            type: "new_lead_assigned",
            title: `Hot update: ${leadName}`,
            body: bodyText,
            lead_id: leadId,
          })
          .then(({ error }) => {
            if (error) console.error("hot-outcome notification failed:", error)
          })
      }

      toast.success("Call logged")
      resetAndClose()
    } catch {
      toast.error("Failed to log call")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetAndClose = () => {
    setCallType("call_outbound")
    setDuration("")
    setOutcome("")
    setNotes("")
    setScheduleFollowUp(false)
    setFollowUpDate("")
    setFollowUpType("call")
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="logcall-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={resetAndClose}
          />
          <motion.div
            key="logcall-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 z-[61] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#2A2A3C] bg-[#111118] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A3C] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-[#3B82F6]" />
                <h3 className="text-sm font-semibold text-[#F0F0FA]">Log Call — {leadName}</h3>
              </div>
              <button onClick={resetAndClose} className="rounded-lg p-1 text-[#9090A8] transition hover:text-[#F0F0FA]">
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {/* Call type radio */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Call Type
                  </label>
                  <div className="flex gap-2">
                    {callTypes.map((ct) => (
                      <button
                        key={ct.value}
                        type="button"
                        onClick={() => setCallType(ct.value)}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition",
                          callType === ct.value
                            ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]"
                            : "border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8] hover:text-[#F0F0FA]"
                        )}
                      >
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Duration (minutes, optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
                  />
                </div>

                {/* Outcome */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Outcome *
                  </label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                  >
                    <option value="">Select outcome...</option>
                    {outcomes.map((o) => (
                      <option key={o} value={o}>
                        {outcomeLabel(o)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Notes {requiresNotes && <span className="text-[#F87171]">*</span>}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Call notes..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
                  />
                </div>

                {/* Follow-up checkbox */}
                <div className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={scheduleFollowUp}
                      onChange={(e) => setScheduleFollowUp(e.target.checked)}
                      className="size-4 rounded border-[#2A2A3C] bg-[#1F1F2E] accent-[#3B82F6]"
                    />
                    <span className="text-xs font-medium text-[#F0F0FA]">Schedule follow-up?</span>
                  </label>

                  {scheduleFollowUp && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-[#9090A8]">Date & Time</label>
                        <input
                          type="datetime-local"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-xs text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[#9090A8]">Type</label>
                        <select
                          value={followUpType}
                          onChange={(e) => setFollowUpType(e.target.value)}
                          className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-xs text-[#F0F0FA] outline-none"
                        >
                          {followUpTypes.map((ft) => (
                            <option key={ft.value} value={ft.value}>
                              {ft.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[#2A2A3C] px-5 py-3.5">
              <button
                onClick={resetAndClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-[#9090A8] transition hover:text-[#F0F0FA]"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !canSubmit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="size-3 animate-spin" />}
                Log Call
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
