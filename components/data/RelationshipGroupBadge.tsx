"use client"

import { useRelationshipGroups } from "@/lib/hooks/useRelationshipGroups"
import type { LeadRelationshipGroup } from "@/lib/types"
import type { GroupMeta } from "@/lib/utils/relationship-group"
import { LEAD_GROUPS } from "@/lib/utils/relationship-group"
import { cn } from "@/lib/utils"

/** Chip for anything that already knows its group meta (universe rows). */
export function GroupBadge({ meta, size = "xs", className }: { meta: GroupMeta; size?: "xs" | "sm"; className?: string }) {
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
      style={{ color: meta.color, borderColor: `${meta.color}55`, backgroundColor: `${meta.color}1A` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}

/** "Gone quiet" / "Proposal pending" chip for a pipeline lead. */
export function RelationshipGroupBadge({
  leadId,
  only,
  size,
  className,
}: {
  leadId: string
  /** Show only these groups — e.g. on Kanban, where the column already says "proposal". */
  only?: LeadRelationshipGroup[]
  size?: "xs" | "sm"
  className?: string
}) {
  const { byLeadId } = useRelationshipGroups()
  const row = byLeadId.get(leadId)
  if (!row) return null
  if (only && !only.includes(row.relationship_group)) return null
  const meta = LEAD_GROUPS[row.relationship_group]
  if (!meta) return null
  return <GroupBadge meta={meta} size={size} className={className} />
}
