"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Search, UserPlus, X, Check } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { getScoreLabel } from "@/lib/utils/lead-scoring"
import { cn } from "@/lib/utils"

// ── Types + fetchers ────────────────────────────────────────────────

interface LeadOption {
  id: string
  full_name: string
  company_name: string | null
  score: number | null
  stage_id: string | null
  stage_name: string | null
  stage_color: string | null
}

interface StageOption {
  id: string
  name: string
  color: string
  position: number
}

async function fetchLeads(): Promise<LeadOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, company_name, score, stage_id, stage:stage_id(name, color)")
    .order("score", { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []).map((l) => {
    const stage = Array.isArray(l.stage) ? l.stage[0] : l.stage
    return {
      id: l.id,
      full_name: l.full_name,
      company_name: l.company_name ?? null,
      score: l.score,
      stage_id: (l.stage_id as string | null) ?? null,
      stage_name: (stage as { name?: string } | null)?.name ?? null,
      stage_color: (stage as { color?: string } | null)?.color ?? null,
    }
  })
}

async function fetchStages(): Promise<StageOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id, name, color, position, is_terminal")
    .eq("is_terminal", false)
    .order("position", { ascending: true })
  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color ?? "#6B7280",
    position: s.position,
  }))
}

// ── Component ───────────────────────────────────────────────────────

interface EnrollLeadsModalProps {
  open: boolean
  campaignId: string
  alreadyEnrolledIds: Set<string>
  onClose: () => void
  onEnrolled: () => void
}

