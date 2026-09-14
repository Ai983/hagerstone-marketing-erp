"use client"

import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"

import { useUIStore } from "@/lib/stores/uiStore"
import { LeadForm } from "@/components/leads/LeadForm"

/**
 * Full-screen modal overlay wrapping the same LeadForm that powers
 * /leads/new. Opened from any page via the TopBar "+ New Lead" button
 * (or programmatically via uiStore.openNewLeadModal).
 */
export function NewLeadModal() {
  const { isNewLeadModalOpen, closeNewLeadModal } = useUIStore()
  const queryClient = useQueryClient()

  // Esc key closes the modal
  useEffect(() => {
    if (!isNewLeadModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNewLeadModal()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isNewLeadModalOpen, closeNewLeadModal])

  // Lock body scroll while the modal is open
  useEffect(() => {
    if (!isNewLeadModalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isNewLeadModalOpen])

  const handleSuccess = () => {
    // Refresh every view that could show this lead
    queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    queryClient.invalidateQueries({ queryKey: ["leads"] })
    queryClient.invalidateQueries({ queryKey: ["inbox-leads"] })
    queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] })
    closeNewLeadModal()
  }

  return (
    <AnimatePresence>
      {isNewLeadModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="new-lead-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeNewLeadModal}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 60,
            }}
          />

          {/* Full-screen sheet on phones, centred panel from md up */}
          <motion.div
            key="new-lead-panel"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="pointer-events-none fixed inset-0 z-[61] flex items-stretch justify-center md:items-start md:overflow-y-auto md:px-4 md:py-10"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto flex h-full w-full flex-col overflow-hidden bg-[#111118] md:h-auto md:max-h-[90vh] md:max-w-[680px] md:rounded-2xl md:border md:border-[#2A2A3C] md:shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#2A2A3C] bg-[#0F0F15] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6 md:py-[18px]">
                <div className="min-w-0">
                  <h2 className="m-0 font-[family-name:var(--font-heading)] text-lg font-semibold text-[#F0F0FA]">
                    New Lead
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-[#9090A8]">
                    Capture all the details — the form will auto-check for duplicates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeNewLeadModal}
                  aria-label="Close new lead modal"
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA] md:size-8"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body with the existing LeadForm */}
              <div className="thin-scrollbar flex-1 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6">
                <LeadForm onSuccess={handleSuccess} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
