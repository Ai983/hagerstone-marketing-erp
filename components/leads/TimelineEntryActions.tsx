"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { ArrowRightLeft, Loader2, MoreHorizontal, Pencil, Trash2, X } from "lucide-react"

import { LeadPickerModal } from "@/components/leads/LeadPickerModal"
import type { TimelineInteraction } from "@/lib/hooks/useActivities"

/**
 * ⋯ menu on a hand-logged timeline entry: fix the text, move it to the
 * lead it was meant for, or delete it. The server re-checks who may do
 * this and keeps the old version in the audit log.
 */
export function TimelineEntryActions({ interaction }: { interaction: TimelineInteraction }) {
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [text, setText] = useState(interaction.notes ?? "")
  const [busy, setBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menuOpen])

  const refresh = (leadIds: string[]) => {
    for (const id of leadIds) queryClient.invalidateQueries({ queryKey: ["lead-interactions", id] })
    queryClient.invalidateQueries({ queryKey: ["meetings"] })
    queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
  }

  const call = async (method: "PATCH" | "DELETE", body?: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/interactions/${interaction.id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not save")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save")
      return false
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    if (!text.trim()) return
    if (await call("PATCH", { notes: text })) {
      toast.success("Note updated")
      setEditing(false)
      refresh([interaction.lead_id])
    }
  }

  const remove = async () => {
    setMenuOpen(false)
    if (!window.confirm("Delete this entry? This can't be undone from the ERP.")) return
    if (await call("DELETE")) {
      toast.success("Entry deleted")
      refresh([interaction.lead_id])
    }
  }

  return (
    <>
      <div ref={menuRef} className="relative ml-auto">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Entry options"
          className="flex size-8 items-center justify-center rounded-md text-[#5A5A72] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-8 z-30 w-52 overflow-hidden rounded-lg border border-[#2A2A3C] bg-[#15151D] py-1 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setText(interaction.notes ?? "")
                setEditing(true)
              }}
              className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm text-[#F0F0FA] hover:bg-[#1F1F2E]"
            >
              <Pencil className="size-4 text-[#9090A8]" /> Edit text
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setMoving(true)
              }}
              className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm text-[#F0F0FA] hover:bg-[#1F1F2E]"
            >
              <ArrowRightLeft className="size-4 text-[#9090A8]" /> Move to another lead
            </button>
            <button
              type="button"
              onClick={remove}
              className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm text-[#F87171] hover:bg-[#2A1215]"
            >
              <Trash2 className="size-4" /> Delete
            </button>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {editing ? (
          <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
            <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && setEditing(false)} />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full rounded-t-2xl border border-[#2A2A3C] bg-[#111118] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#F0F0FA]">Edit entry</h2>
                <button type="button" onClick={() => setEditing(false)} disabled={busy} aria-label="Close" className="flex size-10 items-center justify-center rounded-lg text-[#9090A8] hover:bg-[#1A1A24]">
                  <X className="size-5" />
                </button>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                autoFocus
                className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-base leading-relaxed text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm"
              />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setEditing(false)} disabled={busy} className="h-11 flex-1 rounded-lg border border-[#2A2A3C] text-sm text-[#9090A8]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={busy || !text.trim() || text.trim() === (interaction.notes ?? "").trim()}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3B82F6] text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <LeadPickerModal
        open={moving}
        title="Move this entry to which lead?"
        subtitle={(interaction.notes ?? interaction.title ?? "").slice(0, 80)}
        onClose={() => setMoving(false)}
        onPick={async (lead) => {
          setMoving(false)
          if (lead.id === interaction.lead_id) return
          if (!window.confirm(`Move this entry to ${lead.full_name}?`)) return
          if (await call("PATCH", { lead_id: lead.id })) {
            toast.success(`Moved to ${lead.full_name}`)
            refresh([interaction.lead_id, lead.id])
          }
        }}
      />
    </>
  )
}
