"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  Users,
  MapPin,
  Clock,
  Search,
  Loader2,
  CalendarDays,
  UserCircle2,
} from "lucide-react"

import { DataSetBadge } from "@/components/data/DataSetBadge"
import { LeadPickerModal } from "@/components/leads/LeadPickerModal"
import { useDataSets } from "@/lib/hooks/useDataSets"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/lib/stores/uiStore"
import { cn } from "@/lib/utils"

type MeetingRow = {
  id: string
  type: "meeting" | "site_visit"
  title: string | null
  notes: string | null
  outcome: string | null
  duration_minutes: number | null
  location: string | null
  attendees: string | null
  occurred_at: string | null
  created_at: string
  data_set_id?: string | null
  lead: { id: string; full_name: string; company_name: string | null; data_set_id?: string | null } | null
  user: { id: string; full_name: string } | null
}

const outcomeStyles: Record<string, string> = {
  positive: "bg-[#163322] text-[#34D399]",
  boq_requested: "bg-[#163322] text-[#34D399]",
  proposal_requested: "bg-[#163322] text-[#34D399]",
  negotiating: "bg-[#1E2A4A] text-[#60A5FA]",
  needs_follow_up: "bg-[#3F2A12] text-[#F59E0B]",
  on_hold: "bg-[#3F2A12] text-[#F59E0B]",
  not_interested: "bg-[#3F161A] text-[#F87171]",
}

function humanise(value: string) {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Effective date — a meeting written up late still lands on its real day. */
function meetingDate(m: MeetingRow) {
  return new Date(m.occurred_at ?? m.created_at)
}

async function fetchMeetings(): Promise<MeetingRow[]> {
  const supabase = createClient()
  // `*` rather than a column list so the page keeps working whether or not
  // migration 003 (data_set_id) has been applied.
  const { data, error } = await supabase
    .from("interactions")
    .select("*, lead:lead_id(id, full_name, company_name, data_set_id), user:user_id(id, full_name)")
    .in("type", ["meeting", "site_visit"])
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error) throw error

  return ((data ?? []) as unknown as MeetingRow[]).sort(
    (a, b) => meetingDate(b).getTime() - meetingDate(a).getTime()
  )
}

