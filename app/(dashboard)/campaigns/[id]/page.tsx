"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Megaphone,
  Plug,
  Plus,
  Save,
  Send,
  Trash2,
  Users,
  XCircle,
} from "lucide-react"

import { useUIStore } from "@/lib/stores/uiStore"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import {
  MessageSequenceBuilder,
  type MessageDraft,
} from "@/components/campaigns/MessageSequenceBuilder"
import { EnrollLeadsModal } from "@/components/campaigns/EnrollLeadsModal"
import { getScoreLabel } from "@/lib/utils/lead-scoring"
import { cn } from "@/lib/utils"

const WRITE_ROLES = new Set(["admin", "manager", "marketing", "founder"])

interface Campaign {
  id: string
  name: string
  description: string | null
  status: string
  created_at: string
  audience_filters: { goal?: string; service_line?: string } | null
}

interface MessageRow {
  id: string
  position: number
  delay_days: number
  message_template: string
  media_url: string | null
  media_type: "image" | "document" | "video" | null
  media_filename: string | null
  buttons: { id: string; title: string }[] | null
}

interface EnrollmentRow {
  id: string
  lead_id: string
  status: string
  current_message_position: number
  enrolled_at: string
  lead:
    | {
        id: string
        full_name: string
        company_name: string | null
        score: number | null
        stage:
          | { name: string | null; color: string | null }
          | { name: string | null; color: string | null }[]
          | null
      }
    | null
}

interface DetailResponse {
  campaign: Campaign
  messages: MessageRow[]
  enrollments: EnrollmentRow[]
}

const tabs = ["Messages", "Enrolled Leads", "Settings"] as const
type TabName = (typeof tabs)[number]

// Slide direction depends on whether we're moving forward or backward
// through the tab list. `custom` feeds the direction into the variants.
const tabContentVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 20 }),
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -20,
    transition: { duration: 0.15 },
  }),
}

const statusStyles: Record<string, string> = {
  draft: "bg-[#1A1A24] text-[#9090A8]",
  active: "bg-[#163322] text-[#34D399]",
  paused: "bg-[#3F2A12] text-[#F59E0B]",
  completed: "bg-[#1E3A5F] text-[#60A5FA]",
  archived: "bg-[#1A1A24] text-[#9090A8]",
}

const enrollmentStatusStyles: Record<string, string> = {
  active: "bg-[#163322] text-[#34D399]",
  paused: "bg-[#3F2A12] text-[#F59E0B]",
  completed: "bg-[#1E3A5F] text-[#60A5FA]",
  opted_out: "bg-[#3F161A] text-[#F87171]",
}

