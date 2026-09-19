"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Pencil, Trophy } from "lucide-react"

import { WinStoryFields } from "@/components/leads/WinStoryFields"
import { createClient } from "@/lib/supabase/client"
import type { Lead } from "@/lib/types"
import { WIN_QUESTIONS, winStoryColumns, type WinStory } from "@/lib/utils/win-story"

function fromLead(lead: Lead): WinStory {
  return { trigger: lead.win_trigger ?? "", whyUs: lead.win_why_us ?? "", worry: lead.win_worry ?? "" }
}

/**
 * Won deals: the three "why they bought" answers, shown and editable in
 * the lead drawer — so a win captured without them can be filled later.
 */
export function WinStoryCard({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient()
  const [story, setStory] = useState<WinStory>(() => fromLead(lead))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Re-sync when the saved answers change, but never under someone typing.
  useEffect(() => {
    if (!editing) setStory(fromLead(lead))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, lead.win_trigger, lead.win_why_us, lead.win_worry])

  const answered = WIN_QUESTIONS.filter((q) => story[q.key].trim())

  const save = async () => {
    setSaving(true)
    const { error } = await createClient().from("leads").update(winStoryColumns(story)).eq("id", lead.id)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setEditing(false)
    toast.success("Saved")
    queryClient.invalidateQueries({ queryKey: ["lead-drawer-detail", lead.id] })
  }

  return (
    <div className="mt-3 rounded-lg border border-[#163322] bg-[#0E1A14] p-3">
      <div className="flex items-center gap-2">
        <Trophy className="size-3.5 text-[#34D399]" />
        <p className="text-[11px] uppercase tracking-wider text-[#34D399]">Why they bought</p>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#9090A8] hover:text-[#F0F0FA]">
            <Pencil className="size-3" /> {answered.length ? "Edit" : "Add"}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2">
          <WinStoryFields value={story} onChange={setStory} />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#10B981] px-3 text-xs font-medium text-white disabled:opacity-60">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null} Save
            </button>
            <button type="button" onClick={() => { setStory(fromLead(lead)); setEditing(false) }} className="h-8 px-2 text-xs text-[#9090A8]">
              Cancel
            </button>
          </div>
        </div>
      ) : answered.length ? (
        <dl className="mt-2 space-y-1.5">
          {answered.map((q) => (
            <div key={q.key}>
              <dt className="text-[11px] text-[#5A5A72]">{q.label}</dt>
              <dd className="text-xs text-[#F0F0FA]">{story[q.key]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1 text-xs text-[#9090A8]">
          Not captured yet. Three lines here feed the monthly review and sharpen the pitch.
        </p>
      )}
    </div>
  )
}
