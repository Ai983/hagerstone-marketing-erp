"use client"

import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { differenceInDays, format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  X,
  Phone,
  CalendarPlus,
  Pencil,
  Save,
  MessageCircle,
  MessageSquare,
  Mail,
  Eye,
  Link2,
  ChevronDown,
  Camera,
  Film,
  CheckCircle2,
  CircleDot,
  AlertTriangle,
  Loader2,
  Copy,
  Sparkles,
  Bot,
  Send,
  TrendingDown,
  Trophy,
  Plus,
  UserCircle,
  FileText,
  FileSpreadsheet,
  Upload,
  Download,
  Code2,
  CaseSensitive,
} from "lucide-react"

import { useUIStore } from "@/lib/stores/uiStore"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { useActivities } from "@/lib/hooks/useActivities"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { LeadTimeline } from "@/components/leads/LeadTimeline"
import { WhatsAppChatView } from "@/components/leads/WhatsAppChatView"
import { LogCallModal } from "@/components/leads/LogCallModal"
import { ScheduleFollowUpModal } from "@/components/leads/ScheduleFollowUpModal"
import { SendWhatsAppModal } from "@/components/leads/SendWhatsAppModal"
import { RichTextEditor } from "@/components/email/RichTextEditor"
import { VideoInsertPanel } from "@/components/email/VideoInsertPanel"
import { ReassignPopover } from "@/components/leads/ReassignPopover"
import { StagePickerPopover } from "@/components/leads/StagePickerPopover"
import { StageChangeModal } from "@/components/kanban/StageChangeModal"
import { scoreLead, getScoreLabel, MAX_POINTS } from "@/lib/utils/lead-scoring"
import { categoryConfig, type LeadCategory } from "@/lib/utils/lead-category"
import type { Lead, PipelineStage, PriceRevision, Profile, UserRole } from "@/lib/types"
import type { KanbanLead } from "@/lib/hooks/useKanban"
import type { TimelineInteraction } from "@/lib/hooks/useActivities"
import { cn } from "@/lib/utils"
import { plainTextToEmailHtml, type EmailEditorMode } from "@/lib/utils/email-content"

const PRIVILEGED_ROLES = new Set<UserRole>(["admin", "manager", "founder"])

// ── Fetch lead detail ───────────────────────────────────────────────

async function fetchLeadDetail(id: string): Promise<Lead | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*, stage:stage_id(*), assignee:assigned_to(id, full_name, avatar_url, role)")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data as Lead | null
}

async function fetchCurrentProfile(): Promise<Profile | null> {
  // Use the shared cache — this runs as a React Query queryFn and
  // would otherwise race the auth-token lock with every other hook
  // on the same page.
  const { user, profile } = await getCachedUserAndProfile()
  if (!user) return null
  return (profile as Profile | null) ?? null
}

// ── Tab definitions ─────────────────────────────────────────────────

const tabs = ["Overview", "Timeline", "WhatsApp", "Email", "Tasks", "Campaigns", "AI"] as const
type TabName = (typeof tabs)[number]

// Shorter labels used on phone widths so all 6 tabs fit without
// horizontal-scroll wrapping awkwardly.
const tabShortLabels: Record<TabName, string> = {
  Overview: "Info",
  Timeline: "History",
  WhatsApp: "Chat",
  Email: "Email",
  Tasks: "Tasks",
  Campaigns: "Camp",
  AI: "AI",
}

const taskTypeOptions = [
  { value: "call", label: "Call" },
  { value: "follow_up", label: "Follow Up" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "site_visit", label: "Site Visit" },
  { value: "meeting", label: "Meeting" },
  { value: "proposal", label: "Proposal" },
  { value: "other", label: "Other" },
] as const

// ── Tab transition variants ─────────────────────────────────────────
//
// `mode="wait"` + `key={activeTab}` drives the swap. easeOut 200ms on
// enter, 150ms on exit — snappy enough that rapid tab clicking doesn't
// feel laggy.
const tabVariants = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.15 },
  },
}

// ── Skeleton ────────────────────────────────────────────────────────

function LeadDrawerSkeleton() {
  return (
    <div className="thin-scrollbar flex-1 animate-pulse overflow-y-auto">
      {/* Stage row */}
      <div className="flex items-center justify-between border-b border-[#2A2A3C] px-4 py-3">
        <div className="h-5 w-28 rounded-full bg-[#1A1A24]" />
        <div className="h-6 w-20 rounded-lg bg-[#1A1A24]" />
      </div>

      {/* Assigned row */}
      <div className="flex items-center justify-between border-b border-[#2A2A3C] px-4 py-3">
        <div className="h-4 w-32 rounded bg-[#1A1A24]" />
        <div className="h-4 w-16 rounded bg-[#1A1A24]" />
      </div>

      {/* Score block */}
      <div className="space-y-3 border-b border-[#2A2A3C] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-[#1A1A24]" />
          <div className="h-7 w-16 rounded bg-[#1A1A24]" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-2.5 w-full rounded-full bg-[#1A1A24]" />
          ))}
        </div>
      </div>

      {/* Field grid — 2 columns × 4 rows = 8 fields */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="h-3 w-20 rounded bg-[#1A1A24]" />
            <div className="mt-2 h-4 w-28 rounded bg-[#1A1A24]" />
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="border-t border-[#2A2A3C] p-4">
        <div className="mb-3 h-3 w-24 rounded bg-[#1A1A24]" />
        <div className="mt-4 grid grid-cols-2 gap-2 md:flex md:gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-[#1A1A24]" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

function StageBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">{label}</dt>
      <dd className="mt-0.5 text-sm text-[#F0F0FA]">{value || <span className="text-[#9090A8]">—</span>}</dd>
    </div>
  )
}

function placeholderToast() {
  toast("Coming soon", {
    description: "This action will be available in a future build step.",
  })
}

// ── Tab 1: Overview ─────────────────────────────────────────────────

interface OverviewTabProps {
  lead: Lead
  interactions: TimelineInteraction[]
  currentUserRole: UserRole | null
  onLogCall: () => void
  onScheduleFollowUp: () => void
  onAddNote: () => void
  onSendWhatsApp: () => void
  onMoveStage: (toStage: PipelineStage) => void
  onReassign: (profileId: string | null, profileName: string | null) => Promise<void>
  onCategoryChange: (category: LeadCategory) => Promise<void>
  onRemarksUpdate: (remarks: string) => Promise<void>
  isReassigning: boolean
}

