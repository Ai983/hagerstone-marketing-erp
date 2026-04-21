"use client"

import { formatDistanceToNow } from "date-fns"
import {
  Bell,
  CheckCheck,
  Loader2,
  UserPlus,
  ArrowRightLeft,
  Clock,
  MessageSquare,
  AlertTriangle,
  Globe,
} from "lucide-react"

import { useNotifications, type Notification } from "@/lib/hooks/useNotifications"
import { useUIStore } from "@/lib/stores/uiStore"
import { cn } from "@/lib/utils"

interface NotificationCenterProps {
  open: boolean
  onClose?: () => void
}

const typeIcons: Record<string, typeof Bell> = {
  new_lead_assigned: UserPlus,
  stage_changed: ArrowRightLeft,
  follow_up_overdue: Clock,
  campaign_reply: MessageSquare,
  new_website_lead: Globe,
  lead_stale: AlertTriangle,
}

function NotificationRow({
  n,
  onClick,
}: {
  n: Notification
  onClick: (n: Notification) => void
}) {
  const Icon = typeIcons[n.type] ?? Bell

  return (
    <button
      type="button"
      onClick={() => onClick(n)}
      className={cn(
        "flex w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition",
        n.is_read
          ? "border-transparent bg-transparent hover:bg-[#1A1A24]"
          : "border-[#3B82F6] bg-[#1E3A5F]/20 hover:bg-[#1E3A5F]/30"
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          n.is_read ? "bg-[#1A1A24] text-[#9090A8]" : "bg-[#1E3A5F] text-[#3B82F6]"
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-xs",
            n.is_read ? "text-[#9090A8]" : "font-semibold text-[#F0F0FA]"
          )}
        >
          {n.title}
        </p>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-[#9090A8]">
            {n.body}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-[#5A5A72]">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
      {!n.is_read && (
        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
      )}
    </button>
  )
}

export function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { setLeadDrawerId } = useUIStore()
  const { notifications, unreadCount, isLoading, markAsRead, isMarking } =
    useNotifications()

  const handleRowClick = async (n: Notification) => {
    if (!n.is_read) {
      // Fire-and-forget — don't block the navigation on the mark-read
      markAsRead(n.id).catch(() => {})
    }
    if (n.lead_id) {
      setLeadDrawerId(n.lead_id)
    }
    onClose?.()
  }

  const handleMarkAll = async () => {
    if (unreadCount === 0 || isMarking) return
    await markAsRead()
  }

  return (
    <div
      className={cn(
        "absolute right-0 top-12 z-50 w-96 origin-top-right rounded-2xl border border-[#2A2A3C] bg-[#111118] shadow-2xl transition duration-200",
        open
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A3C] px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-[#3B82F6]" />
          <h3 className="text-sm font-semibold text-[#F0F0FA]">Notifications</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[#3B82F6] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={unreadCount === 0 || isMarking}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#9090A8] transition hover:text-[#F0F0FA] disabled:opacity-50"
        >
          {isMarking ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <CheckCheck className="size-3" />
          )}
          Mark all read
        </button>
      </div>

      {/* Body */}
      <div className="thin-scrollbar max-h-[420px] overflow-y-scroll overscroll-contain">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-[#9090A8]" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-[#2A2A3C] bg-[#1A1A24]">
              <Bell className="size-5 text-[#9090A8]" />
            </div>
            <p className="text-sm font-medium text-[#F0F0FA]">
              No notifications yet
            </p>
            <p className="text-xs text-[#9090A8]">
              Assignments, stage changes, and task updates will show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#2A2A3C]/60 py-1">
            {notifications.map((n) => (
              <NotificationRow key={n.id} n={n} onClick={handleRowClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
