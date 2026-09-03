"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { X, Users, Loader2 } from "lucide-react"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { cn } from "@/lib/utils"

/**
 * Meeting kinds. `site_visit` is stored as its own interaction type because
 * the pipeline already treats site visits as a distinct milestone; everything
 * else is stored as `meeting` with the format kept in the title.
 */
const meetingKinds = [
  { value: "in_person", label: "In Person", type: "meeting" },
  { value: "site_visit", label: "Site Visit", type: "site_visit" },
  { value: "video_call", label: "Video Call", type: "meeting" },
  { value: "office_visit", label: "Office Visit", type: "meeting" },
] as const

const outcomes = [
  "positive",
  "needs_follow_up",
  "boq_requested",
  "proposal_requested",
  "negotiating",
  "on_hold",
  "not_interested",
  "other",
] as const

const followUpTypes = [
  { value: "meeting", label: "Meeting" },
  { value: "site_visit", label: "Site Visit" },
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "proposal", label: "Proposal" },
  { value: "follow_up", label: "Follow Up" },
  { value: "other", label: "Other" },
] as const

function humanise(value: string) {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** `datetime-local` wants local time, not UTC — so build it by hand. */
function nowForInput() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export type MeetingSubmission = {
  type: "meeting" | "site_visit"
  title: string
  notes: string
  outcome: string
  duration_minutes: number | null
  location: string | null
  attendees: string | null
  occurred_at: string
  follow_up?: { due_at: string; type: string }
}

interface LogMeetingModalProps {
  open: boolean
  leadName: string
  onClose: () => void
  onSubmit: (data: MeetingSubmission) => Promise<void>
}

export function LogMeetingModal({
  open,
  leadName,
  onClose,
  onSubmit,
}: LogMeetingModalProps) {
  const [kind, setKind] = useState<(typeof meetingKinds)[number]["value"]>("in_person")
  const [occurredAt, setOccurredAt] = useState(nowForInput)
  const [duration, setDuration] = useState("")
  const [location, setLocation] = useState("")
  const [attendees, setAttendees] = useState("")
  const [outcome, setOutcome] = useState("")
  const [notes, setNotes] = useState("")
  const [nextSteps, setNextSteps] = useState("")
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false)
  const [followUpDate, setFollowUpDate] = useState("")
  const [followUpType, setFollowUpType] = useState("meeting")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Notes are the whole point of the record, so they are always required.
  const canSubmit =
    outcome !== "" &&
    notes.trim() !== "" &&
    occurredAt !== "" &&
    (!scheduleFollowUp || followUpDate !== "")

  const reset = () => {
    setKind("in_person")
    setOccurredAt(nowForInput())
    setDuration("")
    setLocation("")
    setAttendees("")
    setOutcome("")
    setNotes("")
    setNextSteps("")
    setScheduleFollowUp(false)
    setFollowUpDate("")
    setFollowUpType("meeting")
  }

  const resetAndClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      const selected = meetingKinds.find((k) => k.value === kind)!
      const body = nextSteps.trim()
        ? `${notes.trim()}\n\nNext steps: ${nextSteps.trim()}`
        : notes.trim()

      await onSubmit({
        type: selected.type,
        title: `${selected.label} — ${leadName}`,
        notes: body,
        outcome,
        duration_minutes: duration ? parseInt(duration, 10) : null,
        location: location.trim() || null,
        attendees: attendees.trim() || null,
        occurred_at: new Date(occurredAt).toISOString(),
        follow_up:
          scheduleFollowUp && followUpDate
            ? { due_at: new Date(followUpDate).toISOString(), type: followUpType }
            : undefined,
      })

      toast.success("Meeting recorded")
      resetAndClose()
    } catch {
      toast.error("Failed to record meeting")
    } finally {
      setIsSubmitting(false)
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-3 text-base text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6] md:text-sm"
  const labelClass =
    "mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="logmeeting-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={resetAndClose}
          />
          {/* Full-screen flex wrapper handles centring. Framer Motion writes
              an inline `transform`, which would override Tailwind's
              -translate-y-1/2 and drop the panel off the bottom of short
              screens, so position must not depend on a transform. */}
          <motion.div
            key="logmeeting-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed inset-0 z-[61] flex items-end justify-center md:items-center md:p-6"
          >
            <motion.div
              initial={isMobile ? { y: "100%" } : { scale: 0.96 }}
              animate={isMobile ? { y: 0 } : { scale: 1 }}
              exit={isMobile ? { y: "100%" } : { scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-auto flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border-x border-t border-[#2A2A3C] bg-[#111118] shadow-2xl md:max-h-[85vh] md:max-w-lg md:rounded-xl md:border"
            >
            <div className="flex shrink-0 justify-center pb-1 pt-3 md:hidden">
              <div className="h-1 w-10 rounded-full bg-[#3A3A52]" />
            </div>

            <div className="flex shrink-0 items-center justify-between border-b border-[#2A2A3C] px-5 pb-3 pt-4">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-[#8B5CF6]" />
                <h3 className="text-sm font-semibold text-[#F0F0FA]">
                  Log Meeting — {leadName}
                </h3>
              </div>
              <button
                onClick={resetAndClose}
                className="rounded-lg p-1 text-[#9090A8] transition hover:text-[#F0F0FA]"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* min-h-0 lets this flex child shrink so it, not the page, scrolls */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label className={labelClass}>Meeting Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {meetingKinds.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKind(k.value)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-sm font-medium transition",
                        kind === k.value
                          ? "border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#8B5CF6]"
                          : "border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8] hover:text-[#F0F0FA]"
                      )}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={labelClass}>When did it happen? *</label>
                  <input
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Duration (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 45"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Client office, Sector 62 Noida"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Who attended?</label>
                <input
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="e.g. Manpreet, Mr. Sharma (Facilities Head)"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>Outcome *</label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select outcome...</option>
                  {outcomes.map((o) => (
                    <option key={o} value={o}>
                      {humanise(o)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  What was discussed? <span className="text-[#F87171]">*</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Requirements, budget discussed, concerns raised, decisions made..."
                  rows={5}
                  className={cn(fieldClass, "resize-none")}
                />
              </div>

              <div>
                <label className={labelClass}>Next steps</label>
                <textarea
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  placeholder="e.g. Send revised BOQ by Friday; client to confirm floor plan"
                  rows={2}
                  className={cn(fieldClass, "resize-none")}
                />
              </div>

              <div className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scheduleFollowUp}
                    onChange={(e) => setScheduleFollowUp(e.target.checked)}
                    className="size-4 rounded border-[#2A2A3C] bg-[#1F1F2E] accent-[#8B5CF6]"
                  />
                  <span className="text-xs font-medium text-[#F0F0FA]">
                    Schedule a follow-up?
                  </span>
                </label>

                {scheduleFollowUp && (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-[#9090A8]">
                        Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-[#9090A8]">Type</label>
                      <select
                        value={followUpType}
                        onChange={(e) => setFollowUpType(e.target.value)}
                        className={fieldClass}
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

            <div className="flex shrink-0 gap-3 border-t border-[#2A2A3C] bg-[#111118] px-5 py-4">
              <button
                onClick={resetAndClose}
                className="flex-1 rounded-xl border border-[#2A2A3C] py-3 text-sm font-medium text-[#9090A8] transition hover:text-[#F0F0FA]"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !canSubmit}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#8B5CF6] py-3 text-sm font-medium text-white transition hover:bg-[#7C3AED] disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="size-3 animate-spin" />}
                Save Meeting
              </button>
            </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
