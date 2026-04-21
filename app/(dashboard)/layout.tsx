"use client"

import { useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"

import { Sidebar } from "@/components/dashboard/Sidebar"
import { TopBar } from "@/components/dashboard/TopBar"
import { DemoModeBanner } from "@/components/dashboard/DemoModeBanner"
import { LeadDrawer } from "@/components/leads/LeadDrawer"
import { NewLeadModal } from "@/components/leads/NewLeadModal"
import { BulkImportModal } from "@/components/leads/BulkImportModal"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/lib/stores/uiStore"
import { useSidebarCounts } from "@/lib/hooks/useSidebarCounts"

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
  const [fullName, setFullName] = useState("User")
  // Empty string = profile not loaded yet; sidebar treats this as "show all"
  const [role, setRole] = useState("")
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isMounted || !user) {
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      setFullName(getDisplayName(profile?.full_name, user.email))
      setRole(profile?.role ?? "sales_rep")
      setUserId(user.id)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const { data: counts } = useSidebarCounts(userId)

  const sidebarWidth = isSidebarCollapsed ? 56 : 240

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0F0FA]">
      <Sidebar
        fullName={fullName}
        role={role}
        badges={{
          inbox: counts?.unassignedLeads,
          activities: counts?.overdueTasks,
        }}
      />
      <div
        className="min-h-screen bg-transparent transition-[margin] duration-200"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div
          className="fixed top-0 z-20 transition-[left,width] duration-200"
          style={{ left: `${sidebarWidth}px`, width: `calc(100% - ${sidebarWidth}px)` }}
        >
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
