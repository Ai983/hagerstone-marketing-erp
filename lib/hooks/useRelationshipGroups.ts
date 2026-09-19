"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { createClient } from "@/lib/supabase/client"
import type { LeadRelationshipRow, UniverseRelationshipGroup } from "@/lib/types"

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
