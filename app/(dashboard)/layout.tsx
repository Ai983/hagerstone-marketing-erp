"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"

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
  const { isSidebarCollapsed } = useUIStore()

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

  // Below lg, sidebar is an overlay so the main content uses 0 left
  // offset. At lg+, content is shifted by the static sidebar width.
  // CSS variable + Tailwind responsive class keeps this in sync without
  // JS-side viewport detection (no SSR mismatch).
  const sidebarWidth = isSidebarCollapsed ? 56 : 240

  return (
    <div
      className="min-h-screen bg-[#0A0A0F] text-[#F0F0FA]"
      style={{ ["--sidebar-w" as string]: `${sidebarWidth}px` }}
    >
      <Sidebar
        fullName={fullName}
        role={role}
        badges={{
          inbox: counts?.unassignedLeads,
          activities: counts?.overdueTasks,
        }}
      />
      <div className="min-h-screen bg-transparent lg:ml-[var(--sidebar-w)] lg:transition-[margin] lg:duration-200">
        <div className="fixed left-0 right-0 top-0 z-20 lg:left-[var(--sidebar-w)] lg:transition-[left] lg:duration-200">
          <TopBar fullName={fullName} role={role} />
          <DemoModeBanner />
        </div>
        <main className="bg-transparent pt-14">
          <div className="h-[calc(100vh-56px)] overflow-y-auto">{children}</div>
        </main>
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
