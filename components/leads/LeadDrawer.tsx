"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, format } from "date-fns"
import { toast } from "sonner"
import {
  X,
  Phone,
  CalendarPlus,
  Pencil,
  MessageSquare,
  CheckCircle2,
  CircleDot,
  AlertTriangle,
  Loader2,
  Copy,
  Sparkles,
  Bot,
  Send,
  Plus,
  UserCircle,
  ChevronRight,
} from "lucide-react"

import { useUIStore } from "@/lib/stores/uiStore"
import { useActivities } from "@/lib/hooks/useActivities"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { LeadTimeline } from "@/components/leads/LeadTimeline"
import { LogCallModal } from "@/components/leads/LogCallModal"
import { ScheduleFollowUpModal } from "@/components/leads/ScheduleFollowUpModal"
import { SendWhatsAppModal } from "@/components/leads/SendWhatsAppModal"
import { ReassignPopover } from "@/components/leads/ReassignPopover"
import { StagePickerPopover } from "@/components/leads/StagePickerPopover"
import { StageChangeModal } from "@/components/kanban/StageChangeModal"
import { scoreLead, getScoreLabel, MAX_POINTS } from "@/lib/utils/lead-scoring"
import type { Lead, PipelineStage, Profile, UserRole } from "@/lib/types"
import type { KanbanLead } from "@/lib/hooks/useKanban"
import type { TimelineInteraction } from "@/lib/hooks/useActivities"
import { cn } from "@/lib/utils"

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

const tabs = ["Overview", "Timeline", "Tasks", "Campaigns", "AI"] as const
type TabName = (typeof tabs)[number]

