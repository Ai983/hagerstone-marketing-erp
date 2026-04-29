"use client"

import { useEffect, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { createClient } from "@/lib/supabase/client"
import { getCachedUserAndProfile } from "@/lib/hooks/useUser"
import { useKanbanStore } from "@/lib/stores/kanbanStore"
import type { LeadSource, PipelineStage, Profile, ServiceLine, UserRole } from "@/lib/types"
import type { LeadCategory } from "@/lib/utils/lead-category"

interface KanbanTask {
  id: string
  lead_id?: string
  title?: string
  type?: string
  due_at: string
  completed_at?: string | null
  assigned_to?: string | null
}

export interface KanbanLead {
  id: string
  full_name: string
  company_name?: string | null
  phone?: string | null
  city?: string | null
  service_line?: ServiceLine | null
  source: LeadSource
  stage_id: string
  stage_entered_at: string
  assigned_to?: string | null
  estimated_budget?: string | null
  closure_value?: number | null
  score?: number | null
  category?: LeadCategory | null
  category_remarks?: string | null
  category_updated_at?: string | null
  category_updated_by?: string | null
  boq_deadline?: string | null
  created_at: string
  stage?: (PipelineStage & { color: string }) | null
  assignee?: Pick<Profile, "id" | "full_name" | "avatar_url" | "role"> | null
  tasks?: KanbanTask[]
  stage_age_days: number
  next_follow_up?: KanbanTask | null
  has_overdue_follow_up: boolean
}

export interface KanbanBoardColumn {
  stage: PipelineStage
  leads: KanbanLead[]
}

const privilegedRoles: UserRole[] = ["manager", "admin"]

function getStageAgeDays(stageEnteredAt: string) {
  const diffMs = Date.now() - new Date(stageEnteredAt).getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function normalizeLead(lead: Omit<KanbanLead, "stage_age_days" | "next_follow_up" | "has_overdue_follow_up">): KanbanLead {
  const incompleteTasks = (lead.tasks ?? [])
    .filter((task) => !task.completed_at)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())

  const nextFollowUp = incompleteTasks[0] ?? null
  const hasOverdueFollowUp = nextFollowUp
    ? new Date(nextFollowUp.due_at).getTime() < Date.now()
    : false

  return {
    ...lead,
    tasks: incompleteTasks,
    stage_age_days: getStageAgeDays(lead.stage_entered_at),
    next_follow_up: nextFollowUp,
    has_overdue_follow_up: hasOverdueFollowUp,
  }
}

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

async function fetchStages() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("position", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as PipelineStage[]
}

async function fetchKanbanLeads() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, full_name, company_name, phone, city, service_line, source, stage_id, stage_entered_at, assigned_to, estimated_budget, closure_value, score, category, category_remarks, category_updated_at, category_updated_by, boq_deadline, created_at, stage:stage_id(*), assignee:assigned_to(id, full_name, avatar_url, role), tasks:tasks!left(id, lead_id, title, type, due_at, completed_at, assigned_to)"
    )
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map((lead) =>
    normalizeLead({
      id: lead.id,
      full_name: lead.full_name,
      company_name: lead.company_name,
      phone: lead.phone,
      city: lead.city,
      service_line: lead.service_line,
      source: lead.source,
      stage_id: lead.stage_id,
      stage_entered_at: lead.stage_entered_at,
      assigned_to: lead.assigned_to,
      estimated_budget: lead.estimated_budget,
      closure_value: lead.closure_value,
      score: lead.score,
      category: lead.category,
      category_remarks: lead.category_remarks,
      category_updated_at: lead.category_updated_at,
      category_updated_by: lead.category_updated_by,
      boq_deadline: lead.boq_deadline,
      created_at: lead.created_at,
      stage: getSingleRelation(lead.stage) as KanbanLead["stage"],
      assignee: getSingleRelation(lead.assignee) as KanbanLead["assignee"],
      tasks: (lead.tasks ?? []) as KanbanTask[],
    })
  )
}

