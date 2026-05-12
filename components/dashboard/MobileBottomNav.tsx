"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  CheckSquare,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Users,
} from "lucide-react"

import { useMediaQuery } from "@/lib/hooks/useMediaQuery"

const tabs = [
  { label: "Pipeline", icon: LayoutDashboard, href: "/pipeline" },
  { label: "Leads", icon: Users, href: "/leads" },
  { label: "Tasks", icon: CheckSquare, href: "/activities" },
  { label: "Campaigns", icon: Megaphone, href: "/campaigns" },
  { label: "More", icon: MoreHorizontal, href: "/analytics" },
]

export default function MobileBottomNav() {
  const isMobile = useMediaQuery("(max-width: 768px)")
  const pathname = usePathname()
  const router = useRouter()

  if (!isMobile) return null

  return (
    <nav className="safe-area-pb fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-[#2A2A3C] bg-[#111118] px-2 md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname.startsWith(tab.href)

        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className="flex h-full min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1"
          >
            <div
              className={`mb-0.5 h-1 w-1 rounded-full transition-all duration-200 ${
                isActive ? "bg-[#3B82F6] opacity-100" : "opacity-0"
              }`}
            />
            <Icon
              size={22}
              className={`transition-colors duration-200 ${
                isActive ? "text-[#3B82F6]" : "text-[#5A5A72]"
              }`}
            />
            <span
              className={`truncate text-[10px] font-medium transition-colors duration-200 ${
                isActive ? "text-[#3B82F6]" : "text-[#5A5A72]"
              }`}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
