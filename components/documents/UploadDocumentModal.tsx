"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { FileUp, Loader2, X } from "lucide-react"

import { getCachedUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import type { CompanyDocument, DocumentCategory } from "@/lib/types"
import { cn } from "@/lib/utils"

import {
  CATEGORY_LABELS, CATEGORY_ORDER, DOCUMENT_BUCKET, DOCUMENT_FOLDER,
  SERVICE_LINE_LABELS, formatBytes,
} from "./document-meta"

const MAX_BYTES = 50 * 1024 * 1024

interface UploadDocumentModalProps {
  open: boolean
  onClose: () => void
  onUploaded: () => void
  /** Current documents, so a new upload can replace one. */
  existing: CompanyDocument[]
}

function nextVersion(v: string | undefined) {
  const m = v?.match(/^v(\d+)$/i)
  return m ? `v${Number(m[1]) + 1}` : "v1"
}

export function UploadDocumentModal({ open, onClose, onUploaded, existing }: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<DocumentCategory>("company_profile")
  const [serviceLine, setServiceLine] = useState("all")
  const [version, setVersion] = useState("v1")
  const [replaces, setReplaces] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const replaceable = useMemo(
    () => existing.filter((d) => d.is_current && d.category === category),
    [existing, category]
  )

  useEffect(() => {
    if (!open) {
      setFile(null); setTitle(""); setDescription(""); setCategory("company_profile")
      setServiceLine("all"); setVersion("v1"); setReplaces(""); setSubmitting(false)
    }
  }, [open])

  // Picking the document to replace carries its title/service line and bumps the version.
  useEffect(() => {
    const old = existing.find((d) => d.id === replaces)
    if (old) {
      setTitle(old.title)
      setServiceLine(old.service_line)
      setVersion(nextVersion(old.version))
    }
  }, [replaces, existing])

  const pickFile = (f: File | null) => {
    if (!f) return
    if (f.size > MAX_BYTES) {
      toast.error(`File is ${formatBytes(f.size)} — the limit is 50 MB.`)
      return
    }
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "))
  }

  const submit = async () => {
    if (!file || !title.trim()) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const user = await getCachedUser()
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin"
      const safeBase = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)
      const path = `${DOCUMENT_FOLDER}/${category}/${Date.now()}-${safeBase}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(path)

      const { data: inserted, error: insertError } = await supabase
        .from("documents")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          category,
          service_line: serviceLine,
          file_name: file.name,
          file_path: path,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type || null,
          version: version.trim() || "v1",
          is_current: true,
          supersedes: replaces || null,
          uploaded_by: user?.id ?? null,
        })
        .select("id")
        .single()

      if (insertError) {
        // Don't leave an orphaned file behind if the row was refused.
        await supabase.storage.from(DOCUMENT_BUCKET).remove([path])
        throw insertError
      }

      if (replaces) {
        await supabase.from("documents").update({ is_current: false }).eq("id", replaces).neq("id", inserted.id)
      }

      toast.success(replaces ? "New version uploaded" : "Document uploaded")
      onUploaded()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
      setSubmitting(false)
    }
  }

  const field = "h-11 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-base text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm"
  const label = "mb-1.5 block text-xs font-medium text-[#9090A8]"

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !submitting && onClose()} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2A2A3C] bg-[#111118] sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2A2A3C] p-4">
              <h2 className="text-base font-semibold text-[#F0F0FA]">Upload document</h2>
              <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" className="flex size-10 items-center justify-center rounded-lg text-[#9090A8] hover:bg-[#1A1A24]">
                <X className="size-5" />
              </button>
            </div>

            <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0] ?? null) }}
                className={cn(
                  "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
                  file ? "border-[#3B82F6]/60 bg-[#3B82F6]/5" : "border-[#2A2A3C] hover:border-[#3A3A52]"
                )}
              >
                <FileUp className="size-7 text-[#5A5A72]" />
                {file ? (
                  <>
                    <p className="mt-2 max-w-full truncate text-sm font-medium text-[#F0F0FA]">{file.name}</p>
                    <p className="text-xs text-[#9090A8]">{formatBytes(file.size)} · tap to change</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-medium text-[#F0F0FA]">Choose a file</p>
                    <p className="text-xs text-[#9090A8]">PDF, PowerPoint, Word, images or ZIP — up to 50 MB</p>
                  </>
                )}
              </button>
              <input
                ref={inputRef}
                type="file"
                hidden
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip,.mp4"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />

              <div>
                <label className={label}>Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_ORDER.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setCategory(c); setReplaces("") }}
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

              {replaceable.length > 0 ? (
                <div>
                  <label className={label}>Replaces (optional)</label>
                  <select value={replaces} onChange={(e) => setReplaces(e.target.value)} className={field}>
                    <option value="">Nothing — this is a new document</option>
                    {replaceable.map((d) => (
                      <option key={d.id} value={d.id}>{d.title} ({d.version})</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-[#5A5A72]">The old version stays downloadable but is marked superseded.</p>
                </div>
              ) : null}

              <div>
                <label className={label}>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Hagerstone Corporate Profile 2026" className={field} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Service line</label>
                  <select value={serviceLine} onChange={(e) => setServiceLine(e.target.value)} className={field}>
                    {Object.entries(SERVICE_LINE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Version</label>
                  <input value={version} onChange={(e) => setVersion(e.target.value)} className={field} />
                </div>
              </div>

              <div>
                <label className={label}>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="When to use it — e.g. first meeting with architects"
                  className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-base text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 border-t border-[#2A2A3C] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={onClose} disabled={submitting} className="h-11 flex-1 rounded-lg border border-[#2A2A3C] text-sm text-[#9090A8]">
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!file || !title.trim() || submitting}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3B82F6] text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                {submitting ? "Uploading…" : "Upload"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
