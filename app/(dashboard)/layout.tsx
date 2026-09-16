"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Toaster } from "sonner"

import MobileBottomNav from "@/components/dashboard/MobileBottomNav"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { TopBar } from "@/components/dashboard/TopBar"
import { DemoModeBanner } from "@/components/dashboard/DemoModeBanner"
import { LeadDrawer } from "@/components/leads/LeadDrawer"
import { NewLeadModal } from "@/components/leads/NewLeadModal"
import { BulkImportModal } from "@/components/leads/BulkImportModal"
import { useUIStore } from "@/lib/stores/uiStore"
import { useSidebarCounts } from "@/lib/hooks/useSidebarCounts"
import { useUser } from "@/lib/hooks/useUser"

function getDisplayName(fullName?: string | null, email?: string | null) {
  if (fullName) {
    return fullName
  }

  if (email) {
    return email.split("@")[0]
  }

  return "User"
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isMobileSidebarOpen, setMobileSidebarOpen, isFocusMode, setFocusMode } = useUIStore()
  const pathname = usePathname()

  // Focus mode belongs to the page that turned it on; leaving that page
  // must bring the navigation back.
  useEffect(() => {
    setFocusMode(false)
  }, [pathname, setFocusMode])

  // Single shared auth call — every other hook/page on this route
  // reads from the same cache, avoiding the auth-token lock race.
  const { user, profile, loading } = useUser()

  const fullName = getDisplayName(
    (profile?.full_name as string | undefined) ?? null,
    user?.email ?? null
  )
  // Empty string = profile not loaded yet; sidebar treats this as "show all"
  const role = loading
    ? ""
    : ((profile?.role as string | undefined) ?? "sales_rep")
  const userId = user?.id ?? null

  const { data: counts } = useSidebarCounts(userId)

  return (
    // 100dvh, not h-screen: on phones 100vh includes the area under the
    // browser's address bar, which pushed the bottom nav off-screen.
    <div className="flex h-screen overflow-hidden bg-[#0A0A0F] text-[#F0F0FA] supports-[height:100dvh]:h-[100dvh]">
      {!isFocusMode && (
        <Sidebar
          fullName={fullName}
          role={role}
          badges={{
            activities: counts?.overdueTasks,
            adminTasks: counts?.adminOverdueTasks,
          }}
        />
      )}

      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        {!isFocusMode && (
          <>
            <TopBar fullName={fullName} role={role} />
            <DemoModeBanner />
          </>
        )}

        <main className="relative flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="min-h-full">{children}</div>
        </main>

        <MobileBottomNav />
      </div>

      <LeadDrawer />
      <NewLeadModal />
      <BulkImportModal />
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: {
            background: "#111118",
            border: "1px solid #2A2A3C",
            color: "#F0F0FA",
          },
        }}
      />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardShell>{children}</DashboardShell>
    </QueryClientProvider>
  )
}
