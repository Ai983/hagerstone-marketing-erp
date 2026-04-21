"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Users,
  Workflow,
  Plug,
  Database,
  ChevronRight,
  Trash2,
  RefreshCw,
  Loader2,
  Target,
} from "lucide-react"

import { DailySummaryConfigCard } from "@/components/admin/DailySummaryConfig"

const sections = [
  {
    href: "/admin/users",
    icon: Users,
    title: "Users",
    description: "Manage team members, roles, and invitations.",
  },
  {
    href: "/admin/pipeline-config",
    icon: Workflow,
    title: "Pipeline Config",
    description: "Reorder stages, edit names and colors.",
  },
  {
    href: "/admin/integrations",
    icon: Plug,
    title: "Integrations",
    description: "Webhook, WhatsApp, Claude AI connections.",
  },
] as const

export default function AdminPage() {
  const [clearing, setClearing] = useState(false)
  const [reseeding, setReseeding] = useState(false)
  const [scoring, setScoring] = useState(false)

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

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
            Admin
          </h1>
          <p className="mt-0.5 text-sm text-[#9090A8]">
            System configuration, team management, and integrations.
          </p>
        </div>

        {/* Section grid */}
        <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          {sections.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl border border-[#2A2A3C] bg-[#111118] p-5 transition hover:border-[#3B82F6] hover:bg-[#1A1A24]"
            >
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
                  <Icon className="size-5" />
                </div>
                <ChevronRight className="size-4 text-[#9090A8] transition group-hover:translate-x-0.5 group-hover:text-[#F0F0FA]" />
              </div>
              <h3 className="mt-4 font-[family-name:var(--font-heading)] text-base font-semibold text-[#F0F0FA]">
                {title}
              </h3>
              <p className="mt-1 text-xs text-[#9090A8]">{description}</p>
            </Link>
          ))}
        </div>

        {/* Sample Data */}
        <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
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

        {/* Daily WhatsApp briefing */}
        <div className="mt-6">
          <DailySummaryConfigCard />
        </div>
      </div>
    </main>
  )
}
