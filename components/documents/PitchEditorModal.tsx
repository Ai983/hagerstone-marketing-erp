"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { Copy, Loader2, Save, Sparkles, X } from "lucide-react"

import { getCachedUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import type { CompanyDocument } from "@/lib/types"
import { cn } from "@/lib/utils"

import { SERVICE_LINE_LABELS } from "./document-meta"

const AUDIENCES = [
  { value: "architect", label: "Architect / designer" },
  { value: "corporate", label: "Corporate client" },
  { value: "pmc", label: "PMC / consultant" },
  { value: "developer", label: "Developer / landlord" },
  { value: "general", label: "New prospect" },
]

const FORMATS = [
  { value: "whatsapp", label: "WhatsApp message" },
  { value: "email", label: "Email" },
  { value: "talking_points", label: "Meeting talking points" },
  { value: "one_pager", label: "One-page pitch" },
  { value: "call_script", label: "Call opener" },
]

interface PitchEditorModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** An existing pitch to edit; null writes a new one. */
  pitch?: CompanyDocument | null
}

/**
 * AI drafts, the salesperson edits, the ERP keeps it. The draft never
 * contains company figures or client names — it leaves [ADD: …] gaps to
 * be filled only with what the company can stand behind.
 */
export function PitchEditorModal({ open, onClose, onSaved, pitch }: PitchEditorModalProps) {
  const [audience, setAudience] = useState("architect")
  const [format, setFormat] = useState("one_pager")
  const [serviceLine, setServiceLine] = useState("all")
  const [notes, setNotes] = useState("")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const brief = (pitch?.ai_brief ?? {}) as Record<string, string>
    setAudience(brief.audience ?? "architect")
    setFormat(brief.format ?? "one_pager")
    setServiceLine(pitch?.service_line ?? brief.service_line ?? "all")
    setNotes(brief.notes ?? "")
    setTitle(pitch?.title ?? "")
    setBody(pitch?.body ?? "")
    setGenerating(false)
    setSaving(false)
  }, [open, pitch])

  const placeholders = body.match(/\[ADD:[^\]]*\]/g)?.length ?? 0

  const generate = async (improve: boolean) => {
    setGenerating(true)
    try {
      const res = await fetch("/api/ai/generate-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          format,
          service_line: serviceLine,
          notes,
          current: improve ? body : "",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not write the pitch")
      setBody(data.body)
      if (!title.trim() || !improve) setTitle(data.title)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not write the pitch")
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!title.trim() || !body.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const user = await getCachedUser()
      const row = {
        kind: "pitch",
        category: "sales_pitch",
        title: title.trim(),
        body: body.trim(),
        service_line: serviceLine,
        ai_brief: { audience, format, service_line: serviceLine, notes },
        updated_by: user?.id ?? null,
      }
      const { error } = pitch
        ? await supabase.from("documents").update(row).eq("id", pitch.id)
        : await supabase.from("documents").insert({ ...row, uploaded_by: user?.id ?? null })
      if (error) throw error
      toast.success(pitch ? "Pitch saved" : "Pitch added to the library")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save")
      setSaving(false)
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(body)
    toast.success("Copied")
  }

  const busy = generating || saving
  const field = "h-11 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-base text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm"
  const label = "mb-1.5 block text-xs font-medium text-[#9090A8]"
  const chip = (active: boolean) =>
    cn(
      "min-h-9 rounded-full border px-3 text-xs transition",
      active ? "border-[#3B82F6] bg-[#3B82F6]/15 text-[#F0F0FA]" : "border-[#2A2A3C] text-[#9090A8]"
    )

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onClose()} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="relative flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2A2A3C] bg-[#111118] sm:max-w-3xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2A2A3C] p-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[#F0F0FA]">
                <Sparkles className="size-4 text-[#A78BFA]" />
                {pitch ? "Edit pitch" : "Write a pitch with AI"}
              </h2>
              <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex size-10 items-center justify-center rounded-lg text-[#9090A8] hover:bg-[#1A1A24]">
                <X className="size-5" />
              </button>
            </div>

            <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <label className={label}>Who is it for?</label>
                <div className="flex flex-wrap gap-1.5">
                  {AUDIENCES.map((a) => (
                    <button key={a.value} type="button" onClick={() => setAudience(a.value)} className={chip(audience === a.value)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={label}>Format</label>
                <div className="flex flex-wrap gap-1.5">
                  {FORMATS.map((f) => (
                    <button key={f.value} type="button" onClick={() => setFormat(f.value)} className={chip(format === f.value)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>Service line</label>
                  <select value={serviceLine} onChange={(e) => setServiceLine(e.target.value)} className={field}>
                    {Object.entries(SERVICE_LINE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => generate(false)}
                    disabled={busy}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#7C3AED] text-sm font-medium text-white transition hover:bg-[#6D28D9] disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {body ? "Write a fresh draft" : "Write with AI"}
                  </button>
                </div>
              </div>

              <div>
                <label className={label}>Points to include (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. we handle MEP in-house, site visits welcome, quick BOQ turnaround"
                  className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-base text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm"
                />
              </div>

              <div className="border-t border-[#2A2A3C] pt-4">
                <label className={label}>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Architect intro — WhatsApp" className={field} />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-[#9090A8]">Pitch — edit freely</label>
                  {body ? (
                    <button
                      type="button"
                      onClick={() => generate(true)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 text-xs text-[#A78BFA] hover:text-[#C4B5FD] disabled:opacity-50"
                    >
                      <Sparkles className="size-3" /> Improve my edit with AI
                    </button>
                  ) : null}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  placeholder="Pick who it's for and a format, then tap Write with AI — or type your own."
                  className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 font-sans text-base leading-relaxed text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm"
                />
                {placeholders > 0 ? (
                  <p className="mt-1.5 rounded-md bg-[#3F2A12]/60 px-2 py-1.5 text-[11px] text-[#FCD34D]">
                    {placeholders} [ADD: …] gap{placeholders === 1 ? "" : "s"} to fill. Use only figures and client names the company has confirmed — or delete the line.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex gap-2 border-t border-[#2A2A3C] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={copy} disabled={!body.trim() || busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#2A2A3C] px-4 text-sm text-[#F0F0FA] disabled:opacity-50">
                <Copy className="size-4" /> Copy
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!title.trim() || !body.trim() || busy}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3B82F6] text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {pitch ? "Save changes" : "Save to library"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
