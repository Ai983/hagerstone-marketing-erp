"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { Copy, Loader2, Save, X } from "lucide-react"

import { getCachedUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import type { CompanyDocument } from "@/lib/types"

interface PitchEditorModalProps {
  pitch: CompanyDocument | null
  onClose: () => void
  onSaved: () => void
  canEdit: boolean
}

/** Read, edit and save the company sales pitch — a plain text page. */
export function PitchEditorModal({ pitch, onClose, onSaved, canEdit }: PitchEditorModalProps) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(pitch?.title ?? "")
    setBody(pitch?.body ?? "")
    setSaving(false)
  }, [pitch])

  const changed = Boolean(pitch) && (title !== pitch?.title || body !== pitch?.body)

  const save = async () => {
    if (!pitch || !title.trim() || !body.trim()) return
    setSaving(true)
    const user = await getCachedUser()
    const { error } = await createClient()
      .from("documents")
      .update({ title: title.trim(), body: body.trim(), updated_by: user?.id ?? null })
      .eq("id", pitch.id)
    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }
    toast.success("Pitch saved")
    onSaved()
    onClose()
  }

  const close = () => {
    if (changed && !window.confirm("Close without saving your changes?")) return
    onClose()
  }

  const copy = async () => {
    await navigator.clipboard.writeText(body)
    toast.success("Copied")
  }

  return (
    <AnimatePresence>
      {pitch ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && close()} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="relative flex h-[95dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2A2A3C] bg-[#111118] sm:h-[90dvh] sm:max-w-3xl sm:rounded-2xl"
          >
            <div className="flex items-center gap-2 border-b border-[#2A2A3C] p-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                readOnly={!canEdit}
                className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base font-semibold text-[#F0F0FA] outline-none focus:bg-[#1F1F2E]"
              />
              <button type="button" onClick={close} disabled={saving} aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[#9090A8] hover:bg-[#1A1A24]">
                <X className="size-5" />
              </button>
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              readOnly={!canEdit}
              className="thin-scrollbar flex-1 resize-none bg-[#0D0D14] px-4 py-4 text-base leading-7 text-[#F0F0FA] outline-none sm:px-6 sm:text-[15px]"
            />

            <div className="flex gap-2 border-t border-[#2A2A3C] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={copy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#2A2A3C] px-4 text-sm text-[#F0F0FA]">
                <Copy className="size-4" /> Copy
              </button>
              {canEdit ? (
                <button
                  type="button"
                  onClick={save}
                  disabled={!changed || !title.trim() || !body.trim() || saving}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3B82F6] text-sm font-medium text-white disabled:opacity-40"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {changed ? "Save changes" : "Saved"}
                </button>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
