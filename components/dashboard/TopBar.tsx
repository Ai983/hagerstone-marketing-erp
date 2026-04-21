"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Bell, Upload } from "lucide-react"

import { NotificationCenter } from "@/components/dashboard/NotificationCenter"
import { useNotifications } from "@/lib/hooks/useNotifications"
import { useUIStore } from "@/lib/stores/uiStore"

const PAGE_TITLES: Record<string, string> = {
  "/pipeline": "Pipeline",
  "/inbox": "Lead Inbox",
  "/leads": "All Leads",
  "/leads/new": "New Lead",
  "/activities": "My Tasks",
  "/campaigns": "Campaigns",
  "/analytics": "Analytics",
  "/ai-agent": "AI Agent",
  "/admin": "Admin",
}

interface TopBarProps {
  fullName: string
  role: string
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function getPageTitle(pathname: string) {
  const exactMatch = PAGE_TITLES[pathname]
  if (exactMatch) {
    return exactMatch
  }

  const matchedPrefix = Object.keys(PAGE_TITLES).find(
    (route) => route !== "/" && pathname.startsWith(`${route}/`)
  )

  return matchedPrefix ? PAGE_TITLES[matchedPrefix] : "Dashboard"
}

export function TopBar({ fullName, role }: TopBarProps) {
  const pathname = usePathname()
  const title = useMemo(() => getPageTitle(pathname), [pathname])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const { unreadCount } = useNotifications()
  const openNewLeadModal = useUIStore((s) => s.openNewLeadModal)
  const openBulkImportModal = useUIStore((s) => s.openBulkImportModal)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  return (
    <header className="h-14 border-b border-[#2A2A3C] bg-[#111118]">
      <div className="flex h-full items-center justify-between px-6">
        <div>
          <h1 className="text-lg font-semibold text-[#F0F0FA]">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openBulkImportModal()}
            title="Import leads from Excel"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#111118] px-3 text-sm font-medium text-[#F0F0FA] transition hover:bg-[#1A1A24]"
          >
            <Upload className="size-3.5" />
            Import
          </button>

          <button
            type="button"
            onClick={() => openNewLeadModal()}
            className="inline-flex h-9 items-center rounded-lg bg-[#3B82F6] px-3 text-sm font-medium text-white transition hover:bg-[#2563EB]"
          >
            + New Lead
          </button>

          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((open) => !open)}
              className="relative flex size-9 items-center justify-center rounded-lg border border-[#2A2A3C] bg-[#111118] text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
              aria-label="Toggle notifications"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[9px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <NotificationCenter
              open={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
            />
          </div>

          <div className="group relative">
            <div className="flex size-9 items-center justify-center rounded-full bg-[#1E3A5F] text-sm font-semibold text-[#3B82F6]">
              {getInitials(fullName)}
            </div>
            <div className="pointer-events-none absolute right-0 top-11 w-max rounded-lg border border-[#2A2A3C] bg-[#111118] px-3 py-2 text-left opacity-0 transition group-hover:opacity-100">
              <p className="text-sm font-medium text-[#F0F0FA]">{fullName}</p>
              <p className="text-xs capitalize text-[#9090A8]">{role.replace("_", " ")}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
