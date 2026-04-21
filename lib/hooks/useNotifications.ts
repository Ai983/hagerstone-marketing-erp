"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export type NotificationType =
  | "new_lead_assigned"
  | "follow_up_overdue"
  | "stage_changed"
  | "new_website_lead"
  | "campaign_reply"
  | "lead_stale"

export interface Notification {
  id: string
  type: NotificationType | string
  title: string
  body: string | null
  lead_id: string | null
  is_read: boolean
  created_at: string
}

async function fetchNotifications(): Promise<Notification[]> {
  try {
    const res = await fetch("/api/notifications")
    if (!res.ok) return []
    const data = await res.json()
    return (data.notifications ?? []) as Notification[]
  } catch {
    return []
  }
}

/**
 * Hook for the bell-dropdown. Auto-refreshes every 30s so new
 * notifications surface without a full reload.
 */
export function useNotifications() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const markAsReadMutation = useMutation({
    mutationFn: async (id?: string) => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { mark_all: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to mark as read")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] })
    },
  })

  const notifications = query.data ?? []
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    markAsRead: (id?: string) => markAsReadMutation.mutateAsync(id),
    isMarking: markAsReadMutation.isPending,
  }
}
