"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  Phone,
  Plus,
  UserPlus,
  Users,
  X,
} from "lucide-react"

import { LeadPickerModal } from "@/components/leads/LeadPickerModal"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { useUIStore } from "@/lib/stores/uiStore"

const tabs = [
  { label: "Pipeline", icon: LayoutDashboard, href: "/pipeline" },
  { label: "Leads", icon: Users, href: "/leads" },
  null, // centre: quick actions
  { label: "Meetings", icon: CalendarDays, href: "/meetings" },
] as const

type PickerIntent = "meeting" | "call" | null

/**
 * Phone navigation. The centre button is the reason it exists: logging a
 * meeting from outside a client's office should be two taps, not a hunt
 * through the pipeline for the right card.
 */
export default function MobileBottomNav() {
  const isMobile = useMediaQuery("(max-width: 768px)")
  const pathname = usePathname()
  const router = useRouter()
  const { setMobileSidebarOpen, setLeadDrawerId, setDrawerOpenLogMeeting, setDrawerOpenLogCall, openNewLeadModal } = useUIStore()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [picker, setPicker] = useState<PickerIntent>(null)

  if (!isMobile) return null

  const actions = [
    {
      label: "Log a meeting",
      hint: "Office visit, site visit or call-in",
      icon: CalendarDays,
      color: "#A78BFA",
      run: () => setPicker("meeting"),
    },
    {
      label: "Add a lead",
      hint: "New contact or enquiry",
      icon: UserPlus,
      color: "#60A5FA",
      run: () => openNewLeadModal(),
    },
    {
      label: "Log a call",
      hint: "Outcome and next follow-up",
      icon: Phone,
      color: "#34D399",
      run: () => setPicker("call"),
    },
    {
      label: "Share company profile",
      hint: "Profiles & pitches library",
      icon: FileText,
      color: "#F59E0B",
      run: () => router.push("/documents"),
    },
  ]

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch justify-around border-t border-[#2A2A3C] bg-[#111118] px-1 pb-[env(safe-area-inset-bottom)] [height:calc(4rem+env(safe-area-inset-bottom))] md:hidden">
        {tabs.map((tab) => {
          if (!tab) {
            return (
              <div key="quick" className="flex flex-1 items-center justify-center">
                <button
                  type="button"
                  aria-label="Quick actions"
                  onClick={() => setSheetOpen(true)}
                  className="-mt-5 flex size-14 touch-manipulation items-center justify-center rounded-full bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/30 transition active:scale-95"
                >
                  <Plus className="size-7" />
                </button>
              </div>
            )
          }
          const Icon = tab.icon
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => router.push(tab.href)}
              className="flex h-16 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1"
            >
              <Icon size={22} className={isActive ? "text-[#3B82F6]" : "text-[#5A5A72]"} />
              <span className={`truncate text-[10px] font-medium ${isActive ? "text-[#3B82F6]" : "text-[#5A5A72]"}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex h-16 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1"
        >
          <Menu size={22} className="text-[#5A5A72]" />
          <span className="text-[10px] font-medium text-[#5A5A72]">More</span>
        </button>
      </nav>

      <AnimatePresence>
        {sheetOpen ? (
          <div className="fixed inset-0 z-[60] flex items-end md:hidden">
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
              className="relative w-full rounded-t-2xl border-t border-[#2A2A3C] bg-[#111118] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2A2A3C]" />
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#F0F0FA]">Quick actions</p>
                <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close" className="flex size-9 items-center justify-center rounded-lg text-[#9090A8]">
                  <X className="size-5" />
                </button>
              </div>
              <div className="space-y-2">
                {actions.map((a) => {
                  const Icon = a.icon
                  return (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => {
                        setSheetOpen(false)
                        a.run()
                      }}
                      className="flex w-full touch-manipulation items-center gap-3 rounded-xl border border-[#2A2A3C] bg-[#1A1A24] p-3 text-left active:bg-[#1F1F2E]"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${a.color}1F` }}>
                        <Icon className="size-5" style={{ color: a.color }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[#F0F0FA]">{a.label}</span>
                        <span className="block text-xs text-[#9090A8]">{a.hint}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <LeadPickerModal
        open={picker !== null}
        title={picker === "call" ? "Log a call with…" : "Log a meeting with…"}
        subtitle="Pick the lead — or close and use “Add a lead” if they are new"
        onClose={() => setPicker(null)}
        onPick={(lead) => {
          if (picker === "call") setDrawerOpenLogCall(true)
          else setDrawerOpenLogMeeting(true)
          setLeadDrawerId(lead.id)
          setPicker(null)
        }}
      />
    </>
  )
}
