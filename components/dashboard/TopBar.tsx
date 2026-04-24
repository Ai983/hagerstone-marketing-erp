"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Bell, Search, Upload } from "lucide-react"

import { LeadSearchModal } from "@/components/dashboard/LeadSearchModal"
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
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
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

  // Detect platform for the correct ⌘ / Ctrl hint in the button.
  useEffect(() => {
    if (typeof navigator === "undefined") return
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent))
  }, [])

  // Global Cmd+K / Ctrl+K to open the search modal
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <header className="h-14 border-b border-[#2A2A3C] bg-[#111118]">
      <div className="flex h-full items-center gap-4 px-6">
        <div className="shrink-0">
          <h1 className="text-lg font-semibold text-[#F0F0FA]">{title}</h1>
        </div>

        {/* Search trigger — click or ⌘K opens modal */}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search leads"
            className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#9090A8] transition hover:border-[#3A3A52] hover:text-[#F0F0FA]"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">Search leads...</span>
            <kbd className="hidden shrink-0 rounded border border-[#2A2A3C] bg-[#111118] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#9090A8] sm:inline-block">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-3">
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

      <LeadSearchModal
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </header>
  )
}
