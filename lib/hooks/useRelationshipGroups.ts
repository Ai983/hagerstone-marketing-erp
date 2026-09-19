"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { endOfToday } from "date-fns"

import { createClient } from "@/lib/supabase/client"
import type { LeadFollowUp, LeadRelationshipRow, UniverseRelationshipGroup } from "@/lib/types"
import { FOLLOW_UP_ORDER } from "@/lib/utils/relationship-group"

export const RELATIONSHIP_GROUPS_KEY = ["relationship-groups"] as const

/**
 * Every open lead's relationship group, one small row each. Cards and
 * tables look their lead up in `byLeadId`, the same way DataSetBadge
 * reads useDataSets — one fetch per page, however many chips render.
 */
export function useRelationshipGroups() {
  const query = useQuery({
    queryKey: RELATIONSHIP_GROUPS_KEY,
    queryFn: async (): Promise<LeadRelationshipRow[]> => {
      const { data, error } = await createClient()
        .from("lead_relationship_groups")
        .select("lead_id, relationship_group, last_touch_at")
        .limit(10000)
      if (error) throw error
      return (data ?? []) as LeadRelationshipRow[]
    },
    // Groups move over days, not seconds; stage moves and logged
    // activity invalidate this key directly.
    staleTime: 60 * 1000,
    // Before migration 017 the view does not exist — pages must still load.
    retry: false,
  })

  const byLeadId = useMemo(
    () => new Map((query.data ?? []).map((r) => [r.lead_id, r])),
    [query.data]
  )

  return { ...query, byLeadId }
}

const PRIORITY_RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 }
function priorityRank(p: string | null) {
  return (p && PRIORITY_RANK[p]) || 5
}

/**
 * Leads due a follow-up by the end of today, closest-to-money first, plus
 * the size of the pre-rhythm backlog. Keyed under RELATIONSHIP_GROUPS_KEY
 * so every place that refreshes groups (logged call, stage move) also
 * refreshes this list.
 */
export function useFollowUpsDue() {
  return useQuery({
    queryKey: [...RELATIONSHIP_GROUPS_KEY, "follow-ups"],
    queryFn: async () => {
      const supabase = createClient()
      const [dueRes, backlogRes] = await Promise.all([
        supabase
          .from("lead_follow_ups")
          .select("*")
          .lte("due_at", endOfToday().toISOString())
          .limit(1000),
        supabase
          .from("lead_follow_ups")
          .select("lead_id", { count: "exact", head: true })
          .eq("is_backlog", true),
      ])
      if (dueRes.error) throw dueRes.error
      const due = ((dueRes.data ?? []) as LeadFollowUp[]).sort(
        (a, b) =>
          FOLLOW_UP_ORDER.indexOf(a.relationship_group) - FOLLOW_UP_ORDER.indexOf(b.relationship_group) ||
          priorityRank(a.priority) - priorityRank(b.priority) ||
          (a.due_at ?? "").localeCompare(b.due_at ?? "")
      )
      return { due, backlog: backlogRes.count ?? 0 }
    },
    staleTime: 60 * 1000,
    retry: false,
  })
}

/** Universe contact counts per group, for the Sales Engine panel. */
export function useUniverseGroupSummary() {
  return useQuery({
    queryKey: ["universe-group-summary"],
    queryFn: async () => {
      const { data, error } = await createClient().rpc("universe_group_summary")
      if (error) throw error
      const counts: Partial<Record<UniverseRelationshipGroup, number>> = {}
      for (const r of (data ?? []) as { relationship_group: UniverseRelationshipGroup; total: number }[]) {
        counts[r.relationship_group] = Number(r.total)
      }
      return counts
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
