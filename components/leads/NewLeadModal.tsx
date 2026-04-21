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

          {/* Centered panel */}
          <motion.div
            key="new-lead-panel"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 61,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "40px 16px",
              overflowY: "auto",
              pointerEvents: "none", // let the backdrop handle outside clicks
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                pointerEvents: "auto",
                width: "100%",
                maxWidth: "680px",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                background: "#111118",
                border: "1px solid #2A2A3C",
                borderRadius: "16px",
                boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "18px 24px",
                  borderBottom: "1px solid #2A2A3C",
                  background: "#0F0F15",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#F0F0FA",
                      fontFamily: "var(--font-heading), inherit",
                    }}
                  >
                    New Lead
                  </h2>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "12px",
                      color: "#9090A8",
                    }}
                  >
                    Capture all the details — the form will auto-check for duplicates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeNewLeadModal}
                  aria-label="Close new lead modal"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "transparent",
                    border: "1px solid #2A2A3C",
                    color: "#9090A8",
                    cursor: "pointer",
                    transition: "background 150ms, color 150ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#1A1A24"
                    e.currentTarget.style.color = "#F0F0FA"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                    e.currentTarget.style.color = "#9090A8"
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body with the existing LeadForm */}
              <div
                className="thin-scrollbar"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px",
                }}
              >
                <LeadForm onSuccess={handleSuccess} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
