"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-lg rounded-2xl border border-[#2A2A3C] bg-[#111118] p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <h2 className="text-xl font-semibold text-[#F0F0FA]">{title}</h2>
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
                  className="w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
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
                  className="h-10 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
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
                  className="h-10 w-full rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
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

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-4 text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24]"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || blockedTerminalReopen}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
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
