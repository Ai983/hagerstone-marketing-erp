"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Check, Loader2, Plus, Tag as TagIcon } from "lucide-react"

import { useTags } from "@/lib/hooks/useTags"
import { cn } from "@/lib/utils"

/**
 * Pick tags from the shared list, or type a new one and add it to the list
 * on the spot. `onChange` gets the full new set of ids.
 */
export function TagPicker({
  value,
  onChange,
  label = "Tag",
  align = "left",
  disabled = false,
}: {
  value: string[]
  onChange: (next: string[]) => void | Promise<void>
  label?: string
  align?: "left" | "right"
  disabled?: boolean
}) {
  const { active, createTag } = useTags()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (q ? active.filter((t) => t.name.toLowerCase().includes(q)) : active), [active, q])
  const exact = active.some((t) => t.name.toLowerCase() === q)

  const run = async (next: string[]) => {
    setBusy(true)
    try {
      await onChange(next)
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) => run(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  const create = async () => {
    if (!query.trim()) return
    setBusy(true)
    try {
      const tag = await createTag(query)
      setQuery("")
      if (!value.includes(tag.id)) await onChange([...value, tag.id])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create tag")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-[#3A3A52] px-2 text-[11px] text-[#9090A8] transition hover:border-[#5A5A72] hover:text-[#F0F0FA] disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <TagIcon className="size-3" />}
        {label}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute top-8 z-40 w-64 rounded-xl border border-[#2A2A3C] bg-[#111118] p-2 shadow-2xl",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q && !exact) {
                e.preventDefault()
                create()
              }
              if (e.key === "Escape") setOpen(false)
            }}
            placeholder="Search or add a new tag"
            className="mb-1.5 h-9 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2.5 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#3B82F6] md:text-sm"
          />
          <div className="thin-scrollbar max-h-60 overflow-y-auto">
            {shown.map((t) => {
              const on = value.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(t.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24] disabled:opacity-60"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {on ? <Check className="size-4 shrink-0 text-[#3B82F6]" /> : null}
                </button>
              )
            })}
            {q && !exact ? (
              <button
                type="button"
                disabled={busy}
                onClick={create}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#60A5FA] transition hover:bg-[#1A1A24] disabled:opacity-60"
              >
                <Plus className="size-4 shrink-0" />
                <span className="truncate">Add new tag &ldquo;{query.trim()}&rdquo;</span>
              </button>
            ) : null}
            {!q && shown.length === 0 ? <p className="px-2 py-2 text-xs text-[#5A5A72]">No tags yet — type one to add it.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