// Shorter labels used on phone widths so all 5 tabs fit without
// horizontal-scroll wrapping awkwardly.
const tabShortLabels: Record<TabName, string> = {
  Overview: "Info",
  Timeline: "History",
  Tasks: "Tasks",
  Campaigns: "Campaigns",
  AI: "AI",
}

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
        <div className="grid grid-cols-2 gap-2">
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
  isReassigning,
}: OverviewTabProps) {
  const sourceLabel = lead.source
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

  const canReassign = Boolean(currentUserRole && PRIVILEGED_ROLES.has(currentUserRole))
  const [stagePickerOpen, setStagePickerOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)

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
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4">
        <FieldRow label="Full Name" value={lead.full_name} />
        <FieldRow label="Phone" value={lead.phone} />
        <FieldRow label="Email" value={lead.email} />
        <FieldRow label="Company" value={lead.company_name} />
        <FieldRow label="Designation" value={lead.designation} />
        <FieldRow label="City" value={lead.city} />
        <FieldRow label="State" value={lead.state} />
        <FieldRow label="Industry" value={lead.industry} />
        <FieldRow label="Service Line" value={lead.service_line?.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} />
        <FieldRow label="Est. Budget" value={lead.estimated_budget} />
        <FieldRow label="Project Size" value={lead.project_size_sqft ? `${lead.project_size_sqft.toLocaleString()} sq ft` : null} />
        <FieldRow label="Expected Timeline" value={lead.expected_timeline} />
        <FieldRow label="Source" value={sourceLabel} />
        <FieldRow
          label="WhatsApp Opted In"
          value={
            <span className={lead.whatsapp_opted_in ? "text-[#34D399]" : "text-[#9090A8]"}>
              {lead.whatsapp_opted_in ? "Yes" : "No"}
            </span>
          }
        />
      </div>

      {/* Notes */}
      {lead.initial_notes && (
        <div className="border-t border-[#2A2A3C] p-4">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Initial Notes</dt>
          <dd className="mt-1 text-xs leading-relaxed text-[#F0F0FA]">{lead.initial_notes}</dd>
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
              className="flex items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
            >
              <Icon className="size-3.5 text-[#9090A8]" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab 3: Tasks ────────────────────────────────────────────────────

function TasksTab({
  tasks,
  isLoading,
  teamMembers,
  onComplete,
  onCreate,
  isCreating,
}: {
  tasks: import("@/lib/types").Task[]
  isLoading: boolean
  teamMembers: Pick<Profile, "id" | "full_name">[]
  onComplete: (taskId: string) => Promise<void>
  onCreate: (input: { title: string; type: string; due_at: string; assigned_to: string }) => Promise<void>
  isCreating: boolean
}) {
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
    await onCreate({ title: title.trim(), type, due_at: new Date(dueAt).toISOString(), assigned_to: assignedTo })
    setTitle("")
    setType("follow_up")
    setDueAt("")
    setAssignedTo("")
    setShowForm(false)
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
                <option value="follow_up">Follow-up</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="site_visit">Site Visit</option>
                <option value="proposal">Proposal</option>
                <option value="other">Other</option>
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

function AITab({ lead }: { lead: Lead }) {
  const [recapLoading, setRecapLoading] = useState(false)
  const [recapData, setRecapData] = useState<{
    summary: string
    sentiment: string
    next_action: string
    message_angle: string
  } | null>(null)

  const [draftLoading, setDraftLoading] = useState(false)
  const [draftData, setDraftData] = useState<{
    message: string
    tone: string
  } | null>(null)

  const handleRecap = async () => {
    setRecapLoading(true)
    setRecapData(null)
    try {
      const res = await fetch("/api/ai/lead-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      })
      const data = await res.json()
      setRecapData(data)
    } catch {
      toast.error("Failed to generate recap")
    } finally {
      setRecapLoading(false)
    }
  }

  const handleDraft = async () => {
    setDraftLoading(true)
    setDraftData(null)
    try {
      const res = await fetch("/api/ai/draft-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, lead_name: lead.full_name }),
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
            onClick={handleRecap}
            disabled={recapLoading}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
          >
            {recapLoading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            Generate Lead Recap
          </button>

          {recapData && (
            <div className="mt-3 space-y-2 rounded-lg border border-[#2A2A3C] bg-[#111118] p-3">
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
            onClick={handleDraft}
            disabled={draftLoading}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
          >
            {draftLoading ? <Loader2 className="size-3 animate-spin" /> : <MessageSquare className="size-3" />}
            Draft WhatsApp Message
          </button>

          {draftData && (
            <div className="mt-3 rounded-lg border border-[#2A2A3C] bg-[#111118] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#9090A8]">
                  Tone: {draftData.tone}
                </span>
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
  const { leadDrawerId, setLeadDrawerId } = useUIStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabName>("Overview")

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
      setShowLogCall(false)
      setShowFollowUp(false)
      setShowWhatsApp(false)
      setPendingToStage(null)
    }
  }, [leadDrawerId])

  const close = () => setLeadDrawerId(null)

  const lead = leadQuery.data

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

  // Detect viewport once on mount + on resize so drawer slides from
  // the bottom on phones and from the right on tablet/desktop.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const drawerInitial = isMobile ? { y: "100%" } : { x: "100%" }
  const drawerAnimate = isMobile ? { y: 0 } : { x: 0 }
  const drawerExit = isMobile ? { y: "100%" } : { x: "100%" }

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
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "fixed z-50 flex w-full flex-col border-[#2A2A3C] bg-[#111118] shadow-2xl",
                // Phone: bottom sheet
                "inset-x-0 bottom-0 h-[90vh] rounded-t-2xl border-t",
                // Tablet+: right-anchored, full height below topbar
                "md:inset-x-auto md:bottom-0 md:right-0 md:top-14 md:h-auto md:rounded-none md:border-l md:border-t-0",
                // Desktop: capped at 480px
                "lg:w-[480px]"
              )}
            >
              {/* Mobile-only drag handle */}
              <div className="flex justify-center pt-2 md:hidden">
                <span className="block h-1 w-10 rounded-full bg-[#3A3A52]" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#2A2A3C] px-4 py-3">
                <div className="min-w-0 flex-1">
                  {lead ? (
                    <>
                      <h2 className="truncate font-[family-name:var(--font-heading)] text-base font-semibold text-[#F0F0FA]">
                        {lead.full_name}
                      </h2>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="truncate text-xs text-[#9090A8]">
                          {lead.company_name || "No company"}
                        </span>
                        {lead.stage && (
                          <>
                            <ChevronRight className="size-3 text-[#9090A8]" />
                            <StageBadge name={lead.stage.name} color={lead.stage.color} />
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-5 w-36 animate-pulse rounded bg-[#1A1A24]" />
                      <div className="mt-1 h-3 w-24 animate-pulse rounded bg-[#1A1A24]" />
                    </>
                  )}
                </div>
                <button
                  onClick={close}
                  className="ml-2 shrink-0 rounded-lg p-1.5 text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Tab bar — animated underline via layoutId. On phones,
                  scrolls horizontally if the tabs overflow. */}
              <div className="thin-scrollbar flex overflow-x-auto border-b border-[#2A2A3C]">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "relative shrink-0 flex-1 px-2 py-2.5 text-xs font-medium transition md:shrink",
                      activeTab === tab
                        ? "text-[#3B82F6]"
                        : "text-[#9090A8] hover:text-[#F0F0FA]"
                    )}
                  >
                    <span className="md:hidden">{tabShortLabels[tab]}</span>
                    <span className="hidden md:inline">{tab}</span>
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
              <div className="flex flex-1 flex-col overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTab}
                    variants={tabVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-1 flex-col overflow-hidden"
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

                    {activeTab === "Tasks" && (
                      <TasksTab
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
