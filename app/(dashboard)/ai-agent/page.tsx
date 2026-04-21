"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Activity,
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  Target,
  User,
  Zap,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/lib/stores/uiStore"
import { AIAgentPanel } from "@/components/ai/AIAgentPanel"
import {
  LeadRecapPanel,
  type LeadRecapData,
} from "@/components/ai/LeadRecapPanel"
import {
  PipelineSummaryCard,
  type PipelineSummaryData,
} from "@/components/ai/PipelineSummaryCard"
import { cn } from "@/lib/utils"

interface LeadOption {
  id: string
  full_name: string
  company_name: string | null
  score: number | null
}

// ── Data fetchers ───────────────────────────────────────────────────

async function fetchAiStatus(): Promise<{ key_set: boolean }> {
  // Best-effort: call the admin status endpoint. Non-admins get 401 —
  // in that case we assume the key is configured and don't show a banner.
  try {
    const res = await fetch("/api/admin/integrations-status")
    if (!res.ok) return { key_set: true }
    const data = await res.json()
    return { key_set: Boolean(data?.anthropic?.key_set) }
  } catch {
    return { key_set: true }
  }
}

async function fetchLeads(): Promise<LeadOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, company_name, score")
    .order("score", { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as LeadOption[]
}

// ── Lead picker ─────────────────────────────────────────────────────

function LeadPicker({
  value,
  onChange,
}: {
  value: LeadOption | null
  onChange: (lead: LeadOption | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: leads } = useQuery({
    queryKey: ["ai-agent-leads"],
    queryFn: fetchLeads,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = useMemo(() => {
    if (!leads) return []
    const q = query.trim().toLowerCase()
    if (!q) return leads.slice(0, 50)
    return leads
      .filter(
        (l) =>
          l.full_name.toLowerCase().includes(q) ||
          (l.company_name ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [leads, query])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2 text-left text-sm text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
      >
        <User className="size-4 text-[#9090A8]" />
        {value ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-medium">{value.full_name}</span>
            {value.company_name && (
              <span className="truncate text-xs text-[#9090A8]">
                · {value.company_name}
              </span>
            )}
          </span>
        ) : (
          <span className="flex-1 text-[#9090A8]">Select a lead…</span>
        )}
        <ChevronDown className="size-4 text-[#9090A8]" />
      </button>

      {open && (
        <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#111118] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[#2A2A3C] px-3 py-2">
            <Search className="size-3.5 text-[#9090A8]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or company…"
              autoFocus
              className="w-full bg-transparent text-xs text-[#F0F0FA] placeholder-[#9090A8] outline-none"
            />
          </div>
          <div className="thin-scrollbar max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-[#9090A8]">
                No leads match “{query}”
              </p>
            ) : (
              filtered.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => {
                    onChange(lead)
                    setOpen(false)
                    setQuery("")
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition hover:bg-[#1A1A24]",
                    value?.id === lead.id && "bg-[#1E3A5F]/40"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#F0F0FA]">
                      {lead.full_name}
                    </p>
                    <p className="truncate text-[11px] text-[#9090A8]">
                      {lead.company_name ?? "No company"}
                    </p>
                  </div>
                  {lead.score != null && lead.score > 0 && (
                    <span className="shrink-0 rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-semibold text-[#3B82F6]">
                      {lead.score}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────

export default function AIAgentPage() {
  const { setLeadDrawerId } = useUIStore()

  // AI key status
  const { data: aiStatus } = useQuery({
    queryKey: ["ai-key-status"],
    queryFn: fetchAiStatus,
  })

  // Section 1: Pipeline summary
  const [pipelineData, setPipelineData] = useState<PipelineSummaryData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(false)

  const generatePipelineSummary = async (force = false) => {
    setPipelineLoading(true)
    try {
      const res = await fetch("/api/ai/pipeline-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setPipelineData(data)
    } catch {
      toast.error("Failed to generate pipeline summary", {
        action: { label: "Retry", onClick: () => generatePipelineSummary(force) },
      })
    } finally {
      setPipelineLoading(false)
    }
  }

  // Section 2: Lead assistant
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null)
  const [recap, setRecap] = useState<LeadRecapData | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [draft, setDraft] = useState<{
    message: string
    tone: string
    suggested_follow_up_days?: number
  } | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [copiedDraft, setCopiedDraft] = useState(false)

  // Reset recap/draft when lead changes
  useEffect(() => {
    setRecap(null)
    setDraft(null)
    setCopiedDraft(false)
  }, [selectedLead?.id])

  const generateRecap = async (force = false) => {
    if (!selectedLead) return
    setRecapLoading(true)
    try {
      const res = await fetch("/api/ai/lead-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: selectedLead.id, force }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setRecap(data)
    } catch {
      toast.error("Failed to generate recap", {
        action: { label: "Retry", onClick: () => generateRecap(force) },
      })
    } finally {
      setRecapLoading(false)
    }
  }

  const draftMessage = async () => {
    if (!selectedLead) return
    setDraftLoading(true)
    try {
      const res = await fetch("/api/ai/draft-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: selectedLead.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setDraft(data)
      setCopiedDraft(false)
    } catch {
      toast.error("Failed to draft message", {
        action: { label: "Retry", onClick: draftMessage },
      })
    } finally {
      setDraftLoading(false)
    }
  }

  // Section 3: Quick actions
  const [scoringAll, setScoringAll] = useState(false)
  const [scoreAllResult, setScoreAllResult] = useState<{
    scored: number
    average_score: number
  } | null>(null)

  const scoreAllLeads = async () => {
    setScoringAll(true)
    try {
      const res = await fetch("/api/leads/score-all", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setScoreAllResult(data)
      toast.success(
        `Scored ${data.scored} leads · avg ${data.average_score}`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to score leads")
    } finally {
      setScoringAll(false)
    }
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
                AI Agent
              </h1>
              <p className="text-sm text-[#9090A8]">
                Pipeline intelligence, lead recaps, and message drafting — powered by Claude.
              </p>
            </div>
          </div>
        </div>

        {/* Missing key banner */}
        {aiStatus && !aiStatus.key_set && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#3F2A12]/40 p-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#F59E0B]" />
            <div className="text-sm text-[#F0F0FA]">
              <p className="font-medium text-[#F59E0B]">AI features are disabled</p>
              <p className="mt-0.5 text-xs text-[#9090A8]">
                AI features require an Anthropic API key. Add it in Admin → Integrations.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {/* ── Section 1: Pipeline Intelligence ──────────────────── */}
          <AIAgentPanel
            number={1}
            title="Pipeline Intelligence"
            subtitle="Daily summary of pipeline health and what to prioritize"
            icon={<Activity className="size-3.5" />}
          >
            <PipelineSummaryCard
              data={pipelineData}
              loading={pipelineLoading}
              onGenerate={() => generatePipelineSummary(false)}
              onRegenerate={pipelineData ? () => generatePipelineSummary(true) : undefined}
            />
          </AIAgentPanel>

          {/* ── Section 2: Lead Assistant ─────────────────────────── */}
          <AIAgentPanel
            number={2}
            title="Lead Assistant"
            subtitle="Pick a lead to get an AI recap and draft a WhatsApp message"
            icon={<Bot className="size-3.5" />}
          >
            <div className="space-y-4">
              <LeadPicker value={selectedLead} onChange={setSelectedLead} />

              {selectedLead && (
                <>
                  <LeadRecapPanel
                    recap={recap}
                    loading={recapLoading}
                    score={selectedLead.score}
                    onGenerate={() => generateRecap(false)}
                    onRegenerate={recap ? () => generateRecap(true) : undefined}
                  />

                  <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <MessageSquare className="size-4 text-[#34D399]" />
                      <h4 className="text-sm font-semibold text-[#F0F0FA]">
                        Draft WhatsApp Message
                      </h4>
                    </div>

                    {!draft ? (
                      <>
                        <p className="mb-3 text-xs text-[#9090A8]">
                          Claude will write a context-aware follow-up using this lead&apos;s recent interactions.
                        </p>
                        <button
                          onClick={draftMessage}
                          disabled={draftLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
                        >
                          {draftLoading ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <MessageSquare className="size-3" />
                          )}
                          Draft Message
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#9090A8]">
                          <span>Tone: {draft.tone}</span>
                          {draft.suggested_follow_up_days != null && (
                            <span>
                              Suggested follow-up: {draft.suggested_follow_up_days}{" "}
                              {draft.suggested_follow_up_days === 1 ? "day" : "days"}
                            </span>
                          )}
                        </div>
                        <textarea
                          readOnly
                          value={draft.message}
                          className="mt-2 h-32 w-full resize-none rounded-lg border border-[#2A2A3C] bg-[#0A0A0F] p-3 text-xs leading-relaxed text-[#F0F0FA] outline-none"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(draft.message)
                              setCopiedDraft(true)
                              toast.success("Message copied")
                              setTimeout(() => setCopiedDraft(false), 1500)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
                          >
                            {copiedDraft ? (
                              <Check className="size-3 text-[#34D399]" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                            {copiedDraft ? "Copied" : "Copy"}
                          </button>
                          <button
                            onClick={draftMessage}
                            disabled={draftLoading}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E] disabled:opacity-50"
                          >
                            {draftLoading && <Loader2 className="size-3 animate-spin" />}
                            Regenerate
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setLeadDrawerId(selectedLead.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
                  >
                    <User className="size-3" />
                    Open Lead in Drawer
                  </button>
                </>
              )}
            </div>
          </AIAgentPanel>

          {/* ── Section 3: Quick Actions ──────────────────────────── */}
          <AIAgentPanel
            number={3}
            title="Quick Actions"
            subtitle="One-click operations across the whole pipeline"
            icon={<Zap className="size-3.5" />}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {/* Score all */}
              <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Target className="size-4 text-[#3B82F6]" />
                  <h4 className="text-sm font-semibold text-[#F0F0FA]">
                    Score All Leads
                  </h4>
                </div>
                <p className="mb-3 text-xs text-[#9090A8]">
                  Recalculate the 0–100 score for every lead using the current algorithm.
                </p>
                <button
                  onClick={scoreAllLeads}
                  disabled={scoringAll}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
                >
                  {scoringAll ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Target className="size-3" />
                  )}
                  Score All Leads
                </button>
                {scoreAllResult && (
                  <p className="mt-3 text-xs text-[#34D399]">
                    Scored {scoreAllResult.scored} leads · avg {scoreAllResult.average_score}
                  </p>
                )}
              </div>

              {/* Brief me on today */}
              <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="size-4 text-[#F59E0B]" />
                  <h4 className="text-sm font-semibold text-[#F0F0FA]">
                    Brief Me On Today
                  </h4>
                </div>
                <p className="mb-3 text-xs text-[#9090A8]">
                  Generate a fresh pipeline summary focused on today&apos;s overdue
                  tasks and hot leads.
                </p>
                <button
                  onClick={() => generatePipelineSummary(true)}
                  disabled={pipelineLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#F59E0B] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#D97706] disabled:opacity-50"
                >
                  {pipelineLoading ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                  Brief Me
                </button>
                {pipelineData && (
                  <p className="mt-3 text-xs text-[#9090A8]">
                    Latest summary loaded in Section 1.
                  </p>
                )}
              </div>
            </div>
          </AIAgentPanel>
        </div>
      </div>
    </main>
  )
}
