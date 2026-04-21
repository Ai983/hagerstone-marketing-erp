"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Interaction, Task, Campaign, Profile } from "@/lib/types"

// ── Interactions ────────────────────────────────────────────────────

export interface TimelineInteraction extends Omit<Interaction, "user" | "stage_from" | "stage_to"> {
  user?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null
  stage_from?: { id: string; name: string; color: string } | null
  stage_to?: { id: string; name: string; color: string } | null
}

async function fetchInteractions(leadId: string): Promise<TimelineInteraction[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("interactions")
    .select(
      "*, user:user_id(id, full_name, avatar_url), stage_from:stage_from_id(id, name, color), stage_to:stage_to_id(id, name, color)"
    )
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as TimelineInteraction[]
}

// ── Tasks ───────────────────────────────────────────────────────────

async function fetchTasks(leadId: string): Promise<Task[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:assigned_to(id, full_name, avatar_url, role)")
    .eq("lead_id", leadId)
    .order("due_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as Task[]
}

// ── Campaign Enrollments ────────────────────────────────────────────

export interface CampaignEnrollment {
  id: string
  lead_id: string
  campaign_id: string
  status: string
  current_step: number
  enrolled_at: string
  campaign?: Pick<Campaign, "id" | "name" | "type" | "status"> & {
    total_messages?: number
  }
}

async function fetchCampaignEnrollments(leadId: string): Promise<CampaignEnrollment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("campaign_enrollments")
    .select("*, campaign:campaign_id(id, name, type, status)")
    .eq("lead_id", leadId)
    .order("enrolled_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as CampaignEnrollment[]
}

// ── Team members (for task assignment) ──────────────────────────────

async function fetchTeamMembers(): Promise<Pick<Profile, "id" | "full_name">[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true })

  if (error) throw error
  return (data ?? []) as Pick<Profile, "id" | "full_name">[]
}

// ── Current user ────────────────────────────────────────────────────

