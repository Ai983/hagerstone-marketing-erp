"use client"

import { useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNowStrict, isPast } from "date-fns"
import { MessageSquareText } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

/** Title the tracker-status import writes — see add-architect-tracker-status.mjs. */
export const TRACKER_STATUS_TITLE = "Status — 24 Dec 2025 master tracker"

export type StopInteraction = {
  lead_id: string
  type: string
  title: string | null
  notes: string | null
  outcome: string | null
  attendees: string | null
  occurred_at: string | null
  created_at: string
  user: { full_name: string } | null
}

export type StopTask = { lead_id: string; title: string; type: string; due_at: string }

export type WhereItStopped = {
  lastMeeting: StopInteraction | null
  tracker: StopInteraction | null
  /** Most recent entry logged by a person in the ERP (after the handover). */
  latestErp: StopInteraction | null
  nextTask: StopTask | null
}

const when = (i: StopInteraction) => i.occurred_at ?? i.created_at

/** The remark part of an imported note — everything before the first blank line. */
export function firstParagraph(notes: string | null) {
  return (notes ?? "").split(/\n\s*\n/)[0].trim()
}

/** "Mr Anup · Hagerstone: Saurabh" → { met: "Mr Anup", by: "Saurabh" } */
export function parseAttendees(attendees: string | null) {
  const parts = (attendees ?? "").split("·").map((p) => p.trim()).filter(Boolean)
  const by = parts.find((p) => p.startsWith("Hagerstone:"))?.replace("Hagerstone:", "").trim() ?? null
  const met = parts.filter((p) => !p.startsWith("Hagerstone:")).join(", ") || null
  return { met, by }
}

export function recommendedStep(tracker: StopInteraction | null) {
  const line = (tracker?.notes ?? "").split("\n").find((l) => l.startsWith("MD's recommended next step:"))
  return line ? line.replace("MD's recommended next step:", "").trim() : null
}

/** Priority text from the tracker note's detail line ("Priority 1 · POC: …"). */
export function trackerPriority(tracker: StopInteraction | null) {
  const line = (tracker?.notes ?? "").split("\n").find((l) => /^(Priority \d|Client Dropped|Not specified)/.test(l))
  return line ? line.split("·")[0].trim() : null
}

const MEETING_TYPES = ["meeting", "site_visit"]

/** Pick the four facts out of one lead's interactions (newest first or any order). */
export function summarise(interactions: StopInteraction[], tasks: StopTask[]): WhereItStopped {
  const sorted = [...interactions].sort((a, b) => when(b).localeCompare(when(a)))
  return {
    lastMeeting: sorted.find((i) => MEETING_TYPES.includes(i.type)) ?? null,
    tracker: sorted.find((i) => i.title === TRACKER_STATUS_TITLE) ?? null,
    latestErp: sorted.find((i) => i.user && i.type !== "stage_change") ?? null,
    nextTask: [...tasks].sort((a, b) => a.due_at.localeCompare(b.due_at))[0] ?? null,
  }
}

// ------------------------------------------------------------------
// The card
// ------------------------------------------------------------------

export function WhereItStoppedView({ stop, compact = false }: { stop: WhereItStopped; compact?: boolean }) {
  const { lastMeeting, tracker, latestErp, nextTask } = stop
  const meetingPeople = parseAttendees(lastMeeting?.attendees ?? null)
  const step = recommendedStep(tracker)
  const label = "w-[92px] shrink-0 text-[#5A5A72]"

  // If someone has worked the lead in the ERP since the drive, that is
  // where it stands now — shown first.
  const erpIsNewer = latestErp && (!tracker || when(latestErp) > when(tracker))

  return (
    <div className={cn("space-y-1.5", compact ? "text-[11px]" : "text-xs")}>
      {erpIsNewer ? (
        <div className="flex gap-2">
          <span className={cn(label, "text-[#34D399]")}>Latest</span>
          <span className="min-w-0 text-[#F0F0FA]">
            {format(new Date(when(latestErp!)), "d MMM yyyy")} · {latestErp!.type.replace(/_/g, " ")} by {latestErp!.user?.full_name}
            {latestErp!.notes ? <span className="text-[#9090A8]"> — {firstParagraph(latestErp!.notes).slice(0, compact ? 110 : 400)}</span> : null}
          </span>
        </div>
      ) : null}

      <div className="flex gap-2">
        <span className={label}>Last met</span>
        <span className="min-w-0 text-[#F0F0FA]">
          {lastMeeting ? (
            <>
              {format(new Date(when(lastMeeting)), "d MMM yyyy")}
              {meetingPeople.by ? ` · by ${meetingPeople.by}` : ""}
              {meetingPeople.met ? <span className="text-[#9090A8]"> · met {meetingPeople.met}</span> : null}
            </>
          ) : (
            <span className="text-[#5A5A72]">No meeting on record</span>
          )}
        </span>
      </div>

      {lastMeeting?.notes ? (
        <div className="flex gap-2">
          <span className={label}>What was said</span>
          <span className={cn("min-w-0 text-[#C8C8DC]", compact && "line-clamp-2")}>{firstParagraph(lastMeeting.notes)}</span>
        </div>
      ) : null}

      {tracker ? (
        <div className="flex gap-2">
          <span className={label}>Status 24 Dec</span>
          <span className={cn("min-w-0 text-[#C8C8DC]", compact && "line-clamp-2")}>
            {trackerPriority(tracker) ? <span className="text-[#A78BFA]">{trackerPriority(tracker)} — </span> : null}
            {firstParagraph(tracker.notes)}
          </span>
        </div>
      ) : null}

      <div className="flex gap-2">
        <span className={label}>Next step</span>
        <span className="min-w-0">
          {nextTask ? (
            <span className={isPast(new Date(nextTask.due_at)) ? "text-[#F87171]" : "text-[#F0F0FA]"}>
              {nextTask.title} · due {format(new Date(nextTask.due_at), "d MMM")}
              {isPast(new Date(nextTask.due_at)) ? ` (${formatDistanceToNowStrict(new Date(nextTask.due_at))} overdue)` : ""}
            </span>
          ) : step ? (
            <span className={cn("text-[#F59E0B]", compact && "line-clamp-2")}>{step} <span className="text-[#5A5A72]">(MD&apos;s recommendation — no task set)</span></span>
          ) : (
            <span className="text-[#5A5A72]">No next step set — decide on the next call</span>
          )}
        </span>
      </div>
    </div>
  )
}

/** Drawer version: loads one lead's facts itself. */
export function WhereItStoppedCard({ leadId }: { leadId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["where-it-stopped", leadId],
    queryFn: async (): Promise<WhereItStopped> => {
      const supabase = createClient()
      const [ints, tasks] = await Promise.all([
        supabase
          .from("interactions")
          .select("lead_id, type, title, notes, outcome, attendees, occurred_at, created_at, user:user_id(full_name)")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("tasks")
          .select("lead_id, title, type, due_at")
          .eq("lead_id", leadId)
          .is("completed_at", null),
      ])
      if (ints.error) throw ints.error
      if (tasks.error) throw tasks.error
      return summarise((ints.data ?? []) as unknown as StopInteraction[], (tasks.data ?? []) as StopTask[])
    },
  })

  return (
    <div className="mt-3 rounded-md border border-[#8B5CF6]/40 bg-[#8B5CF6]/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#A78BFA]">
        <MessageSquareText className="size-3.5" /> Where it stopped
      </p>
      {isLoading || !data ? (
        <p className="text-xs text-[#5A5A72]">Loading…</p>
      ) : (
        <WhereItStoppedView stop={data} />
      )}
    </div>
  )
}
