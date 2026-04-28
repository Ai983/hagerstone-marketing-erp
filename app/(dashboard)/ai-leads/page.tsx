"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Building2,
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { useUIStore } from "@/lib/stores/uiStore"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"

// ── Types & constants ──────────────────────────────────────────────

const ALLOWED_ROLES: UserRole[] = ["admin", "manager", "founder", "marketing"]

const VALID_SERVICE_LINES = new Set([
  "office_interiors",
  "mep",
  "facade_glazing",
  "peb_construction",
  "civil_works",
  "multiple",
  "unknown",
])

const SERVICE_LINE_OPTIONS = [
  { value: "", label: "Any service" },
  { value: "office_interiors", label: "Office Interiors" },
  { value: "mep", label: "MEP" },
  { value: "facade_glazing", label: "Facade / Glazing" },
  { value: "peb_construction", label: "PEB Construction" },
  { value: "civil_works", label: "Civil Works" },
  { value: "multiple", label: "Multiple" },
]

const COMPANY_SIZE_OPTIONS = [
  { value: "", label: "Any size" },
  { value: "1-20", label: "1–20" },
  { value: "20-100", label: "20–100" },
  { value: "100-500", label: "100–500" },
  { value: "500+", label: "500+" },
]

const HISTORY_KEY = "ai-leads-history"
const MAX_HISTORY = 3

interface GeneratedLead {
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  website: string | null
  linkedin_url?: string | null
  city: string | null
  industry: string | null
  service_line: string | null
  company_size: string | null
  estimated_budget: string | null
  score: number | null
  ai_insight: string | null
  source_url: string | null
  // Server-side enrichment from /api/ai/generate-leads
  dbId?: string | null
  isDuplicate?: boolean
  existingLeadId?: string | null
  isNew?: boolean
}

interface LeadWithId extends GeneratedLead {
  _id: string
}

type AddState = "idle" | "adding" | "added" | "duplicate" | "error"

// ── Helpers ────────────────────────────────────────────────────────

function getScoreBadge(score: number | null) {
  return score ?? 0
}

// Strip PostgREST-special chars from values going into .or(ilike) filters.
function sanitizeForOr(value: string): string {
  return value.replace(/[,()%_*]/g, " ").trim()
}

function loadHistory(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_HISTORY)
      : []
  } catch {
    return []
  }
}

function saveHistory(prompt: string) {
  if (typeof window === "undefined") return
  const current = loadHistory()
  const next = [prompt, ...current.filter((x) => x !== prompt)].slice(
    0,
    MAX_HISTORY
  )
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    /* quota / private-mode — ignore */
  }
}

