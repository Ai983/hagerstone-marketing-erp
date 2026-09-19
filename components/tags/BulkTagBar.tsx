"use client"

import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { X } from "lucide-react"

import { TagPicker } from "@/components/tags/TagPicker"
import { useTags } from "@/lib/hooks/useTags"
import { createClient } from "@/lib/supabase/client"

/**
 * Shown on All Leads while leads are ticked: add or remove one tag on all
 * of them at once (marketing.add_tag_to_leads / remove_tag_from_leads).
 */
export function BulkTagBar({ leadIds, onClear }: { leadIds: string[]; onClear: () => void }) {
  const queryClient = useQueryClient()
  const { byId } = useTags()

  const apply = async (mode: "add" | "remove", tagId: string | undefined) => {
    if (!tagId) return
    const fn = mode === "add" ? "add_tag_to_leads" : "remove_tag_from_leads"
    const { data, error } = await createClient().rpc(fn, { p_tag_id: tagId, p_lead_ids: leadIds })
    if (error) {
      toast.error(error.message)
      return
    }
    const name = byId.get(tagId)?.name ?? "tag"
    const n = Number(data ?? 0)
    toast.success(
      mode === "add"
        ? `Tagged ${n} lead${n === 1 ? "" : "s"} “${name}”`
        : `Removed “${name}” from ${n} lead${n === 1 ? "" : "s"}`
    )
    queryClient.invalidateQueries({ queryKey: ["leads"] })
    queryClient.invalidateQueries({ queryKey: ["kanban-leads"] })
  }

  return (
    <div className="sticky top-0 z-20 mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#3B82F6]/40 bg-[#111827] px-3 py-2 md:mx-0">
      <span className="text-sm font-medium text-[#F0F0FA]">{leadIds.length} selected</span>
      {/* value is always empty: whatever is picked is applied, then the picker resets. */}
      <TagPicker value={[]} onChange={(next) => apply("add", next[0])} label="Add tag" />
      <TagPicker value={[]} onChange={(next) => apply("remove", next[0])} label="Remove tag" />
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#9090A8] hover:text-[#F0F0FA]"
      >
        <X className="size-3.5" /> Clear selection
      </button>
    </div>
  )
}
