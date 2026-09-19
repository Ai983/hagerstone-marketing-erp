"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { addDays, differenceInCalendarDays, format, formatDistanceToNowStrict } from "date-fns"
import { toast } from "sonner"
import { AlarmClockOff, BellRing, Loader2, MessageCircle, NotebookPen, Phone } from "lucide-react"

import { GroupBadge } from "@/components/data/RelationshipGroupBadge"
import { RELATIONSHIP_GROUPS_KEY, useFollowUpsDue } from "@/lib/hooks/useRelationshipGroups"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import type { LeadFollowUp, LeadRelationshipGroup } from "@/lib/types"
import { cn } from "@/lib/utils"
import { FOLLOW_UP_DAYS, FOLLOW_UP_ORDER, LEAD_GROUPS } from "@/lib/utils/relationship-group"

const SNOOZE_OPTIONS = [
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
]

const PAGE = 15

function tenDigits(phone: string | null) {
  const d = (phone ?? "").split(/[\/,;]/)[0].replace(/\D/g, "")
  return d.length >= 10 ? d.slice(-10) : null
}

function dueLabel(dueAt: string) {
  const days = differenceInCalendarDays(new Date(), new Date(dueAt))
  if (days <= 0) return { text: "Due today", className: "text-[#F59E0B]" }
  return { text: `Overdue ${days} day${days === 1 ? "" : "s"}`, className: "text-[#F87171]" }
}

/**
 * The leads due a client contact today, from each relationship group's
 * rhythm (migration 018). Logging a call, meeting or note moves the lead's
 * next due date on its own; Snooze pushes it when the client asked for later.
 */
export function FollowUpsDue() {
  const queryClient = useQueryClient()
  const { setLeadDrawerId, setDrawerOpenLogCall } = useUIStore()
  const { data, isLoading, error } = useFollowUpsDue()
  const [group, setGroup] = useState<LeadRelationshipGroup | "">("")
  const [shown, setShown] = useState(PAGE)
  const [snoozeFor, setSnoozeFor] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const due = useMemo(() => data?.due ?? [], [data])
  const counts = useMemo(() => {
    const c: Partial<Record<LeadRelationshipGroup, number>> = {}
    for (const f of due) c[f.relationship_group] = (c[f.relationship_group] ?? 0) + 1
    return c
  }, [due])
  const list = group ? due.filter((f) => f.relationship_group === group) : due

  const snooze = async (f: LeadFollowUp, days: number) => {
    setSaving(f.lead_id)
    const until = addDays(new Date(), days)
    const { error: err } = await createClient()
      .from("leads")
      .update({ follow_up_snoozed_until: until.toISOString() })
      .eq("id", f.lead_id)
    setSaving(null)
    setSnoozeFor(null)
    if (err) {
      toast.error(err.message)
      return
    }
    toast.success(`${f.company_name || f.full_name} snoozed to ${format(until, "d MMM")}`)
    queryClient.invalidateQueries({ queryKey: RELATIONSHIP_GROUPS_KEY })
  }

  const logCall = (leadId: string) => {
    setLeadDrawerId(leadId)
    setDrawerOpenLogCall(true)
  }

  if (error) return null

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#60A5FA]">
          <BellRing className="size-3.5" />
          Follow-ups due {isLoading ? "" : `(${due.length})`}
        </h2>
        {data?.backlog ? (
          <Link href="/leads?group=new_prospect" className="text-[11px] text-[#5A5A72] hover:text-[#9090A8]">
            + {data.backlog} older new leads never contacted →
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-[#2A2A3C] bg-[#111118] py-8 text-sm text-[#9090A8]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading follow-ups…
        </div>
      ) : due.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] px-4 py-6 text-center text-sm text-[#9090A8]">
          Nobody is due a follow-up today.
        </p>
      ) : (
        <>
          {/* Group chips double as a filter */}
          <div className="thin-scrollbar -mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {[{ key: "" as const, label: "All", color: "#9090A8", count: due.length },
              ...FOLLOW_UP_ORDER.filter((g) => counts[g]).map((g) => ({
                key: g, label: LEAD_GROUPS[g].label, color: LEAD_GROUPS[g].color, count: counts[g] ?? 0,
              }))].map((c) => (
              <button
                key={c.key || "all"}
                type="button"
                onClick={() => { setGroup(c.key); setShown(PAGE) }}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition",
                  group === c.key ? "text-[#F0F0FA]" : "border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8]"
                )}
                style={group === c.key ? { borderColor: c.color, backgroundColor: `${c.color}22` } : undefined}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}
                <span className="text-[#5A5A72]">{c.count}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {list.slice(0, shown).map((f) => {
              const phone = tenDigits(f.phone)
              const dueText = f.due_at ? dueLabel(f.due_at) : null
              const meta = LEAD_GROUPS[f.relationship_group]
              return (
                <div key={f.lead_id} className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-3">
                  <button type="button" onClick={() => setLeadDrawerId(f.lead_id)} className="block w-full text-left">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-[#F0F0FA]">{f.company_name || f.full_name}</span>
                      {meta ? <GroupBadge meta={meta} /> : null}
                      {dueText ? <span className={cn("ml-auto text-[11px] font-medium", dueText.className)}>{dueText.text}</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#9090A8]">
                      {f.company_name && f.full_name !== f.company_name ? <span>{f.full_name}</span> : null}
                      {f.stage_name ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: f.stage_color ?? "#6B7280" }} />
                          {f.stage_name}
                        </span>
                      ) : null}
                      <span className="text-[#5A5A72]">
                        {f.last_touch_at
                          ? `Last contact ${formatDistanceToNowStrict(new Date(f.last_touch_at), { addSuffix: true })}`
                          : "No contact logged"}
                        {` · every ${FOLLOW_UP_DAYS[f.relationship_group]} days`}
                      </span>
                    </div>
                  </button>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {phone ? (
                      <>
                        <a href={`tel:${phone}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#2A2A3C] px-2.5 text-xs text-[#F0F0FA]">
                          <Phone className="size-3.5 text-[#10B981]" />Call
                        </a>
                        <a href={`https://wa.me/91${phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#2A2A3C] px-2.5 text-xs text-[#F0F0FA]">
                          <MessageCircle className="size-3.5 text-[#25D366]" />WhatsApp
                        </a>
                      </>
                    ) : null}
                    <button type="button" onClick={() => logCall(f.lead_id)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1E3A5F] px-2.5 text-xs text-[#93C5FD]">
                      <NotebookPen className="size-3.5" />Log call
                    </button>
                    {snoozeFor === f.lead_id ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {SNOOZE_OPTIONS.map((o) => (
                          <button
                            key={o.days}
                            type="button"
                            disabled={saving === f.lead_id}
                            onClick={() => snooze(f, o.days)}
                            className="h-8 rounded-lg border border-[#2A2A3C] px-2 text-xs text-[#9090A8] hover:text-[#F0F0FA] disabled:opacity-50"
                          >
                            {o.label}
                          </button>
                        ))}
                        <button type="button" onClick={() => setSnoozeFor(null)} className="h-8 px-1.5 text-xs text-[#5A5A72]">Cancel</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setSnoozeFor(f.lead_id)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-[#9090A8] hover:text-[#F0F0FA]">
                        <AlarmClockOff className="size-3.5" />Snooze
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {list.length > shown ? (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-2 h-9 w-full rounded-lg border border-[#2A2A3C] text-xs text-[#9090A8] hover:text-[#F0F0FA]">
              Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}
            </button>
          ) : null}
        </>
      )}
    </section>
  )
}
