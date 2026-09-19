"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNowStrict } from "date-fns"
import { TrendingUp } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { CompanyDocument } from "@/lib/types"

export interface DocumentStats {
  document_id: string
  shares: number
  leads: number
  leads_moved_forward: number
  leads_won: number
  won_value: number
  last_shared_at: string | null
}

function inr(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 2)} Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

/** Per-document share outcomes (migration 022, `document_performance()`). */
export function useDocumentPerformance() {
  const query = useQuery({
    queryKey: ["document-performance"],
    queryFn: async (): Promise<DocumentStats[]> => {
      const { data, error } = await createClient().rpc("document_performance")
      if (error) throw error
      return ((data ?? []) as DocumentStats[]).map((r) => ({
        ...r,
        shares: Number(r.shares),
        leads: Number(r.leads),
        leads_moved_forward: Number(r.leads_moved_forward),
        leads_won: Number(r.leads_won),
        won_value: Number(r.won_value),
      }))
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const byId = useMemo(() => new Map((query.data ?? []).map((r) => [r.document_id, r])), [query.data])
  return { ...query, byId }
}

/** One line under a document card: what happened to the leads it went to. */
export function DocumentOutcomeLine({ stats }: { stats?: DocumentStats }) {
  if (!stats || stats.leads === 0) return null
  return (
    <p className="mt-1 text-[11px] text-[#9090A8]">
      Sent to {stats.leads} lead{stats.leads === 1 ? "" : "s"}
      {stats.leads_moved_forward ? <span className="text-[#60A5FA]"> · {stats.leads_moved_forward} moved forward</span> : null}
      {stats.leads_won ? (
        <span className="text-[#34D399]">
          {" "}· {stats.leads_won} won{stats.won_value ? ` (${inr(stats.won_value)})` : ""}
        </span>
      ) : null}
    </p>
  )
}

/**
 * "Content that moves money, not likes." Documents ranked by what the
 * leads they were sent to did afterwards — won value, then moves forward.
 */
export function DocumentPerformanceSection({ documents }: { documents: CompanyDocument[] }) {
  const { data, isLoading, isError } = useDocumentPerformance()

  const rows = useMemo(() => {
    const titles = new Map(documents.map((d) => [d.id, d]))
    return (data ?? [])
      .filter((r) => r.leads > 0 && titles.has(r.document_id))
      .map((r) => ({ ...r, doc: titles.get(r.document_id)! }))
      .sort((a, b) => b.won_value - a.won_value || b.leads_won - a.leads_won || b.leads_moved_forward - a.leads_moved_forward || b.leads - a.leads)
  }, [data, documents])

  if (isLoading || isError) return null

  return (
    <section className="mb-5 rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#F0F0FA]">
        <TrendingUp className="size-4 text-[#34D399]" /> What&apos;s working
      </h2>
      <p className="mt-0.5 text-xs text-[#9090A8]">
        What happened to the leads each profile or pitch was shared with. Only shares sent from the ERP count, and
        &ldquo;moved forward&rdquo; means a later pipeline stage after the first share.
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[#5A5A72]">
          Nothing shared from the ERP yet. Use <span className="text-[#F0F0FA]">Share</span> or{" "}
          <span className="text-[#F0F0FA]">Send</span> on a card, and results collect here.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#5A5A72]">
                <th className="pb-2 text-left font-medium">Document</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">Moved forward</th>
                <th className="pb-2 text-right font-medium">Won</th>
                <th className="pb-2 text-right font-medium">Won value</th>
                <th className="pb-2 text-right font-medium">Last shared</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => {
                const rate = r.leads ? Math.round((r.leads_moved_forward / r.leads) * 100) : 0
                return (
                  <tr key={r.document_id} className="border-t border-[#1F1F2E]">
                    <td className="max-w-[240px] truncate py-2 text-[#F0F0FA]">{r.doc.title}</td>
                    <td className="py-2 text-right text-[#9090A8]">{r.leads}</td>
                    <td className="py-2 text-right text-[#60A5FA]">{r.leads_moved_forward ? `${r.leads_moved_forward} · ${rate}%` : "—"}</td>
                    <td className="py-2 text-right text-[#34D399]">{r.leads_won || "—"}</td>
                    <td className="py-2 text-right text-[#F0F0FA]">{r.won_value ? inr(r.won_value) : "—"}</td>
                    <td className="py-2 text-right text-xs text-[#5A5A72]">
                      {r.last_shared_at ? formatDistanceToNowStrict(new Date(r.last_shared_at), { addSuffix: true }) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
