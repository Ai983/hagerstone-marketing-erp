"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { useKanbanStore } from "@/lib/stores/kanbanStore"
import type { KanbanLead } from "@/lib/hooks/useKanban"
import type { PipelineStage, Profile } from "@/lib/types"

// ── Helpers ─────────────────────────────────────────────────────────

/** Fetch a single lead with stage + assignee joins (same shape as kanban query) */
async function fetchSingleLead(id: string): Promise<KanbanLead | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, full_name, company_name, phone, city, service_line, source, stage_id, stage_entered_at, assigned_to, estimated_budget, closure_value, score, created_at, stage:stage_id(*), assignee:assigned_to(id, full_name, avatar_url, role), tasks:tasks!left(id, lead_id, title, type, due_at, completed_at, assigned_to)"
    )
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return null

  const stage = Array.isArray(data.stage) ? data.stage[0] : data.stage
  const assignee = Array.isArray(data.assignee) ? data.assignee[0] : data.assignee

  const incompleteTasks = ((data.tasks ?? []) as Array<{ id: string; lead_id?: string; title?: string; type?: string; due_at: string; completed_at?: string | null; assigned_to?: string | null }>)
    .filter((t) => !t.completed_at)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())

  const nextFollowUp = incompleteTasks[0] ?? null
  const hasOverdueFollowUp = nextFollowUp
    ? new Date(nextFollowUp.due_at).getTime() < Date.now()
    : false

  const diffMs = Date.now() - new Date(data.stage_entered_at).getTime()
  const stageAgeDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

  return {
    id: data.id,
    full_name: data.full_name,
    company_name: data.company_name,
    phone: data.phone,
    city: data.city,
    service_line: data.service_line,
    source: data.source,
    stage_id: data.stage_id,
    stage_entered_at: data.stage_entered_at,
    assigned_to: data.assigned_to,
    estimated_budget: data.estimated_budget,
    closure_value: data.closure_value,
    score: data.score,
    created_at: data.created_at,
    stage: (stage as PipelineStage & { color: string }) ?? null,
    assignee: (assignee as Pick<Profile, "id" | "full_name" | "avatar_url" | "role">) ?? null,
    tasks: incompleteTasks,
    stage_age_days: stageAgeDays,
    next_follow_up: nextFollowUp,
    has_overdue_follow_up: hasOverdueFollowUp,
  } as KanbanLead
}

// ── Realtime event types ────────────────────────────────────────────

interface LeadPayload {
  id: string
  full_name?: string
  stage_id?: string
  assigned_to?: string | null
  [key: string]: unknown
}

interface TaskPayload {
  id: string
  lead_id?: string
  completed_at?: string | null
  [key: string]: unknown
}

// ── Callback refs ───────────────────────────────────────────────────

type RealtimeCallbacks = {
  onLeadInserted: (leadId: string) => void
  onLeadUpdated: (leadId: string, oldStageId: string | undefined, newStageId: string | undefined, updatedBy: string | null) => void
  onLeadDeleted: (leadId: string) => void
}

// ── Hook ────────────────────────────────────────────────────────────

export function useRealtime(callbacks: RealtimeCallbacks) {
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const store = useKanbanStore

  useEffect(() => {
    const supabase = createClient()

    // Get current user id synchronously from cached query
    let currentUserId: string | null = null
    supabase.auth.getUser().then(({ data }) => {
      currentUserId = data.user?.id ?? null
    })

    const channel = supabase
      .channel("kanban-realtime")

      // ── Leads channel ──────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        async (payload) => {
          const newLead = payload.new as LeadPayload
          const fullLead = await fetchSingleLead(newLead.id)
          if (fullLead) {
            store.getState().addLead(fullLead)
            callbacks.onLeadInserted(fullLead.id)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        async (payload) => {
          const updated = payload.new as LeadPayload
          const old = payload.old as LeadPayload
          const stageChanged = old.stage_id !== updated.stage_id

          // Re-fetch the full lead with joins
          const fullLead = await fetchSingleLead(updated.id)
          if (!fullLead) return

          // Update in store
          store.getState().updateLead(fullLead)

          // If stage changed, determine who moved it
          if (stageChanged) {
            callbacks.onLeadUpdated(
              updated.id,
              old.stage_id,
              updated.stage_id,
              (updated.assigned_to as string | null) ?? null
            )

            // Show toast if moved by another user
            // We check the most recent stage_change interaction to find who did it
            const supabaseInner = createClient()
            const { data: recentInteraction } = await supabaseInner
              .from("interactions")
              .select("user_id, user:user_id(full_name)")
              .eq("lead_id", updated.id)
              .eq("type", "stage_change")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()

            const movedByUserId = recentInteraction?.user_id
            if (movedByUserId && movedByUserId !== currentUserId) {
              const user = Array.isArray(recentInteraction?.user)
                ? recentInteraction.user[0]
                : recentInteraction?.user
              const userName = (user as { full_name?: string })?.full_name ?? "Someone"
              const stageName = fullLead.stage?.name ?? "a new stage"
              toast.info(`${userName} moved ${fullLead.full_name} to ${stageName}`)
            }
          } else {
            // Non-stage update — still flash the card
            callbacks.onLeadUpdated(updated.id, undefined, undefined, null)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        (payload) => {
          const deleted = payload.old as LeadPayload
          callbacks.onLeadDeleted(deleted.id)
          store.getState().setLeads(
            store.getState().leads.filter((l) => l.id !== deleted.id)
          )
        }
      )

      // ── Tasks channel ──────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          const task = (payload.new ?? payload.old) as TaskPayload
          const leadId = task?.lead_id

          // Invalidate the drawer's task query if it matches the open lead
          if (leadId) {
            queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] })
          }

          // Also refresh kanban leads so follow-up badges update
          queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
        }
      )

      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
