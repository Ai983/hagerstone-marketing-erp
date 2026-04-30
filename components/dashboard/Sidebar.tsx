"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  BarChart2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Database,
  Inbox,
  Kanban,
  Loader2,
  LogOut,
  Megaphone,
  Settings,
  Shield,
  Sparkles,
  User as UserIcon,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"

type BadgeKey = "inbox" | "activities"

type Role = "admin" | "manager" | "founder" | "marketing" | "sales_rep"

const ALL_ROLES: Role[] = ["admin", "manager", "founder", "marketing", "sales_rep"]

interface NavItem {
  href: string
  label: string
  icon: typeof Kanban
  badgeKey?: BadgeKey
  roles: Role[]
}

const primaryNavigation: ReadonlyArray<NavItem> = [
  { href: "/pipeline", label: "Pipeline", icon: Kanban, roles: ALL_ROLES },
  { href: "/inbox", label: "Lead Inbox", icon: Inbox, badgeKey: "inbox", roles: ["admin", "manager"] },
  { href: "/leads", label: "All Leads", icon: Users, roles: ["admin", "manager", "founder", "marketing"] },
  { href: "/activities", label: "My Tasks", icon: CheckSquare, badgeKey: "activities", roles: ALL_ROLES },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, roles: ["admin", "manager", "marketing", "founder"] },
  { href: "/analytics", label: "Analytics", icon: BarChart2, roles: ["admin", "manager", "founder", "marketing"] },
  { href: "/ai-agent", label: "AI Agent", icon: Sparkles, roles: ["admin", "manager", "founder"] },
  { href: "/ai-leads", label: "AI Lead Gen", icon: Sparkles, roles: ["admin", "manager", "founder", "marketing"] },
  { href: "/ai-leads/database", label: "Lead Database", icon: Database, roles: ["admin", "manager", "founder", "marketing"] },
  { href: "/profile", label: "My Profile", icon: UserIcon, roles: ALL_ROLES },
]

const secondaryNavigation: ReadonlyArray<NavItem> = [
  { href: "/admin", label: "Admin", icon: Settings, roles: ["admin"] },
  { href: "/admin/audit-log", label: "Audit Log", icon: Shield, roles: ["admin", "founder"] },
]

