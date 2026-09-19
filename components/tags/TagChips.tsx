"use client"

import { useTags } from "@/lib/hooks/useTags"
import { cn } from "@/lib/utils"

/** Coloured chips for a record's tag ids. Unknown or missing ids are skipped. */
export function TagChips({
  tagIds,
  onlyImportant = false,
  size = "xs",
  className,
}: {
  tagIds?: string[] | null
  /** Kanban cards show only the tags marked important (VIP, Do not contact). */
  onlyImportant?: boolean
  size?: "xs" | "sm"
  className?: string
}) {
  const { byId } = useTags()
  if (!tagIds?.length) return null
  const tags = tagIds
    .map((id) => byId.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t) && (!onlyImportant || t!.is_important))
    .sort((a, b) => a.position - b.position)
  if (!tags.length) return null

  return (
    <>
      {tags.map((t) => (
        <span
          key={t.id}
          className={cn(
            "inline-flex shrink-0 items-center rounded-md border font-medium",
            size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
            className
          )}
          style={{ color: t.color, borderColor: `${t.color}55`, backgroundColor: `${t.color}14` }}
        >
          {t.name}
        </span>
      ))}
    </>
  )
}