async function fetchCurrentProfile() {
  // Use the shared cache — every other hook on the same page hits this
  // same helper, so resolving auth once avoids the token-lock race.
  const { user, profile } = await getCachedUserAndProfile()
  if (!user) return null
  return (profile as Profile | null) ?? null
}

async function fetchTeamMembers() {
  const supabase = createClient()
  // Minimal column set — only what the Assigned To filter actually
  // reads. Keeps the query 400-proof against schema drift.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("is_active", true)
    .order("full_name", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as Profile[]
}

export function useKanban() {
  const queryClient = useQueryClient()
  const { leads, stages, filters, setLeads, setStages } = useKanbanStore()

  const stagesQuery = useQuery({
    queryKey: ["kanban-stages"],
    queryFn: fetchStages,
  })

  const leadsQuery = useQuery({
    queryKey: ["kanban-leads"],
    queryFn: fetchKanbanLeads,
    refetchInterval: 60000,
  })

  const currentProfileQuery = useQuery({
    queryKey: ["kanban-current-profile"],
    queryFn: fetchCurrentProfile,
  })

  const canFilterAssignedTo = privilegedRoles.includes(
    (currentProfileQuery.data?.role ?? "sales_rep") as UserRole
  )

  const teamMembersQuery = useQuery({
    queryKey: ["kanban-team-members"],
    queryFn: fetchTeamMembers,
    enabled: canFilterAssignedTo,
  })

  useEffect(() => {
    if (leadsQuery.data) {
      setLeads(leadsQuery.data)
    }
  }, [leadsQuery.data, setLeads])

  useEffect(() => {
    if (stagesQuery.data) {
      setStages(stagesQuery.data)
    }
  }, [setStages, stagesQuery.data])

  const filteredLeads = useMemo(() => {
    const out = leads.filter((lead) => {
      const matchesMyLeads =
        !filters.myLeadsOnly || lead.assigned_to === currentProfileQuery.data?.id
      const matchesOverdue = !filters.overdueOnly || lead.has_overdue_follow_up
      const matchesServiceLine =
        filters.serviceLines.length === 0 ||
        (lead.service_line ? filters.serviceLines.includes(lead.service_line) : false)
      const matchesSource =
        filters.sources.length === 0 || filters.sources.includes(lead.source)
      const matchesAssignedTo =
        filters.assignedTo.length === 0 ||
        filters.assignedTo.includes(lead.assigned_to ?? "")
      const matchesCategory =
        !filters.category ||
        filters.category === "" ||
        (filters.category === "uncategorized"
          ? lead.category == null
          : lead.category === filters.category)

      return (
        matchesMyLeads &&
        matchesOverdue &&
        matchesServiceLine &&
        matchesSource &&
        matchesAssignedTo &&
        matchesCategory
      )
    })
    // When an Assigned To filter is active, log a sample of leads so
    // we can verify the UUIDs being compared. Only the first 3 are
    // logged to avoid flooding the console.
    if (filters.assignedTo.length > 0) {
      console.log("[useKanban] assignedTo filter active:", filters.assignedTo)
      leads.slice(0, 3).forEach((lead) => {
        console.log("Lead assigned_to:", lead.id, "→", lead.assigned_to)
      })
    }
    console.log("[useKanban] filteredLeads:", {
      filters,
      inputCount: leads.length,
      outputCount: out.length,
    })
    return out
  }, [currentProfileQuery.data?.id, filters, leads])

  const columns = useMemo<KanbanBoardColumn[]>(() => {
    return stages.map((stage) => ({
      stage,
      leads: filteredLeads.filter((lead) => lead.stage_id === stage.id),
    }))
  }, [filteredLeads, stages])

  const updateLeadStage = async (
    leadId: string,
    newStageId: string,
    note?: string,
    closureValue?: number,
    lossReason?: string
  ) => {
    const supabase = createClient()
    const lead = leads.find((item) => item.id === leadId)
    const fromStage = stages.find((stage) => stage.id === lead?.stage_id)
    const toStage = stages.find((stage) => stage.id === newStageId)
    const role = currentProfileQuery.data?.role

    if (!lead || !fromStage || !toStage) {
      throw new Error("Unable to resolve the stage change context.")
    }

    const trimmedNote = note?.trim()
    const isManagerOrAdmin = role === "manager" || role === "admin"

    if (
      (fromStage.stage_type === "won" || fromStage.stage_type === "lost") &&
      toStage.stage_type === "active" &&
      !isManagerOrAdmin
    ) {
      throw new Error("Only managers or admins can move Won or Lost leads back to active stages.")
    }

    if (toStage.requires_note && !trimmedNote) {
      throw new Error("A note is required for this stage change.")
    }

    if (toStage.slug === "won" && (!closureValue || closureValue <= 0)) {
      throw new Error("A valid deal value is required when moving a lead to Won.")
    }

    if (toStage.slug === "lost" && !lossReason) {
      throw new Error("Please select a reason for loss before confirming.")
    }

    const now = new Date().toISOString()
    const payload: Record<string, string | number | null> = {
      stage_id: newStageId,
    }

    if (toStage.slug === "won") {
      payload.closure_value = closureValue ?? null
      payload.closed_at = now
    } else if (toStage.slug === "lost") {
      payload.closure_reason = lossReason ?? null
      payload.closed_at = now
    } else if (toStage.stage_type === "active") {
      payload.closed_at = null
      payload.closure_value = null
      payload.closure_reason = null
    }

    const { error: updateError } = await supabase.from("leads").update(payload).eq("id", leadId)

    if (updateError) {
      throw updateError
    }

    const { error: interactionError } = await supabase.from("interactions").insert({
      lead_id: leadId,
      user_id: currentProfileQuery.data?.id ?? null,
      type: "stage_change",
      stage_from_id: fromStage.id,
      stage_to_id: toStage.id,
      notes: trimmedNote ?? null,
    })

    if (interactionError) {
      throw interactionError
    }

    // Notify the lead's assignee about the stage change (if someone else moved it).
    // Fire-and-forget — never awaited, never throws, never blocks the UI.
    const movedByMe = currentProfileQuery.data?.id
    if (
      lead.assigned_to &&
      movedByMe &&
      lead.assigned_to !== movedByMe
    ) {
      supabase
        .from("notifications")
        .insert({
          user_id: lead.assigned_to,
          type: "stage_changed",
          title: `${lead.full_name} moved to ${toStage.name}`,
          body: `Stage updated by ${currentProfileQuery.data?.full_name ?? "a teammate"}`,
          lead_id: lead.id,
        })
        .then(({ error }) => {
          if (error) console.error("stage-change notification failed:", error)
        })
    }

    supabase
      .from("profiles")
      .select("id")
      .in("role", ["admin", "manager"])
      .eq("is_active", true)
      .then(async ({ data: managers, error }) => {
        if (error) {
          console.error("stage-change manager lookup failed:", error)
          return
        }
        const recipients = (managers ?? []).filter(
          (manager) => manager.id !== movedByMe
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
            "stage-change manager notification failed:",
            notificationError
          )
        }
      })

    // Auto-score after stage change (fire-and-forget)
    fetch("/api/leads/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId }),
    }).catch(() => {
      // scoring failure shouldn't break the stage update UX
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["kanban-leads"] }),
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ])
  }

  return {
    columns,
    leads,
    stages,
    filteredLeads,
    currentProfile: currentProfileQuery.data,
    teamMembers: teamMembersQuery.data ?? [],
    isLoading: stagesQuery.isLoading || leadsQuery.isLoading || currentProfileQuery.isLoading,
    isError: stagesQuery.isError || leadsQuery.isError || currentProfileQuery.isError,
    canFilterAssignedTo,
    updateLeadStage,
  }
}
