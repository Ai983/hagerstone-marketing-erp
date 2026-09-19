"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { endOfDay, startOfDay, subDays } from "date-fns"
import { Loader2, RefreshCcwDot, Trophy, XCircle } from "lucide-react"

import { ObjectionsCard } from "@/components/analytics/ObjectionsCard"
import { ActionBoard } from "@/components/feedback/ActionBoard"
import { AIReviewPanel } from "@/components/feedback/AIReviewPanel"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import { WIN_QUESTIONS } from "@/lib/utils/win-story"

type ClosedLead = {
  id: string
  full_name: string
  company_name: string | null
  closure_reason: string | null
  lost_to_competitor: string | null
  win_trigger: string | null
  win_why_us: string | null
  win_worry: string | null
  closed_at: string | null
  stage: { stage_type: string } | null
}

/**
 * Step 7 of the playbook — "every conversation makes you smarter".
 * What we heard, why we lost, why we won, what we're changing.
 */
export default function FeedbackPage() {
  const { setLeadDrawerId } = useUIStore()
  // Fixed for the life of the page so the objections query key is stable.
  const range = useMemo(() => ({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) }), [])

  const closed = useQuery({
    queryKey: ["feedback-closed-leads"],
    queryFn: async (): Promise<ClosedLead[]> => {
      const { data, error } = await createClient()
        .from("leads")
        .select("id, full_name, company_name, closure_reason, lost_to_competitor, win_trigger, win_why_us, win_worry, closed_at, stage:stage_id(stage_type)")
        .eq("is_archived", false)
        .not("closed_at", "is", null)
        .gte("closed_at", subDays(new Date(), 90).toISOString())
        .limit(500)
      if (error) throw error
      return (data ?? []) as unknown as ClosedLead[]
    },
  })

  const summary = useMemo(() => {
    const rows = closed.data ?? []
    const lost = rows.filter((r) => r.stage?.stage_type === "lost")
    const won = rows.filter((r) => r.stage?.stage_type === "won")
    const reasons = new Map<string, number>()
    const competitors = new Map<string, number>()
    for (const l of lost) {
      reasons.set(l.closure_reason || "Unspecified", (reasons.get(l.closure_reason || "Unspecified") ?? 0) + 1)
      if (l.lost_to_competitor?.trim()) competitors.set(l.lost_to_competitor.trim(), (competitors.get(l.lost_to_competitor.trim()) ?? 0) + 1)
    }
    const withStory = won.filter((w) => w.win_trigger || w.win_why_us || w.win_worry)
    return {
      lost,
      won,
      withStory,
      reasons: Array.from(reasons.entries()).sort((a, b) => b[1] - a[1]),
      competitors: Array.from(competitors.entries()).sort((a, b) => b[1] - a[1]),
    }
  }, [closed.data])

  const card = "rounded-xl border border-[#2A2A3C] bg-[#111118] p-4"

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
          <RefreshCcwDot className="size-5 text-[#A78BFA]" /> Feedback Loop
        </h1>
        <p className="mt-1 text-sm text-[#9090A8]">
          Every conversation makes us smarter: what clients push back with, why we lose, why we win — and what we change because of it.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className={card}>
          <h2 className="mb-0.5 text-sm font-semibold text-[#F0F0FA]">Objections · last 30 days</h2>
          <p className="mb-3 text-xs text-[#9090A8]">Arrow = change vs the 30 days before.</p>
          <ObjectionsCard from={range.from} to={range.to} />
        </section>

        <section className={card}>
          <h2 className="mb-0.5 flex items-center gap-1.5 text-sm font-semibold text-[#F0F0FA]">
            <XCircle className="size-4 text-[#F87171]" /> Why we lost · last 90 days
          </h2>
          {closed.isLoading ? (
            <Loader2 className="mt-4 size-4 animate-spin text-[#9090A8]" />
          ) : summary.lost.length === 0 ? (
            <p className="mt-2 text-sm text-[#9090A8]">
              No deal marked Lost in 90 days. Deals that quietly die never teach anything — mark them Lost with a reason.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-[#9090A8]">{summary.lost.length} deal{summary.lost.length === 1 ? "" : "s"} lost.</p>
              <ul className="space-y-1.5">
                {summary.reasons.map(([reason, n]) => (
                  <li key={reason} className="flex items-center justify-between text-sm">
                    <span className="truncate text-[#F0F0FA]">{reason}</span>
                    <span className="ml-2 rounded-full bg-[#1A1A24] px-2 py-0.5 text-[11px] text-[#9090A8]">{n}</span>
                  </li>
                ))}
              </ul>
              {summary.competitors.length ? (
                <p className="mt-3 text-[11px] text-[#9090A8]">
                  Lost to: {summary.competitors.map(([c, n]) => `${c}${n > 1 ? ` ×${n}` : ""}`).join(" · ")}
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-0.5 flex items-center gap-1.5 text-sm font-semibold text-[#F0F0FA]">
            <Trophy className="size-4 text-[#34D399]" /> Why they bought · last 90 days
          </h2>
          {closed.isLoading ? (
            <Loader2 className="mt-4 size-4 animate-spin text-[#9090A8]" />
          ) : summary.won.length === 0 ? (
            <p className="mt-2 text-sm text-[#9090A8]">No deals won in 90 days.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-[#9090A8]">
                {summary.withStory.length} of {summary.won.length} won deal{summary.won.length === 1 ? "" : "s"} have their story captured.
              </p>
              <ul className="space-y-2">
                {summary.won.slice(0, 4).map((w) => {
                  const answer = WIN_QUESTIONS.map((q) => w[q.column]).find(Boolean)
                  return (
                    <li key={w.id}>
                      <button type="button" onClick={() => setLeadDrawerId(w.id)} className="block w-full text-left">
                        <p className="truncate text-sm text-[#F0F0FA]">{w.company_name || w.full_name}</p>
                        <p className="line-clamp-2 text-[11px] text-[#9090A8]">
                          {answer ? answer : <span className="text-[#F59E0B]">Story not captured — open to add it</span>}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="space-y-4">
        <AIReviewPanel />
        <ActionBoard />
        <p className="text-[11px] text-[#5A5A72]">
          Content that works lives on <Link href="/documents" className="text-[#60A5FA]">Profiles &amp; Pitches → What&apos;s working</Link>.
        </p>
      </div>
    </div>
  )
}
