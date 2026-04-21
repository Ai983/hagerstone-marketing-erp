"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

async function fetchSidebarCounts(currentUserId: string | null) {
  const supabase = createClient()

  const [unassignedRes, overdueRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("assigned_to", null),
    currentUserId
      ? supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", currentUserId)
          .eq("is_overdue", true)
          .is("completed_at", null)
      : Promise.resolve({ count: 0 }),
  ])

  return {
    unassignedLeads: unassignedRes.count ?? 0,
    overdueTasks: overdueRes.count ?? 0,
  }
}

export function useSidebarCounts(currentUserId: string | null) {
  return useQuery({
    queryKey: ["sidebar-counts", currentUserId],
    queryFn: () => fetchSidebarCounts(currentUserId),
    enabled: true,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
