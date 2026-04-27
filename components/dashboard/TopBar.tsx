"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Bell, Menu, Plus, Search, Upload } from "lucide-react"

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
  "/ai-leads": "AI Lead Gen",
  "/admin": "Admin",
  "/profile": "My Profile",
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
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav)

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
      <div className="flex h-full items-center gap-2 px-3 sm:gap-4 sm:px-6">
        {/* Mobile: hamburger + logo. Desktop: page title. */}
        <button
          type="button"
          onClick={toggleMobileNav}
          aria-label="Open menu"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[#F0F0FA] transition hover:bg-[#1A1A24] lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        {/* Mobile-only logo (sm and md). Hidden on lg where the sidebar carries it. */}
        <div className="flex shrink-0 items-center lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Hagerstone"
            style={{
              width: "32px",
              height: "32px",
              objectFit: "cover",
              objectPosition: "left center",
            }}
          />
        </div>

        {/* Page title — hidden on phone, visible on tablet + desktop */}
        <div className="hidden shrink-0 md:block">
          <h1 className="text-base font-semibold text-[#F0F0FA] lg:text-lg">
            {title}
          </h1>
        </div>

        {/* Search — full button on tablet+, icon-only on phone */}
        <div className="ml-auto flex flex-1 justify-end md:ml-0 md:justify-center">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search leads"
            className="hidden h-9 w-full max-w-[160px] items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#9090A8] transition hover:border-[#3A3A52] hover:text-[#F0F0FA] md:flex lg:max-w-sm"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">Search…</span>
            <kbd className="hidden shrink-0 rounded border border-[#2A2A3C] bg-[#111118] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#9090A8] lg:inline-block">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>
          {/* Phone search icon */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search leads"
            className="flex size-10 items-center justify-center rounded-lg text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA] md:hidden"
          >
            <Search className="size-5" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
          {/* Import — hidden on phone, visible tablet+ */}
          <button
            type="button"
            onClick={() => openBulkImportModal()}
            title="Import leads from Excel"
            className="hidden h-9 items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#111118] px-3 text-sm font-medium text-[#F0F0FA] transition hover:bg-[#1A1A24] md:inline-flex"
          >
            <Upload className="size-3.5" />
            Import
          </button>

          {/* New Lead — phone: icon button. Tablet: "+ Lead". Desktop: "+ New Lead" */}
          <button
            type="button"
            onClick={() => openNewLeadModal()}
            aria-label="New lead"
            title="New lead"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#3B82F6] px-2.5 text-sm font-medium text-white transition hover:bg-[#2563EB] md:h-9 md:px-3"
          >
            <Plus className="size-4 md:hidden" />
            <span className="hidden md:inline lg:hidden">+ Lead</span>
            <span className="hidden lg:inline">+ New Lead</span>
          </button>

          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((open) => !open)}
              className="relative flex size-10 items-center justify-center rounded-lg border border-[#2A2A3C] bg-[#111118] text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA] md:size-9"
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
            <div className="pointer-events-none absolute right-0 top-11 hidden w-max rounded-lg border border-[#2A2A3C] bg-[#111118] px-3 py-2 text-left opacity-0 transition group-hover:opacity-100 md:block">
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
