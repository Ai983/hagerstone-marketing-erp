"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

/**
 * Badge numbers for the sidebar. There is no "unassigned leads" count
 * any more — leads are not assigned to people; the whole team works the
 * same book.
 */
async function fetchSidebarCounts(currentUserId: string | null) {
  const supabase = createClient()

  const [overdueRes, adminOverdueRes] = await Promise.all([
    // `is_overdue` lives on the overdue_tasks VIEW, not the tasks table
    // (PRD §5). Querying tasks.is_overdue returns PostgREST 42703 → 400.
    currentUserId
      ? supabase
          .from("overdue_tasks")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", currentUserId)
          .eq("is_overdue", true)
          .is("completed_at", null)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("overdue_tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_overdue", true)
      .is("completed_at", null),
  ])

  return {
    overdueTasks: overdueRes.count ?? 0,
    adminOverdueTasks: adminOverdueRes.count ?? 0,
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