export default function MeetingsPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "meeting" | "site_visit">("all")
  const [dataSetFilter, setDataSetFilter] = useState("")
  const [picking, setPicking] = useState(false)
  const { setLeadDrawerId, setDrawerOpenLogMeeting } = useUIStore()
  const { dataSets } = useDataSets()

  const { data: meetings, isLoading, error } = useQuery({
    queryKey: ["meetings"],
    queryFn: fetchMeetings,
  })

  const filtered = useMemo(() => {
    const rows = meetings ?? []
    const q = search.trim().toLowerCase()
    return rows.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false
      // Filter by the LEAD source: a meeting logged today on a founder deal
      // belongs under Founder, even though the record itself was made in the ERP.
      if (dataSetFilter && m.lead?.data_set_id !== dataSetFilter) return false
      if (!q) return true
      return [
        m.lead?.full_name,
        m.lead?.company_name,
        m.location,
        m.attendees,
        m.notes,
        m.user?.full_name,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    })
  }, [meetings, search, typeFilter, dataSetFilter])

  const dataSetCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const m of meetings ?? []) {
      const ds = m.lead?.data_set_id
      if (ds) c[ds] = (c[ds] ?? 0) + 1
    }
    return c
  }, [meetings])

  const stats = useMemo(() => {
    const rows = meetings ?? []
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return {
      total: rows.length,
      thisMonth: rows.filter((m) => meetingDate(m) >= monthStart).length,
      siteVisits: rows.filter((m) => m.type === "site_visit").length,
    }
  }, [meetings])

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-6 md:py-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
            Meetings
          </h1>
          <p className="mt-1 text-sm text-[#9090A8]">
            Every client meeting and site visit recorded across the pipeline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#8B5CF6] px-3 text-sm font-medium text-white transition hover:bg-[#7C3AED] md:px-4"
        >
          <Users className="size-4" />
          Log meeting
        </button>
      </div>

      {dataSets.some((d) => dataSetCounts[d.id]) ? (
        <div className="thin-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {[{ id: "", name: "All sources", color: "#9090A8" }, ...dataSets.filter((d) => dataSetCounts[d.id])].map((d) => (
            <button
              key={d.id || "all"}
              type="button"
              onClick={() => setDataSetFilter(d.id)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition",
                dataSetFilter === d.id ? "text-[#F0F0FA]" : "border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8]"
              )}
              style={dataSetFilter === d.id ? { borderColor: d.color, backgroundColor: `${d.color}22` } : undefined}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
              {d.name}
              <span className="text-xs text-[#5A5A72]">{d.id ? dataSetCounts[d.id] : (meetings ?? []).length}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-2 md:gap-3">
        {[
          { label: "Total Recorded", value: stats.total, icon: Users },
          { label: "This Month", value: stats.thisMonth, icon: CalendarDays },
          { label: "Site Visits", value: stats.siteVisits, icon: MapPin },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border border-[#2A2A3C] bg-[#111118] p-3 md:p-4"
          >
            <div className="flex items-center gap-1.5 text-[#9090A8]">
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate text-[10px] uppercase tracking-wider md:text-[11px]">{label}</span>
            </div>
            <p className="mt-1 text-xl font-semibold text-[#F0F0FA] md:text-2xl">{value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5A5A72]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, company, location, attendee or notes..."
            className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] py-2.5 pl-9 pr-3 text-sm text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#8B5CF6]"
          />
        </div>
        <div className="flex gap-2">
          {(
            [
              { value: "all", label: "All" },
              { value: "meeting", label: "Meetings" },
              { value: "site_visit", label: "Site Visits" },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium transition",
                typeFilter === t.value
                  ? "border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#8B5CF6]"
                  : "border-[#2A2A3C] bg-[#1A1A24] text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading meetings...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">
          Could not load meetings.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] py-16 text-center">
          <Users className="mx-auto size-8 text-[#3A3A52]" />
          <p className="mt-3 text-sm font-medium text-[#F0F0FA]">
            {(meetings ?? []).length === 0
              ? "No meetings recorded yet"
              : "No meetings match your filters"}
          </p>
          <p className="mt-1 text-xs text-[#9090A8]">
            {(meetings ?? []).length === 0
              ? 'Open a lead and use "Log Meeting" to record one.'
              : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const when = meetingDate(m)
            return (
              <button
                key={m.id}
                onClick={() => m.lead && setLeadDrawerId(m.lead.id)}
                className="block w-full rounded-xl border border-[#2A2A3C] bg-[#111118] p-4 text-left transition hover:border-[#3A3A52]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      m.type === "site_visit"
                        ? "bg-[#1E2A4A] text-[#60A5FA]"
                        : "bg-[#2A1F3F] text-[#A78BFA]"
                    )}
                  >
                    {m.type === "site_visit" ? (
                      <MapPin className="size-3" />
                    ) : (
                      <Users className="size-3" />
                    )}
                    {m.type === "site_visit" ? "Site Visit" : "Meeting"}
                  </span>

                  <span className="text-sm font-semibold text-[#F0F0FA]">
                    {m.lead?.full_name ?? "Unknown lead"}
                  </span>
                  {m.lead?.company_name && (
                    <span className="text-xs text-[#9090A8]">
                      · {m.lead.company_name}
                    </span>
                  )}
                  <DataSetBadge dataSetId={m.lead?.data_set_id} />

                  {m.outcome && (
                    <span
                      className={cn(
                        "ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium",
                        outcomeStyles[m.outcome] ?? "bg-[#1A1A24] text-[#9090A8]"
                      )}
                    >
                      {humanise(m.outcome)}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#9090A8]">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3 text-[#5A5A72]" />
                    {format(when, "d MMM yyyy, h:mm a")}
                  </span>
                  {m.duration_minutes != null && m.duration_minutes > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3 text-[#5A5A72]" />
                      {m.duration_minutes}m
                    </span>
                  )}
                  {m.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3 text-[#5A5A72]" />
                      {m.location}
                    </span>
                  )}
                  {m.user?.full_name ? (
                    <span className="inline-flex items-center gap-1">
                      <UserCircle2 className="size-3 text-[#5A5A72]" />
                      {m.user.full_name}
                    </span>
                  ) : m.data_set_id ? (
                    <span className="inline-flex items-center gap-1 text-[#5A5A72]">
                      <UserCircle2 className="size-3" />
                      Imported record
                    </span>
                  ) : null}
                </div>

                {m.attendees && (
                  <p className="mt-1.5 text-[11px] text-[#9090A8]">
                    <span className="text-[#5A5A72]">Attendees: </span>
                    {m.attendees}
                  </p>
                )}

                {m.notes && (
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[#9090A8]">
                    {m.notes}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      <LeadPickerModal
        open={picking}
        title="Log a meeting with…"
        subtitle="Pick the lead you met"
        onClose={() => setPicking(false)}
        onPick={(lead) => {
          setDrawerOpenLogMeeting(true)
          setLeadDrawerId(lead.id)
          setPicking(false)
        }}
      />
    </div>
  )
}