async function fetchDetail(id: string): Promise<DetailResponse> {
  const res = await fetch(`/api/campaigns/${id}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Failed to load campaign")
  }
  return res.json()
}

async function fetchRole(): Promise<string | null> {
  const { user, profile } = await getCachedUserAndProfile()
  if (!user) return null
  return (profile?.role as string | undefined) ?? null
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { setLeadDrawerId } = useUIStore()
  const id = params?.id

  const [activeTab, setActiveTab] = useState<TabName>("Messages")
  const [enrollOpen, setEnrollOpen] = useState(false)

  // Track direction for tab slide animation — forward = +1, back = -1
  const tabIndex = tabs.indexOf(activeTab)
  const prevTabIndex = useRef(tabIndex)
  const direction = tabIndex >= prevTabIndex.current ? 1 : -1
  useEffect(() => {
    prevTabIndex.current = tabIndex
  }, [tabIndex])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["campaign-detail", id],
    queryFn: () => fetchDetail(id!),
    enabled: Boolean(id),
  })

  const { data: role } = useQuery({
    queryKey: ["campaign-current-role"],
    queryFn: fetchRole,
  })

  const canEdit = Boolean(role && WRITE_ROLES.has(role))

  const initialMessages: MessageDraft[] = useMemo(() => {
    return (data?.messages ?? []).map((m) => ({
      id: m.id,
      position: m.position,
      delay_days: m.delay_days,
      message_template: m.message_template,
      media_url: m.media_url ?? null,
      media_type: m.media_type ?? null,
      media_filename: m.media_filename ?? null,
      buttons: Array.isArray(m.buttons) ? m.buttons : [],
    }))
  }, [data?.messages])

  const enrolledIds = useMemo(
    () => new Set((data?.enrollments ?? []).map((e) => e.lead_id)),
    [data?.enrollments]
  )

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["campaign-detail", id] })

  if (isLoading) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="flex h-full flex-col items-center justify-center bg-[#0A0A0F] p-6">
        <div className="rounded-xl border border-[#7F1D1D]/50 bg-[#2A1215]/40 p-4 text-sm text-[#F87171]">
          {error instanceof Error ? error.message : "Failed to load campaign"}
        </div>
        <Link
          href="/campaigns"
          className="mt-4 text-xs text-[#9090A8] underline transition hover:text-[#F0F0FA]"
        >
          Back to campaigns
        </Link>
      </main>
    )
  }

  const { campaign, enrollments } = data

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/campaigns"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#9090A8] transition hover:text-[#F0F0FA]"
        >
          <ArrowLeft className="size-4" />
          Back to campaigns
        </Link>

        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
              <Megaphone className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
                  {campaign.name}
                </h1>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
                    statusStyles[campaign.status] ?? statusStyles.draft
                  )}
                >
                  {campaign.status}
                </span>
              </div>
              {campaign.description && (
                <p className="mt-0.5 text-sm text-[#9090A8]">{campaign.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs — animated underline via layoutId */}
        <div className="mb-4 flex border-b border-[#2A2A3C]">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "relative px-4 py-2.5 text-xs font-medium transition",
                activeTab === t
                  ? "text-[#3B82F6]"
                  : "text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              {t}
              {activeTab === t && (
                <motion.div
                  layoutId="campaign-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-sm bg-[#3B82F6]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content — sliding swap, direction based on tab index */}
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {activeTab === "Messages" && (
              <MessageSequenceBuilder
                campaignId={campaign.id}
                initialMessages={initialMessages}
                canEdit={canEdit}
              />
            )}

            {activeTab === "Enrolled Leads" && (
              <EnrolledLeadsTab
                campaignId={campaign.id}
                enrollments={enrollments}
                canEdit={canEdit}
                onOpenEnroll={() => setEnrollOpen(true)}
                onOpenLead={(leadId) => setLeadDrawerId(leadId)}
                onRefresh={refresh}
              />
            )}

            {activeTab === "Settings" && (
              <SettingsTab
                campaign={campaign}
                canEdit={canEdit}
                activeEnrollmentCount={
                  enrollments.filter((e) => e.status === "active").length
                }
                onSaved={refresh}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <EnrollLeadsModal
        open={enrollOpen}
        campaignId={campaign.id}
        alreadyEnrolledIds={enrolledIds}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={refresh}
      />
    </main>
  )
}

// ── Enrolled Leads Tab ───────────────────────────────────────────

function EnrolledLeadsTab({
  campaignId,
  enrollments,
  canEdit,
  onOpenEnroll,
  onOpenLead,
}: {
  campaignId: string
  enrollments: EnrollmentRow[]
  canEdit: boolean
  onOpenEnroll: () => void
  onOpenLead: (leadId: string) => void
  onRefresh: () => void
}) {
  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const unenrollMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await fetch(`/api/campaigns/${campaignId}/enroll`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to unenroll")
      }
      return res.json()
    },
    onSuccess: () => {
      // Refetch this campaign's detail (enrollments live here)
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", campaignId] })
      // Refetch the campaigns list (enrollment_count changes)
      queryClient.invalidateQueries({ queryKey: ["campaigns-list"] })
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      toast.success("Lead unenrolled")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to unenroll lead")
    },
    onSettled: () => {
      setPendingId(null)
    },
  })

  const handleUnenroll = (leadId: string) => {
    if (!confirm("Unenroll this lead from the campaign?")) return
    setPendingId(leadId)
    unenrollMutation.mutate(leadId)
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={onOpenEnroll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB]"
          >
            <Plus className="size-3" />
            Enroll Leads
          </button>
        </div>
      )}

      {enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#2A2A3C] bg-[#111118] py-16 text-center">
          <Users className="mb-3 size-10 text-[#9090A8]" />
          <p className="text-sm font-medium text-[#F0F0FA]">No leads enrolled yet</p>
          <p className="mt-1 text-xs text-[#9090A8]">
            Enroll leads to start their personalised message sequence.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#2A2A3C] bg-[#111118]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A3C] text-[11px] uppercase tracking-wider text-[#9090A8]">
                <th className="px-4 py-3 text-left font-medium">Lead</th>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Stage</th>
                <th className="px-4 py-3 text-left font-medium">Enrolled</th>
                <th className="px-4 py-3 text-left font-medium">Position</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => {
                const lead = e.lead
                const stageRaw = lead?.stage ?? null
                const stage: { name: string | null; color: string | null } | null = Array.isArray(
                  stageRaw
                )
                  ? stageRaw[0] ?? null
                  : stageRaw
                const scoreInfo = getScoreLabel(lead?.score ?? 0)
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[#2A2A3C]/60 transition hover:bg-[#1A1A24]/60"
                  >
                    <td className="px-4 py-3">
                      {lead ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onOpenLead(lead.id)}
                            className="font-medium text-[#F0F0FA] hover:text-[#3B82F6] hover:underline"
                          >
                            {lead.full_name}
                          </button>
                          {lead.score != null && lead.score > 0 && (
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: `${scoreInfo.color}20`,
                                color: scoreInfo.color,
                              }}
                            >
                              {lead.score}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#9090A8]">Unknown lead</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#9090A8]">
                      {lead?.company_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#9090A8]">
                      {stage?.name ? (
                        <span
                          className="inline-flex items-center gap-1.5"
                          style={{ color: stage.color ?? "#9090A8" }}
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: stage.color ?? "#9090A8" }}
                          />
                          {stage.name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#9090A8]">
                      {formatDistanceToNow(new Date(e.enrolled_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-[#F0F0FA]">
                      {e.current_message_position}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          enrollmentStatusStyles[e.status] ?? enrollmentStatusStyles.active
                        )}
                      >
                        {e.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <button
                          onClick={() => lead && handleUnenroll(lead.id)}
                          disabled={pendingId === lead?.id}
                          className="inline-flex items-center gap-1 rounded-md border border-[#2A2A3C] px-2 py-1 text-[11px] font-medium text-[#F87171] transition hover:bg-[#2A1215] disabled:opacity-50"
                        >
                          {pendingId === lead?.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            "Unenroll"
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Settings Tab ─────────────────────────────────────────────────

function SettingsTab({
  campaign,
  canEdit,
  activeEnrollmentCount,
  onSaved,
}: {
  campaign: Campaign
  canEdit: boolean
  activeEnrollmentCount: number
  onSaved: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [name, setName] = useState(campaign.name)
  const [description, setDescription] = useState(campaign.description ?? "")
  const [status, setStatus] = useState(campaign.status)
  const [goal, setGoal] = useState(campaign.audience_filters?.goal ?? "lead_nurture")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(campaign.name)
    setDescription(campaign.description ?? "")
    setStatus(campaign.status)
    setGoal(campaign.audience_filters?.goal ?? "lead_nurture")
  }, [campaign])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          status,
          goal,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast.success("Campaign updated")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns-list"] })
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      toast.success("Campaign deleted successfully")
      router.push("/campaigns")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete campaign")
    },
  })

  const handleDelete = () => {
    if (!confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return
    deleteMutation.mutate()
  }

  const canDelete = activeEnrollmentCount === 0
  const deleting = deleteMutation.isPending

  return (
    <div className="space-y-5">
      {/* Edit fields */}
      <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
        <h3 className="mb-4 font-[family-name:var(--font-heading)] text-sm font-semibold text-[#F0F0FA]">
          Campaign Details
        </h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              rows={3}
              className="w-full resize-none rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] disabled:opacity-60"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                Goal
              </label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] disabled:opacity-60"
              >
                <option value="lead_nurture">Lead Nurture</option>
                <option value="site_visit_followup">Site Visit Follow-up</option>
                <option value="proposal_followup">Proposal Follow-up</option>
                <option value="reengagement">Re-engagement</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] disabled:opacity-60"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Save className="size-3" />
                )}
                Save Settings
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-[11px] text-[#9090A8]">
          Created {format(new Date(campaign.created_at), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </section>

      {/* Test Manual Send — fires campaign's first message to all active enrollments */}
      {canEdit && <TestSendCard campaignId={campaign.id} />}

      {/* Sending Provider — placeholder */}
      <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1A1A24] text-[#9090A8]">
            <Plug className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[#F0F0FA]">
              Sending Provider
            </h3>
            <p className="mt-1 text-xs text-[#9090A8]">
              WhatsApp sending not configured. Connect Interakt or AiSensy to enable
              automatic sending. Contact your admin to set up the integration.
            </p>
            <Link
              href="/admin/integrations"
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
            >
              Configure Integration
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* Danger zone */}
      {canEdit && (
        <section className="rounded-xl border border-[#7F1D1D]/40 bg-[#2A1215]/30 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#F87171]" />
            <div className="flex-1">
              <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[#F87171]">
                Danger Zone
              </h3>
              <p className="mt-1 text-xs text-[#F0F0FA]">
                Permanently delete this campaign and all its message templates.
                Lead enrollment history is also removed.
              </p>
              {!canDelete && (
                <p className="mt-2 text-[11px] text-[#F59E0B]">
                  Cannot delete: {activeEnrollmentCount} active enrollment
                  {activeEnrollmentCount === 1 ? "" : "s"}. Pause or unenroll first.
                </p>
              )}
              <button
                onClick={handleDelete}
                disabled={!canDelete || deleting}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#7F1D1D]/50 bg-[#2A1215]/40 px-3 py-2 text-xs font-medium text-[#F87171] transition hover:bg-[#2A1215] disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
                Delete Campaign
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

// ── Test Manual Send card ────────────────────────────────────────
//
// For testing only. Fires the campaign's first message (position = 1)
// to every active enrollment via Whapi, serialised with a 2-second
// pause between messages.

interface SendResult {
  lead_id?: string
  lead: string
  phone?: string
  status: "sent" | "failed" | "skipped" | "error"
  reason?: string
  message_preview?: string
}

function TestSendCard({ campaignId }: { campaignId: string }) {
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<SendResult[] | null>(null)
  const [summary, setSummary] = useState<{ sent: number; failed: number; total: number } | null>(null)

  const handleTestSend = async () => {
    const confirmed = window.confirm(
      "This will send real WhatsApp messages to all enrolled leads. Continue?"
    )
    if (!confirmed) return

    setSending(true)
    setResults(null)
    setSummary(null)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Test send failed")

      setResults(data.results ?? [])
      setSummary({
        sent: data.sent ?? 0,
        failed: data.failed ?? 0,
        total: data.total ?? 0,
      })

      if ((data.sent ?? 0) > 0) {
        toast.success(
          `Sent to ${data.sent} lead${data.sent === 1 ? "" : "s"} successfully`
        )
      } else {
        toast.error("No messages were sent")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test send failed")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-xl border border-[#F59E0B]/30 bg-[#3F2A12]/20 p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#3F2A12] text-[#F59E0B]">
          <Send className="size-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[#F0F0FA]">
            Test Manual Send
          </h3>
          <p className="mt-1 text-xs text-[#9090A8]">
            Send the first message to all enrolled active leads right now via
            Whapi. Use for testing only.
          </p>

          {/* Warning banner */}
          <div className="mt-3 rounded-lg border border-[#7F1D1D]/40 bg-[#2A1215]/40 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#F87171]" />
              <p className="text-[11px] leading-relaxed text-[#F87171]">
                This will send real WhatsApp messages to enrolled leads. Only
                use for testing. Max 5 leads recommended to avoid number
                blocking.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestSend}
            disabled={sending}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#F59E0B] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#D97706] disabled:opacity-50"
          >
            {sending ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Sending… please wait
              </>
            ) : (
              <>
                <Send className="size-3" />
                Send First Message to All Enrolled Leads
              </>
            )}
          </button>

          {/* Summary line */}
          {summary && (
            <p className="mt-4 text-xs text-[#9090A8]">
              <span className="text-[#34D399]">{summary.sent} sent</span>
              <span className="mx-1.5">·</span>
              <span className="text-[#F87171]">{summary.failed} failed</span>
              <span className="mx-1.5">·</span>
              <span>{summary.total} total</span>
            </p>
          )}

          {/* Results table */}
          {results && results.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-[#2A2A3C]">
              <table className="w-full text-xs">
                <thead className="bg-[#0F0F15] text-[10px] uppercase tracking-wider text-[#9090A8]">
                  <tr>
                    <th className="px-3 py-2 text-left">Lead</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A3C]/60">
                  {results.map((r, i) => (
                    <tr
                      key={`${r.lead_id ?? r.lead}-${i}`}
                      className={
                        r.status === "sent"
                          ? ""
                          : r.status === "failed" || r.status === "error"
                            ? "bg-[#3F161A]/25"
                            : "bg-[#3F2A12]/20"
                      }
                    >
                      <td className="px-3 py-2 text-[#F0F0FA]">{r.lead}</td>
                      <td className="px-3 py-2 font-mono text-[#9090A8]">
                        {r.phone ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "sent" ? (
                          <span className="inline-flex items-center gap-1 text-[#34D399]">
                            <CheckCircle2 className="size-3" />
                            Sent
                          </span>
                        ) : (
                          <span
                            className={
                              r.status === "skipped"
                                ? "inline-flex items-center gap-1 text-[#F59E0B]"
                                : "inline-flex items-center gap-1 text-[#F87171]"
                            }
                            title={r.reason}
                          >
                            <XCircle className="size-3" />
                            {r.status === "skipped"
                              ? "Skipped"
                              : r.status === "error"
                                ? "Error"
                                : "Failed"}
                            {r.reason && (
                              <span className="text-[10px] text-[#9090A8]">
                                {" · "}
                                {r.reason.length > 40
                                  ? `${r.reason.slice(0, 40)}…`
                                  : r.reason}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
