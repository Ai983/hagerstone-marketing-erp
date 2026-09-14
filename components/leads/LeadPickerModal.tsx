"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Search, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { PriorityBadge } from "@/components/data/DataSetBadge"

export type PickedLead = {
  id: string
  full_name: string
  company_name: string | null
  phone: string | null
  email: string | null
  priority: string | null
}

interface LeadPickerModalProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onPick: (lead: PickedLead) => void
}

/**
 * Full-screen on phones, centred sheet on desktop. Search is server-side
 * so it works the same whether the user can see 30 leads or 3,000.
 */
export function LeadPickerModal({ open, title, subtitle, onClose, onPick }: LeadPickerModalProps) {
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(input.trim()), 250)
    return () => window.clearTimeout(t)
  }, [input])

  useEffect(() => {
    if (!open) {
      setInput("")
      setQuery("")
    }
  }, [open])

  const { data, isFetching } = useQuery({
    queryKey: ["lead-picker", query],
    enabled: open,
    queryFn: async (): Promise<PickedLead[]> => {
      const supabase = createClient()
      // select("*") so this works whether or not migration 003's
      // `priority` column exists yet.
      let q = supabase
        .from("leads")
        .select("*")
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(30)
      if (query) {
        // PostgREST `or` syntax: commas separate conditions, so strip them.
        const safe = query.replace(/[,()]/g, " ")
        q = q.or(`full_name.ilike.%${safe}%,company_name.ilike.%${safe}%,phone.ilike.%${safe}%`)
      }
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((l) => ({
        id: l.id,
        full_name: l.full_name,
        company_name: l.company_name ?? null,
        phone: l.phone ?? null,
        email: l.email ?? null,
        priority: l.priority ?? null,
      }))
    },
  })

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="relative flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2A2A3C] bg-[#111118] sm:h-[70vh] sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-start justify-between border-b border-[#2A2A3C] p-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#F0F0FA]">{title}</h2>
                {subtitle ? <p className="mt-0.5 truncate text-xs text-[#9090A8]">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 flex size-10 items-center justify-center rounded-lg text-[#9090A8] hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="border-b border-[#2A2A3C] p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5A5A72]" />
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Search name, company or phone"
                  className="h-11 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] pl-9 pr-9 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#3B82F6] sm:text-sm"
                />
                {isFetching ? (
                  <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#5A5A72]" />
                ) : null}
              </div>
            </div>

            <div className="thin-scrollbar flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
              {(data ?? []).length === 0 && !isFetching ? (
                <p className="p-6 text-center text-sm text-[#9090A8]">No leads found.</p>
              ) : (
                <ul>
                  {(data ?? []).map((lead) => (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => onPick(lead)}
                        className="flex w-full touch-manipulation items-center gap-3 border-b border-[#1F1F2E] px-4 py-3 text-left transition hover:bg-[#1A1A24] active:bg-[#1A1A24]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#F0F0FA]">{lead.full_name}</p>
                          <p className="truncate text-xs text-[#9090A8]">
                            {[lead.company_name, lead.phone].filter(Boolean).join(" · ") || "No details"}
                          </p>
                        </div>
                        <PriorityBadge priority={lead.priority} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
