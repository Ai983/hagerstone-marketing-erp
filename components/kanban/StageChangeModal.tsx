"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"

import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import type { KanbanLead } from "@/lib/hooks/useKanban"
import type { PipelineStage, UserRole } from "@/lib/types"

interface StageChangeModalProps {
  open: boolean
  lead: KanbanLead | null
  fromStage: PipelineStage | null
  toStage: PipelineStage | null
  currentUserRole?: UserRole
  isSubmitting?: boolean
  onCancel: () => void
  onConfirm: (values: {
    note?: string
    closureValue?: number
    lossReason?: string
  }) => Promise<void> | void
}

const lossReasonOptions = [
  "Budget constraints",
  "Chose competitor",
  "No response",
  "Timeline mismatch",
  "Project cancelled",
  "Other",
] as const

function StagePill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `${color}33`, color }}
    >
      {label}
    </span>
  )
}

export function StageChangeModal({
  open,
  lead,
  fromStage,
  toStage,
  currentUserRole,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: StageChangeModalProps) {
  const [note, setNote] = useState("")
  const [closureValue, setClosureValue] = useState("")
  const [lossReason, setLossReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")

  useEffect(() => {
    if (open) {
      setNote("")
      setClosureValue("")
      setLossReason("")
      setError(null)
    }
  }, [open])

  const movingBackwards =
    fromStage && toStage ? fromStage.position > toStage.position : false
  const blockedTerminalReopen = Boolean(
    fromStage &&
      toStage &&
      (fromStage.stage_type === "won" || fromStage.stage_type === "lost") &&
      toStage.stage_type === "active" &&
      currentUserRole !== "manager" &&
      currentUserRole !== "admin"
  )

  const title = useMemo(() => {
    if (!toStage) {
      return "Move Lead"
    }

    return `Move to ${toStage.name}`
  }, [toStage])

  const validate = () => {
    if (blockedTerminalReopen) {
      return "Only managers or admins can move Won or Lost leads back to active stages."
    }

    if (toStage?.requires_note && !note.trim()) {
      return "Please add a note about this move."
    }

    if (toStage?.slug === "won") {
      const numericValue = Number(closureValue)
      if (!closureValue || Number.isNaN(numericValue) || numericValue <= 0) {
        return "Deal value is required when moving a lead to Won."
      }
    }

    if (toStage?.slug === "lost" && !lossReason) {
      return "Please select a reason for loss."
    }

    return null
  }

  const handleConfirm = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)

    await onConfirm({
      note: note.trim() || undefined,
      closureValue: closureValue ? Number(closureValue) : undefined,
      lossReason: lossReason || undefined,
    })
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border-x border-t border-[#2A2A3C] bg-[#111118] md:max-w-lg md:rounded-2xl md:border"
            initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
            exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex justify-center pb-1 pt-3 md:hidden">
              <div className="h-1 w-10 rounded-full bg-[#3A3A52]" />
            </div>

            <div className="px-5 py-4">
              <h2 className="text-base font-bold text-[#F0F0FA] md:text-xl md:font-semibold">
                {title}
              </h2>
              {lead ? (
                <p className="mt-2 text-sm text-[#9090A8]">
                  Confirm the stage change for {lead.full_name}.
                </p>
              ) : null}

            {fromStage && toStage ? (
              <div className="mt-4 flex items-center gap-2">
                <StagePill label={fromStage.name} color={fromStage.color} />
                <span className="text-sm text-[#9090A8]">→</span>
                <StagePill label={toStage.name} color={toStage.color} />
              </div>
            ) : null}

            {movingBackwards ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#7C4A15] bg-[#2A1B0D] p-4 text-sm text-[#F0F0FA]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#F59E0B]" />
                <p>You are moving this lead backwards — this will be logged.</p>
              </div>
            ) : null}

            {blockedTerminalReopen ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#7F1D1D] bg-[#2A1215] p-4 text-sm text-[#F87171]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>Only managers or admins can move Won or Lost leads back to active stages.</p>
              </div>
            ) : null}

            {toStage?.requires_note ? (
              <div className="mt-4">
                <label className="mb-2 block text-xs uppercase tracking-[0.05em] text-[#9090A8]">
                  Add a note about this move (required)
                </label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 py-3 text-base text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 md:text-sm"
                />
              </div>
            ) : null}

            {toStage?.slug === "won" ? (
              <div className="mt-4">
                <label className="mb-2 block text-xs uppercase tracking-[0.05em] text-[#9090A8]">
                  Deal Value (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={closureValue}
                  onChange={(event) => setClosureValue(event.target.value)}
                  className="w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 py-3 text-base text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 md:text-sm"
                />
              </div>
            ) : null}

            {toStage?.slug === "lost" ? (
              <div className="mt-4">
                <label className="mb-2 block text-xs uppercase tracking-[0.05em] text-[#9090A8]">
                  Reason for Loss
                </label>
                <select
                  value={lossReason}
                  onChange={(event) => setLossReason(event.target.value)}
                  className="w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 py-3 text-base text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 md:text-sm"
                >
                  <option value="">Select a reason</option>
                  {lossReasonOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-sm text-[#F87171]">{error}</p> : null}
            </div>

            <div className="sticky bottom-0 flex gap-3 border-t border-[#2A2A3C] bg-[#111118] px-5 py-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-[#2A2A3C] py-3 text-sm font-medium text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || blockedTerminalReopen}
                className="flex-1 rounded-xl bg-[#3B82F6] py-3 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Moving..." : "Confirm Move"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
