"use client"

import { useQuery } from "@tanstack/react-query"
import { endOfToday } from "date-fns"
import { createClient } from "@/lib/supabase/client"

/**
 * Badge numbers for the sidebar. There is no "unassigned leads" count
 * any more — leads are not assigned to people; the whole team works the
 * same book.
 */
async function fetchSidebarCounts(currentUserId: string | null) {
  const supabase = createClient()

  const [overdueRes, adminOverdueRes, followUpsRes] = await Promise.all([
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
    // Leads due a client contact by tonight (migration 018). The whole
    // team works one book, so this is the same number for everyone.
    supabase
      .from("lead_follow_ups")
      .select("lead_id", { count: "exact", head: true })
      .lte("due_at", endOfToday().toISOString()),
  ])

  return {
    overdueTasks: overdueRes.count ?? 0,
    adminOverdueTasks: adminOverdueRes.count ?? 0,
    // Before 018 the view is missing; the count errors and the badge just hides.
    followUpsDue: followUpsRes.error ? 0 : followUpsRes.count ?? 0,
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
