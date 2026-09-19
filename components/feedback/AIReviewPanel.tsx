"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { addDays, format, formatDistanceToNowStrict } from "date-fns"
import { toast } from "sonner"
import { Check, Loader2, Plus, Quote, RefreshCw, Sparkles } from "lucide-react"

import {
  addFeedbackAction, FEEDBACK_ACTIONS_KEY, OWNER_STYLE,
} from "@/components/feedback/ActionBoard"
import type { FeedbackReview } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SavedReview {
  id: string
  period_start: string
  period_end: string
  content: FeedbackReview
  created_at: string
  creator?: { full_name: string } | null
}

const REVIEW_KEY = ["feedback-review"] as const

/**
 * "What did you learn from your last lost deals?" Claude reads the last
 * 90 days of losses, objections and win stories and suggests fixes. Runs
 * on request (it costs an API call); the latest review is kept for everyone.
 */
export function AIReviewPanel() {
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)
  const [added, setAdded] = useState<Set<number>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: REVIEW_KEY,
    queryFn: async (): Promise<SavedReview | null> => {
      const res = await fetch("/api/ai/feedback-review")
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Could not load the review")
      return body.review ?? null
    },
    retry: false,
  })

  const run = async () => {
    setRunning(true)
    try {
      const res = await fetch("/api/ai/feedback-review", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Review failed")
      setAdded(new Set())
      queryClient.setQueryData(REVIEW_KEY, body.review)
      toast.success("Review ready")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed", { duration: 8000 })
    } finally {
      setRunning(false)
    }
  }

  const addAction = async (i: number) => {
    const a = data?.content.actions[i]
    if (!a) return
    try {
      await addFeedbackAction({
        heard: a.heard,
        objection_key: a.objection_key,
        meaning: a.meaning,
        action: a.action,
        owner: a.owner,
        due_date: format(addDays(new Date(), a.due_in_days), "yyyy-MM-dd"),
        source: "ai",
      })
      setAdded((s) => new Set(s).add(i))
      queryClient.invalidateQueries({ queryKey: FEEDBACK_ACTIONS_KEY })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add")
    }
  }

  const review = data?.content

  return (
    <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#F0F0FA]">
            <Sparkles className="size-4 text-[#A78BFA]" /> What we learned — AI review
          </h2>
          <p className="text-xs text-[#9090A8]">
            Last 90 days of lost deals, objections and win stories. Run it once a month, or after a run of losses.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#A78BFA]/40 bg-[#A78BFA]/10 px-3 text-sm text-[#C4B5FD] disabled:opacity-60"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {running ? "Reviewing…" : review ? "Run a new review" : "Run the review"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-sm text-[#9090A8]"><Loader2 className="mr-2 size-4 animate-spin" /> Loading…</div>
      ) : !review ? (
        <p className="rounded-lg border border-dashed border-[#2A2A3C] px-4 py-6 text-center text-sm text-[#9090A8]">
          No review yet. It needs a few lost deals with reasons, objections logged on calls or meetings, or win stories.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-base font-medium text-[#F0F0FA]">{review.headline}</p>
            <p className="mt-0.5 text-[11px] text-[#5A5A72]">
              {format(new Date(data!.period_start), "d MMM")} – {format(new Date(data!.period_end), "d MMM yyyy")} · generated{" "}
              {formatDistanceToNowStrict(new Date(data!.created_at), { addSuffix: true })}
              {data!.creator?.full_name ? ` by ${data!.creator.full_name}` : ""}
            </p>
          </div>

          {review.patterns.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#9090A8]">Patterns</p>
              <ul className="space-y-2">
                {review.patterns.map((p, i) => (
                  <li key={i} className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3">
                    <p className="text-sm font-medium text-[#F0F0FA]">{p.title}</p>
                    <p className="mt-0.5 text-xs text-[#9090A8]">{p.detail}</p>
                    {p.evidence ? <p className="mt-1 text-[11px] text-[#5A5A72]">Evidence: {p.evidence}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {review.why_clients_buy.length > 0 || review.pitch_lines.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {review.why_clients_buy.length > 0 ? (
                <div className="rounded-lg border border-[#163322] bg-[#0E1A14] p-3">
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#34D399]">Why clients buy from us</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-[#F0F0FA]">
                    {review.why_clients_buy.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              ) : null}
              {review.pitch_lines.length > 0 ? (
                <div className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3">
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#9090A8]">Lines to use in the pitch</p>
                  <ul className="space-y-1.5">
                    {review.pitch_lines.map((l, i) => (
                      <li key={i} className="flex gap-1.5 text-xs text-[#F0F0FA]"><Quote className="mt-0.5 size-3 shrink-0 text-[#5A5A72]" />{l}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {review.actions.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#9090A8]">Suggested fixes</p>
              <ul className="space-y-2">
                {review.actions.map((a, i) => (
                  <li key={i} className="flex flex-col gap-2 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#F0F0FA]">
                        <span className="text-[#9090A8]">Heard:</span> {a.heard}
                      </p>
                      {a.meaning ? <p className="text-xs text-[#9090A8]">Might mean: {a.meaning}</p> : null}
                      <p className="mt-0.5 text-xs text-[#F0F0FA]">→ {a.action}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", OWNER_STYLE[a.owner].className)}>{OWNER_STYLE[a.owner].label}</span>
                      <span className="text-[11px] text-[#9090A8]">{a.due_in_days}d</span>
                      {added.has(i) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[#34D399]"><Check className="size-3.5" /> On the board</span>
                      ) : (
                        <button type="button" onClick={() => addAction(i)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#3B82F6] px-2.5 text-xs font-medium text-white">
                          <Plus className="size-3.5" /> Add to board
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {review.data_note ? <p className="text-[11px] text-[#5A5A72]">Note on the data: {review.data_note}</p> : null}
        </div>
      )}
    </section>
  )
}