function formatLabel(value: string | null | undefined) {
  if (!value) return ""
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

// ── Page ───────────────────────────────────────────────────────────

export default function AiLeadsPage() {
  const router = useRouter()
  const setLeadDrawerId = useUIStore((s) => s.setLeadDrawerId)

  const [accessChecked, setAccessChecked] = useState(false)

  const [prompt, setPrompt] = useState("")
  const [city, setCity] = useState("")
  const [serviceLine, setServiceLine] = useState("")
  const [companySize, setCompanySize] = useState("")

  const [leads, setLeads] = useState<LeadWithId[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [addStates, setAddStates] = useState<Record<string, AddState>>({})
  const [history, setHistory] = useState<string[]>([])
  const [newLeadStageId, setNewLeadStageId] = useState<string | null>(null)
  const [lastSessionLeads, setLastSessionLeads] = useState<LeadWithId[]>([])

  // Role gate + initial data load
  useEffect(() => {
    let mounted = true
    const init = async () => {
      const { user, profile } = await getCachedUserAndProfile()
      if (!mounted) return
      if (!user || !profile) {
        router.replace("/login")
        return
      }
      const role = (profile as { role?: UserRole }).role
      if (!role || !ALLOWED_ROLES.includes(role)) {
        router.replace("/pipeline")
        return
      }

      // Fetch new_lead stage id + pending session leads in parallel.
      const supabase = createClient()
      const [{ data: stage }, { data: pending }] = await Promise.all([
        supabase
          .from("pipeline_stages")
          .select("id")
          .eq("slug", "new_lead")
          .maybeSingle(),
        supabase
          .from("ai_generated_leads")
          .select("*")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(20),
      ])
      if (!mounted) return
      setNewLeadStageId((stage?.id as string | undefined) ?? null)
      if (pending && pending.length > 0) {
        const withIds: LeadWithId[] = pending.map((row, i) => ({
          company_name: row.company_name,
          contact_name: row.contact_name ?? null,
          phone: row.phone ?? null,
          email: row.email ?? null,
          website: row.website ?? null,
          linkedin_url: row.linkedin_url ?? null,
          city: row.city ?? null,
          industry: row.industry ?? null,
          service_line: row.service_line ?? null,
          company_size: row.company_size ?? null,
          estimated_budget: row.estimated_budget ?? null,
          score: row.score ?? 0,
          ai_insight: row.ai_insight ?? null,
          source_url: row.source_url ?? null,
          dbId: row.id,
          isDuplicate: false,
          existingLeadId: null,
          isNew: false,
          _id: `pending-${row.id ?? i}`,
        }))
        setLastSessionLeads(withIds)
      }
      setHistory(loadHistory())
      setAccessChecked(true)
    }
    init()
    return () => {
      mounted = false
    }
  }, [router])

  // ── Generate ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setError(null)
    const trimmed = prompt.trim()
    if (trimmed.length < 10) {
      setError("Describe the leads you want in at least 10 characters")
      return
    }

    setLoading(true)
    setLeads([])
    setAddStates({})

    try {
      const res = await fetch("/api/ai/generate-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          city: city.trim() || undefined,
          serviceLine: serviceLine || undefined,
          companySize: companySize || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        leads?: GeneratedLead[]
        error?: string
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to generate leads")
        setLoading(false)
        return
      }

      const withIds: LeadWithId[] = (data.leads ?? []).map((lead, i) => ({
        ...lead,
        _id: `${Date.now()}-${i}`,
      }))
      setLeads(withIds)
      saveHistory(trimmed)
      setHistory(loadHistory())

      if (withIds.length === 0) {
        toast.info("No leads found. Try a broader description.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate leads")
    } finally {
      setLoading(false)
    }
  }

  // ── Add to Pipeline ──────────────────────────────────────────────
  const handleAdd = async (lead: LeadWithId) => {
    if (!newLeadStageId) {
      toast.error("Pipeline stages not loaded yet. Please retry in a moment.")
      return
    }

    setAddStates((s) => ({ ...s, [lead._id]: "adding" }))

    try {
      const supabase = createClient()

      // Duplicate check — phone first, fall back to company name
      let duplicate: { id: string } | null = null
      const phoneRaw = lead.phone?.trim() ?? ""
      if (phoneRaw) {
        const normalised = phoneRaw.replace(/\D/g, "").slice(-10)
        if (normalised) {
          const { data } = await supabase
            .from("leads")
            .select("id")
            .or(
              `phone.ilike.%${normalised}%,phone_alt.ilike.%${normalised}%`
            )
            .limit(1)
            .maybeSingle()
          duplicate = (data as { id: string } | null) ?? null
        }
      }
      if (!duplicate && lead.company_name) {
        const safe = sanitizeForOr(lead.company_name)
        if (safe) {
          const { data } = await supabase
            .from("leads")
            .select("id")
            .ilike("company_name", `%${safe}%`)
            .limit(1)
            .maybeSingle()
          duplicate = (data as { id: string } | null) ?? null
        }
      }

      if (duplicate) {
        setAddStates((s) => ({ ...s, [lead._id]: "duplicate" }))
        toast(`${lead.company_name} already exists in your pipeline`)
        return
      }

      // Validate AI-provided values against CHECK constraints
      const serviceLineSafe =
        lead.service_line && VALID_SERVICE_LINES.has(lead.service_line)
          ? lead.service_line
          : null

      const payload = {
        full_name: lead.contact_name?.trim() || "Unknown Contact",
        company_name: lead.company_name ?? null,
        phone: lead.phone?.trim() || null,
        email: lead.email?.trim() || null,
        city: lead.city ?? null,
        service_line: serviceLineSafe,
        estimated_budget: lead.estimated_budget ?? null,
        source: "ai_suggested", // PRD CHECK allows ai_suggested, not ai_generated
        stage_id: newLeadStageId,
        initial_notes: lead.ai_insight ?? null,
        score:
          typeof lead.score === "number"
            ? Math.max(0, Math.min(100, Math.round(lead.score)))
            : 0,
        is_sample_data: false,
      }

      const { data: insertedRow, error: insertError } = await supabase
        .from("leads")
        .insert(payload)
        .select("id")
        .maybeSingle()
      if (insertError) {
        console.error("AI lead insert error:", insertError)
        setAddStates((s) => ({ ...s, [lead._id]: "error" }))
        toast.error(insertError.message)
        return
      }

      // Update the AI database row to reflect the pipeline link.
      if (lead.dbId) {
        const newPipelineId =
          (insertedRow as { id: string } | null)?.id ?? null
        await supabase
          .from("ai_generated_leads")
          .update({
            status: "added",
            pipeline_lead_id: newPipelineId,
            added_to_pipeline_at: new Date().toISOString(),
          })
          .eq("id", lead.dbId)
      }

      setAddStates((s) => ({ ...s, [lead._id]: "added" }))
      toast.success(`${lead.company_name} added to pipeline!`)
    } catch (err) {
      setAddStates((s) => ({ ...s, [lead._id]: "error" }))
      toast.error(err instanceof Error ? err.message : "Failed to add lead")
    }
  }

  // ── Skip (fade out + persist status) ─────────────────────────────
  const handleSkip = async (id: string) => {
    const lead = [...leads, ...lastSessionLeads].find((l) => l._id === id)
    setLeads((prev) => prev.filter((l) => l._id !== id))
    setLastSessionLeads((prev) => prev.filter((l) => l._id !== id))
    if (lead?.dbId) {
      const supabase = createClient()
      await supabase
        .from("ai_generated_leads")
        .update({ status: "skipped" })
        .eq("id", lead.dbId)
    }
  }

  // ── View existing pipeline lead (duplicate card action) ──────────
  const handleViewExisting = (leadId: string) => {
    setLeadDrawerId(leadId)
    router.push("/pipeline")
  }

  const canSubmit = useMemo(
    () => prompt.trim().length >= 10 && !loading,
    [prompt, loading]
  )

  // ── Render guards ────────────────────────────────────────────────
  if (!accessChecked) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#3F2A12] text-[#F59E0B]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
                AI Lead Generation
              </h1>
              <p className="text-sm text-[#9090A8]">
                Describe your ideal prospect and Claude will find real
                companies from across the web
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F59E0B]/40 bg-[#3F2A12]/40 px-2.5 py-1 text-[11px] font-medium text-[#F59E0B]">
            <Sparkles className="size-3" />
            Powered by Claude + Web Search
          </span>
        </div>

        {/* Resume banner — shows if there are pending leads from a prior
            session (status='new' in ai_generated_leads). Loads them
            into the current view so the user can continue triaging. */}
        {leads.length === 0 && lastSessionLeads.length > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#2A2A3C] bg-[#111118] px-4 py-3">
            <p className="text-sm font-medium text-[#F0F0FA]">
              Continue from last session ({lastSessionLeads.length} leads
              pending)
            </p>
            <button
              type="button"
              onClick={() => {
                setLeads(lastSessionLeads)
                setLastSessionLeads([])
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#3B82F6]/40 bg-[#1E3A5F] px-3 py-1.5 text-xs font-medium text-[#3B82F6] transition hover:bg-[#3B82F6]/20"
            >
              Load These Leads
            </button>
          </div>
        )}

        {/* Search card */}
        <section className="mb-6 rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder={`Describe the leads you want...
Examples:
- IT companies in Noida with 50-200 employees needing office fit-out
- Manufacturing plants in Greater Noida needing PEB construction
- Hospitals in Delhi NCR needing interior renovation`}
            className="thin-scrollbar w-full resize-none rounded-lg border border-[#3A3A52] bg-[#1F1F2E] p-3 text-sm text-[#F0F0FA] outline-none transition placeholder:text-[#5A5A72] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#9090A8]" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City (optional)"
                className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] pl-8 pr-3 text-xs text-[#F0F0FA] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
            <select
              value={serviceLine}
              onChange={(e) => setServiceLine(e.target.value)}
              className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-2.5 text-xs text-[#F0F0FA] outline-none transition focus:border-[#3B82F6]"
            >
              {SERVICE_LINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              className="h-9 rounded-lg border border-[#3A3A52] bg-[#1F1F2E] px-2.5 text-xs text-[#F0F0FA] outline-none transition focus:border-[#3B82F6]"
            >
              {COMPANY_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="mt-3 text-xs text-[#F87171]">{error}</p>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canSubmit}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Searching the web…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate Leads
              </>
            )}
          </button>

          {/* Recent searches */}
          {history.length > 0 && !loading && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                Recent:
              </span>
              {history.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setPrompt(h)
                    // Let React commit the value before firing the request
                    setTimeout(() => handleGenerate(), 0)
                  }}
                  className="inline-flex max-w-[280px] items-center gap-1 truncate rounded-full border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1 text-[11px] text-[#9090A8] transition hover:border-[#3B82F6] hover:text-[#F0F0FA]"
                  title={h}
                >
                  <Search className="size-3 shrink-0" />
                  <span className="truncate">{h}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <LeadCardSkeleton key={i} />
            ))}
          </div>
        ) : leads.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {leads.map((lead) => (
                <motion.div
                  key={lead._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                >
                  <LeadCard
                    lead={lead}
                    state={addStates[lead._id] ?? "idle"}
                    onAdd={() => handleAdd(lead)}
                    onSkip={() => handleSkip(lead._id)}
                    onViewExisting={
                      lead.existingLeadId
                        ? () => handleViewExisting(lead.existingLeadId!)
                        : undefined
                    }
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </main>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────

function LeadCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-[#1A1A24]" />
          <div className="h-3 w-1/2 rounded bg-[#1A1A24]" />
        </div>
        <div className="h-5 w-12 rounded-full bg-[#1A1A24]" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-2/3 rounded bg-[#1A1A24]" />
        <div className="h-3 w-1/2 rounded bg-[#1A1A24]" />
      </div>
      <div className="my-4 h-px bg-[#2A2A3C]" />
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-[#1A1A24]" />
        <div className="h-3 w-4/5 rounded bg-[#1A1A24]" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-8 flex-1 rounded bg-[#1A1A24]" />
        <div className="h-8 w-16 rounded bg-[#1A1A24]" />
      </div>
    </div>
  )
}

// ── Lead card ──────────────────────────────────────────────────────

function LeadCard({
  lead,
  state,
  onAdd,
  onSkip,
  onViewExisting,
}: {
  lead: LeadWithId
  state: AddState
  onAdd: () => void
  onSkip: () => void
  onViewExisting?: () => void
}) {
  const badge = getScoreBadge(lead.score)
  const isDuplicate = Boolean(lead.isDuplicate)

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-xl border border-[#2A2A3C] bg-[#111118] p-5",
        isDuplicate && "opacity-60"
      )}
    >
      {isDuplicate && (
        <div className="absolute right-2 top-2 z-10 rounded-full bg-[#374151] px-2 py-0.5 text-[11px] font-medium text-[#9CA3AF]">
          Already exists
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Building2 className="size-3.5 shrink-0 text-[#9090A8]" />
            <h3 className="truncate font-semibold text-[#F0F0FA]">
              {lead.company_name || "Unknown company"}
            </h3>
          </div>
          {lead.contact_name && (
            <p className="mt-0.5 truncate text-xs text-[#9090A8]">
              {lead.contact_name}
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "#1F1F2E", color: "#9090A8" }}
        >
          {badge}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-[11px] text-[#9090A8]">
        <div className="flex flex-wrap items-center gap-2">
          {lead.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {lead.city}
            </span>
          )}
          {lead.industry && (
            <>
              {lead.city && <span>•</span>}
              <span>{lead.industry}</span>
            </>
          )}
        </div>
        {lead.service_line && (
          <p>
            <span className="text-[#5A5A72]">Service:</span>{" "}
            <span className="text-[#F0F0FA]">
              {formatLabel(lead.service_line)}
            </span>
            {lead.estimated_budget && (
              <span className="text-[#9090A8]"> · {lead.estimated_budget}</span>
            )}
          </p>
        )}
        {lead.website && (
          <p className="flex items-center gap-1 truncate">
            <Globe className="size-3 shrink-0" />
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[#60A5FA] hover:underline"
            >
              {lead.website.replace(/^https?:\/\//, "")}
            </a>
          </p>
        )}
      </div>

      {/* Contact quality badges — at-a-glance signal of how reachable
          this lead is. Strikethrough on missing channels. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {lead.phone ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#10B98120] px-2 py-0.5 text-[11px] text-[#10B981]">
            <Phone className="size-3" />
            {lead.phone}
          </span>
        ) : (
          <span className="rounded-full bg-[#1F1F2E] px-2 py-0.5 text-[11px] text-[#5A5A72] line-through">
            No phone
          </span>
        )}
        {lead.email ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#3B82F620] px-2 py-0.5 text-[11px] text-[#3B82F6]">
            <Mail className="size-3" />
            {lead.email}
          </span>
        ) : (
          <span className="rounded-full bg-[#1F1F2E] px-2 py-0.5 text-[11px] text-[#5A5A72] line-through">
            No email
          </span>
        )}
        {lead.linkedin_url && (
          <a
            href={lead.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[#0A66C220] px-2 py-0.5 text-[11px] font-semibold text-[#0A66C2] transition hover:bg-[#0A66C2]/30"
          >
            <span className="font-mono lowercase">in</span>
            LinkedIn
          </a>
        )}
      </div>

      {lead.ai_insight && (
        <>
          <div className="my-3 h-px bg-[#2A2A3C]" />
          <p className="flex-1 text-xs leading-relaxed text-[#F0F0FA]">
            {lead.ai_insight}
          </p>
          {lead.source_url && (
            <a
              href={lead.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block truncate text-[10px] text-[#5A5A72] hover:text-[#9090A8] hover:underline"
            >
              Source: {lead.source_url.replace(/^https?:\/\//, "").slice(0, 40)}…
            </a>
          )}
        </>
      )}

      <div className="mt-4 flex gap-2 border-t border-[#2A2A3C] pt-3">
        {isDuplicate && onViewExisting ? (
          <button
            type="button"
            onClick={onViewExisting}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
          >
            <ExternalLink className="size-3" />
            View in Pipeline
          </button>
        ) : (
          <AddButton state={state} onClick={onAdd} />
        )}
        {state === "idle" && (
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1 rounded-md border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#9090A8] transition hover:text-[#F87171]"
          >
            <X className="size-3" />
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

function AddButton({
  state,
  onClick,
}: {
  state: AddState
  onClick: () => void
}) {
  if (state === "added") {
    return (
      <button
        type="button"
        disabled
        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#163322] px-3 py-1.5 text-xs font-medium text-[#34D399]"
      >
        <Check className="size-3" />
        Added
      </button>
    )
  }
  if (state === "duplicate") {
    return (
      <button
        type="button"
        disabled
        className="inline-flex flex-1 items-center justify-center rounded-md bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#9090A8]"
      >
        Already exists
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "adding"}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-white transition",
        state === "error"
          ? "bg-[#F87171] hover:bg-[#EF4444]"
          : "bg-[#3B82F6] hover:bg-[#2563EB]",
        state === "adding" && "opacity-70"
      )}
    >
      {state === "adding" ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          Adding…
        </>
      ) : state === "error" ? (
        "Retry"
      ) : (
        <>
          <Plus className="size-3" />
          Add to Pipeline
        </>
      )}
    </button>
  )
}
