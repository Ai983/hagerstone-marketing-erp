"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { getDate, getDay, parseISO } from "date-fns"
import { Loader2, Trash2, UserRound, X } from "lucide-react"

import { LeadPickerModal, type PickedLead } from "@/components/leads/LeadPickerModal"
import { getCachedUser } from "@/lib/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { WEEKDAY_SHORT, dayKey, type ScheduleItem, type ScheduleRepeat } from "@/lib/utils/schedule"
import { cn } from "@/lib/utils"

const REPEATS: { value: ScheduleRepeat; label: string }[] = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

// Monday first, the way a work week is read.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface ScheduleItemModalProps {
  open: boolean
  item: ScheduleItem | null
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}

export function ScheduleItemModal({ open, item, defaultDate, onClose, onSaved }: ScheduleItemModalProps) {
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [startsOn, setStartsOn] = useState(dayKey(new Date()))
  const [time, setTime] = useState("")
  const [repeat, setRepeat] = useState<ScheduleRepeat>("none")
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [endsOn, setEndsOn] = useState("")
  const [lead, setLead] = useState<Pick<PickedLead, "id" | "full_name" | "company_name"> | null>(null)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const start = item?.starts_on ?? defaultDate ?? dayKey(new Date())
    setTitle(item?.title ?? "")
    setNotes(item?.notes ?? "")
    setStartsOn(start)
    setTime(item?.time_of_day?.slice(0, 5) ?? "")
    setRepeat(item?.repeat ?? "none")
    setWeekdays(item?.weekdays?.length ? item.weekdays : [getDay(parseISO(start))])
    setEndsOn(item?.ends_on ?? "")
    setLead(item?.lead ?? null)
    setSaving(false)
  }, [open, item, defaultDate])

  const toggleDay = (d: number) =>
    setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))

  const valid =
    title.trim() &&
    startsOn &&
    (repeat !== "weekly" || weekdays.length > 0) &&
    (!endsOn || repeat === "none" || endsOn >= startsOn)

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const user = await getCachedUser()
    const row = {
      title: title.trim(),
      notes: notes.trim() || null,
      starts_on: startsOn,
      time_of_day: time || null,
      repeat,
      weekdays: repeat === "weekly" ? weekdays : [],
      ends_on: repeat === "none" ? null : endsOn || null,
      lead_id: lead?.id ?? null,
    }
    const supabase = createClient()
    const { error } = item
      ? await supabase.from("schedule_items").update(row).eq("id", item.id)
      : await supabase.from("schedule_items").insert({ ...row, owner_id: user?.id })
    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }
    toast.success(item ? "Schedule updated" : "Added to your schedule")
    onSaved()
    onClose()
  }

  const remove = async () => {
    if (!item) return
    const msg = item.repeat === "none" ? "Delete this item?" : "Delete this repeating item from every day?"
    if (!window.confirm(msg)) return
    setSaving(true)
    const { error } = await createClient().from("schedule_items").delete().eq("id", item.id)
    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }
    toast.success("Deleted")
    onSaved()
    onClose()
  }

  const field = "h-11 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-base text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm [color-scheme:dark]"
  const label = "mb-1.5 block text-xs font-medium text-[#9090A8]"
  const chip = (active: boolean) =>
    cn(
      "h-10 rounded-lg border px-3 text-sm transition",
      active ? "border-[#3B82F6] bg-[#3B82F6]/15 text-[#F0F0FA]" : "border-[#2A2A3C] text-[#9090A8]"
    )

  return (
    <>
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
            <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && onClose()} />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2A2A3C] bg-[#111118] sm:max-w-lg sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#2A2A3C] p-4">
                <h2 className="text-base font-semibold text-[#F0F0FA]">{item ? "Edit schedule item" : "Add to my schedule"}</h2>
                <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="flex size-10 items-center justify-center rounded-lg text-[#9090A8] hover:bg-[#1A1A24]">
                  <X className="size-5" />
                </button>
              </div>

              <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                  <label className={label}>What</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call architects, Review pipeline" className={field} autoFocus={!item} />
                </div>

                <div>
                  <label className={label}>Repeat</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {REPEATS.map((r) => (
                      <button key={r.value} type="button" onClick={() => setRepeat(r.value)} className={chip(repeat === r.value)}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {repeat === "weekly" ? (
                  <div>
                    <label className={label}>On which days</label>
                    <div className="grid grid-cols-7 gap-1">
                      {WEEK_ORDER.map((d) => (
                        <button key={d} type="button" onClick={() => toggleDay(d)} className={cn(chip(weekdays.includes(d)), "px-0 text-xs")}>
                          {WEEKDAY_SHORT[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>{repeat === "none" ? "Date" : "Starting"}</label>
                    <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label className={label}>Time (optional)</label>
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
                  </div>
                </div>
                {repeat === "monthly" && startsOn ? (
                  <p className="-mt-2 text-[11px] text-[#5A5A72]">
                    Repeats on day {getDate(parseISO(startsOn))} of every month.
                  </p>
                ) : null}

                {repeat !== "none" ? (
                  <div>
                    <label className={label}>Stop repeating on (optional)</label>
                    <input type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} className={field} />
                  </div>
                ) : null}

                <div>
                  <label className={label}>Lead (optional)</label>
                  {lead ? (
                    <div className="flex h-11 items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3">
                      <UserRound className="size-4 shrink-0 text-[#9090A8]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[#F0F0FA]">
                        {lead.full_name}
                        {lead.company_name ? <span className="text-[#9090A8]"> · {lead.company_name}</span> : null}
                      </span>
                      <button type="button" onClick={() => setLead(null)} aria-label="Remove lead" className="flex size-8 items-center justify-center rounded text-[#9090A8] hover:text-[#F0F0FA]">
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPicking(true)} className="flex h-11 w-full items-center gap-2 rounded-lg border border-dashed border-[#2A2A3C] px-3 text-sm text-[#9090A8] hover:text-[#F0F0FA]">
                      <UserRound className="size-4" /> Link a lead
                    </button>
                  )}
                </div>

                <div>
                  <label className={label}>Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-base text-[#F0F0FA] outline-none focus:border-[#3B82F6] sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 border-t border-[#2A2A3C] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {item ? (
                  <button type="button" onClick={remove} disabled={saving} aria-label="Delete" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#F87171] hover:bg-[#2A1215]">
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
                <button type="button" onClick={onClose} disabled={saving} className="h-11 flex-1 rounded-lg border border-[#2A2A3C] text-sm text-[#9090A8]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!valid || saving}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3B82F6] text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {item ? "Save" : "Add"}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <LeadPickerModal
        open={picking}
        title="Link which lead?"
        onClose={() => setPicking(false)}
        onPick={(l) => {
          setLead(l)
          setPicking(false)
        }}
      />
    </>
  )
}