async function fetchCurrentUserId(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ── Mutations ───────────────────────────────────────────────────────

async function addNote(leadId: string, notes: string, userId: string | null) {
  const supabase = createClient()
  const { error } = await supabase.from("interactions").insert({
    lead_id: leadId,
    user_id: userId,
    type: "note",
    title: "Note added",
    notes,
  })
  if (error) throw error
}

async function completeTask(taskId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from("tasks")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", taskId)
  if (error) throw error
}

async function createTask(input: {
  lead_id: string
  title: string
  type: string
  due_at: string
  assigned_to: string
  created_by: string | null
}) {
  const supabase = createClient()
  const { error } = await supabase.from("tasks").insert(input)
  if (error) throw error
}

/**
 * Notify the task's assignee that a task has been assigned to them.
 * Best-effort — failures are logged but do not propagate.
 */
async function notifyTaskAssigned(
  task: { lead_id: string; assigned_to: string; title: string; due_at: string },
  currentUserId: string | null
) {
  if (!task.assigned_to) return
  if (task.assigned_to === currentUserId) return // don't notify self
  try {
    const supabase = createClient()
    const dueLabel = new Date(task.due_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    await supabase.from("notifications").insert({
      user_id: task.assigned_to,
      type: "new_lead_assigned",
      title: "New task assigned to you",
      body: `${task.title} — due ${dueLabel}`,
      lead_id: task.lead_id,
    })
  } catch (err) {
    console.error("notifyTaskAssigned failed:", err)
  }
}

async function logCall(
  leadId: string,
  userId: string | null,
  data: {
    type: "call_outbound" | "call_inbound" | "call_missed"
    outcome: string
    notes: string
    duration_minutes: number | null
  }
) {
  const supabase = createClient()
  const { error } = await supabase.from("interactions").insert({
    lead_id: leadId,
    user_id: userId,
    type: data.type,
    outcome: data.outcome,
    notes: data.notes || null,
    duration_minutes: data.duration_minutes,
  })
  if (error) throw error
}

async function scheduleFollowUp(
  leadId: string,
  userId: string | null,
  data: {
    type: string
    due_at: string
    notes: string
    assigned_to: string
    lead_name: string
  }
) {
  const supabase = createClient()

  // Create task — always stamp created_by with the current user so we
  // know who scheduled the follow-up.
  const { error: taskError } = await supabase.from("tasks").insert({
    lead_id: leadId,
    title: `Follow up with ${data.lead_name}`,
    type: data.type,
    due_at: data.due_at,
    assigned_to: data.assigned_to,
    description: data.notes || null,
    created_by: userId,
  })
  if (taskError) throw taskError

  // Map follow-up type to interaction type
  const interactionTypeMap: Record<string, string> = {
    call: "call_outbound",
    whatsapp: "whatsapp_sent",
    email: "email_sent",
    site_visit: "site_visit",
    meeting: "meeting",
  }

  // Log interaction
  const { error: interactionError } = await supabase.from("interactions").insert({
    lead_id: leadId,
    user_id: userId,
    type: interactionTypeMap[data.type] ?? "note",
    title: `Follow-up scheduled: ${data.type}`,
    notes: data.notes || null,
    follow_up_at: data.due_at,
    follow_up_type: data.type,
  })
  if (interactionError) throw interactionError
}

// ── Hook ────────────────────────────────────────────────────────────

export function useActivities(leadId: string | null) {
  const queryClient = useQueryClient()
  const enabled = Boolean(leadId)

  const interactionsQuery = useQuery({
    queryKey: ["lead-interactions", leadId],
    queryFn: () => fetchInteractions(leadId!),
    enabled,
  })

  const tasksQuery = useQuery({
    queryKey: ["lead-tasks", leadId],
    queryFn: () => fetchTasks(leadId!),
    enabled,
  })

  const enrollmentsQuery = useQuery({
    queryKey: ["lead-enrollments", leadId],
    queryFn: () => fetchCampaignEnrollments(leadId!),
    enabled,
  })

  const teamMembersQuery = useQuery({
    queryKey: ["team-members-minimal"],
    queryFn: fetchTeamMembers,
    enabled,
  })

  const currentUserQuery = useQuery({
    queryKey: ["current-user-id"],
    queryFn: fetchCurrentUserId,
    enabled,
  })

  const addNoteMutation = useMutation({
    mutationFn: (notes: string) => addNote(leadId!, notes, currentUserQuery.data ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-interactions", leadId] })
    },
  })

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => completeTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: async (input: { title: string; type: string; due_at: string; assigned_to: string }) => {
      const currentUserId = currentUserQuery.data ?? null
      await createTask({ ...input, lead_id: leadId!, created_by: currentUserId })
      // Fire-and-forget — never awaited, errors swallowed in the helper
      notifyTaskAssigned(
        { ...input, lead_id: leadId! },
        currentUserId
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })

  const logCallMutation = useMutation({
    mutationFn: async (data: {
      type: "call_outbound" | "call_inbound" | "call_missed"
      outcome: string
      notes: string
      duration_minutes: number | null
      follow_up?: { due_at: string; type: string }
    }) => {
      const currentUserId = currentUserQuery.data ?? null
      await logCall(leadId!, currentUserId, data)
      if (data.follow_up) {
        const followUpTask = {
          lead_id: leadId!,
          title: `Follow up after call`,
          type: data.follow_up.type,
          due_at: data.follow_up.due_at,
          assigned_to: currentUserId ?? "",
        }
        await createTask({ ...followUpTask, created_by: currentUserId })
        // Fire-and-forget notification
        notifyTaskAssigned(followUpTask, currentUserId)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-interactions", leadId] })
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
      // Auto-score after a call is logged (new interaction affects activity score)
      if (leadId) {
        fetch("/api/leads/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId }),
        }).catch(() => {
          // scoring failure shouldn't block the call-log UX
        })
      }
    },
  })

  const scheduleFollowUpMutation = useMutation({
    mutationFn: async (data: {
      type: string
      due_at: string
      notes: string
      assigned_to: string
      lead_name: string
    }) => {
      await scheduleFollowUp(leadId!, currentUserQuery.data ?? null, data)
      // Fire-and-forget notification
      notifyTaskAssigned(
        {
          lead_id: leadId!,
          assigned_to: data.assigned_to,
          title: `Follow up with ${data.lead_name}`,
          due_at: data.due_at,
        },
        currentUserQuery.data ?? null
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-interactions", leadId] })
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] })
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })

  return {
    interactions: interactionsQuery.data ?? [],
    tasks: tasksQuery.data ?? [],
    enrollments: enrollmentsQuery.data ?? [],
    teamMembers: teamMembersQuery.data ?? [],
    currentUserId: currentUserQuery.data ?? null,
    isLoadingInteractions: interactionsQuery.isLoading,
    isLoadingTasks: tasksQuery.isLoading,
    isLoadingEnrollments: enrollmentsQuery.isLoading,
    addNote: addNoteMutation.mutateAsync,
    isAddingNote: addNoteMutation.isPending,
    completeTask: completeTaskMutation.mutateAsync,
    createTask: createTaskMutation.mutateAsync,
    isCreatingTask: createTaskMutation.isPending,
    logCall: logCallMutation.mutateAsync,
    scheduleFollowUp: scheduleFollowUpMutation.mutateAsync,
    refreshInteractions: () => queryClient.invalidateQueries({ queryKey: ["lead-interactions", leadId] }),
  }
}