interface SidebarProps {
  fullName: string
  role: string
  badges?: {
    inbox?: number
    activities?: number
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function Sidebar({ fullName, role, badges }: SidebarProps) {
  const router = useRouter()
  const { isSidebarCollapsed, toggleSidebar } = useUIStore()
  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen)
  const closeMobileNav = useUIStore((s) => s.closeMobileNav)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleLogout = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push("/login")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign out")
      setIsSigningOut(false)
    }
  }

  const desktopWidth = isSidebarCollapsed ? "w-14" : "w-60"

  return (
    <>
      {/* ── Desktop sidebar (lg+) ──────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 hidden h-screen flex-col border-r border-[#2A2A3C] bg-[#111118] transition-[width] duration-200 lg:flex",
          desktopWidth
        )}
      >
        <SidebarBody
          collapsed={isSidebarCollapsed}
          fullName={fullName}
          role={role}
          badges={badges}
          isSigningOut={isSigningOut}
          onLogout={handleLogout}
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {/* ── Mobile / tablet overlay (below lg) ─────────────────── */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <>
            <motion.div
              key="mobile-nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeMobileNav}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.aside
              key="mobile-nav-panel"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-[#2A2A3C] bg-[#111118] shadow-2xl lg:hidden"
            >
              <SidebarBody
                collapsed={false}
                fullName={fullName}
                role={role}
                badges={badges}
                isSigningOut={isSigningOut}
                onLogout={handleLogout}
                onItemClick={closeMobileNav}
                onCloseMobile={closeMobileNav}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Sidebar body — shared between desktop + mobile ────────────────

interface SidebarBodyProps {
  collapsed: boolean
  fullName: string
  role: string
  badges?: { inbox?: number; activities?: number }
  isSigningOut: boolean
  onLogout: () => void
  onToggleCollapse?: () => void
  onItemClick?: () => void
  onCloseMobile?: () => void
}

function SidebarBody({
  collapsed,
  fullName,
  role,
  badges,
  isSigningOut,
  onLogout,
  onToggleCollapse,
  onItemClick,
  onCloseMobile,
}: SidebarBodyProps) {
  const pathname = usePathname()

  // If role hasn't loaded yet (empty/falsy), fall back to showing every item
  // so the menu doesn't briefly hide nav items the user actually has access to.
  const filterByRole = (items: ReadonlyArray<NavItem>): NavItem[] => {
    if (!role) return [...items]
    return items.filter((item) => item.roles.includes(role as Role))
  }

  const visiblePrimary = filterByRole(primaryNavigation)
  const visibleSecondary = filterByRole(secondaryNavigation)

  const getBadge = (key?: BadgeKey): number | undefined => {
    if (!key) return undefined
    const value = badges?.[key]
    return value && value > 0 ? value : undefined
  }

  return (
    <>
      <div className="flex min-h-16 items-center px-2">
        <div
          className={cn(
            "flex w-full items-center",
            collapsed ? "justify-center" : "justify-start"
          )}
          style={{ gap: "10px" }}
        >
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo.png"
              alt="Hagerstone"
              style={{
                width: "40px",
                height: "40px",
                objectFit: "cover",
                objectPosition: "left center",
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo.png"
              alt="Hagerstone International"
              style={{
                width: "220px",
                height: "auto",
                objectFit: "contain",
                objectPosition: "left center",
              }}
            />
          )}
        </div>
        {/* Mobile-only close button */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <nav className="thin-scrollbar flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {visiblePrimary.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const badgeCount = getBadge(item.badgeKey)
          const isOverdueBadge = item.badgeKey === "activities"

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                "relative flex h-11 items-center rounded-xl border-l-2 text-sm transition-colors duration-200",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                isActive
                  ? "border-[#3B82F6] bg-[#1E3A5F] text-[#3B82F6]"
                  : "border-transparent text-[#9090A8] hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className="relative">
                <Icon className="size-4 shrink-0" />
                {collapsed && badgeCount != null && (
                  <span
                    className={cn(
                      "absolute -right-1.5 -top-1.5 flex min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white",
                      isOverdueBadge ? "bg-[#EF4444]" : "bg-[#3B82F6]"
                    )}
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
              {!collapsed ? (
                <>
                  <span>{item.label}</span>
                  {badgeCount != null && (
                    <span
                      className={cn(
                        "ml-auto min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold text-white",
                        isOverdueBadge ? "bg-[#EF4444]" : "bg-[#3B82F6]"
                      )}
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </>
              ) : null}
            </Link>
          )
        })}

        {visibleSecondary.length > 0 && (
          <>
            <div className="my-3 border-t border-[#2A2A3C]" />
            {visibleSecondary.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={cn(
                    "flex h-11 items-center rounded-xl border-l-2 text-sm transition-colors duration-200",
                    collapsed ? "justify-center px-0" : "gap-3 px-3",
                    isActive
                      ? "border-[#3B82F6] bg-[#1E3A5F] text-[#3B82F6]"
                      : "border-transparent text-[#9090A8] hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              )
            })}
          </>
        )}

        <div className="my-3 border-t border-[#2A2A3C]" />

        <button
          type="button"
          onClick={() => {
            onItemClick?.()
            onLogout()
          }}
          disabled={isSigningOut}
          className={cn(
            "flex h-11 w-full items-center rounded-xl text-sm text-[#9090A8] transition-colors duration-200 hover:bg-[#1A1A24] hover:text-[#EF4444] disabled:opacity-50",
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          )}
          title={collapsed ? "Logout" : undefined}
          aria-label="Logout"
        >
          {isSigningOut ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <LogOut className="size-4 shrink-0" />
          )}
          {!collapsed ? <span>Logout</span> : null}
        </button>
      </nav>

      <div className="border-t border-[#2A2A3C] p-2">
        {/* Collapse toggle is desktop-only */}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "mb-2 flex h-10 w-full items-center rounded-xl text-sm text-[#9090A8] transition-colors duration-200 hover:bg-[#1A1A24] hover:text-[#F0F0FA]",
              collapsed ? "justify-center" : "gap-3 px-3"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <>
                <ChevronLeft className="size-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        )}

        <Link
          href="/profile"
          onClick={onItemClick}
          className={cn(
            "group flex items-center rounded-xl transition hover:bg-[#1A1A24]",
            collapsed ? "justify-center py-2" : "gap-3 px-2 py-2"
          )}
          title={
            collapsed
              ? `View Profile — ${fullName}${role ? ` (${role})` : ""}`
              : "View Profile"
          }
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] text-sm font-semibold text-[#3B82F6]">
            {getInitials(fullName)}
          </div>
          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#F0F0FA]">
                  {fullName}
                </p>
                {role ? (
                  <p className="truncate text-xs capitalize text-[#9090A8]">
                    {role.replace("_", " ")}
                  </p>
                ) : null}
              </div>
              <Settings
                className="size-3.5 shrink-0 text-[#5A5A72] transition group-hover:text-[#9090A8]"
                aria-hidden
              />
            </>
          ) : null}
        </Link>
      </div>
    </>
  )
}
