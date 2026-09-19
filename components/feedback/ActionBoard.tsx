"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { differenceInCalendarDays, format } from "date-fns"
import { toast } from "sonner"
import { Check, ChevronDown, Loader2, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react"

import { getCachedUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { OBJECTIONS } from "@/lib/utils/objections"

export const FEEDBACK_ACTIONS_KEY = ["feedback-actions"] as const

export type ActionOwner = "sales" | "marketing" | "founder"

export interface FeedbackAction {
  id: string
  heard: string
  objection_key: string | null
  meaning: string | null
  action: string
  owner: ActionOwner
  due_date: string | null
  status: "open" | "done"
  outcome: string | null
  source: "manual" | "ai"
  created_at: string
  done_at: string | null
}

export const OWNER_STYLE: Record<ActionOwner, { label: string; className: string }> = {
  sales: { label: "Sales", className: "border-[#3987E5]/40 bg-[#3987E5]/15 text-[#8FB9F5]" },
  marketing: { label: "Marketing", className: "border-[#22B58A]/40 bg-[#22B58A]/15 text-[#6FD8B5]" },
  founder: { label: "Founder", className: "border-[#F5B429]/40 bg-[#F5B429]/15 text-[#F5B429]" },
}

export interface NewAction {
  heard: string
  objection_key?: string | null
  meaning?: string
  action: string
  owner: ActionOwner
  due_date?: string | null
  source?: "manual" | "ai"
}

/** Insert an action on the board; used by the form and by AI suggestions. */
export async function addFeedbackAction(input: NewAction) {
  const user = await getCachedUser()
  const { error } = await createClient()
    .from("feedback_actions")
    .insert({
      heard: input.heard.trim(),
      objection_key: input.objection_key ?? null,
      meaning: input.meaning?.trim() || null,
      action: input.action.trim(),
      owner: input.owner,
      due_date: input.due_date || null,
      source: input.source ?? "manual",
      created_by: user?.id ?? null,
    })
  if (error) throw error
}

const field =
  "w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2.5 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#3B82F6] md:text-sm"

/**
 * The playbook's Feedback → Action matrix: what we heard, what it might
 * mean, the fix, who owns it and by when. "Fix the process, not the person."
 */
export function ActionBoard() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: FEEDBACK_ACTIONS_KEY,
    queryFn: async (): Promise<FeedbackAction[]> => {
      const { data, error } = await createClient()
        .from("feedback_actions")
        .select("*")
        .order("status")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as FeedbackAction[]
    },
    retry: false,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: FEEDBACK_ACTIONS_KEY })
  const open = (data ?? []).filter((a) => a.status === "open")
  const done = (data ?? []).filter((a) => a.status === "done")

  return (
    <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#F0F0FA]">Feedback → Action board</h2>
          <p className="text-xs text-[#9090A8]">What we keep hearing, what it may mean, the fix, an owner and a date.</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 text-sm font-medium text-white"
        >
          <Plus className="size-4" /> Add action
        </button>
      </div>

      {adding ? <ActionForm onDone={() => { setAdding(false); refresh() }} /> : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-sm text-[#9090A8]"><Loader2 className="mr-2 size-4 animate-spin" /> Loading…</div>
      ) : error ? (
        <p className="text-sm text-[#9090A8]">The action board is not available yet — migration 022 has not been run.</p>
      ) : open.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#2A2A3C] px-4 py-6 text-center text-sm text-[#9090A8]">
          No open actions. Add one, or run the review above and add its suggestions.
        </p>
      ) : (
        <div className="space-y-2">
          {open.map((a) => <ActionRow key={a.id} action={a} onChanged={refresh} />)}
        </div>
      )}

      {done.length > 0 ? (
        <div className="mt-4">
          <button type="button" onClick={() => setShowDone((s) => !s)} className="inline-flex items-center gap-1 text-xs text-[#9090A8] hover:text-[#F0F0FA]">
            <ChevronDown className={cn("size-3.5 transition", showDone && "rotate-180")} /> Done ({done.length})
          </button>
          {showDone ? <div className="mt-2 space-y-2 opacity-70">{done.map((a) => <ActionRow key={a.id} action={a} onChanged={refresh} />)}</div> : null}
        </div>
      ) : null}
    </section>
  )
}

function ActionForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<NewAction>({ heard: "", objection_key: null, meaning: "", action: "", owner: "sales", due_date: "" })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.heard.trim() || !form.action.trim()) {
      toast.error("Fill in what you heard and the action")
      return
    }
    setSaving(true)
    try {
      await addFeedbackAction(form)
      toast.success("Action added")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-[#9090A8]">We heard</span>
          <select
            className={field}
            value={form.objection_key ?? ""}
            onChange={(e) => {
              const o = OBJECTIONS.find((x) => x.key === e.target.value)
              setForm((f) => ({ ...f, objection_key: o?.key ?? null, heard: o ? o.label : f.heard }))
            }}
          >
            <option value="">Pick an objection, or type below…</option>
            {OBJECTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <input className={cn(field, "mt-1.5")} value={form.heard} onChange={(e) => setForm((f) => ({ ...f, heard: e.target.value }))} placeholder="e.g. “Too expensive”" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[#9090A8]">What it might mean</span>
          <input className={field} value={form.meaning} onChange={(e) => setForm((f) => ({ ...f, meaning: e.target.value }))} placeholder="e.g. Value not clear / competitor cheaper" />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-[11px] text-[#9090A8]">Action</span>
          <input className={field} value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))} placeholder="e.g. Test a new value message on the next 5 proposals" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[#9090A8]">Owner</span>
          <select className={field} value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value as ActionOwner }))}>
            {(Object.keys(OWNER_STYLE) as ActionOwner[]).map((o) => <option key={o} value={o}>{OWNER_STYLE[o].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-[#9090A8]">Due</span>
          <input type="date" className={field} value={form.due_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={save} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save
        </button>
        <button type="button" onClick={onDone} className="h-9 px-3 text-sm text-[#9090A8]">Cancel</button>
      </div>
    </div>
  )
}

function ActionRow({ action, onChanged }: { action: FeedbackAction; onChanged: () => void }) {
  const [closing, setClosing] = useState(false)
  const [outcome, setOutcome] = useState("")
  const [busy, setBusy] = useState(false)

  const days = action.due_date ? differenceInCalendarDays(new Date(action.due_date), new Date()) : null
  const due =
    action.status === "done"
      ? action.done_at ? `Done ${format(new Date(action.done_at), "d MMM")}` : "Done"
      : days === null ? "No date"
        : days < 0 ? `Overdue ${-days}d`
          : days === 0 ? "Due today"
            : `Due ${format(new Date(action.due_date!), "d MMM")}`

  const update = async (patch: Record<string, unknown>) => {
    setBusy(true)
    const { error } = await createClient().from("feedback_actions").update(patch).eq("id", action.id)
    setBusy(false)
    if (error) {
      toast.error(error.message)
      return false
    }
    onChanged()
    return true
  }

  const remove = async () => {
    if (!window.confirm("Delete this action?")) return
    const { error } = await createClient().from("feedback_actions").delete().eq("id", action.id)
    if (error) toast.error(error.message)
    else onChanged()
  }

  return (
    <div className="rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.1fr_1.3fr_1.5fr_auto] md:items-start">
        <div>
          <p className="text-sm font-medium text-[#F0F0FA]">{action.heard}</p>
          {action.source === "ai" ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[#A78BFA]"><Sparkles className="size-3" /> From AI review</span>
          ) : null}
        </div>
        <p className="text-xs text-[#9090A8]">{action.meaning || "—"}</p>
        <div>
          <p className="text-xs text-[#F0F0FA]">{action.action}</p>
          {action.outcome ? <p className="mt-1 text-[11px] text-[#34D399]">Result: {action.outcome}</p> : null}
        </div>
        <div className="flex items-center gap-2 md:flex-col md:items-end">
          <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", OWNER_STYLE[action.owner].className)}>
            {OWNER_STYLE[action.owner].label}
          </span>
          <span className={cn("text-[11px] font-medium", action.status === "open" && days !== null && days < 0 ? "text-[#F87171]" : "text-[#9090A8]")}>{due}</span>
        </div>
      </div>

      {closing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            autoFocus
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="What happened? (optional) — e.g. new message got 3 replies from 8"
            className="h-9 min-w-0 flex-1 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#3B82F6] md:text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await update({ status: "done", done_at: new Date().toISOString(), outcome: outcome.trim() || null })) setClosing(false)
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#10B981] px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            <Check className="size-3.5" /> Mark done
          </button>
          <button type="button" onClick={() => setClosing(false)} className="h-9 px-2 text-xs text-[#9090A8]">Cancel</button>
        </div>
      ) : (
        <div className="mt-2 flex gap-3">
          {action.status === "open" ? (
            <button type="button" onClick={() => setClosing(true)} className="inline-flex items-center gap-1 text-[11px] text-[#34D399] hover:underline">
              <Check className="size-3" /> Done
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => update({ status: "open", done_at: null })} className="inline-flex items-center gap-1 text-[11px] text-[#9090A8] hover:text-[#F0F0FA]">
              <RotateCcw className="size-3" /> Reopen
            </button>
          )}
          <button type="button" onClick={remove} className="inline-flex items-center gap-1 text-[11px] text-[#5A5A72] hover:text-[#F87171]">
            <Trash2 className="size-3" /> Delete
          </button>
        </div>
      )}
    </div>
  )
}
