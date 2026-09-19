"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowDownRight, ArrowUpRight, Loader2, Minus } from "lucide-react"

import { useRelationshipGroups } from "@/lib/hooks/useRelationshipGroups"
import { createClient } from "@/lib/supabase/client"
import type { LeadRelationshipGroup } from "@/lib/types"
import { objectionLabel } from "@/lib/utils/objections"
import { LEAD_GROUPS } from "@/lib/utils/relationship-group"

type Row = { lead_id: string; objections: string[] }

async function fetchObjections(from: Date, to: Date): Promise<Row[]> {
  const { data, error } = await createClient()
    .from("interactions")
    .select("lead_id, objections")
    .not("objections", "eq", "{}")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .limit(5000)
  if (error) throw error
  return (data ?? []) as Row[]
}

/**
 * "Which objection do you hear again and again?" Objections tapped on
 * Log Call / Log Meeting in the selected period, against the period of
 * the same length just before it, with the relationship group that
 * raises each one most (by the lead's group today).
 */
export function ObjectionsCard({ from, to }: { from: Date; to: Date }) {
  const span = to.getTime() - from.getTime()
  const prevFrom = new Date(from.getTime() - span)
  const prevTo = new Date(from.getTime() - 1)

  const current = useQuery({
    queryKey: ["analytics-objections", from.toISOString(), to.toISOString()],
    queryFn: () => fetchObjections(from, to),
    retry: false,
  })
  const previous = useQuery({
    queryKey: ["analytics-objections", prevFrom.toISOString(), prevTo.toISOString()],
    queryFn: () => fetchObjections(prevFrom, prevTo),
    retry: false,
  })
  const { byLeadId } = useRelationshipGroups()

  const rows = useMemo(() => {
    const prevCounts = new Map<string, number>()
    for (const r of previous.data ?? []) for (const k of r.objections) prevCounts.set(k, (prevCounts.get(k) ?? 0) + 1)

    const counts = new Map<string, { n: number; groups: Map<LeadRelationshipGroup, number> }>()
    for (const r of current.data ?? []) {
      const group = byLeadId.get(r.lead_id)?.relationship_group
      for (const k of r.objections) {
        const c = counts.get(k) ?? { n: 0, groups: new Map() }
        c.n++
        if (group) c.groups.set(group, (c.groups.get(group) ?? 0) + 1)
        counts.set(k, c)
      }
    }

    return Array.from(counts.entries())
      .map(([key, c]) => {
        const top = Array.from(c.groups.entries()).sort((a, b) => b[1] - a[1])[0]
        return { key, n: c.n, prev: prevCounts.get(key) ?? 0, topGroup: top?.[0], topGroupN: top?.[1] ?? 0 }
      })
      .sort((a, b) => b.n - a.n)
  }, [current.data, previous.data, byLeadId])

  if (current.isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[#9090A8]" />
      </div>
    )
  }

  if (current.isError) {
    return <p className="text-sm text-[#9090A8]">Objections are not available yet — migration 019 has not been run.</p>
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[#9090A8]">
        No objections logged in this period. Tap them in Log Call or Log Meeting and they collect here.
      </p>
    )
  }

  const max = rows[0].n
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const delta = r.n - r.prev
        return (
          <li key={r.key}>
            <div className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-[#F0F0FA]">{objectionLabel(r.key)}</span>
              <span className="font-semibold text-[#F0F0FA]">{r.n}</span>
              <span
                title={`${r.prev} in the previous period`}
                className={
                  delta > 0 ? "inline-flex w-12 items-center justify-end text-xs text-[#F87171]"
                    : delta < 0 ? "inline-flex w-12 items-center justify-end text-xs text-[#34D399]"
                      : "inline-flex w-12 items-center justify-end text-xs text-[#5A5A72]"
                }
              >
                {delta > 0 ? <ArrowUpRight className="size-3" /> : delta < 0 ? <ArrowDownRight className="size-3" /> : <Minus className="size-3" />}
                {delta !== 0 ? Math.abs(delta) : ""}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#1F1F2E]">
              <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${Math.max(4, (r.n / max) * 100)}%` }} />
            </div>
            {r.topGroup ? (
              <p className="mt-1 text-[11px] text-[#5A5A72]">
                Mostly from{" "}
                <span style={{ color: LEAD_GROUPS[r.topGroup].color }}>{LEAD_GROUPS[r.topGroup].label.toLowerCase()}</span>
                {` (${r.topGroupN} of ${r.n})`}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
