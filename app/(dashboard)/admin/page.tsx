"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Users,
  Workflow,
  Plug,
  Mail,
  MessageSquare,
  ClipboardList,
  Database,
  ChevronRight,
  Trash2,
  RefreshCw,
  Loader2,
  Shield,
  Target,
} from "lucide-react"

import { DailySummaryConfigCard } from "@/components/admin/DailySummaryConfig"

const sections = [
  {
    href: "/admin/users",
    icon: Users,
    title: "User Management",
    description: "Manage roles and access",
    color: "#3B82F6",
  },
  {
    href: "/admin/pipeline-config",
    icon: Workflow,
    title: "Pipeline Config",
    description: "Stages, colors, order",
    color: "#8B5CF6",
  },
  {
    href: "/admin/integrations",
    icon: Plug,
    title: "Integrations",
    description: "Webhook, WhatsApp, AI",
    color: "#10B981",
  },
  {
    href: "/admin/chatbot",
    icon: MessageSquare,
    title: "Chatbot Builder",
    description: "WhatsApp flows",
    color: "#F59E0B",
  },
  {
    href: "/admin/email-templates",
    icon: Mail,
    title: "Email Templates",
    description: "Manage email templates",
    color: "#EC4899",
  },
  {
    href: "/admin/tasks",
    icon: ClipboardList,
    title: "All Tasks",
    description: "View all team tasks",
    color: "#EF4444",
  },
  {
    href: "/admin/audit-log",
    icon: Shield,
    title: "Audit Log",
    description: "Review system actions",
    color: "#8B5CF6",
  },
] as const

