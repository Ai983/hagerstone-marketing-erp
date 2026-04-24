"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Clock, Loader2, Search } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/lib/stores/uiStore"
import { cn } from "@/lib/utils"

interface LeadResult {
  id: string
  full_name: string
  company_name: string | null
  phone: string | null
  stage:
    | { name: string; color: string }
    | { name: string; color: string }[]
    | null
}

const RECENT_KEY = "hagerstone-recent-lead-searches"
const MAX_RECENTS = 5

function loadRecents(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS)
      : []
  } catch {
    return []
  }
}

function saveRecent(name: string) {
  if (typeof window === "undefined") return
  const current = loadRecents()
  const next = [name, ...current.filter((x) => x !== name)].slice(0, MAX_RECENTS)
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // localStorage may be unavailable (private mode / quota) — fail silent
  }
}

// Strip chars that would let a user inject extra PostgREST conditions into
// the `or=` filter. Commas separate conditions, parens group them. ILIKE
// wildcards (%, _) are fine to leave in — users can use them intentionally.
function sanitizeForOr(query: string): string {
  return query.replace(/[,()]/g, " ").trim()
}

interface LeadSearchModalProps {
  open: boolean
  onClose: () => void
}

export function LeadSearchModal({ open, onClose }: LeadSearchModalProps) {
  const setLeadDrawerId = useUIStore((s) => s.setLeadDrawerId)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<LeadResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLUListElement>(null)

  // Reset + focus on open
  useEffect(() => {
    if (!open) return
    setQuery("")
    setResults([])
    setSelectedIndex(0)
    setRecents(loadRecents())
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [open])

  // Debounced Supabase search on query change (2+ chars)
  useEffect(() => {
    if (!open) return
    const safe = sanitizeForOr(query)
    if (safe.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const handle = window.setTimeout(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, full_name, company_name, phone, stage:stage_id(name, color)"
        )
        .or(
          `full_name.ilike.%${safe}%,company_name.ilike.%${safe}%,phone.ilike.%${safe}%`
        )
        .limit(8)

      if (error) {
        console.error("Lead search error:", error)
        setResults([])
      } else {
        setResults((data ?? []) as LeadResult[])
      }
      setSelectedIndex(0)
      setLoading(false)
    }, 200)

    return () => window.clearTimeout(handle)
  }, [query, open])

  const handleSelect = (lead: LeadResult) => {
    saveRecent(lead.full_name)
    setLeadDrawerId(lead.id)
    onClose()
  }

  // Keyboard navigation + Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (results.length === 0) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const picked = results[selectedIndex]
        if (picked) handleSelect(picked)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
    // handleSelect closes over setLeadDrawerId/onClose but both are stable
    // enough that we omit them to avoid re-subscribing on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, selectedIndex, onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsRef.current) return
    const item = resultsRef.current.querySelector<HTMLElement>(
      `[data-idx="${selectedIndex}"]`
    )
    item?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  const trimmedQuery = query.trim()
  const showingResults = trimmedQuery.length >= 2

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh]"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="w-full overflow-hidden border border-[#2A2A3C] bg-[#111118]"
            style={{
              maxWidth: "600px",
              borderRadius: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Search leads"
          >
            {/* Search input */}
            <div className="relative border-b border-[#2A2A3C] p-3">
              <Search
                className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-[#9090A8]"
                style={{ left: "24px" }}
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search leads by name, phone, company..."
                style={{
                  background: "#1F1F2E",
                  border: "1px solid #2A2A3C",
                  color: "#F0F0FA",
                  fontSize: "18px",
                  padding: "16px 20px 16px 44px",
                  borderRadius: "12px",
                  width: "100%",
                  outline: "none",
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Body */}
            <div className="max-h-[60vh] overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-[#9090A8]" />
                </div>
              )}

              {!loading && showingResults && results.length === 0 && (
                <div className="py-12 text-center text-sm text-[#9090A8]">
                  No leads found for &ldquo;{trimmedQuery}&rdquo;
                </div>
              )}

              {!loading && showingResults && results.length > 0 && (
                <ul ref={resultsRef} className="py-2">
                  {results.map((lead, i) => {
                    const stage = Array.isArray(lead.stage)
                      ? lead.stage[0]
                      : lead.stage
                    const highlighted = i === selectedIndex
                    return (
                      <li key={lead.id} data-idx={i}>
                        <button
                          type="button"
                          onClick={() => handleSelect(lead)}
                          onMouseEnter={() => setSelectedIndex(i)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                            highlighted ? "bg-[#1A1A24]" : "bg-transparent"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#F0F0FA]">
                              {lead.full_name}
                            </p>
                            <p className="truncate text-xs text-[#9090A8]">
                              {lead.company_name || "—"}
                            </p>
                          </div>
                          {stage?.name && (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: `${stage.color}20`,
                                color: stage.color,
                              }}
                            >
                              {stage.name}
                            </span>
                          )}
                          {lead.phone && (
                            <span className="shrink-0 font-mono text-xs text-[#9090A8]">
                              {lead.phone}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {!loading && !showingResults && recents.length > 0 && (
                <div className="py-2">
                  <p className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Recent
                  </p>
                  <ul>
                    {recents.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => setQuery(name)}
                          className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-[#F0F0FA] transition hover:bg-[#1A1A24]"
                        >
                          <Clock className="size-3.5 shrink-0 text-[#9090A8]" />
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!loading && !showingResults && recents.length === 0 && (
                <div className="py-10 text-center text-xs text-[#9090A8]">
                  Type 2+ characters to search leads
                </div>
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between border-t border-[#2A2A3C] px-4 py-2 text-[11px] text-[#9090A8]">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-[#2A2A3C] bg-[#1A1A24] px-1.5 py-0.5 font-mono text-[10px]">
                    ↑↓
                  </kbd>
                  navigate
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-[#2A2A3C] bg-[#1A1A24] px-1.5 py-0.5 font-mono text-[10px]">
                    ↵
                  </kbd>
                  select
                </span>
              </div>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-[#2A2A3C] bg-[#1A1A24] px-1.5 py-0.5 font-mono text-[10px]">
                  Esc
                </kbd>
                close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
