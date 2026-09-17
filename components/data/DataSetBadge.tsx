"use client"

import { Database, Flame, Globe, Mail, Users, type LucideIcon } from "lucide-react"

import { useDataSets } from "@/lib/hooks/useDataSets"
import type { DataSet } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = { Database, Flame, Globe, Mail, Users }

interface DataSetBadgeProps {
  /** Pass either the id (looked up from the cached list) or the row. */
  dataSetId?: string | null
  dataSet?: DataSet | null
  size?: "xs" | "sm"
  className?: string
}

/** "Architect Drive" / "Founder Pipeline" chip — where a record came from. */
export function DataSetBadge({ dataSetId, dataSet, size = "xs", className }: DataSetBadgeProps) {
  const { byId } = useDataSets()
  const ds = dataSet ?? (dataSetId ? byId.get(dataSetId) : undefined)
  if (!ds) return null

  const Icon = (ds.icon && ICONS[ds.icon]) || Database

  return (
    <span
      title={ds.description ?? ds.name}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
      style={{
        color: ds.color,
        borderColor: `${ds.color}55`,
        backgroundColor: `${ds.color}1A`,
      }}
    >
      <Icon className={size === "xs" ? "size-2.5" : "size-3"} />
      {ds.name}
    </span>
  )
}

/** One short word per data set — what a card says about where it came from. */
export const SOURCE_SHORT_LABEL: Record<string, string> = {
  "erp-native": "ERP",
  website: "WEBSITE",
  "architect-meetings-dec-2025": "ARCHITECT",
  "founder-pipeline": "FOUNDER",
  "founder-universe": "UNIVERSE",
  "sales-bd-mailbox": "SALES BD",
}

export function sourceShortLabel(ds: Pick<DataSet, "key" | "name">) {
  return SOURCE_SHORT_LABEL[ds.key] ?? ds.name.toUpperCase()
}

/**
 * Compact, always-visible source tag for cards: FOUNDER / ARCHITECT / ERP
 * in the data set's colour. Deliberately text, not just a colour dot —
 * a dot alone was too easy to miss and clashed with status colours.
 */
export function SourceTag({ dataSetId, className }: { dataSetId?: string | null; className?: string }) {
  const { byId } = useDataSets()
  const ds = dataSetId ? byId.get(dataSetId) : undefined
  if (!ds) return null
  return (
    <span
      title={ds.description ?? ds.name}
      className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-px text-[9px] font-bold tracking-wider", className)}
      style={{ color: ds.color, backgroundColor: `${ds.color}24` }}
    >
      {sourceShortLabel(ds)}
    </span>
  )
}

const PRIORITY_STYLE: Record<string, { label: string; className: string; hint: string }> = {
  P1: { label: "P1", className: "bg-[#3F161A] text-[#F87171] border-[#F87171]/30", hint: "High-value — act now, weekly touchpoints" },
  P2: { label: "P2", className: "bg-[#3F2A12] text-[#F59E0B] border-[#F59E0B]/30", hint: "Medium potential — nurture" },
  P3: { label: "P3", className: "bg-[#1E2A4A] text-[#60A5FA] border-[#60A5FA]/30", hint: "Needs a scheduled meeting" },
  P4: { label: "P4", className: "bg-[#1A1A24] text-[#9090A8] border-[#2A2A3C]", hint: "Opportunistic — quarterly check-in" },
  dropped: { label: "Dropped", className: "bg-[#1A1A24] text-[#5A5A72] border-[#2A2A3C] line-through", hint: "Client dropped in field review" },
}

export const PRIORITY_OPTIONS = ["P1", "P2", "P3", "P4", "dropped"] as const

export function priorityLabel(p: string) {
  return PRIORITY_STYLE[p]?.label ?? p
}

/** P1–P4 field rating chip. */
export function PriorityBadge({ priority, note, className }: { priority?: string | null; note?: string | null; className?: string }) {
  if (!priority) return null
  const s = PRIORITY_STYLE[priority]
  if (!s) return null
  return (
    <span
      title={note ?? s.hint}
      className={cn("inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", s.className, className)}
    >
      {s.label}
    </span>
  )
}