export default function AdminPage() {
  const [clearing, setClearing] = useState(false)
  const [reseeding, setReseeding] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [testingDrip, setTestingDrip] = useState(false)
  const [runningDrip, setRunningDrip] = useState(false)

  const handleClear = async () => {
    if (!confirm("Delete all sample leads? This cannot be undone.")) return
    setClearing(true)
    try {
      const res = await fetch("/api/admin/clear-sample-data", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to clear")
      toast.success(`Deleted ${data.deleted} sample leads`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear sample data")
    } finally {
      setClearing(false)
    }
  }

  const handleReseed = async () => {
    setReseeding(true)
    try {
      const res = await fetch("/api/admin/reseed", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reseed")
      toast.success("Sample data reseeded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reseed")
    } finally {
      setReseeding(false)
    }
  }

  const handleScoreAll = async () => {
    setScoring(true)
    try {
      const res = await fetch("/api/leads/score-all", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to score leads")
      toast.success(
        `Scored ${data.scored} lead${data.scored === 1 ? "" : "s"}. Average score: ${data.average_score}`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to score leads")
    } finally {
      setScoring(false)
    }
  }

  const handleTestDrip = async () => {
    setTestingDrip(true)
    try {
      const res = await fetch("/api/cron/campaign-drip-test")
      const data = await res.json()
      console.log("Drip test logs:", data.logs)
      if (!res.ok) throw new Error(data.error || "Drip test failed")
      if (data.logs) {
        data.logs.forEach((log: string) => console.log("[DRIP]", log))
      }
      toast.success("Test complete - check console for logs")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drip test failed")
    } finally {
      setTestingDrip(false)
    }
  }

  const handleRunDrip = async () => {
    setRunningDrip(true)
    try {
      const res = await fetch("/api/cron/campaign-drip", {
        headers: {
          Authorization: "Bearer hagerstone-cron-2024",
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Full drip failed")
      toast.success(
        `Drip complete: ${data.sent ?? 0} sent, ${data.failed ?? 0} failed, ${data.completed ?? 0} completed`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Full drip failed")
    } finally {
      setRunningDrip(false)
    }
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] pb-20 md:p-6 md:pb-6">
      <div className="mx-auto max-w-5xl">
        <div className="px-4 py-4 md:mb-6 md:px-0 md:py-0">
          <h1 className="text-xl font-bold text-[#F0F0FA] md:font-[family-name:var(--font-heading)] md:text-2xl md:font-semibold">
            Admin Panel
          </h1>
          <p className="mt-1 text-xs text-[#9090A8] md:text-sm">
            Manage users, pipeline and settings
          </p>
        </div>

        {/* Section grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 px-4 md:grid-cols-2 md:px-0">
          {sections.map(({ href, icon: Icon, title, description, color }) => (
            <Link
              key={href}
              href={href}
              className="group flex w-full items-center gap-4 rounded-xl border border-[#2A2A3C] bg-[#111118] p-4 text-left transition-all hover:border-[#3A3A52] active:scale-[0.99]"
            >
              <div
                className="flex size-11 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${color}20` }}
              >
                <Icon className="size-5" style={{ color }} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#F0F0FA]">{title}</h3>
                <p className="mt-0.5 truncate text-xs text-[#9090A8]">{description}</p>
              </div>
              <ChevronRight className="ml-auto size-4 flex-shrink-0 text-[#5A5A72]" />
            </Link>
          ))}
        </div>

        {/* Sample Data */}
        <section className="mx-4 rounded-xl border border-[#2A2A3C] bg-[#111118] p-4 md:mx-0 md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database className="size-4 text-[#C084FC]" />
            <h2 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[#F0F0FA]">
              Sample Data
            </h2>
          </div>
          <p className="mb-4 text-xs text-[#9090A8]">
            Seeded demo leads (<code className="rounded bg-[#1A1A24] px-1">is_sample_data = true</code>) used for testing and demos.
            Safe to clear at any time without affecting real leads.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleClear}
              disabled={clearing || reseeding || scoring}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#7F1D1D]/50 bg-[#2A1215]/40 px-3 py-2 text-xs font-medium text-[#F87171] transition hover:bg-[#2A1215] disabled:opacity-50"
            >
              {clearing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
              Clear Sample Data
            </button>
            <button
              onClick={handleReseed}
              disabled={clearing || reseeding || scoring}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E] disabled:opacity-50"
            >
              {reseeding ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Reseed Sample Data
            </button>
            <button
              onClick={handleScoreAll}
              disabled={clearing || reseeding || scoring}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#3B82F6]/40 bg-[#1E3A5F]/40 px-3 py-2 text-xs font-medium text-[#3B82F6] transition hover:bg-[#1E3A5F] disabled:opacity-50"
            >
              {scoring ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Target className="size-3" />
              )}
              Score All Leads
            </button>
          </div>
          <p className="mt-3 text-[11px] text-[#9090A8]">
            Reseed calls the <code className="rounded bg-[#1A1A24] px-1">reseed_sample_data()</code> RPC.
            If the function doesn&apos;t exist yet, create it in Supabase SQL editor.
          </p>
        </section>

        {/* Campaign Drip */}
        <section className="mt-4 rounded-lg border border-[#2A2A3C] bg-[#111118] p-3.5">
          <p className="mb-1 text-[13px] font-medium text-[#F0F0FA]">
            Campaign Drip Engine
          </p>
          <p className="mb-3 text-xs text-[#9090A8]">
            Runs automatically every hour. Use button to test manually.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestDrip}
              disabled={testingDrip || runningDrip}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
            >
              {testingDrip && <Loader2 className="size-3 animate-spin" />}
              Test Drip Now (max 3)
            </button>
            <button
              onClick={handleRunDrip}
              disabled={testingDrip || runningDrip}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#10B981] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#059669] disabled:opacity-50"
            >
              {runningDrip && <Loader2 className="size-3 animate-spin" />}
              Run Full Drip
            </button>
          </div>
        </section>

        {/* Daily WhatsApp briefing */}
        <div className="mt-6">
          <DailySummaryConfigCard />
        </div>
      </div>
    </main>
  )
}
