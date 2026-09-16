"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNowStrict, isAfter, subDays } from "date-fns"
import {
  Clock, Globe, Loader2, Mail, MessageCircle, Phone, Search, Zap,
} from "lucide-react"

import { useDataSets } from "@/lib/hooks/useDataSets"
import { useUIStore } from "@/lib/stores/uiStore"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type WebsiteLead = {
  id: string
  full_name: string
  company_name: string | null
  phone: string | null
  email: string | null
  city: string | null
  service_line: string | null
  initial_notes: string | null
  source_detail: string | null
  utm_source: string | null
  utm_campaign: string | null
  created_at: string
  stage: { name: string; slug: string; color: string; stage_type: string } | null
}

type Reply = { lead_id: string; created_at: string; type: string; user: { full_name: string } | null }

type Tab = "attention" | "all" | "won"

/** How quickly someone replied — the number that matters for web enquiries. */
function responseTime(lead: WebsiteLead, firstReply?: Reply) {
  if (!firstReply) return null
  const ms = new Date(firstReply.created_at).getTime() - new Date(lead.created_at).getTime()
  return Math.max(0, ms)
}

function humanMs(ms: number) {
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export default function WebsiteLeadsPage() {
  const { setLeadDrawerId } = useUIStore()
  const { byKey } = useDataSets()
  const dataSet = byKey.get("website")
  const [tab, setTab] = useState<Tab>("attention")
  const [search, setSearch] = useState("")

  const leadsQuery = useQuery({
    queryKey: ["website-leads", dataSet?.id],
    enabled: Boolean(dataSet),
    queryFn: async (): Promise<WebsiteLead[]> => {
      const { data, error } = await createClient()
        .from("leads")
        .select("id, full_name, company_name, phone, email, city, service_line, initial_notes, source_detail, utm_source, utm_campaign, created_at, stage:stage_id(name, slug, color, stage_type)")
        .eq("data_set_id", dataSet!.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as unknown as WebsiteLead[]
    },
  })

  // First human reply per enquiry, to show the response time.
  const repliesQuery = useQuery({
    queryKey: ["website-lead-replies", dataSet?.id],
    enabled: Boolean(dataSet),
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("interactions")
        .select("lead_id, created_at, type, user:user_id(full_name), lead:lead_id!inner(data_set_id)")
        .eq("lead.data_set_id", dataSet!.id)
        .not("user_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(5000)
      if (error) throw error
      const first = new Map<string, Reply>()
      for (const r of (data ?? []) as unknown as Reply[]) {
        if (!first.has(r.lead_id)) first.set(r.lead_id, r)
      }
      return first
    },
  })

  const leads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data])
  const replies = useMemo(() => repliesQuery.data ?? new Map<string, Reply>(), [repliesQuery.data])

  const stats = useMemo(() => {
    const dayAgo = subDays(new Date(), 1)
    const weekAgo = subDays(new Date(), 7)
    const answered = leads.filter((l) => replies.has(l.id))
    const times = answered.map((l) => responseTime(l, replies.get(l.id))).filter((v): v is number => v != null)
    return {
      today: leads.filter((l) => isAfter(new Date(l.created_at), dayAgo)).length,
      week: leads.filter((l) => isAfter(new Date(l.created_at), weekAgo)).length,
      waiting: leads.filter((l) => !replies.has(l.id) && l.stage?.stage_type === "active").length,
      won: leads.filter((l) => l.stage?.slug === "won").length,
      median: times.length ? humanMs(times.sort((a, b) => a - b)[Math.floor(times.length / 2)]) : "—",
    }
  }, [leads, replies])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads
      .filter((l) => {
        if (tab === "attention") return !replies.has(l.id) && l.stage?.stage_type === "active"
        if (tab === "won") return l.stage?.slug === "won"
        return true
      })
      .filter((l) => !q || [l.full_name, l.company_name, l.phone, l.email, l.city, l.initial_notes, l.utm_campaign]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)))
  }, [leads, tab, search, replies])

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "attention", label: "Needs a reply", count: stats.waiting },
    { id: "all", label: "All enquiries", count: leads.length },
    { id: "won", label: "Won", count: stats.won },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 md:px-6 md:pb-8 md:pt-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold text-[#F0F0FA] md:text-2xl">
          <Globe className="size-5 text-[#06B6D4]" /> Website Leads
        </h1>
        <p className="mt-1 text-sm text-[#9090A8]">
          Enquiries people submit on hagerstone.com. They arrive here automatically — reply fast, the enquiry is only worth something while it is warm.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: "Last 24 hours", value: stats.today },
          { label: "Last 7 days", value: stats.week },
          { label: "Waiting for a reply", value: stats.waiting, warn: stats.waiting > 0 },
          { label: "Typical reply time", value: stats.median },
          { label: "Won", value: stats.won },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-3">
            <p className="truncate text-[10px] uppercase tracking-wider text-[#9090A8]">{s.label}</p>
            <p className={cn("mt-1 text-xl font-semibold", s.warn ? "text-[#F87171]" : "text-[#F0F0FA]")}>
              {leadsQuery.isLoading ? "…" : s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="thin-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition",
                tab === t.id ? "border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F0FA]" : "border-[#2A2A3C] text-[#9090A8] hover:text-[#F0F0FA]"
              )}
            >
              {t.label}
              <span className="text-xs text-[#5A5A72]">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5A5A72]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, phone or enquiry"
            className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] pl-9 pr-3 text-base text-[#F0F0FA] placeholder-[#5A5A72] outline-none focus:border-[#06B6D4] md:text-sm"
          />
        </div>
      </div>

      {leadsQuery.isLoading || !dataSet ? (
        <div className="flex items-center justify-center py-16 text-[#9090A8]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading enquiries…
        </div>
      ) : leadsQuery.error ? (
        <div className="rounded-xl border border-[#3F161A] bg-[#3F161A]/20 p-4 text-sm text-[#F87171]">
          Could not load website leads.
        </div>
      ) : leads.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] py-16 text-center text-sm text-[#9090A8]">
          {tab === "attention" ? "Every enquiry has been replied to." : "Nothing matches."}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((lead) => {
            const reply = replies.get(lead.id)
            const ms = responseTime(lead, reply)
            const waitingMs = Date.now() - new Date(lead.created_at).getTime()
            const digits = (lead.phone ?? "").replace(/\D/g, "").slice(-10)
            return (
              <li key={lead.id} className="rounded-xl border border-[#2A2A3C] bg-[#111118]">
                <button type="button" onClick={() => setLeadDrawerId(lead.id)} className="block w-full p-3 text-left hover:bg-[#15151D] md:p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-[#F0F0FA]">{lead.full_name}</span>
                    {lead.company_name ? <span className="truncate text-xs text-[#9090A8]">· {lead.company_name}</span> : null}
                    {lead.stage ? (
                      <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ color: lead.stage.color, backgroundColor: `${lead.stage.color}1F` }}>
                        {lead.stage.name}
                      </span>
                    ) : null}
                    <span className="ml-auto text-[10px] text-[#5A5A72]">
                      {format(new Date(lead.created_at), "d MMM, h:mm a")}
                    </span>
                  </div>

                  {lead.initial_notes ? (
                    <p className="mt-1.5 line-clamp-2 rounded-md bg-[#0F0F15] px-2 py-1.5 text-xs leading-relaxed text-[#C8C8DC]">
                      “{lead.initial_notes}”
                    </p>
                  ) : null}

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#9090A8]">
                    {lead.service_line ? <span>{lead.service_line.replace(/_/g, " ")}</span> : null}
                    {lead.city ? <span>{lead.city}</span> : null}
                    {lead.utm_campaign || lead.utm_source ? (
                      <span className="inline-flex items-center gap-1 text-[#06B6D4]">
                        <Zap className="size-3" />
                        {lead.utm_campaign ?? lead.utm_source}
                      </span>
                    ) : null}
                    <span className={cn("inline-flex items-center gap-1", ms == null && waitingMs > 2 * 3600_000 ? "text-[#F87171]" : "")}>
                      <Clock className="size-3" />
                      {ms != null
                        ? `Replied in ${humanMs(ms)}${reply?.user ? ` by ${reply.user.full_name}` : ""}`
                        : `Waiting ${formatDistanceToNowStrict(new Date(lead.created_at))}`}
                    </span>
                  </div>
                </button>

                <div className="flex flex-wrap gap-2 border-t border-[#1F1F2E] px-3 py-2 md:px-4">
                  {digits.length === 10 ? (
                    <>
                      <a href={`tel:${digits}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-3 text-xs text-[#F0F0FA]">
                        <Phone className="size-3.5" /> Call
                      </a>
                      <a href={`https://wa.me/91${digits}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-3 text-xs text-[#F0F0FA]">
                        <MessageCircle className="size-3.5 text-[#25D366]" /> WhatsApp
                      </a>
                    </>
                  ) : null}
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-3 text-xs text-[#F0F0FA]">
                      <Mail className="size-3.5" /> <span className="truncate">{lead.email}</span>
                    </a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** No enquiries yet — most likely the website form isn't wired up. */
function EmptyState() {
  const endpoint = `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhook/website-leads`
  return (
    <div className="rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] p-6">
      <Globe className="mx-auto size-8 text-[#3A3A52]" />
      <p className="mt-3 text-center text-sm font-medium text-[#F0F0FA]">No website enquiries yet</p>
      <p className="mx-auto mt-1 max-w-lg text-center text-xs text-[#9090A8]">
        Enquiries appear here the moment hagerstone.com posts them to the ERP. If the website team hasn&apos;t connected the form yet, give them this:
      </p>
      <div className="mx-auto mt-4 max-w-lg space-y-2 text-xs">
        <div className="rounded-lg bg-[#0F0F15] p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#5A5A72]">POST to</p>
          <p className="mt-0.5 break-all font-mono text-[#F0F0FA]">{endpoint}</p>
        </div>
        <div className="rounded-lg bg-[#0F0F15] p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#5A5A72]">Header</p>
          <p className="mt-0.5 font-mono text-[#F0F0FA]">x-webhook-secret: &lt;WEBHOOK_SECRET&gt;</p>
          <p className="mt-1 text-[#5A5A72]">Ask an admin for the secret — it is never shown here.</p>
        </div>
        <div className="rounded-lg bg-[#0F0F15] p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#5A5A72]">Body (JSON)</p>
          <pre className="thin-scrollbar mt-1 overflow-x-auto font-mono text-[11px] leading-relaxed text-[#C8C8DC]">{`{
  "full_name": "Client name",     // required
  "phone": "98xxxxxxxx",          // phone or email required
  "email": "client@company.com",
  "company_name": "Company",
  "city": "Gurugram",
  "service_line": "office_interiors",
  "message": "What they wrote",
  "utm_source": "google",
  "utm_campaign": "office-interiors"
}`}</pre>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-lg text-center text-xs text-[#5A5A72]">
        Duplicates are detected by phone and email, and managers get a WhatsApp alert for every new enquiry.
      </p>
    </div>
  )
}
