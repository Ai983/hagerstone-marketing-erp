"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { format } from "date-fns"
import { toast } from "sonner"
import { X, CalendarPlus, Loader2 } from "lucide-react"
import type { Profile } from "@/lib/types"

const followUpTypes = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "site_visit", label: "Site Visit" },
  { value: "meeting", label: "Meeting" },
  { value: "follow_up", label: "Follow Up" },
  { value: "proposal", label: "Proposal" },
  { value: "other", label: "Other" },
] as const

interface ScheduleFollowUpModalProps {
  open: boolean
  leadId: string
  leadName: string
  currentUserId: string | null
  currentUserRole?: string
  teamMembers: Pick<Profile, "id" | "full_name">[]
  onClose: () => void
  onSubmit: (data: {
    type: string
    due_at: string
    notes: string
    assigned_to: string
  }) => Promise<void>
}

export function ScheduleFollowUpModal({
  open,
  leadName,
  currentUserId,
  currentUserRole,
  teamMembers,
  onClose,
  onSubmit,
}: ScheduleFollowUpModalProps) {
  const [type, setType] = useState("call")
  const [dueAt, setDueAt] = useState("")
  const [notes, setNotes] = useState("")
  const [assignedTo, setAssignedTo] = useState(currentUserId ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canAssignOthers =
    currentUserRole === "manager" ||
    currentUserRole === "admin" ||
    currentUserRole === "founder"

  const isValidDate = dueAt !== "" && new Date(dueAt).getTime() > Date.now()
  const canSubmit = isValidDate && assignedTo !== ""

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      await onSubmit({
        type,
        due_at: new Date(dueAt).toISOString(),
        notes: notes.trim(),
        assigned_to: assignedTo,
      })
      const dateLabel = format(new Date(dueAt), "MMM d 'at' h:mm a")
      toast.success(`Follow-up scheduled for ${dateLabel}`)
      resetAndClose()
    } catch {
      toast.error("Failed to schedule follow-up")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetAndClose = () => {
    setType("call")
    setDueAt("")
    setNotes("")
    setAssignedTo(currentUserId ?? "")
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="followup-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={resetAndClose}
          />
          <motion.div
            key="followup-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 z-[61] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#2A2A3C] bg-[#111118] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A3C] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <CalendarPlus className="size-4 text-[#3B82F6]" />
                <h3 className="text-sm font-semibold text-[#F0F0FA]">
                  Schedule Follow-up — {leadName}
                </h3>
              </div>
              <button onClick={resetAndClose} className="rounded-lg p-1 text-[#9090A8] transition hover:text-[#F0F0FA]">
                <X className="size-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <div className="space-y-4">
                {/* Follow-up type */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Follow-up Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                  >
                    {followUpTypes.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date + Time */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                  />
                  {dueAt && !isValidDate && (
                    <p className="mt-1 text-[11px] text-[#F87171]">Must be a future date</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any context for the follow-up..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
                  />
                </div>

                {/* Assigned to */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Assigned To
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    disabled={!canAssignOthers}
                    className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] disabled:opacity-60"
                  >
                    <option value="">Select...</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                        {m.id === currentUserId ? " (you)" : ""}
                      </option>
                    ))}
                  </select>
                  {!canAssignOthers && (
                    <p className="mt-1 text-[11px] text-[#9090A8]">
                      Only managers and admins can assign to others
                    </p>
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
                Schedule
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