export function EnrollLeadsModal({
  open,
  campaignId,
  alreadyEnrolledIds,
  onClose,
  onEnrolled,
}: EnrollLeadsModalProps) {
  const [query, setQuery] = useState("")
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const { data: leads, isLoading } = useQuery({
    queryKey: ["enroll-modal-leads", campaignId],
    queryFn: fetchLeads,
    enabled: open,
  })

  const { data: stages } = useQuery({
    queryKey: ["enroll-modal-stages"],
    queryFn: fetchStages,
    enabled: open,
  })

  // Reset everything when the modal closes
  useEffect(() => {
    if (!open) {
      setSelected(new Set())
      setQuery("")
      setSelectedStageId(null)
    }
  }, [open])

  // Count of not-yet-enrolled leads in a specific stage (ignores search).
  // Used for the pill badges.
  const stageCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of leads ?? []) {
      if (!l.stage_id) continue
      if (alreadyEnrolledIds.has(l.id)) continue
      map.set(l.stage_id, (map.get(l.stage_id) ?? 0) + 1)
    }
    return map
  }, [leads, alreadyEnrolledIds])

  const allAvailableCount = useMemo(
    () => (leads ?? []).filter((l) => !alreadyEnrolledIds.has(l.id)).length,
    [leads, alreadyEnrolledIds]
  )

  // Combined search + stage filter
  const filtered = useMemo(() => {
    if (!leads) return []
    const q = query.trim().toLowerCase()
    return leads.filter((l) => {
      const matchesSearch =
        !q ||
        l.full_name.toLowerCase().includes(q) ||
        (l.company_name ?? "").toLowerCase().includes(q)
      const matchesStage = !selectedStageId || l.stage_id === selectedStageId
      return matchesSearch && matchesStage
    })
  }, [leads, query, selectedStageId])

  // Filtered rows that can actually be selected (not already enrolled)
  const selectableFiltered = useMemo(
    () => filtered.filter((l) => !alreadyEnrolledIds.has(l.id)),
    [filtered, alreadyEnrolledIds]
  )

  // Are all selectable filtered leads currently selected?
  const allSelectableChecked =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((l) => selected.has(l.id))

  const activeStage = selectedStageId
    ? stages?.find((s) => s.id === selectedStageId) ?? null
    : null

  const toggle = (id: string) => {
    if (alreadyEnrolledIds.has(id)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllInFilter = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelectableChecked) {
        // Uncheck everything currently visible
        for (const l of selectableFiltered) next.delete(l.id)
      } else {
        for (const l of selectableFiltered) next.add(l.id)
      }
      return next
    })
  }

  const handleEnroll = async () => {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_ids: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Enrollment failed")
      toast.success(
        `${data.enrolled} lead${data.enrolled === 1 ? "" : "s"} enrolled in campaign`
      )
      onEnrolled()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrollment failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="enroll-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            key="enroll-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 z-[61] flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2A2A3C] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <UserPlus className="size-4 text-[#3B82F6]" />
                <h3 className="text-sm font-semibold text-[#F0F0FA]">
                  Enroll Leads in Campaign
                </h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-[#9090A8] transition hover:text-[#F0F0FA]"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 border-b border-[#2A2A3C] px-4 py-2.5">
              <Search className="size-3.5 text-[#9090A8]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or company…"
                className="w-full bg-transparent text-xs text-[#F0F0FA] placeholder-[#9090A8] outline-none"
              />
              <span className="ml-auto text-[11px] text-[#9090A8]">
                {selected.size} selected
              </span>
            </div>

            {/* Stage filter pills */}
            <div className="border-b border-[#2A2A3C]">
              <div
                className="thin-scrollbar flex gap-1.5 overflow-x-auto px-4 py-2"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <StagePill
                  label="All"
                  count={allAvailableCount}
                  color="#3B82F6"
                  active={selectedStageId === null}
                  onClick={() => setSelectedStageId(null)}
                  showDot={false}
                />
                {(stages ?? []).map((s) => (
                  <StagePill
                    key={s.id}
                    label={s.name}
                    count={stageCount.get(s.id) ?? 0}
                    color={s.color}
                    active={selectedStageId === s.id}
                    onClick={() => setSelectedStageId(s.id)}
                  />
                ))}
              </div>
            </div>

            {/* Select-all-in-stage row (only when a specific stage is selected) */}
            {activeStage && selectableFiltered.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllInFilter}
                className="flex items-center gap-2 border-b border-[#2A2A3C] bg-[#1A1A24] px-3 py-2 text-left transition hover:bg-[#1F1F2E]"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    allSelectableChecked
                      ? "border-[#3B82F6] bg-[#3B82F6]"
                      : "border-[#2A2A3C]"
                  )}
                >
                  {allSelectableChecked && <Check className="size-3 text-white" />}
                </span>
                <span className="text-xs text-[#F0F0FA]">
                  {allSelectableChecked ? "Deselect all" : "Select all"}{" "}
                  <span className="font-semibold">{selectableFiltered.length}</span>{" "}
                  <span style={{ color: activeStage.color }}>{activeStage.name}</span>{" "}
                  lead{selectableFiltered.length === 1 ? "" : "s"}
                </span>
              </button>
            )}

            {/* Lead list — only this section scrolls. */}
            <div
              className="thin-scrollbar max-h-80 overflow-y-scroll overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-[#9090A8]" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-10 text-center text-xs text-[#9090A8]">
                  {query && selectedStageId
                    ? `No leads match "${query}" in ${activeStage?.name ?? "this stage"}`
                    : query
                      ? `No leads match "${query}"`
                      : selectedStageId
                        ? `No leads in ${activeStage?.name ?? "this stage"}`
                        : "No leads available"}
                </p>
              ) : (
                <ul className="divide-y divide-[#2A2A3C]/60">
                  {filtered.map((lead) => {
                    const isEnrolled = alreadyEnrolledIds.has(lead.id)
                    const isSelected = selected.has(lead.id)
                    const scoreInfo = getScoreLabel(lead.score ?? 0)
                    return (
                      <li key={lead.id}>
                        <button
                          type="button"
                          onClick={() => toggle(lead.id)}
                          disabled={isEnrolled}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
                            isEnrolled
                              ? "cursor-not-allowed opacity-50"
                              : "hover:bg-[#1A1A24]",
                            isSelected && "bg-[#1E3A5F]/40"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border",
                              isEnrolled
                                ? "border-[#34D399] bg-[#163322]"
                                : isSelected
                                  ? "border-[#3B82F6] bg-[#3B82F6]"
                                  : "border-[#2A2A3C]"
                            )}
                          >
                            {(isEnrolled || isSelected) && (
                              <Check className="size-3 text-white" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-[#F0F0FA]">
                              {lead.full_name}
                              {isEnrolled && (
                                <span className="ml-2 text-[10px] font-normal text-[#34D399]">
                                  already enrolled
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[11px] text-[#9090A8]">
                              {lead.company_name ?? "No company"}
                              {lead.stage_name && (
                                <>
                                  {" · "}
                                  <span
                                    style={{
                                      color: lead.stage_color ?? "#9090A8",
                                    }}
                                  >
                                    {lead.stage_name}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          {lead.score != null && lead.score > 0 && (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: `${scoreInfo.color}20`,
                                color: scoreInfo.color,
                              }}
                            >
                              {lead.score}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[#2A2A3C] px-5 py-3.5">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-[#9090A8] transition hover:text-[#F0F0FA]"
              >
                Cancel
              </button>
              <button
                onClick={handleEnroll}
                disabled={submitting || selected.size === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
              >
                {submitting && <Loader2 className="size-3 animate-spin" />}
                Enroll Selected ({selected.size})
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Stage pill ──────────────────────────────────────────────────────

interface StagePillProps {
  label: string
  count: number
  color: string
  active: boolean
  onClick: () => void
  showDot?: boolean
}

function StagePill({
  label,
  count,
  color,
  active,
  onClick,
  showDot = true,
}: StagePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        !active && "border-[#2A2A3C] bg-transparent text-[#9090A8] hover:text-[#F0F0FA]"
      )}
      style={
        active
          ? {
              // 0x26 = ~15% alpha on 0xFF
              backgroundColor: `${color}26`,
              borderColor: color,
              color,
            }
          : undefined
      }
    >
      {showDot && (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1 text-[10px]",
          active ? "bg-black/20" : "bg-[#1A1A24] text-[#9090A8]"
        )}
        style={active ? { color } : undefined}
      >
        {count}
      </span>
    </button>
  )
}