function ScoreRow({
  label,
  earned,
  max,
  color,
  bold,
}: {
  label: string
  earned: number
  max: number
  color?: string
  bold?: boolean
}) {
  const pct = Math.max(0, Math.min(100, (earned / max) * 100))
  const barColor = color ?? "#3B82F6"
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span
          className={cn(
            bold ? "font-semibold text-[#F0F0FA]" : "text-[#9090A8]"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "font-mono tabular-nums",
            bold ? "font-semibold text-[#F0F0FA]" : "text-[#9090A8]"
          )}
        >
          {earned} / {max}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[#0F0F15]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

function OverviewTab({
  lead,
  interactions,
  currentUserRole,
  onLogCall,
  onScheduleFollowUp,
  onAddNote,
  onSendWhatsApp,
  onMoveStage,
  onReassign,
  onCategoryChange,
  onRemarksUpdate,
  isReassigning,
}: OverviewTabProps) {
  const sourceLabel = lead.source
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

  const canReassign = Boolean(currentUserRole && PRIVILEGED_ROLES.has(currentUserRole))
  const [stagePickerOpen, setStagePickerOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const queryClient = useQueryClient()
  const currentStageSlug = lead.stage?.slug
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    full_name: lead.full_name ?? "",
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    company_name: lead.company_name ?? "",
    designation: lead.designation ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    industry: lead.industry ?? "",
    service_line: lead.service_line ?? "",
    estimated_budget: lead.estimated_budget ?? "",
    project_size_sqft: lead.project_size_sqft ?? "",
    expected_timeline: lead.expected_timeline ?? "",
    initial_notes: lead.initial_notes ?? "",
    whatsapp_opted_in: lead.whatsapp_opted_in ?? false,
  })
  const [saving, setSaving] = useState(false)

  const [boqData, setBOQData] = useState({
    boq_received_date: lead.boq_received_date ?? "",
    boq_document_url: lead.boq_document_url ?? null,
    boq_deadline: lead.boq_deadline ?? "",
    boq_scope: lead.boq_scope ?? "",
    boq_area_sqft: lead.boq_area_sqft ?? "",
    boq_floors: lead.boq_floors ?? "",
    boq_remarks: lead.boq_remarks ?? "",
  })
  const [proposalData, setProposalData] = useState({
    boq_document_url: lead.boq_document_url ?? null,
    proposal_estimated_cost: lead.proposal_estimated_cost ?? "",
    proposal_sent_date: lead.proposal_sent_date ?? "",
    proposal_deadline: lead.proposal_deadline ?? "",
    proposal_validity_days: lead.proposal_validity_days ?? 30,
    proposal_remarks: lead.proposal_remarks ?? "",
  })
  const [boqUploading, setBOQUploading] = useState(false)
  const [priceRevisions, setPriceRevisions] = useState<PriceRevision[]>([])
  const [newPrice, setNewPrice] = useState("")
  const [newPriceNote, setNewPriceNote] = useState("")
  const [addingPrice, setAddingPrice] = useState(false)
  const [wonData, setWonData] = useState({
    final_boq_url: lead.final_boq_url ?? null,
    final_agreed_price: lead.final_agreed_price ?? "",
    final_area_sqft: lead.final_area_sqft ?? "",
    final_floors: lead.final_floors ?? "",
    final_scope: lead.final_scope ?? "",
    final_remarks: lead.final_remarks ?? "",
    won_date: lead.won_date ?? "",
  })
  const [wonUploading, setWonUploading] = useState(false)
  const [categorising, setCategorising] = useState(false)

  // AI-categorisation fields aren't on the Lead type yet (schema migration
  // pending). Local widening keeps the JSX typed without touching lib/types.
  const leadCat = lead as Lead & {
    profile_categories?: string[] | null
    profile_category_primary?: string | null
    profile_category_reason?: string | null
  }

  useEffect(() => {
    setEditData({
      full_name: lead.full_name ?? "",
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      company_name: lead.company_name ?? "",
      designation: lead.designation ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      industry: lead.industry ?? "",
      service_line: lead.service_line ?? "",
      estimated_budget: lead.estimated_budget ?? "",
      project_size_sqft: lead.project_size_sqft ?? "",
      expected_timeline: lead.expected_timeline ?? "",
      initial_notes: lead.initial_notes ?? "",
      whatsapp_opted_in: lead.whatsapp_opted_in ?? false,
    })
    setBOQData({
      boq_received_date: lead.boq_received_date ?? "",
      boq_document_url: lead.boq_document_url ?? null,
      boq_deadline: lead.boq_deadline ?? "",
      boq_scope: lead.boq_scope ?? "",
      boq_area_sqft: lead.boq_area_sqft ?? "",
      boq_floors: lead.boq_floors ?? "",
      boq_remarks: lead.boq_remarks ?? "",
    })
    setProposalData({
      boq_document_url: lead.boq_document_url ?? null,
      proposal_estimated_cost: lead.proposal_estimated_cost ?? "",
      proposal_sent_date: lead.proposal_sent_date ?? "",
      proposal_deadline: lead.proposal_deadline ?? "",
      proposal_validity_days: lead.proposal_validity_days ?? 30,
      proposal_remarks: lead.proposal_remarks ?? "",
    })
    setWonData({
      final_boq_url: lead.final_boq_url ?? null,
      final_agreed_price: lead.final_agreed_price ?? "",
      final_area_sqft: lead.final_area_sqft ?? "",
      final_floors: lead.final_floors ?? "",
      final_scope: lead.final_scope ?? "",
      final_remarks: lead.final_remarks ?? "",
      won_date: lead.won_date ?? "",
    })
  }, [
    lead.boq_area_sqft,
    lead.boq_deadline,
    lead.boq_document_url,
    lead.boq_floors,
    lead.boq_received_date,
    lead.boq_remarks,
    lead.boq_scope,
    lead.full_name,
    lead.phone,
    lead.email,
    lead.company_name,
    lead.designation,
    lead.city,
    lead.state,
    lead.industry,
    lead.service_line,
    lead.estimated_budget,
    lead.project_size_sqft,
    lead.expected_timeline,
    lead.initial_notes,
    lead.whatsapp_opted_in,
    lead.proposal_deadline,
    lead.proposal_estimated_cost,
    lead.proposal_remarks,
    lead.proposal_sent_date,
    lead.proposal_validity_days,
    lead.final_agreed_price,
    lead.final_area_sqft,
    lead.final_boq_url,
    lead.final_floors,
    lead.final_remarks,
    lead.final_scope,
    lead.won_date,
  ])

  useEffect(() => {
    if (currentStageSlug !== "negotiation") return

    const fetchRevisions = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("lead_price_revisions")
        .select("*, profile:profiles(full_name)")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })

      if (data) {
        setPriceRevisions(data as PriceRevision[])
      }
    }

    fetchRevisions()
  }, [lead.id, currentStageSlug])

  // Compute live score breakdown
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recentInteractionCount = interactions.filter(
    (i) => new Date(i.created_at).getTime() >= thirtyDaysAgo
  ).length
  const breakdown = scoreLead(
    {
      email: lead.email,
      company_name: lead.company_name,
      city: lead.city,
      service_line: lead.service_line,
      whatsapp_opted_in: lead.whatsapp_opted_in,
      estimated_budget: lead.estimated_budget,
      source: lead.source,
      stage_slug: lead.stage?.slug ?? null,
    },
    recentInteractionCount
  )

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("leads")
        .update({
          full_name: editData.full_name.trim(),
          phone: editData.phone.trim() || null,
          email: editData.email.trim() || null,
          company_name: editData.company_name.trim() || null,
          designation: editData.designation.trim() || null,
          city: editData.city.trim() || null,
          state: editData.state.trim() || null,
          industry: editData.industry.trim() || null,
          service_line: editData.service_line || null,
          estimated_budget: editData.estimated_budget.trim() || null,
          project_size_sqft: editData.project_size_sqft
            ? Number(editData.project_size_sqft)
            : null,
          expected_timeline: editData.expected_timeline.trim() || null,
          initial_notes: editData.initial_notes.trim() || null,
          whatsapp_opted_in: editData.whatsapp_opted_in,
        })
        .eq("id", lead.id)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      toast.success("Lead updated successfully")
      setIsEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update lead")
    } finally {
      setSaving(false)
    }
  }

  const handleCategorise = async () => {
    if (!lead?.id || categorising) return
    setCategorising(true)
    try {
      const res = await fetch("/api/ai/categorise-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Lead categorised: " + data.categories.join(", "))
        queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
        queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
        queryClient.invalidateQueries({ queryKey: ["leads"] })
      } else {
        toast.error("Categorisation failed: " + data.error)
      }
    } catch {
      toast.error("Categorisation failed")
    } finally {
      setCategorising(false)
    }
  }

  const handleSaveBOQ = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase
      .from("leads")
      .update({
        boq_received_date: boqData.boq_received_date || null,
        boq_deadline: boqData.boq_deadline || null,
        boq_scope: boqData.boq_scope || null,
        boq_area_sqft: boqData.boq_area_sqft ? Number(boqData.boq_area_sqft) : null,
        boq_floors: boqData.boq_floors ? Number(boqData.boq_floors) : null,
        boq_remarks: boqData.boq_remarks || null,
        boq_received_by: user?.id ?? null,
      })
      .eq("id", lead.id)

    if (error) {
      toast.error(error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
    queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    toast.success("BOQ details saved!")
  }

  const handleProposalBOQUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBOQUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("leadId", lead.id)
      formData.append("type", "boq")
      const res = await fetch("/api/storage/upload-boq", {
        method: "POST",
        body: formData,
      })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        error?: string
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Upload failed")
      }
      setProposalData((p) => ({ ...p, boq_document_url: data.url ?? null }))
      toast.success("BOQ document uploaded!")
    } catch {
      toast.error("Upload failed")
    } finally {
      setBOQUploading(false)
    }
  }

  const handleSaveProposal = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase
      .from("leads")
      .update({
        boq_document_url: proposalData.boq_document_url,
        proposal_estimated_cost: proposalData.proposal_estimated_cost
          ? Number(proposalData.proposal_estimated_cost)
          : null,
        proposal_sent_date: proposalData.proposal_sent_date || null,
        proposal_deadline: proposalData.proposal_deadline || null,
        proposal_validity_days: proposalData.proposal_validity_days
          ? Number(proposalData.proposal_validity_days)
          : 30,
        proposal_remarks: proposalData.proposal_remarks || null,
        proposal_sent_by: user?.id ?? null,
      })
      .eq("id", lead.id)

    if (error) {
      toast.error(error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
    queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    toast.success("Proposal details saved!")
  }

  const handleAddPriceRevision = async () => {
    if (!newPrice || Number(newPrice) <= 0) {
      toast.error("Please enter a valid price")
      return
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from("lead_price_revisions")
      .insert({
        lead_id: lead.id,
        revised_price: Number(newPrice),
        revision_note: newPriceNote || null,
        revised_by: user?.id ?? null,
      })
      .select("*, profile:profiles(full_name)")
      .single()

    if (error) {
      toast.error("Failed to save revision")
      return
    }

    setPriceRevisions((prev) => [data as PriceRevision, ...prev])
    setNewPrice("")
    setNewPriceNote("")
    setAddingPrice(false)
    toast.success("Price revision saved!")
  }

  const handleFinalBOQUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setWonUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("leadId", lead.id)
      formData.append("type", "final-boq")
      const res = await fetch("/api/storage/upload-boq", {
        method: "POST",
        body: formData,
      })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        error?: string
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Upload failed")
      }
      setWonData((p) => ({ ...p, final_boq_url: data.url ?? null }))
      toast.success("Final BOQ uploaded!")
    } catch {
      toast.error("Upload failed")
    } finally {
      setWonUploading(false)
    }
  }

  const handleSaveWonDetails = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase
      .from("leads")
      .update({
        final_boq_url: wonData.final_boq_url,
        final_agreed_price: wonData.final_agreed_price
          ? Number(wonData.final_agreed_price)
          : null,
        final_area_sqft: wonData.final_area_sqft ? Number(wonData.final_area_sqft) : null,
        final_floors: wonData.final_floors ? Number(wonData.final_floors) : null,
        final_scope: wonData.final_scope || null,
        final_remarks: wonData.final_remarks || null,
        won_date: wonData.won_date || null,
        won_by: user?.id ?? null,
      })
      .eq("id", lead.id)

    if (error) {
      toast.error(error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
    queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    toast.success("Won details saved!")
  }

  return (
    <div className="thin-scrollbar flex-1 overflow-y-auto">
      {/* Stage row */}
      <div className="relative flex items-center justify-between border-b border-[#2A2A3C] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#9090A8]">Stage:</span>
          {lead.stage ? (
            <StageBadge name={lead.stage.name} color={lead.stage.color} />
          ) : (
            <span className="text-xs text-[#9090A8]">Unknown</span>
          )}
        </div>
        <button
          onClick={() => setStagePickerOpen((o) => !o)}
          className="rounded-lg border border-[#2A2A3C] px-2.5 py-1 text-[11px] font-medium text-[#9090A8] transition hover:border-[#3B82F6] hover:text-[#3B82F6]"
        >
          Move Stage
        </button>
        {stagePickerOpen && (
          <StagePickerPopover
            currentStageId={lead.stage_id ?? null}
            onSelect={(stage) => {
              setStagePickerOpen(false)
              onMoveStage(stage)
            }}
            onClose={() => setStagePickerOpen(false)}
          />
        )}
      </div>

      {/* Assigned row */}
      <div className="relative flex items-center justify-between border-b border-[#2A2A3C] px-4 py-3">
        <div className="flex items-center gap-2">
          <UserCircle className="size-4 text-[#9090A8]" />
          <span className="text-xs text-[#F0F0FA]">
            {lead.assignee?.full_name ?? "Unassigned"}
          </span>
        </div>
        {canReassign && (
          <button
            onClick={() => setReassignOpen((o) => !o)}
            disabled={isReassigning}
            className="rounded px-1.5 py-0.5 text-[11px] text-[#3B82F6] transition hover:underline disabled:opacity-50"
          >
            {isReassigning ? "Reassigning…" : "Reassign"}
          </button>
        )}
        {reassignOpen && (
          <ReassignPopover
            currentAssigneeId={lead.assigned_to ?? null}
            pending={isReassigning}
            onSelect={async (profileId, profileName) => {
              await onReassign(profileId, profileName)
              setReassignOpen(false)
            }}
            onClose={() => setReassignOpen(false)}
          />
        )}
      </div>

      {/* Score + breakdown */}
      <div className="border-b border-[#2A2A3C] px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
              Lead Score
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: `${breakdown.color}20`,
                color: breakdown.color,
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: breakdown.color }}
              />
              {breakdown.label}
            </span>
          </div>
          <div
            className="font-[family-name:var(--font-heading)] text-2xl font-semibold tabular-nums"
            style={{ color: breakdown.color }}
          >
            {breakdown.total}
            <span className="text-sm text-[#9090A8]"> / {MAX_POINTS.total}</span>
          </div>
        </div>

        <div className="space-y-2">
          <ScoreRow
            label="Budget"
            earned={breakdown.budget}
            max={MAX_POINTS.budget}
            color={getScoreLabel(Math.round((breakdown.budget / MAX_POINTS.budget) * 100)).color}
          />
          <ScoreRow
            label="Source"
            earned={breakdown.source}
            max={MAX_POINTS.source}
            color={getScoreLabel(Math.round((breakdown.source / MAX_POINTS.source) * 100)).color}
          />
          <ScoreRow
            label="Profile"
            earned={breakdown.profile}
            max={MAX_POINTS.profile}
            color={getScoreLabel(Math.round((breakdown.profile / MAX_POINTS.profile) * 100)).color}
          />
          <ScoreRow
            label="Activity (30d)"
            earned={breakdown.activity}
            max={MAX_POINTS.activity}
            color={getScoreLabel(Math.round((breakdown.activity / MAX_POINTS.activity) * 100)).color}
          />
          <ScoreRow
            label="Stage"
            earned={breakdown.stage}
            max={MAX_POINTS.stage}
            color={getScoreLabel(Math.round((breakdown.stage / MAX_POINTS.stage) * 100)).color}
          />
          <div className="pt-1">
            <ScoreRow
              label="Total"
              earned={breakdown.total}
              max={MAX_POINTS.total}
              color={breakdown.color}
              bold
            />
          </div>
        </div>
      </div>

      {/* Lead profile grid */}
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
          Lead Details
        </p>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A3C] px-2.5 py-1 text-[11px] font-medium text-[#9090A8] transition hover:border-[#3B82F6] hover:text-[#3B82F6]"
          >
            <Pencil className="size-3" />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsEditing(false)
                setEditData({
                  full_name: lead.full_name ?? "",
                  phone: lead.phone ?? "",
                  email: lead.email ?? "",
                  company_name: lead.company_name ?? "",
                  designation: lead.designation ?? "",
                  city: lead.city ?? "",
                  state: lead.state ?? "",
                  industry: lead.industry ?? "",
                  service_line: lead.service_line ?? "",
                  estimated_budget: lead.estimated_budget ?? "",
                  project_size_sqft: lead.project_size_sqft ?? "",
                  expected_timeline: lead.expected_timeline ?? "",
                  initial_notes: lead.initial_notes ?? "",
                  whatsapp_opted_in: lead.whatsapp_opted_in ?? false,
                })
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A3C] px-2.5 py-1 text-[11px] font-medium text-[#9090A8] transition hover:text-[#F0F0FA]"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg bg-[#3B82F6] px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Save
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4">
        {isEditing ? (
          <>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Full Name</label>
              <input value={editData.full_name} onChange={e => setEditData(p => ({...p, full_name: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Phone</label>
              <input value={editData.phone} onChange={e => setEditData(p => ({...p, phone: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Email</label>
              <input value={editData.email} onChange={e => setEditData(p => ({...p, email: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Company</label>
              <input value={editData.company_name} onChange={e => setEditData(p => ({...p, company_name: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Designation</label>
              <input value={editData.designation} onChange={e => setEditData(p => ({...p, designation: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">City</label>
              <input value={editData.city} onChange={e => setEditData(p => ({...p, city: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">State</label>
              <input value={editData.state} onChange={e => setEditData(p => ({...p, state: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Industry</label>
              <input value={editData.industry} onChange={e => setEditData(p => ({...p, industry: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Service Line</label>
              <select value={editData.service_line} onChange={e => setEditData(p => ({...p, service_line: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]">
                <option value="">Select service line</option>
                <option value="office_interiors">Office Interiors</option>
                <option value="mep">MEP Works</option>
                <option value="facade_glazing">Facade doors & Windows</option>
                <option value="peb_construction">PEB Construction</option>
                <option value="civil_works">Civil Works</option>
                <option value="hospitality">Hospitality</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Est. Budget</label>
              <input value={editData.estimated_budget} onChange={e => setEditData(p => ({...p, estimated_budget: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Project Size (sqft)</label>
              <input type="number" value={editData.project_size_sqft} onChange={e => setEditData(p => ({...p, project_size_sqft: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Expected Timeline</label>
              <input value={editData.expected_timeline} onChange={e => setEditData(p => ({...p, expected_timeline: e.target.value}))}
                className="mt-1 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Initial Notes</label>
              <textarea value={editData.initial_notes} onChange={e => setEditData(p => ({...p, initial_notes: e.target.value}))}
                rows={3}
                className="mt-1 w-full resize-none rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="wa-opted" checked={editData.whatsapp_opted_in}
                onChange={e => setEditData(p => ({...p, whatsapp_opted_in: e.target.checked}))}
                className="rounded" />
              <label htmlFor="wa-opted" className="text-sm text-[#F0F0FA]">WhatsApp Opted In</label>
            </div>
          </>
        ) : (
          <>
            <FieldRow label="Full Name" value={lead.full_name} />
            <FieldRow label="Phone" value={lead.phone} />
            <FieldRow label="Email" value={lead.email} />
            <FieldRow label="Company" value={lead.company_name} />
            <FieldRow label="Designation" value={lead.designation} />
            <FieldRow label="City" value={lead.city} />
            <FieldRow label="State" value={lead.state} />
            <FieldRow label="Industry" value={lead.industry} />
            <FieldRow label="Service Line" value={lead.service_line?.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} />

            {/* AI Profile Category */}
            <div
              className="col-span-2"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: "1px solid #2A2A3C",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#9090A8",
                  letterSpacing: "0.05em",
                }}
              >
                AI PROFILE
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {leadCat.profile_categories && leadCat.profile_categories.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {leadCat.profile_categories.map((cat: string) => (
                      <span
                        key={cat}
                        style={{
                          fontSize: 11,
                          padding: "3px 10px",
                          borderRadius: 4,
                          background:
                            cat === leadCat.profile_category_primary
                              ? "rgba(201,168,76,0.15)"
                              : "rgba(255,255,255,0.05)",
                          border:
                            cat === leadCat.profile_category_primary
                              ? "1px solid rgba(201,168,76,0.4)"
                              : "1px solid rgba(255,255,255,0.1)",
                          color:
                            cat === leadCat.profile_category_primary
                              ? "#C9A84C"
                              : "#9090A8",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        {cat.replace(/_/g, " ")}
                      </span>
                    ))}

                    <button
                      onClick={handleCategorise}
                      disabled={categorising}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4,
                        color: "#9090A8",
                        cursor: categorising ? "not-allowed" : "pointer",
                      }}
                    >
                      {categorising ? "..." : "↺"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCategorise}
                    disabled={categorising}
                    style={{
                      fontSize: 12,
                      padding: "6px 14px",
                      background: "rgba(201,168,76,0.1)",
                      border: "1px solid rgba(201,168,76,0.3)",
                      borderRadius: 4,
                      color: "#C9A84C",
                      cursor: categorising ? "not-allowed" : "pointer",
                      opacity: categorising ? 0.6 : 1,
                    }}
                  >
                    {categorising ? "Analysing..." : "✦ AI Categorise"}
                  </button>
                )}
              </div>
            </div>

            {leadCat.profile_category_reason && (
              <div
                className="col-span-2"
                style={{
                  fontSize: 11,
                  color: "#9090A8",
                  padding: "4px 0 8px",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                {leadCat.profile_category_reason}
              </div>
            )}

            <FieldRow label="Est. Budget" value={lead.estimated_budget} />
            <FieldRow label="Project Size" value={lead.project_size_sqft ? `${lead.project_size_sqft.toLocaleString()} sq ft` : null} />
            <FieldRow label="Expected Timeline" value={lead.expected_timeline} />
            <FieldRow label="Source" value={sourceLabel} />
            <FieldRow label="WhatsApp Opted In" value={
              <span className={lead.whatsapp_opted_in ? "text-[#34D399]" : "text-[#9090A8]"}>
                {lead.whatsapp_opted_in ? "Yes" : "No"}
              </span>
            } />
            <FieldRow label="Email Opted In" value={
              <div>
                <span className={lead.email_opted_in ? "text-[#34D399]" : "text-[#EF4444]"}>
                  {lead.email_opted_in ? "Yes" : "No"}
                </span>
                {lead.email_unsubscribed_at && (
                  <p className="mt-0.5 text-[11px] text-[#9090A8]">
                    Unsubscribed {formatDistanceToNow(new Date(lead.email_unsubscribed_at), { addSuffix: true })}
                    {lead.email_unsubscribed_campaign && (
                      <span> from <em>{lead.email_unsubscribed_campaign}</em></span>
                    )}
                  </p>
                )}
              </div>
            } />
          </>
        )}
      </div>

      {/* Notes */}
      {lead.initial_notes && (
        <div className="border-t border-[#2A2A3C] p-4">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Initial Notes</dt>
          <dd className="mt-1 text-xs leading-relaxed text-[#F0F0FA]">{lead.initial_notes}</dd>
        </div>
      )}

      <div className="px-4 pb-3">
        <div
          style={{
            background: "#1A1A24",
            border: "1px solid #2A2A3C",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 12,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: "#9090A8",
              margin: "0 0 10px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Lead Category
          </p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["hot", "warm", "lukewarm", "cold"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                style={{
                  background:
                    lead.category === cat ? categoryConfig[cat].bg : "#111118",
                  color:
                    lead.category === cat ? categoryConfig[cat].color : "#5A5A72",
                  border:
                    lead.category === cat
                      ? `1px solid ${categoryConfig[cat].color}60`
                      : "1px solid #2A2A3C",
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontWeight: lead.category === cat ? 500 : 400,
                }}
              >
                {categoryConfig[cat].label}
              </button>
            ))}
          </div>

          {lead.category && (
            <textarea
              placeholder="Add remarks... e.g. Client confirmed budget ₹1Cr+, site visit scheduled"
              defaultValue={lead.category_remarks ?? ""}
              onBlur={(e) => onRemarksUpdate(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                marginTop: 10,
                background: "#1F1F2E",
                border: "1px solid #2A2A3C",
                borderRadius: 6,
                padding: "8px 10px",
                color: "#F0F0FA",
                fontSize: 12,
                resize: "vertical",
                outline: "none",
                fontFamily: "DM Sans, sans-serif",
              }}
            />
          )}
        </div>
      </div>

      {currentStageSlug === "boq_received" && (
        <div className="px-4 pb-3">
          <div
            style={{
              background: "#1A1A24",
              border: "1px solid #2A2A3C",
              borderRadius: 8,
              padding: "14px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <FileText size={14} color="#F59E0B" />
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#F59E0B",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                BOQ Details
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Received Date
                </label>
                <input
                  type="date"
                  value={boqData.boq_received_date}
                  onChange={(e) => setBOQData((p) => ({ ...p, boq_received_date: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Proposal Deadline ⚡
                </label>
                <input
                  type="date"
                  value={boqData.boq_deadline}
                  onChange={(e) => setBOQData((p) => ({ ...p, boq_deadline: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border:
                      boqData.boq_deadline &&
                      differenceInDays(new Date(boqData.boq_deadline), new Date()) <= 3
                        ? "1px solid #EF4444"
                        : "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
                {boqData.boq_deadline &&
                  (() => {
                    const days = differenceInDays(new Date(boqData.boq_deadline), new Date())
                    if (days < 0)
                      return (
                        <p style={{ color: "#EF4444", fontSize: 10, margin: "3px 0 0" }}>
                          ⚠ Deadline passed!
                        </p>
                      )
                    if (days <= 3)
                      return (
                        <p style={{ color: "#F59E0B", fontSize: 10, margin: "3px 0 0" }}>
                          ⚠ Due in {days} day{days !== 1 ? "s" : ""}
                        </p>
                      )
                    return (
                      <p style={{ color: "#10B981", fontSize: 10, margin: "3px 0 0" }}>
                        ✓ {days} days remaining
                      </p>
                    )
                  })()}
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Scope of Work
                </label>
                <select
                  value={boqData.boq_scope}
                  onChange={(e) => setBOQData((p) => ({ ...p, boq_scope: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  <option value="">Select scope</option>
                  <option value="office_interiors">Office Interiors</option>
                  <option value="mep">MEP Works</option>
                  <option value="facade_glazing">Facade doors & Windows</option>
                  <option value="peb_construction">PEB Construction</option>
                  <option value="civil_works">Civil Works</option>
                  <option value="multiple">Multiple Scopes</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Area (sq.ft)
                </label>
                <input
                  type="number"
                  value={boqData.boq_area_sqft}
                  onChange={(e) => setBOQData((p) => ({ ...p, boq_area_sqft: e.target.value }))}
                  placeholder="e.g. 5000"
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  No. of Floors
                </label>
                <input
                  type="number"
                  value={boqData.boq_floors}
                  onChange={(e) => setBOQData((p) => ({ ...p, boq_floors: e.target.value }))}
                  placeholder="e.g. 2"
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                BOQ Remarks
              </label>
              <textarea
                value={boqData.boq_remarks}
                onChange={(e) => setBOQData((p) => ({ ...p, boq_remarks: e.target.value }))}
                placeholder="Special requirements, client preferences, site conditions..."
                rows={3}
                style={{
                  width: "100%",
                  background: "#1F1F2E",
                  border: "1px solid #2A2A3C",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "#F0F0FA",
                  fontSize: 12,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "DM Sans, sans-serif",
                }}
              />
            </div>

            <button
              onClick={handleSaveBOQ}
              style={{
                width: "100%",
                background: "#F59E0B",
                color: "#000",
                border: "none",
                borderRadius: 6,
                padding: "10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save BOQ Details
            </button>
          </div>
        </div>
      )}

      {currentStageSlug === "proposal_sent" && (
        <div className="px-4 pb-3">
          <div
            style={{
              background: "#1A1A24",
              border: "1px solid #2A2A3C",
              borderRadius: 8,
              padding: "14px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Send size={14} color="#EC4899" />
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#EC4899",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Proposal Details
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Sent Date
                </label>
                <input
                  type="date"
                  value={proposalData.proposal_sent_date}
                  onChange={(e) => setProposalData((p) => ({ ...p, proposal_sent_date: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Client Decision Deadline
                </label>
                <input
                  type="date"
                  value={proposalData.proposal_deadline}
                  onChange={(e) => setProposalData((p) => ({ ...p, proposal_deadline: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Proposed Cost (₹)
                </label>
                <input
                  type="number"
                  value={proposalData.proposal_estimated_cost}
                  onChange={(e) => setProposalData((p) => ({ ...p, proposal_estimated_cost: Number(e.target.value) }))}
                  placeholder="e.g. 5000000"
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
                {Number(proposalData.proposal_estimated_cost) > 0 && (
                  <p style={{ color: "#10B981", fontSize: 11, margin: "3px 0 0" }}>
                    ₹{(Number(proposalData.proposal_estimated_cost) / 100000).toFixed(1)} Lakhs
                  </p>
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Valid for (days)
                </label>
                <input
                  type="number"
                  value={proposalData.proposal_validity_days}
                  onChange={(e) => setProposalData((p) => ({ ...p, proposal_validity_days: Number(e.target.value) }))}
                  placeholder="30"
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                Proposal Remarks
              </label>
              <textarea
                value={proposalData.proposal_remarks}
                onChange={(e) => setProposalData((p) => ({ ...p, proposal_remarks: e.target.value }))}
                placeholder="Scope covered, exclusions, payment terms, special notes..."
                rows={3}
                style={{
                  width: "100%",
                  background: "#1F1F2E",
                  border: "1px solid #2A2A3C",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "#F0F0FA",
                  fontSize: 12,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "DM Sans, sans-serif",
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 6 }}>
                Proposed BOQ Document
              </label>
              {proposalData.boq_document_url ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#111118",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  <FileSpreadsheet size={16} color="#F59E0B" />
                  <span style={{ color: "#F0F0FA", fontSize: 13, flex: 1 }}>
                    Proposed BOQ Document
                  </span>
                  <a
                    href={proposalData.boq_document_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#3B82F6",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    <Download size={14} />
                    View
                  </a>
                  <button
                    onClick={() => setProposalData((p) => ({ ...p, boq_document_url: null }))}
                    style={{ color: "#9090A8", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <label style={{ cursor: "pointer" }}>
                  <div
                    style={{
                      border: "2px dashed #2A2A3C",
                      borderRadius: 8,
                      padding: "20px",
                      textAlign: "center",
                    }}
                  >
                    {boqUploading ? (
                      <p style={{ color: "#9090A8", fontSize: 12, margin: 0 }}>Uploading...</p>
                    ) : (
                      <>
                        <Upload size={20} color="#5A5A72" style={{ margin: "0 auto 8px" }} />
                        <p style={{ color: "#9090A8", fontSize: 12, margin: 0 }}>
                          Upload Proposed BOQ Document
                        </p>
                        <p style={{ color: "#5A5A72", fontSize: 11, margin: "4px 0 0" }}>
                          PDF, DOC, DOCX, XLSX, XLS only — Max 50MB
                        </p>
                      </>
                    )}
                  </div>
                  <input type="file" accept=".pdf,.doc,.docx,.xlsx,.xls" style={{ display: "none" }} onChange={handleProposalBOQUpload} />
                </label>
              )}
            </div>


            <button
              onClick={handleSaveProposal}
              style={{
                width: "100%",
                background: "#EC4899",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save Proposal Details
            </button>
          </div>
        </div>
      )}

      {currentStageSlug === "negotiation" && (
        <div className="px-4 pb-3">
          <div
            style={{
              background: "#1A1A24",
              border: "1px solid #2A2A3C",
              borderRadius: 8,
              padding: "14px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <TrendingDown size={14} color="#EF4444" />
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#EF4444",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Negotiation
              </p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 6 }}>
                Proposed BOQ Document
              </label>
              {lead.boq_document_url ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#111118",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  <FileText size={16} color="#F59E0B" />
                  <span style={{ color: "#F0F0FA", fontSize: 13, flex: 1 }}>
                    Proposed BOQ
                  </span>
                  <a
                    href={lead.boq_document_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#3B82F6",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    <Download size={14} />
                    View
                  </a>
                </div>
              ) : (
                <div
                  style={{
                    background: "#111118",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  <p style={{ color: "#5A5A72", fontSize: 12, margin: 0 }}>
                    No BOQ document uploaded yet
                  </p>
                </div>
              )}

              {lead.proposal_estimated_cost && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#111118",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "8px 12px",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#9090A8" }}>
                    Original Proposed Cost
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#F0F0FA" }}>
                    Rs {(lead.proposal_estimated_cost / 100000).toFixed(1)}L
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "#9090A8",
                  display: "block",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Price Revisions
              </label>

              {priceRevisions.length === 0 ? (
                <p style={{ color: "#5A5A72", fontSize: 12, margin: "0 0 8px" }}>
                  No revisions yet
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  {priceRevisions.map((rev, index) => (
                    <div
                      key={rev.id}
                      style={{
                        background: "#111118",
                        border: index === 0 ? "1px solid #10B98140" : "1px solid #2A2A3C",
                        borderRadius: 6,
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: rev.revision_note ? 4 : 0,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {index === 0 && (
                            <span
                              style={{
                                background: "#10B98120",
                                color: "#10B981",
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 20,
                              }}
                            >
                              Latest
                            </span>
                          )}
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#F0F0FA" }}>
                            Rs {(rev.revised_price / 100000).toFixed(1)}L
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "#5A5A72" }}>
                          {new Date(rev.created_at).toLocaleDateString("en-IN")}
                          {rev.profile?.full_name ? ` · ${rev.profile.full_name}` : ""}
                        </span>
                      </div>
                      {rev.revision_note && (
                        <p style={{ fontSize: 12, color: "#9090A8", margin: 0 }}>
                          {rev.revision_note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!addingPrice ? (
                <button
                  onClick={() => setAddingPrice(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: "1px dashed #3B82F6",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#3B82F6",
                    fontSize: 12,
                    cursor: "pointer",
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={13} />
                  Add Price Revision
                </button>
              ) : (
                <div
                  style={{
                    background: "#111118",
                    border: "1px solid #3B82F6",
                    borderRadius: 6,
                    padding: "12px",
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                      Revised Price (Rs)
                    </label>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="e.g. 4500000"
                      autoFocus
                      style={{
                        width: "100%",
                        background: "#1F1F2E",
                        border: "1px solid #2A2A3C",
                        borderRadius: 6,
                        padding: "6px 10px",
                        color: "#F0F0FA",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                    {newPrice && Number(newPrice) > 0 && (
                      <p style={{ color: "#10B981", fontSize: 11, margin: "3px 0 0" }}>
                        Rs {(Number(newPrice) / 100000).toFixed(1)} Lakhs
                      </p>
                    )}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={newPriceNote}
                      onChange={(e) => setNewPriceNote(e.target.value)}
                      placeholder="e.g. Client requested 10% discount"
                      style={{
                        width: "100%",
                        background: "#1F1F2E",
                        border: "1px solid #2A2A3C",
                        borderRadius: 6,
                        padding: "6px 10px",
                        color: "#F0F0FA",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={handleAddPriceRevision}
                      style={{
                        flex: 1,
                        background: "#3B82F6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "8px",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Save Revision
                    </button>
                    <button
                      onClick={() => {
                        setAddingPrice(false)
                        setNewPrice("")
                        setNewPriceNote("")
                      }}
                      style={{
                        background: "#1A1A24",
                        color: "#9090A8",
                        border: "1px solid #2A2A3C",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentStageSlug === "won" && (
        <div className="px-4 pb-3">
          <div
            style={{
              background: "#1A1A24",
              border: "1px solid #10B98140",
              borderRadius: 8,
              padding: "14px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Trophy size={14} color="#10B981" />
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#10B981",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Won - Final Details
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Won Date
                </label>
                <input
                  type="date"
                  value={wonData.won_date}
                  onChange={(e) => setWonData((p) => ({ ...p, won_date: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Final Agreed Price (Rs)
                </label>
                <input
                  type="number"
                  value={wonData.final_agreed_price}
                  onChange={(e) => setWonData((p) => ({ ...p, final_agreed_price: e.target.value }))}
                  placeholder="e.g. 4500000"
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
                {wonData.final_agreed_price && Number(wonData.final_agreed_price) > 0 && (
                  <p style={{ color: "#10B981", fontSize: 11, margin: "3px 0 0" }}>
                    Rs {(Number(wonData.final_agreed_price) / 100000).toFixed(1)} Lakhs
                  </p>
                )}
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Final Area (sq.ft)
                </label>
                <input
                  type="number"
                  value={wonData.final_area_sqft}
                  onChange={(e) => setWonData((p) => ({ ...p, final_area_sqft: e.target.value }))}
                  placeholder="e.g. 5000"
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  No. of Floors
                </label>
                <input
                  type="number"
                  value={wonData.final_floors}
                  onChange={(e) => setWonData((p) => ({ ...p, final_floors: e.target.value }))}
                  placeholder="e.g. 2"
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                  Final Scope of Work
                </label>
                <select
                  value={wonData.final_scope}
                  onChange={(e) => setWonData((p) => ({ ...p, final_scope: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "#1F1F2E",
                    border: "1px solid #2A2A3C",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "#F0F0FA",
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  <option value="">Select scope</option>
                  <option value="office_interiors">Office Interiors</option>
                  <option value="mep">MEP Works</option>
                  <option value="facade_glazing">Facade doors & Windows</option>
                  <option value="peb_construction">PEB Construction</option>
                  <option value="civil_works">Civil Works</option>
                  <option value="multiple">Multiple Scopes</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 4 }}>
                Remarks
              </label>
              <textarea
                value={wonData.final_remarks}
                onChange={(e) => setWonData((p) => ({ ...p, final_remarks: e.target.value }))}
                placeholder="Payment terms, special conditions, project start date, key contacts..."
                rows={3}
                style={{
                  width: "100%",
                  background: "#1F1F2E",
                  border: "1px solid #2A2A3C",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "#F0F0FA",
                  fontSize: 12,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "DM Sans, sans-serif",
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "#9090A8", display: "block", marginBottom: 6 }}>
                Final Agreed BOQ Document
              </label>
              {wonData.final_boq_url ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#111118",
                    border: "1px solid #10B98140",
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  <FileText size={16} color="#10B981" />
                  <span style={{ color: "#F0F0FA", fontSize: 13, flex: 1 }}>
                    Final BOQ Document
                  </span>
                  <a
                    href={wonData.final_boq_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#3B82F6",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      textDecoration: "none",
                      fontSize: 12,
                    }}
                  >
                    <Download size={14} />
                    View
                  </a>
                  <button
                    onClick={() => setWonData((p) => ({ ...p, final_boq_url: null }))}
                    style={{
                      color: "#9090A8",
                      fontSize: 11,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <label style={{ cursor: "pointer" }}>
                  <div
                    style={{
                      border: "2px dashed #10B98140",
                      borderRadius: 8,
                      padding: "20px",
                      textAlign: "center",
                    }}
                  >
                    {wonUploading ? (
                      <p style={{ color: "#9090A8", fontSize: 12, margin: 0 }}>
                        Uploading...
                      </p>
                    ) : (
                      <>
                        <Upload size={20} color="#10B981" style={{ margin: "0 auto 8px" }} />
                        <p style={{ color: "#9090A8", fontSize: 12, margin: 0 }}>
                          Upload Final BOQ Document
                        </p>
                        <p style={{ color: "#5A5A72", fontSize: 11, margin: "4px 0 0" }}>
                          PDF, DOC, DOCX, XLSX - Max 50MB
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={handleFinalBOQUpload}
                  />
                </label>
              )}
            </div>

            <button
              onClick={handleSaveWonDetails}
              style={{
                width: "100%",
                background: "#10B981",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save Won Details
            </button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="border-t border-[#2A2A3C] p-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Phone, label: "Log Call", action: onLogCall },
            { icon: CalendarPlus, label: "Schedule Follow-up", action: onScheduleFollowUp },
            { icon: Pencil, label: "Add Note", action: onAddNote },
            { icon: MessageSquare, label: "Send WhatsApp", action: onSendWhatsApp },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border border-[#2A2A3C] bg-[#1A1A24] px-3 py-3 text-sm font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E] md:py-2 md:text-xs",
                label === "Send WhatsApp" && "bg-[#25D366]/10 text-[#25D366]"
              )}
            >
              <Icon className={cn("size-3.5 text-[#9090A8]", label === "Send WhatsApp" && "text-[#25D366]")} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab 3: Tasks ────────────────────────────────────────────────────

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body_html: string
  category: string
}

interface EmailLog {
  id: string
  subject: string
  body_html: string
  status: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed"
  to_email: string
  opened_count: number | null
  clicked_count: number | null
  created_at: string
  sender: { full_name: string | null } | { full_name: string | null }[] | null
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function renderEmailTemplate(html: string, variables: Record<string, string>) {
  let rendered = html
  Object.entries(variables).forEach(([key, value]) => {
    rendered = rendered.replaceAll(`{{${key}}}`, value || "")
  })
  return rendered
}

function EmailModeToggle({
  mode,
  onChange,
}: {
  mode: EmailEditorMode
  onChange: (mode: EmailEditorMode) => void
}) {
  const options: { value: EmailEditorMode; label: string; icon: typeof Pencil }[] = [
    { value: "rich", label: "Rich", icon: Pencil },
    { value: "html", label: "HTML", icon: Code2 },
    { value: "plain", label: "Plain", icon: CaseSensitive },
  ]

  return (
    <div className="inline-flex rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-1">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-[#9090A8] transition hover:text-[#F0F0FA]",
            mode === value && "bg-[#3B82F6] text-white hover:text-white"
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

function EmailTab({
  lead,
  currentProfile,
  onSent,
}: {
  lead: Lead
  currentProfile: Profile | null | undefined
  onSent: () => void
}) {
  const queryClient = useQueryClient()
  const [toEmail, setToEmail] = useState(lead.email ?? "")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [editorMode, setEditorMode] = useState<EmailEditorMode>("rich")
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isVideoPanelOpen, setIsVideoPanelOpen] = useState(false)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  useEffect(() => {
    setToEmail(lead.email ?? "")
    setSelectedTemplateId("")
    setSubject("")
    setBodyHtml("")
    setEditorMode("rich")
    setIsVideoPanelOpen(false)
    setExpandedLogId(null)
  }, [lead.id, lead.email])

  const variables = useMemo(
    () => ({
      lead_name: lead.full_name ?? "",
      rep_name: currentProfile?.full_name ?? lead.assignee?.full_name ?? "",
      company_name: lead.company_name ?? "",
      service_line: (lead.service_line ?? "").replaceAll("_", " "),
      visit_date: "",
      city: lead.city ?? "",
    }),
    [currentProfile?.full_name, lead]
  )

  const templatesQuery = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/email/templates")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load templates")
      return data.templates as EmailTemplate[]
    },
  })

  const logsQuery = useQuery({
    queryKey: ["lead-email-logs", lead.id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("email_logs")
        .select("id, subject, body_html, status, to_email, opened_count, clicked_count, created_at, sender:sent_by(full_name)")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as EmailLog[]
    },
  })

  const selectedTemplate = templatesQuery.data?.find((t) => t.id === selectedTemplateId)
  const renderedSubject = renderEmailTemplate(subject, variables)
  const emailBodyHtml = editorMode === "plain" ? plainTextToEmailHtml(bodyHtml) : bodyHtml
  const renderedBody = renderEmailTemplate(emailBodyHtml, variables)

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templatesQuery.data?.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setBodyHtml(template.body_html)
      setEditorMode("rich")
    }
  }

  const appendToBody = (html: string) => {
    setBodyHtml((prev) => `${prev}${prev.trim() ? "\n\n" : ""}${html}`)
  }

  const handleInsertImage = () => {
    const imageUrl = window.prompt("Paste image URL")
    if (!imageUrl?.trim()) return
    const alt = window.prompt("Image alt text", "Hagerstone image") ?? "Hagerstone image"
    appendToBody(
      `<p style="text-align:center;"><img src="${imageUrl.trim()}" alt="${alt}" style="max-width:100%; height:auto; border-radius:8px;" /></p>`
    )
  }

  const saveLeadEmail = async () => {
    const trimmed = toEmail.trim()
    if (!trimmed) {
      toast.error("Enter an email address first")
      return
    }
    if (trimmed === (lead.email ?? "")) return
    setSavingEmail(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("leads")
        .update({ email: trimmed })
        .eq("id", lead.id)
      if (error) throw error
      toast.success("Lead email updated")
      queryClient.invalidateQueries({ queryKey: ["lead-detail", lead.id] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update email")
    } finally {
      setSavingEmail(false)
    }
  }

  const handleSend = async () => {
    if (!toEmail.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast.error("To email, subject and body are required")
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          to_email: toEmail.trim(),
          subject: renderedSubject,
          html: renderedBody,
          template_id: selectedTemplate?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Email send failed")
      toast.success(`Email sent to ${toEmail.trim()}`)
      queryClient.invalidateQueries({ queryKey: ["lead-email-logs", lead.id] })
      onSent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Email send failed")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#F0F0FA]">Compose & Send</h3>
              <p className="text-xs text-[#9090A8]">Send templated or custom email to this lead.</p>
            </div>
            <Mail className="size-5 text-[#3B82F6]" />
          </div>

          {!lead.email && (
            <div className="mb-4 rounded-lg border border-[#92400E]/40 bg-[#2A1F10] p-3">
              <p className="mb-2 text-xs font-medium text-[#FBBF24]">
                No email address saved for this lead
              </p>
              <div className="flex gap-2">
                <input
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="lead@example.com"
                  className="h-9 flex-1 rounded-lg border border-[#92400E]/40 bg-[#0A0A0F] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#F59E0B]"
                />
                <button
                  type="button"
                  onClick={saveLeadEmail}
                  disabled={savingEmail}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F59E0B] px-3 text-xs font-semibold text-[#111118] disabled:opacity-60"
                >
                  {savingEmail && <Loader2 className="size-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <label>
              <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">To</span>
              <div className="flex gap-2">
                <input
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="lead@example.com"
                  className="h-10 flex-1 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                />
                {savingEmail && <Loader2 className="mt-3 size-4 animate-spin text-[#9090A8]" />}
              </div>
            </label>

            <label>
              <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">Template</span>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              >
                <option value="">Select a template or write custom</option>
                {(templatesQuery.data ?? []).map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[11px] font-medium uppercase text-[#9090A8]">Subject</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="block text-[11px] font-medium uppercase text-[#9090A8]">Body</span>
                <EmailModeToggle mode={editorMode} onChange={setEditorMode} />
              </div>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleInsertImage}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
                >
                  <Camera className="size-3.5" />
                  Insert Image
                </button>
                <button
                  type="button"
                  onClick={() => setIsVideoPanelOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
                >
                  <Film className="size-3.5" />
                  Insert Video
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
                >
                  <Eye className="size-3.5" />
                  Preview
                </button>
              </div>
              {isVideoPanelOpen && (
                <div className="mb-3">
                  <VideoInsertPanel
                    onCancel={() => setIsVideoPanelOpen(false)}
                    onInsert={(html) => {
                      appendToBody(html)
                      setIsVideoPanelOpen(false)
                    }}
                  />
                </div>
              )}
              {editorMode === "rich" ? (
                <RichTextEditor
                  content={bodyHtml}
                  onChange={setBodyHtml}
                  placeholder="Hi {{lead_name}},"
                />
              ) : (
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={editorMode === "plain" ? 8 : 10}
                  placeholder={editorMode === "plain" ? "Hi {{lead_name}}," : "<p>Hi {{lead_name}},</p>"}
                  className="w-full resize-y rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                />
              )}
              <span className="mt-1 block text-[11px] text-[#9090A8]">
                Available: {"{{lead_name}}"}, {"{{rep_name}}"}, {"{{company_name}}"}, {"{{service_line}}"}, {"{{city}}"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
            >
              {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Send
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#F0F0FA]">Sent Emails</h3>
          {logsQuery.isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-[#9090A8]" />
            </div>
          ) : (logsQuery.data ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#2A2A3C] py-10 text-center text-sm text-[#9090A8]">
              <Mail className="mx-auto mb-3 size-8 text-[#5A5A72]" />
              No emails sent yet
            </div>
          ) : (
            <div className="space-y-2">
              {(logsQuery.data ?? []).map((log) => {
                const sender = Array.isArray(log.sender) ? log.sender[0] : log.sender
                const expanded = expandedLogId === log.id
                return (
                  <div key={log.id} className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24]">
                    <button
                      type="button"
                      onClick={() => setExpandedLogId(expanded ? null : log.id)}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#F0F0FA]">{log.subject}</p>
                        <p className="mt-1 text-xs text-[#9090A8]">
                          Sent by {sender?.full_name ?? "Unknown"} {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <EmailStatusPill log={log} />
                        <ChevronDown className={cn("size-4 text-[#9090A8] transition", expanded && "rotate-180")} />
                      </div>
                    </button>
                    {expanded && (
                      <div className="border-t border-[#2A2A3C] p-3">
                        <div
                          className="rounded-lg bg-[#0A0A0F] p-3 text-sm text-[#F0F0FA]"
                          dangerouslySetInnerHTML={{ __html: log.body_html }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-[#2A2A3C] bg-[#111118]">
            <div className="flex items-center justify-between border-b border-[#2A2A3C] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#F0F0FA]">{renderedSubject || "Preview"}</p>
                <p className="text-xs text-[#9090A8]">To: {toEmail || "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg p-2 text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="thin-scrollbar max-h-[70vh] overflow-y-auto p-5">
              <div
                className="email-preview prose max-w-none rounded-lg bg-white p-5 text-sm leading-relaxed text-gray-900"
                dangerouslySetInnerHTML={{ __html: renderedBody || "<p>No body yet.</p>" }}
              />
              {!renderedBody && (
                <p className="mt-3 text-xs text-[#9090A8]">{stripHtml(bodyHtml)}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EmailStatusPill({ log }: { log: EmailLog }) {
  if (log.status === "opened") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#163322] px-2 py-0.5 text-[11px] font-medium text-[#34D399]">
        <Eye className="size-3" />
        👁 Opened {log.opened_count ?? 1} times
      </span>
    )
  }
  if (log.status === "clicked") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#2E1A47] px-2 py-0.5 text-[11px] font-medium text-[#C084FC]">
        <Link2 className="size-3" />
        🔗 Clicked
      </span>
    )
  }
  if (log.status === "bounced" || log.status === "failed") {
    return <span className="rounded-full bg-[#7F1D1D] px-2 py-0.5 text-[11px] font-medium text-white">⚠ Bounced</span>
  }
  if (log.status === "delivered") {
    return <span className="rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-medium text-[#60A5FA]">Delivered</span>
  }
  return <span className="rounded-full bg-[#1F1F2E] px-2 py-0.5 text-[11px] font-medium text-[#C7C7D8]">Sent</span>
}

function TasksTab({
  leadId,
  tasks,
  isLoading,
  teamMembers,
  onComplete,
  onCreate,
  isCreating,
}: {
  leadId: string
  tasks: import("@/lib/types").Task[]
  isLoading: boolean
  teamMembers: Pick<Profile, "id" | "full_name">[]
  onComplete: (taskId: string) => Promise<void>
  onCreate: (input: { title: string; type: string; due_at: string; assigned_to: string }) => Promise<void>
  isCreating: boolean
}) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [type, setType] = useState("follow_up")
  const [dueAt, setDueAt] = useState("")
  const [assignedTo, setAssignedTo] = useState("")

  const overdue = tasks.filter((t) => !t.completed_at && t.is_overdue)
  const upcoming = tasks.filter((t) => !t.completed_at && !t.is_overdue)
  const completed = tasks.filter((t) => t.completed_at)

  const handleCreate = async () => {
    if (!title.trim() || !dueAt || !assignedTo) return
    try {
      await onCreate({
        title: title.trim(),
        type,
        due_at: new Date(dueAt).toISOString(),
        assigned_to: assignedTo,
      })
      toast.success("Task created!")
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] })
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] })
      setTitle("")
      setType("follow_up")
      setDueAt("")
      setAssignedTo("")
      setShowForm(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown task creation error"
      console.error("Task creation error:", err)
      toast.error(`Failed to create task: ${message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-[#1A1A24]" />
        ))}
      </div>
    )
  }

  const TaskRow = ({ task, isOverdue }: { task: import("@/lib/types").Task; isOverdue?: boolean }) => (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
        isOverdue
          ? "border-[#7F1D1D]/50 bg-[#2A1215]/50"
          : "border-[#2A2A3C] bg-[#1A1A24]"
      )}
    >
      <CircleDot className={cn("size-4 shrink-0", isOverdue ? "text-[#F87171]" : "text-[#9090A8]")} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[#F0F0FA]">{task.title}</p>
        <p className="text-[11px] text-[#9090A8]">
          Due {formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
          {task.assignee && ` · ${task.assignee.full_name}`}
        </p>
      </div>
      {!task.completed_at && (
        <button
          onClick={() => onComplete(task.id)}
          className="shrink-0 rounded-md border border-[#2A2A3C] px-2 py-1 text-[11px] text-[#34D399] transition hover:bg-[#163322]"
        >
          <CheckCircle2 className="size-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      {/* Add task button */}
      <div className="border-b border-[#2A2A3C] p-4">
        {showForm ? (
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-1.5 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
              autoFocus
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-xs text-[#F0F0FA] outline-none"
              >
                {taskTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-xs text-[#F0F0FA] outline-none"
              />
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-2 py-1.5 text-xs text-[#F0F0FA] outline-none"
              >
                <option value="">Assign to...</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={isCreating || !title.trim() || !dueAt || !assignedTo}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                Create Task
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-[#9090A8] transition hover:text-[#F0F0FA]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
          >
            <Plus className="size-3" />
            Add Task
          </button>
        )}
      </div>

      {/* Task list */}
      <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
        {overdue.length === 0 && upcoming.length === 0 && completed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="mb-3 size-10 text-[#9090A8]" />
            <p className="text-sm font-medium text-[#F0F0FA]">No tasks scheduled</p>
            <p className="mt-1 text-xs text-[#9090A8]">Create a task to track follow-ups.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {overdue.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-[#F87171]" />
                  <h4 className="text-xs font-semibold text-[#F87171]">
                    Overdue ({overdue.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {overdue.map((t) => (
                    <TaskRow key={t.id} task={t} isOverdue />
                  ))}
                </div>
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-[#9090A8]">
                  Upcoming ({upcoming.length})
                </h4>
                <div className="space-y-2">
                  {upcoming.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </div>
            )}

            {completed.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-[#9090A8]">
                  Completed ({completed.length})
                </h4>
                <div className="space-y-2 opacity-60">
                  {completed.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 4: Campaigns ────────────────────────────────────────────────

function CampaignsTab({
  enrollments,
  isLoading,
  userRole,
}: {
  enrollments: import("@/lib/hooks/useActivities").CampaignEnrollment[]
  isLoading: boolean
  userRole?: string
}) {
  const canEnroll = userRole === "marketing" || userRole === "manager" || userRole === "admin" || userRole === "founder"

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-[#1A1A24]" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {canEnroll && (
        <div className="border-b border-[#2A2A3C] p-4">
          <button
            onClick={placeholderToast}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
          >
            <Plus className="size-3" />
            Enroll in Campaign
          </button>
        </div>
      )}

      <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
        {enrollments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Send className="mb-3 size-10 text-[#9090A8]" />
            <p className="text-sm font-medium text-[#F0F0FA]">Not enrolled in any campaigns</p>
            <p className="mt-1 text-xs text-[#9090A8]">
              Campaigns help automate outreach sequences.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment) => {
              const totalSteps = (enrollment.campaign as { total_messages?: number })?.total_messages ?? 5
              const progress = Math.min(100, ((enrollment.current_step ?? 0) / totalSteps) * 100)

              return (
                <div
                  key={enrollment.id}
                  className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-[#F0F0FA]">
                      {enrollment.campaign?.name ?? "Unknown Campaign"}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        enrollment.status === "active"
                          ? "bg-[#163322] text-[#34D399]"
                          : enrollment.status === "completed"
                            ? "bg-[#1E3A5F] text-[#60A5FA]"
                            : "bg-[#1A1A24] text-[#9090A8]"
                      )}
                    >
                      {enrollment.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#9090A8]">
                    Enrolled {format(new Date(enrollment.enrolled_at), "MMM d, yyyy")}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-[#9090A8]">
                      <span>
                        Step {enrollment.current_step ?? 0} / {totalSteps}
                      </span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#2A2A3C]">
                      <div
                        className="h-full rounded-full bg-[#3B82F6] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={placeholderToast}
                    className="mt-2 text-[11px] text-[#F87171] transition hover:underline"
                  >
                    Unenroll
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 5: AI ───────────────────────────────────────────────────────

function CacheStatusBadge({
  cached,
  loading,
  onRegenerate,
}: {
  cached: boolean
  loading: boolean
  onRegenerate: () => void
}) {
  if (!cached) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#163322] px-2 py-0.5 text-[11px] font-medium text-[#34D399]">
        ✨ Just generated
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3A5F] px-2 py-0.5 text-[11px] font-medium text-[#60A5FA]">
      ⚡ Cached
      <button
        type="button"
        onClick={onRegenerate}
        disabled={loading}
        className="font-semibold text-white underline-offset-2 hover:underline disabled:opacity-50"
      >
        Regenerate
      </button>
    </span>
  )
}

function AITab({ lead }: { lead: Lead }) {
  const [recapLoading, setRecapLoading] = useState(false)
  const [recapData, setRecapData] = useState<{
    summary: string
    sentiment: string
    next_action: string
    message_angle: string
    cached?: boolean
    cached_at?: string
    generated_at?: string
  } | null>(null)

  const [draftLoading, setDraftLoading] = useState(false)
  const [draftData, setDraftData] = useState<{
    message: string
    tone: string
    cached?: boolean
    cached_at?: string
    generated_at?: string
  } | null>(null)

  const handleRecap = async (forceRefresh = false) => {
    setRecapLoading(true)
    if (!forceRefresh) setRecapData(null)
    try {
      const res = await fetch("/api/ai/lead-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, force_refresh: forceRefresh }),
      })
      const data = await res.json()
      setRecapData(data)
    } catch {
      toast.error("Failed to generate recap")
    } finally {
      setRecapLoading(false)
    }
  }

  const handleDraft = async (forceRefresh = false) => {
    setDraftLoading(true)
    if (!forceRefresh) setDraftData(null)
    try {
      const res = await fetch("/api/ai/draft-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          lead_name: lead.full_name,
          force_refresh: forceRefresh,
        }),
      })
      const data = await res.json()
      setDraftData(data)
    } catch {
      toast.error("Failed to draft message")
    } finally {
      setDraftLoading(false)
    }
  }

  const sentimentStyles: Record<string, string> = {
    warm: "bg-[#163322] text-[#34D399]",
    hot: "bg-[#3F161A] text-[#F87171]",
    cold: "bg-[#1E3A5F] text-[#60A5FA]",
    neutral: "bg-[#1A1A24] text-[#9090A8]",
  }

  return (
    <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        {/* Recap */}
        <div className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[#F59E0B]" />
            <h4 className="text-sm font-semibold text-[#F0F0FA]">Lead Recap</h4>
          </div>
          <p className="mt-1 text-[11px] text-[#9090A8]">
            AI-generated summary of this lead&apos;s journey and recommended next steps.
          </p>
          <button
            onClick={() => handleRecap(false)}
            disabled={recapLoading}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
          >
            {recapLoading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            Generate Lead Recap
          </button>

          {recapData && (
            <div className="mt-3 space-y-2 rounded-lg border border-[#2A2A3C] bg-[#111118] p-3">
              <CacheStatusBadge
                cached={Boolean(recapData.cached)}
                onRegenerate={() => handleRecap(true)}
                loading={recapLoading}
              />
              <p className="text-xs leading-relaxed text-[#F0F0FA]">{recapData.summary}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#9090A8]">Sentiment:</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sentimentStyles[recapData.sentiment] ?? sentimentStyles.neutral}`}
                >
                  {recapData.sentiment}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#9090A8]">Next Action:</span>
                <p className="mt-0.5 text-xs text-[#F0F0FA]">{recapData.next_action}</p>
              </div>
              <div>
                <span className="text-[11px] text-[#9090A8]">Message Angle:</span>
                <p className="mt-0.5 text-xs text-[#F0F0FA]">{recapData.message_angle}</p>
              </div>
            </div>
          )}
        </div>

        {/* Draft message */}
        <div className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-4">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-[#3B82F6]" />
            <h4 className="text-sm font-semibold text-[#F0F0FA]">Draft WhatsApp Message</h4>
          </div>
          <p className="mt-1 text-[11px] text-[#9090A8]">
            Generate a context-aware follow-up message for this lead.
          </p>
          <button
            onClick={() => handleDraft(false)}
            disabled={draftLoading}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
          >
            {draftLoading ? <Loader2 className="size-3 animate-spin" /> : <MessageSquare className="size-3" />}
            Draft WhatsApp Message
          </button>

          {draftData && (
            <div className="mt-3 rounded-lg border border-[#2A2A3C] bg-[#111118] p-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-[#9090A8]">
                    Tone: {draftData.tone}
                  </span>
                  <CacheStatusBadge
                    cached={Boolean(draftData.cached)}
                    onRegenerate={() => handleDraft(true)}
                    loading={draftLoading}
                  />
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(draftData.message)
                    toast.success("Message copied to clipboard")
                  }}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#3B82F6] transition hover:bg-[#1E3A5F]"
                >
                  <Copy className="size-3" />
                  Copy
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[#0A0A0F] p-2.5 text-xs leading-relaxed text-[#F0F0FA]">
                {draftData.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Drawer ─────────────────────────────────────────────────────

export function LeadDrawer() {
  const {
    leadDrawerId,
    setLeadDrawerId,
    drawerActiveTab,
    setDrawerActiveTab,
    drawerOpenLogCall,
    setDrawerOpenLogCall,
  } = useUIStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabName>("Overview")
  const [lastWhatsAppViewedAt, setLastWhatsAppViewedAt] = useState<string | null>(
    null
  )

  // Modal state
  const [showLogCall, setShowLogCall] = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)

  // Stage-change flow
  const [pendingToStage, setPendingToStage] = useState<PipelineStage | null>(null)
  const [isMovingStage, setIsMovingStage] = useState(false)

  // Reassign flow
  const [isReassigning, setIsReassigning] = useState(false)

  const leadQuery = useQuery({
    queryKey: ["lead-drawer-detail", leadDrawerId],
    queryFn: () => fetchLeadDetail(leadDrawerId!),
    enabled: Boolean(leadDrawerId),
  })

  const profileQuery = useQuery({
    queryKey: ["drawer-current-profile"],
    queryFn: fetchCurrentProfile,
    enabled: Boolean(leadDrawerId),
  })

  const {
    interactions,
    tasks,
    enrollments,
    teamMembers,
    currentUserId,
    isLoadingInteractions,
    isLoadingTasks,
    isLoadingEnrollments,
    addNote,
    isAddingNote,
    completeTask,
    createTask,
    isCreatingTask,
    logCall,
    scheduleFollowUp,
    refreshInteractions,
  } = useActivities(leadDrawerId)

  // Reset tab and modals when opening a new lead
  useEffect(() => {
    if (leadDrawerId) {
      setActiveTab("Overview")
      setLastWhatsAppViewedAt(null)
      setShowLogCall(false)
      setShowFollowUp(false)
      setShowWhatsApp(false)
      setPendingToStage(null)
    }
  }, [leadDrawerId])

  useEffect(() => {
    if (!drawerActiveTab) return
    if (tabs.includes(drawerActiveTab as TabName)) {
      setActiveTab(drawerActiveTab as TabName)
    }
    setDrawerActiveTab(null)
  }, [drawerActiveTab, setDrawerActiveTab])

  useEffect(() => {
    if (!drawerOpenLogCall || !leadDrawerId) return
    setShowLogCall(true)
    setDrawerOpenLogCall(false)
  }, [drawerOpenLogCall, leadDrawerId, setDrawerOpenLogCall])

  useEffect(() => {
    if (activeTab === "WhatsApp") {
      setLastWhatsAppViewedAt(new Date().toISOString())
    }
  }, [activeTab])

  const close = () => setLeadDrawerId(null)

  const lead = leadQuery.data
  const unreadWhatsAppCount = interactions.filter((interaction) => {
    if (interaction.type !== "whatsapp_received") return false
    if (!lastWhatsAppViewedAt) return true
    return (
      new Date(interaction.created_at).getTime() >
      new Date(lastWhatsAppViewedAt).getTime()
    )
  }).length

  // ── Reassign handler ─────────────────────────────────────────
  const handleReassign = async (
    profileId: string | null,
    profileName: string | null
  ) => {
    if (!lead) return
    setIsReassigning(true)
    const supabase = createClient()
    try {
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          assigned_to: profileId,
          assigned_at: profileId ? new Date().toISOString() : null,
        })
        .eq("id", lead.id)
      if (updateError) throw updateError

      await supabase.from("interactions").insert({
        lead_id: lead.id,
        user_id: currentUserId,
        type: "note",
        title: profileId ? "Lead reassigned" : "Lead unassigned",
        notes: profileId
          ? `Lead reassigned to ${profileName ?? "another rep"}`
          : "Lead unassigned",
        is_automated: true,
      })

      // Lead-reassignment notification is handled by the Supabase DB trigger
      // on the leads table — do not insert it here or it will duplicate.

      toast.success(
        profileId ? `Lead assigned to ${profileName ?? "rep"}` : "Lead unassigned"
      )

      // Refresh drawer data + downstream caches
      queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
      queryClient.invalidateQueries({ queryKey: ["lead-interactions", lead.id] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
      queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] })
      queryClient.invalidateQueries({ queryKey: ["inbox-leads"] })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reassign failed")
    } finally {
      setIsReassigning(false)
    }
  }

  const handleCategoryChange = async (cat: LeadCategory) => {
    if (!lead) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const newCategory = lead.category === cat ? null : cat
    const { error } = await supabase
      .from("leads")
      .update({
        category: newCategory,
        category_updated_at: new Date().toISOString(),
        category_updated_by: user?.id ?? null,
      })
      .eq("id", lead.id)

    if (error) {
      toast.error(error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
    queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    toast.success(newCategory ? `Category set to ${newCategory}` : "Category cleared")
  }

  const handleRemarksUpdate = async (remarks: string) => {
    if (!lead) return
    const supabase = createClient()
    const { error } = await supabase
      .from("leads")
      .update({ category_remarks: remarks })
      .eq("id", lead.id)

    if (error) {
      toast.error(error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
    toast.success("Remarks saved")
  }

  // ── Stage-change handlers ────────────────────────────────────
  const handleStageConfirm = async (values: {
    note?: string
    closureValue?: number
    lossReason?: string
  }) => {
    if (!lead || !pendingToStage) return
    setIsMovingStage(true)
    const supabase = createClient()
    const trimmedNote = values.note?.trim()
    const fromStageType = lead.stage?.stage_type
    const toStage = pendingToStage
    const now = new Date().toISOString()

    // Mirror the validations from useKanban.updateLeadStage
    if (toStage.requires_note && !trimmedNote) {
      toast.error("A note is required for this stage change.")
      setIsMovingStage(false)
      return
    }
    if (toStage.slug === "won" && (!values.closureValue || values.closureValue <= 0)) {
      toast.error("A valid deal value is required when moving a lead to Won.")
      setIsMovingStage(false)
      return
    }
    if (toStage.slug === "lost" && !values.lossReason) {
      toast.error("Please select a reason for loss before confirming.")
      setIsMovingStage(false)
      return
    }

    const payload: Record<string, string | number | null> = {
      stage_id: toStage.id,
    }
    if (toStage.slug === "won") {
      payload.closure_value = values.closureValue ?? null
      payload.closed_at = now
    } else if (toStage.slug === "lost") {
      payload.closure_reason = values.lossReason ?? null
      payload.closed_at = now
    } else if (toStage.stage_type === "active" && (fromStageType === "won" || fromStageType === "lost")) {
      payload.closed_at = null
      payload.closure_value = null
      payload.closure_reason = null
    }

    try {
      const { error: updateError } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", lead.id)
      if (updateError) throw updateError

      const { error: interactionError } = await supabase.from("interactions").insert({
        lead_id: lead.id,
        user_id: currentUserId,
        type: "stage_change",
        stage_from_id: lead.stage_id,
        stage_to_id: toStage.id,
        notes: trimmedNote ?? null,
      })
      if (interactionError) throw interactionError

      if (
        lead.assigned_to &&
        currentUserId &&
        lead.assigned_to !== currentUserId
      ) {
        supabase
          .from("notifications")
          .insert({
            user_id: lead.assigned_to,
            type: "stage_changed",
            title: "Lead Stage Updated",
            body: `${lead.full_name} moved to ${toStage.name}`,
            lead_id: lead.id,
            is_read: false,
          })
          .then(({ error }) => {
            if (error) {
              console.error("drawer stage-change notification failed:", error)
            }
          })
      }

      supabase
        .from("profiles")
        .select("id")
        .in("role", ["admin", "manager"])
        .eq("is_active", true)
        .then(async ({ data: managers, error }) => {
          if (error) {
            console.error("drawer stage-change manager lookup failed:", error)
            return
          }
          const recipients = (managers ?? []).filter(
            (manager) => manager.id !== currentUserId
          )
          if (recipients.length === 0) return
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert(
              recipients.map((manager) => ({
                user_id: manager.id,
                type: "stage_changed",
                title: "Lead Stage Changed",
                body: `${lead.full_name} moved to ${toStage.name}`,
                lead_id: lead.id,
                is_read: false,
              }))
            )
          if (notificationError) {
            console.error(
              "drawer stage-change manager notification failed:",
              notificationError
            )
          }
        })

      // Fire-and-forget rescore
      fetch("/api/leads/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      }).catch(() => {})

      toast.success(`${lead.full_name} moved to ${toStage.name}`)
      setPendingToStage(null)

      queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
      queryClient.invalidateQueries({ queryKey: ["lead-interactions", lead.id] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stage change failed")
    } finally {
      setIsMovingStage(false)
    }
  }

  // Build a KanbanLead-shape for the StageChangeModal
  const stageModalLead: KanbanLead | null = useMemo(() => {
    if (!lead) return null
    return {
      id: lead.id,
      full_name: lead.full_name,
      company_name: lead.company_name ?? null,
      phone: lead.phone ?? null,
      city: lead.city ?? null,
      service_line: lead.service_line ?? null,
      source: lead.source,
      stage_id: lead.stage_id,
      stage_entered_at: lead.stage_entered_at,
      assigned_to: lead.assigned_to ?? null,
      estimated_budget: lead.estimated_budget ?? null,
      closure_value: lead.closure_value ?? null,
      score: lead.score ?? null,
      category: lead.category ?? null,
      category_remarks: lead.category_remarks ?? null,
      category_updated_at: lead.category_updated_at ?? null,
      category_updated_by: lead.category_updated_by ?? null,
      boq_deadline: lead.boq_deadline ?? null,
      created_at: lead.created_at,
      stage: lead.stage as KanbanLead["stage"],
      assignee: lead.assignee
        ? {
            id: lead.assignee.id,
            full_name: lead.assignee.full_name,
            avatar_url: lead.assignee.avatar_url ?? undefined,
            role: lead.assignee.role,
          }
        : null,
      tasks: [],
      stage_age_days: 0,
      next_follow_up: null,
      has_overdue_follow_up: false,
    }
  }, [lead])

  const isMobile = useMediaQuery("(max-width: 768px)")

  const drawerInitial = {
    x: isMobile ? 0 : "100%",
    y: isMobile ? "100%" : 0,
  }
  const drawerAnimate = { x: 0, y: 0 }
  const drawerExit = {
    x: isMobile ? 0 : "100%",
    y: isMobile ? "100%" : 0,
  }

  return (
    <>
      <AnimatePresence>
        {leadDrawerId && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 md:top-14"
              onClick={close}
            />

            {/* Drawer panel — slides up from bottom on phones, in from
                right on tablet+. Phone: full width + 90vh sheet with
                rounded top + drag-handle pill. Tablet: full width.
                Desktop: 480px from right edge. */}
            <motion.aside
              key="drawer-panel"
              initial={drawerInitial}
              animate={drawerAnimate}
              exit={drawerExit}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={cn(
                "fixed z-40 flex flex-col bg-[#111118]",
                isMobile
                  ? "bottom-0 left-0 right-0 rounded-t-2xl border-x border-t border-[#2A2A3C]"
                  : "bottom-0 right-0 top-[56px] w-[480px] border-l border-[#2A2A3C]"
              )}
              style={{ height: isMobile ? "92vh" : undefined }}
            >
              {/* Mobile-only drag handle */}
              {isMobile && (
                <div className="flex shrink-0 justify-center pb-1 pt-3">
                  <div className="h-1 w-10 rounded-full bg-[#3A3A52]" />
                </div>
              )}
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[#2A2A3C] px-4 py-3">
                <div className="mr-3 min-w-0 flex-1">
                  {lead ? (
                    <>
                      <h2 className="truncate text-base font-bold text-[#F0F0FA]">
                        {lead.full_name}
                      </h2>
                      <p className="truncate text-xs text-[#9090A8]">
                        {lead.company_name || "No company"}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="h-5 w-36 animate-pulse rounded bg-[#1A1A24]" />
                      <div className="mt-1 h-3 w-24 animate-pulse rounded bg-[#1A1A24]" />
                    </>
                  )}
                </div>
                {lead?.stage && (
                  <div
                    className="mr-2 shrink-0 rounded-full px-2 py-1 text-[10px] font-medium text-white"
                    style={{ backgroundColor: lead.stage.color }}
                  >
                    {lead.stage.name}
                  </div>
                )}
                <button
                  onClick={close}
                  className="shrink-0 rounded-lg p-2 text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tab bar — animated underline via layoutId. On phones,
                  scrolls horizontally if the tabs overflow. */}
              <div className="thin-scrollbar flex shrink-0 overflow-x-auto border-b border-[#2A2A3C]">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "relative shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition",
                      activeTab === tab
                        ? "border-[#3B82F6] text-[#3B82F6]"
                        : "border-transparent text-[#9090A8] hover:text-[#F0F0FA]"
                    )}
                    >
                    <span className="inline-flex items-center gap-1.5">
                      {tab === "WhatsApp" && (
                        <MessageCircle className="size-3.5" />
                      )}
                      {tab === "Email" && <Mail className="size-3.5" />}
                      <span className="md:hidden">{tabShortLabels[tab]}</span>
                      <span className="hidden md:inline">{tab}</span>
                      {tab === "WhatsApp" &&
                        unreadWhatsAppCount > 0 &&
                        activeTab !== "WhatsApp" && (
                          <span className="size-2 rounded-full bg-[#EF4444]" />
                        )}
                    </span>
                    {activeTab === tab && (
                      <motion.div
                        layoutId="lead-drawer-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-sm bg-[#3B82F6]"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content — AnimatePresence swap on tab change */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTab}
                    variants={tabVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex min-h-full flex-col"
                  >
                    {activeTab === "Overview" &&
                      (lead ? (
                        <OverviewTab
                          lead={lead}
                          interactions={interactions}
                          currentUserRole={
                            (profileQuery.data?.role as UserRole | undefined) ?? null
                          }
                          onLogCall={() => setShowLogCall(true)}
                          onScheduleFollowUp={() => setShowFollowUp(true)}
                          onAddNote={() => setActiveTab("Timeline")}
                          onSendWhatsApp={() => setShowWhatsApp(true)}
                          onMoveStage={(toStage) => setPendingToStage(toStage)}
                          onReassign={handleReassign}
                          onCategoryChange={handleCategoryChange}
                          onRemarksUpdate={handleRemarksUpdate}
                          isReassigning={isReassigning}
                        />
                      ) : (
                        <LeadDrawerSkeleton />
                      ))}

                    {activeTab === "Timeline" && (
                      <LeadTimeline
                        interactions={interactions}
                        isLoading={isLoadingInteractions}
                        onAddNote={addNote}
                        isAddingNote={isAddingNote}
                      />
                    )}

                    {activeTab === "WhatsApp" &&
                      (lead ? (
                        <div className="h-full">
                          <WhatsAppChatView
                            lead={{
                              id: lead.id,
                              full_name: lead.full_name,
                              phone: lead.phone ?? "",
                              whatsapp_opted_in: lead.whatsapp_opted_in,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-1 items-center justify-center">
                          <Loader2 className="size-6 animate-spin text-[#9090A8]" />
                        </div>
                      ))}

                    {activeTab === "Email" && lead && (
                      <EmailTab
                        lead={lead}
                        currentProfile={profileQuery.data}
                        onSent={refreshInteractions}
                      />
                    )}

                    {activeTab === "Tasks" && lead && (
                      <TasksTab
                        leadId={lead.id}
                        tasks={tasks}
                        isLoading={isLoadingTasks}
                        teamMembers={teamMembers}
                        onComplete={completeTask}
                        onCreate={createTask}
                        isCreating={isCreatingTask}
                      />
                    )}

                    {activeTab === "Campaigns" && (
                      <CampaignsTab
                        enrollments={enrollments}
                        isLoading={isLoadingEnrollments}
                        userRole={profileQuery.data?.role}
                      />
                    )}

                    {activeTab === "AI" &&
                      (lead ? (
                        <AITab lead={lead} />
                      ) : (
                        <div className="flex flex-1 items-center justify-center">
                          <Loader2 className="size-6 animate-spin text-[#9090A8]" />
                        </div>
                      ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Modals — rendered outside AnimatePresence so they layer on top */}
      {lead && (
        <>
          <LogCallModal
            open={showLogCall}
            leadId={lead.id}
            leadName={lead.full_name}
            leadAssignedTo={lead.assigned_to ?? null}
            currentUserId={currentUserId}
            onClose={() => setShowLogCall(false)}
            onSubmit={logCall}
          />

          <ScheduleFollowUpModal
            open={showFollowUp}
            leadId={lead.id}
            leadName={lead.full_name}
            currentUserId={currentUserId}
            currentUserRole={profileQuery.data?.role}
            teamMembers={teamMembers}
            onClose={() => setShowFollowUp(false)}
            onSubmit={async (data) => {
              await scheduleFollowUp({ ...data, lead_name: lead.full_name })
            }}
          />

          <SendWhatsAppModal
            open={showWhatsApp}
            leadId={lead.id}
            leadName={lead.full_name}
            leadPhone={lead.phone ?? ""}
            whatsappOptedIn={lead.whatsapp_opted_in}
            currentUserId={currentUserId}
            onClose={() => setShowWhatsApp(false)}
            onSent={refreshInteractions}
          />

          <StageChangeModal
            open={Boolean(pendingToStage && stageModalLead)}
            lead={stageModalLead}
            fromStage={(lead.stage as PipelineStage | undefined) ?? null}
            toStage={pendingToStage}
            currentUserRole={(profileQuery.data?.role as UserRole | undefined) ?? undefined}
            isSubmitting={isMovingStage}
            onCancel={() => setPendingToStage(null)}
            onConfirm={handleStageConfirm}
          />
        </>
      )}
    </>
  )
}
