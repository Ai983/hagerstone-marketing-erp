"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isToday, parseISO,
  startOfMonth, startOfWeek, subDays,
} from "date-fns"
import { toast } from "sonner"
import { CalendarClock, Check, ChevronLeft, ChevronRight, Loader2, Plus, Repeat, UserRound } from "lucide-react"

import { FollowUpsDue } from "@/components/schedule/FollowUpsDue"
import { ScheduleItemModal } from "@/components/schedule/ScheduleItemModal"
import { getCachedUser, useUser } from "@/lib/hooks/useUser"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import {
  dayKey, occurrences, repeatLabel, timeLabel,
  type ScheduleItem, type ScheduleOccurrence,
} from "@/lib/utils/schedule"
import { cn } from "@/lib/utils"

type View = "today" | "week" | "month"

export default function SchedulePage() {
  const queryClient = useQueryClient()
  const { user } = useUser()
  const { setLeadDrawerId } = useUIStore()
  const [view, setView] = useState<View>("today")
  const [anchor, setAnchor] = useState(() => new Date())
  const [editing, setEditing] = useState<ScheduleItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultDate, setDefaultDate] = useState<string | undefined>()
  const [toggling, setToggling] = useState<string | null>(null)

  const today = new Date()

  // Days shown, plus the week before today so missed items can be listed.
  const range = useMemo(() => {
    if (view === "week") {
      return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) }
    }
    if (view === "month") return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
    return { start: today, end: today }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor])

  const fetchFrom = dayKey(view === "today" ? subDays(today, 7) : range.start)
  const fetchTo = dayKey(range.end)

  const { data, isLoading, error } = useQuery({
    queryKey: ["schedule", user?.id, fetchFrom, fetchTo],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const supabase = createClient()
      const { data: items, error } = await supabase
        .from("schedule_items")
        .select("*, lead:lead_id(id, full_name, company_name)")
        .eq("owner_id", user!.id)
        .eq("is_active", true)
        .lte("starts_on", fetchTo)
      if (error) throw error
      const ids = (items ?? []).map((i) => i.id)
      const { data: done, error: doneError } = ids.length
        ? await supabase
            .from("schedule_completions")
            .select("item_id, occurs_on")
            .in("item_id", ids)
            .gte("occurs_on", fetchFrom)
            .lte("occurs_on", fetchTo)
        : { data: [], error: null }
      if (doneError) throw doneError
      return {
        items: (items ?? []) as ScheduleItem[],
        doneKeys: new Set((done ?? []).map((d) => `${d.item_id}|${d.occurs_on}`)),
      }
    },
  })

  const items = useMemo(() => data?.items ?? [], [data])
  const doneKeys = useMemo(() => data?.doneKeys ?? new Set<string>(), [data])

  const shown = useMemo(
    () => occurrences(items, eachDayOfInterval(range), doneKeys),
    [items, range, doneKeys]
  )
  const missed = useMemo(
    () =>
      view === "today"
        ? occurrences(items, eachDayOfInterval({ start: subDays(today, 7), end: subDays(today, 1) }), doneKeys).filter((o) => !o.done)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, doneKeys, view]
  )

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["schedule"] })

  const toggle = async (o: ScheduleOccurrence) => {
    const key = `${o.item.id}|${o.date}`
    setToggling(key)
    const supabase = createClient()
    const { error } = o.done
      ? await supabase.from("schedule_completions").delete().eq("item_id", o.item.id).eq("occurs_on", o.date)
      : await supabase.from("schedule_completions").insert({
          item_id: o.item.id,
          occurs_on: o.date,
          completed_by: (await getCachedUser())?.id ?? null,
        })
    setToggling(null)
    if (error) {
      toast.error(error.message)
      return
    }
    refresh()
  }

  const openNew = (date?: string) => {
    setEditing(null)
    setDefaultDate(date)
    setModalOpen(true)
  }

  const shift = (dir: 1 | -1) => {
    if (view === "week") setAnchor((a) => addDays(a, 7 * dir))
    if (view === "month") setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1))
  }

  const periodLabel =
    view === "today"
      ? format(today, "EEEE, d MMMM")
      : view === "week"
        ? `${format(range.start, "d MMM")} – ${format(range.end, "d MMM yyyy")}`
        : format(anchor, "MMMM yyyy")

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleOccurrence[]>()
    for (const o of shown) map.set(o.date, [...(map.get(o.date) ?? []), o])
    return map
  }, [shown])

  const todayDone = shown.filter((o) => o.done).length

  const Row = ({ o, showDate = false }: { o: ScheduleOccurrence; showDate?: boolean }) => {
    const key = `${o.item.id}|${o.date}`
    const time = timeLabel(o.item.time_of_day)
    return (
      <div className={cn("flex items-start gap-3 rounded-xl border border-[#2A2A3C] bg-[#111118] p-3", o.done && "opacity-60")}>
        <button
          type="button"
          onClick={() => toggle(o)}
          disabled={toggling === key}
          aria-label={o.done ? "Mark not done" : "Mark done"}
          className={cn(
            "mt-0.5 flex size-7 shrink-0 touch-manipulation items-center justify-center rounded-full border-2 transition",
            o.done ? "border-[#10B981] bg-[#10B981] text-white" : "border-[#3A3A52] hover:border-[#10B981]"
          )}
        >
          {toggling === key ? <Loader2 className="size-3.5 animate-spin" /> : o.done ? <Check className="size-4" /> : null}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(o.item)
            setModalOpen(true)
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p className={cn("text-sm font-medium text-[#F0F0FA]", o.done && "line-through")}>{o.item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#9090A8]">
            {showDate ? <span className="text-[#F59E0B]">{format(parseISO(o.date), "EEE d MMM")}</span> : null}
            {time ? <span className="font-medium text-[#60A5FA]">{time}</span> : <span>Any time</span>}
            {o.item.repeat !== "none" ? (
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3" />
                {repeatLabel(o.item)}
              </span>
            ) : null}
          </div>
          {o.item.notes ? <p className="mt-1 line-clamp-2 text-xs text-[#9090A8]">{o.item.notes}</p> : null}
        </button>
        {o.item.lead ? (
          <button
            type="button"
            onClick={() => setLeadDrawerId(o.item.lead!.id)}
            className="inline-flex max-w-[40%] shrink-0 items-center gap-1 rounded-md border border-[#2A2A3C] px-2 py-1 text-[11px] text-[#9090A8] hover:text-[#F0F0FA]"
          >
            <UserRound className="size-3 shrink-0" />
            <span className="truncate">{o.item.lead.full_name}</span>
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">My Schedule</h1>
          <p className="mt-1 text-sm text-[#9090A8]">Who to follow up with today, and your own daily, weekly and monthly plan.</p>
        </div>
        <button
          type="button"
          onClick={() => openNew(view === "today" ? dayKey(today) : undefined)}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 text-sm font-medium text-white hover:bg-[#2563EB] md:px-4"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#2A2A3C] bg-[#111118] p-1 sm:w-80">
          {(["today", "week", "month"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v)
                setAnchor(new Date())
              }}
              className={cn(
                "h-9 rounded-md text-sm transition",
                view === v ? "bg-[#3B82F6] font-medium text-white" : "text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              {v === "today" ? "Today" : v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {view !== "today" ? (
            <button type="button" onClick={() => shift(-1)} aria-label="Previous" className="flex size-9 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#9090A8] hover:text-[#F0F0FA]">
              <ChevronLeft className="size-4" />
            </button>
          ) : null}
          <p className="min-w-0 flex-1 px-2 text-center text-sm font-medium text-[#F0F0FA] sm:flex-none">{periodLabel}</p>
          {view !== "today" ? (
            <button type="button" onClick={() => shift(1)} aria-label="Next" className="flex size-9 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#9090A8] hover:text-[#F0F0FA]">
              <ChevronRight className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {isLoading || !user ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">
          Could not load your schedule. Refresh the page.
        </div>
      ) : view === "today" ? (
        <div className="space-y-5">
          <FollowUpsDue />
          {missed.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">
                Not done — last 7 days ({missed.length})
              </h2>
              <div className="space-y-2">
                {missed.map((o) => <Row key={`${o.item.id}|${o.date}`} o={o} showDate />)}
              </div>
            </section>
          ) : null}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9090A8]">
              Today {shown.length ? `· ${todayDone} of ${shown.length} done` : ""}
            </h2>
            {shown.length === 0 ? (
              <EmptyState onAdd={() => openNew(dayKey(today))} hasAny={items.length > 0} />
            ) : (
              <div className="space-y-2">
                {shown.map((o) => <Row key={`${o.item.id}|${o.date}`} o={o} />)}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          {eachDayOfInterval(range)
            .filter((d) => view === "week" || byDay.has(dayKey(d)))
            .map((d) => {
              const key = dayKey(d)
              const list = byDay.get(key) ?? []
              return (
                <section key={key}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className={cn("text-xs font-semibold uppercase tracking-wider", isToday(d) ? "text-[#60A5FA]" : "text-[#9090A8]")}>
                      {format(d, "EEE d MMM")}
                      {isToday(d) ? " · Today" : ""}
                    </h2>
                    <button type="button" onClick={() => openNew(key)} aria-label={`Add on ${format(d, "d MMM")}`} className="flex size-8 items-center justify-center rounded-md text-[#5A5A72] hover:bg-[#1A1A24] hover:text-[#F0F0FA]">
                      <Plus className="size-4" />
                    </button>
                  </div>
                  {list.length ? (
                    <div className="space-y-2">
                      {list.map((o) => <Row key={`${o.item.id}|${o.date}`} o={o} />)}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-[#22222F] px-3 py-2 text-xs text-[#5A5A72]">Nothing planned</p>
                  )}
                </section>
              )
            })}
          {view === "month" && shown.length === 0 ? (
            <EmptyState onAdd={() => openNew()} hasAny={items.length > 0} />
          ) : null}
        </div>
      )}

      <ScheduleItemModal
        open={modalOpen}
        item={editing}
        defaultDate={defaultDate}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
      />
    </div>
  )
}

function EmptyState({ onAdd, hasAny }: { onAdd: () => void; hasAny: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] px-4 py-12 text-center">
      <CalendarClock className="mx-auto size-8 text-[#3A3A52]" />
      <p className="mt-3 text-sm font-medium text-[#F0F0FA]">{hasAny ? "Nothing planned here" : "Your schedule is empty"}</p>
      <p className="mt-1 text-xs text-[#9090A8]">
        Add a routine like &ldquo;Call architects — every weekday 11 am&rdquo; or &ldquo;Pipeline review — every Monday&rdquo;.
      </p>
      <button type="button" onClick={onAdd} className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 text-sm font-medium text-white">
        <Plus className="size-4" /> Add to schedule
      </button>
    </div>
  )
}
