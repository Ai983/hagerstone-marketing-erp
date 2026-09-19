"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Globe, HeartPulse, Loader2 } from "lucide-react"

import { DuplicatesPanel } from "@/components/data-health/DuplicatesPanel"
import { FillInQueue } from "@/components/data-health/FillInQueue"
import { UnreachableList } from "@/components/data-health/UnreachableList"
import { useDataSets } from "@/lib/hooks/useDataSets"
import {
  HEALTH_CHECKS, healthScore, missingChecks, useDataHealth, useUniverseHealth, useUniverseMatches,
  type HealthLead,
} from "@/lib/hooks/useDataHealth"
import { cn } from "@/lib/utils"

type Tab = "overview" | "complete" | "duplicates" | "unreachable"

function scoreColor(score: number) {
  return score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444"
}

/**
 * Data Health — the playbook's Step 1, "garbage in, garbage out". How
 * complete and clean the pipeline is per data set, and the queues that
 * fix it a few records at a time.
 */
export default function DataHealthPage() {
  const [tab, setTab] = useState<Tab>("overview")
  const { leads, duplicates, isLoading, error } = useDataHealth()
  const universeMatches = useUniverseMatches()
  const universe = useUniverseHealth()
  const { dataSets } = useDataSets()

  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads])
  const unreachable = useMemo(() => leads.filter((l) => missingChecks(l).includes("reachable")), [leads])
  const toComplete = useMemo(
    () => leads.filter((l) => l.stage?.stage_type !== "lost" && missingChecks(l).some((k) => k !== "reachable")).length,
    [leads]
  )

  const bySet = useMemo(() => {
    const groups = new Map<string, HealthLead[]>()
    for (const l of leads) {
      const key = l.data_set_id ?? "none"
      groups.set(key, [...(groups.get(key) ?? []), l])
    }
    return Array.from(groups.entries())
      .map(([id, list]) => ({
        id,
        name: dataSets.find((d) => d.id === id)?.name ?? "No data set",
        color: dataSets.find((d) => d.id === id)?.color ?? "#6B7280",
        leads: list,
        score: healthScore(list),
      }))
      .sort((a, b) => b.leads.length - a.leads.length)
  }, [leads, dataSets])

  const overall = healthScore(leads)
  const card = "rounded-xl border border-[#2A2A3C] bg-[#111118] p-4"

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "complete", label: "Complete leads", count: toComplete },
    { key: "duplicates", label: "Duplicates", count: duplicates.length + (universeMatches.data?.length ?? 0) },
    { key: "unreachable", label: "Unreachable", count: unreachable.length },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4">
        <Link href="/admin" className="text-xs text-[#9090A8] hover:text-[#F0F0FA]">← Admin</Link>
        <h1 className="mt-1 flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
          <HeartPulse className="size-5 text-[#EF4444]" /> Data Health
        </h1>
        <p className="mt-1 text-sm text-[#9090A8]">
          Garbage in, garbage out. Groups, scoring and filters are only as good as the records under them — fix a few at a time.
        </p>
      </div>

      <div className="thin-scrollbar -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm transition",
              tab === t.key ? "bg-[#3B82F6] font-medium text-white" : "border border-[#2A2A3C] bg-[#111118] text-[#9090A8] hover:text-[#F0F0FA]"
            )}
          >
            {t.label}
            {t.count ? <span className={cn("rounded-full px-1.5 text-[11px]", tab === t.key ? "bg-white/20" : "bg-[#1F1F2E]")}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Checking every lead…
        </div>
      ) : error ? (
        <p className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">Could not load leads. Refresh the page.</p>
      ) : tab === "complete" ? (
        <FillInQueue leads={leads} />
      ) : tab === "duplicates" ? (
        <DuplicatesPanel groups={duplicates} leadsById={leadsById} universeMatches={universeMatches.data ?? []} />
      ) : tab === "unreachable" ? (
        <UnreachableList leads={unreachable} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className={card}>
              <p className="text-[11px] uppercase tracking-wider text-[#9090A8]">Health score</p>
              <p className="mt-1 text-3xl font-semibold" style={{ color: scoreColor(overall) }}>{overall}%</p>
              <p className="text-[11px] text-[#5A5A72]">{leads.length} open leads · 5 checks each</p>
            </div>
            <button type="button" onClick={() => setTab("complete")} className={cn(card, "text-left transition hover:border-[#3A3A52]")}>
              <p className="text-[11px] uppercase tracking-wider text-[#9090A8]">To complete</p>
              <p className="mt-1 text-3xl font-semibold text-[#F0F0FA]">{toComplete}</p>
              <p className="text-[11px] text-[#60A5FA]">Open the queue →</p>
            </button>
            <button type="button" onClick={() => setTab("duplicates")} className={cn(card, "text-left transition hover:border-[#3A3A52]")}>
              <p className="text-[11px] uppercase tracking-wider text-[#9090A8]">Duplicates</p>
              <p className="mt-1 text-3xl font-semibold text-[#F0F0FA]">{duplicates.length}</p>
              <p className="text-[11px] text-[#5A5A72]">+ {universeMatches.data?.length ?? 0} unlinked in universe</p>
            </button>
            <button type="button" onClick={() => setTab("unreachable")} className={cn(card, "text-left transition hover:border-[#3A3A52]")}>
              <p className="text-[11px] uppercase tracking-wider text-[#9090A8]">Unreachable</p>
              <p className="mt-1 text-3xl font-semibold text-[#F87171]">{unreachable.length}</p>
              <p className="text-[11px] text-[#5A5A72]">No phone and no email</p>
            </button>
          </div>

          <section className={card}>
            <h2 className="mb-3 text-sm font-semibold text-[#F0F0FA]">By data set</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#5A5A72]">
                    <th className="pb-2 text-left font-medium">Data set</th>
                    <th className="pb-2 text-right font-medium">Leads</th>
                    <th className="pb-2 text-right font-medium">Score</th>
                    {HEALTH_CHECKS.map((c) => <th key={c.key} className="pb-2 text-right font-medium">No {c.label.toLowerCase()}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {bySet.map((s) => (
                    <tr key={s.id} className="border-t border-[#1F1F2E]">
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1.5 text-[#F0F0FA]">
                          <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      </td>
                      <td className="py-2 text-right text-[#9090A8]">{s.leads.length}</td>
                      <td className="py-2 text-right font-semibold" style={{ color: scoreColor(s.score) }}>{s.score}%</td>
                      {HEALTH_CHECKS.map((c) => {
                        const n = s.leads.filter((l) => !c.test(l)).length
                        const pct = Math.round((n / s.leads.length) * 100)
                        return (
                          <td key={c.key} className="py-2 text-right text-xs" style={{ color: pct >= 50 ? "#F87171" : pct >= 20 ? "#F59E0B" : "#9090A8" }}>
                            {n ? `${n} · ${pct}%` : "—"}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-[#5A5A72]">
              Score = share of the five checks (phone or email, company, city, service line, budget/value) that pass. Website
              leads only carry what the visitor typed, so they score low until completed.
            </p>
          </section>

          <section className={card}>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#F0F0FA]">
              <Globe className="size-4 text-[#10B981]" /> Contact Universe
            </h2>
            {universe.data ? (
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div><p className="text-xl font-semibold text-[#F0F0FA]">{universe.data.total.toLocaleString("en-IN")}</p><p className="text-[11px] text-[#9090A8]">contacts</p></div>
                <div><p className="text-xl font-semibold text-[#F87171]">{universe.data.unreachable.toLocaleString("en-IN")}</p><p className="text-[11px] text-[#9090A8]">no phone and no email</p></div>
                <div>
                  <p className="text-xl font-semibold text-[#F59E0B]">{universe.data.duplicateGroups.toLocaleString("en-IN")}</p>
                  <p className="text-[11px] text-[#9090A8]">phone numbers shared by {universe.data.inDuplicateGroups.toLocaleString("en-IN")} contacts</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#9090A8]">{universe.isLoading ? "Counting…" : "Not available."}</p>
            )}
            <p className="mt-2 text-[11px] text-[#5A5A72]">Shown for awareness only — universe clean-up is a separate job.</p>
          </section>
        </div>
      )}
    </div>
  )
}
