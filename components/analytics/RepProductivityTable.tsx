"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface RepRow {
  user_id: string
  full_name: string
  role: string
  assigned_leads: number
  closed_leads: number
  calls_per_week: number
  tasks_completed: number
  overdue_tasks: number
}

async function fetchRepActivity(): Promise<RepRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("rep_activity_summary")
    .select("*")

  if (error) throw error
  return (data ?? []) as RepRow[]
}

type SortKey =
  | "full_name"
  | "assigned_leads"
  | "closed_leads"
  | "calls_per_week"
  | "tasks_completed"
  | "overdue_tasks"

type SortDir = "asc" | "desc"

const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "full_name", label: "Rep", align: "left" },
  { key: "assigned_leads", label: "Assigned", align: "right" },
  { key: "closed_leads", label: "Closed", align: "right" },
  { key: "calls_per_week", label: "Calls/Week", align: "right" },
  { key: "tasks_completed", label: "Tasks Done", align: "right" },
  { key: "overdue_tasks", label: "Overdue", align: "right" },
]

export function RepProductivityTable() {
  const [sortKey, setSortKey] = useState<SortKey>("closed_leads")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-rep-activity"],
    queryFn: fetchRepActivity,
  })

  const sorted = useMemo(() => {
    if (!data) return []
    const copy = [...data]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp = 0
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv)
      } else {
        cmp = (av as number) - (bv as number)
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [data, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "full_name" ? "asc" : "desc")
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-[#7F1D1D]/50 bg-[#2A1215]/40 p-4 text-sm text-[#F87171]">
        Failed to load rep activity
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[#9090A8]">
        No rep activity data available
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2A3C] text-[11px] uppercase tracking-wider text-[#9090A8]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "cursor-pointer select-none px-3 py-2 font-medium transition hover:text-[#F0F0FA]",
                  col.align === "right" ? "text-right" : "text-left"
                )}
                onClick={() => toggleSort(col.key)}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    col.align === "right" ? "justify-end" : "justify-start"
                  )}
                >
                  {col.label}
                  {sortKey === col.key &&
                    (sortDir === "asc" ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((rep) => (
            <tr
              key={rep.user_id}
              className="border-b border-[#2A2A3C]/60 transition hover:bg-[#1A1A24]/60"
            >
              <td className="px-3 py-2.5">
                <p className="font-medium text-[#F0F0FA]">{rep.full_name}</p>
                <p className="text-[11px] capitalize text-[#9090A8]">
                  {rep.role.replace("_", " ")}
                </p>
              </td>
              <td className="px-3 py-2.5 text-right text-[#F0F0FA]">
                {rep.assigned_leads}
              </td>
              <td className="px-3 py-2.5 text-right text-[#34D399]">
                {rep.closed_leads}
              </td>
              <td className="px-3 py-2.5 text-right text-[#F0F0FA]">
                {rep.calls_per_week}
              </td>
              <td className="px-3 py-2.5 text-right text-[#F0F0FA]">
                {rep.tasks_completed}
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right font-medium",
                  rep.overdue_tasks > 0 ? "text-[#F87171]" : "text-[#9090A8]"
                )}
              >
                {rep.overdue_tasks}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
