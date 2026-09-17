"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { Link2, Loader2, X } from "lucide-react"

import { getCachedUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import type { CompanyDocument, DocumentCategory } from "@/lib/types"
import { cn } from "@/lib/utils"

import { CATEGORY_LABELS, CATEGORY_ORDER, SERVICE_LINE_LABELS } from "./document-meta"

interface AddLinkModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Edit an existing link instead of adding one. */
  editing?: CompanyDocument | null
}

/**
 * Adds a Google Drive (or any) link to the library — e.g. the Drive folder
 * that holds every company profile — so nobody has to upload each file.
 */
export function AddLinkModal({ open, onClose, onSaved, editing }: AddLinkModalProps) {
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<DocumentCategory>("company_profile")
  const [serviceLine, setServiceLine] = useState("all")
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setUrl(editing?.link_url ?? "")
    setTitle(editing?.title ?? "")
    setDescription(editing?.description ?? "")
    setCategory(editing?.category ?? "company_profile")
    setServiceLine(editing?.service_line ?? "all")
    setPinned(editing?.is_pinned ?? false)
    setSaving(false)
  }, [open, editing])

  const validUrl = /^https?:\/\/\S+$/i.test(url.trim())

  const save = async () => {
    if (!validUrl || !title.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const user = await getCachedUser()
      const row = {
        kind: "link",
        link_url: url.trim(),
        title: title.trim(),
        description: description.trim() || null,
        category,
        service_line: serviceLine,
        is_pinned: pinned,
        updated_by: user?.id ?? null,
      }
      const { error } = editing
        ? await supabase.from("documents").update(row).eq("id", editing.id)
        : await supabase.from("documents").insert({ ...row, uploaded_by: user?.id ?? null })
      if (error) throw error
      toast.success(editing ? "Link updated" : "Link added")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the link")
      setSaving(false)
    }
  }

  const field = "h-11 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-base text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm"
  const label = "mb-1.5 block text-xs font-medium text-[#9090A8]"

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && onClose()} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2A2A3C] bg-[#111118] sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2A2A3C] p-4">
              <h2 className="text-base font-semibold text-[#F0F0FA]">{editing ? "Edit link" : "Add Drive link"}</h2>
              <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="flex size-10 items-center justify-center rounded-lg text-[#9090A8] hover:bg-[#1A1A24]">
                <X className="size-5" />
              </button>
            </div>

            <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <label className={label}>Link</label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/…"
                  inputMode="url"
                  className={field}
                />
                <p className="mt-1 text-[11px] text-[#5A5A72]">
                  In Drive, set sharing to &ldquo;Anyone with the link can view&rdquo; so clients can open it.
                </p>
              </div>

              <div>
                <label className={label}>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. All company profiles (Drive)" className={field} />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="mt-0.5 size-4 accent-[#3B82F6]" />
                <span>
                  <span className="block text-sm text-[#F0F0FA]">Pin at the top</span>
                  <span className="block text-xs text-[#9090A8]">For the main folder that has every profile.</span>
                </span>
              </label>

              <div>
                <label className={label}>Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_ORDER.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={cn(
                        "min-h-9 rounded-full border px-3 text-xs transition",
                        category === c ? "border-[#3B82F6] bg-[#3B82F6]/15 text-[#F0F0FA]" : "border-[#2A2A3C] text-[#9090A8]"
                      )}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={label}>Service line</label>
                <select value={serviceLine} onChange={(e) => setServiceLine(e.target.value)} className={field}>
                  {Object.entries(SERVICE_LINE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={label}>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What's inside — e.g. profiles for interiors, MEP and facade"
                  className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-base text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 border-t border-[#2A2A3C] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={onClose} disabled={saving} className="h-11 flex-1 rounded-lg border border-[#2A2A3C] text-sm text-[#9090A8]">
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!validUrl || !title.trim() || saving}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3B82F6] text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                {editing ? "Save" : "Add link"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
