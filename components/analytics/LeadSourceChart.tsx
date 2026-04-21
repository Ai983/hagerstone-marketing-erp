"use client"

import { useQuery } from "@tanstack/react-query"
import { format, subDays, startOfDay, addDays } from "date-fns"
import { Loader2 } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import type { LeadSource } from "@/lib/types"

const sourceColors: Record<LeadSource, string> = {
  website: "#3B82F6",
  manual_sales: "#9090A8",
  referral: "#C084FC",
  google_ads: "#FB923C",
  whatsapp_inbound: "#34D399",
  linkedin: "#60A5FA",
  justdial: "#FBBF24",
  ai_suggested: "#F472B6",
  other: "#6B7280",
}

const sourceLabels: Record<LeadSource, string> = {
  website: "Website",
  manual_sales: "Manual",
  referral: "Referral",
  google_ads: "Google Ads",
  whatsapp_inbound: "WhatsApp",
  linkedin: "LinkedIn",
  justdial: "JustDial",
  ai_suggested: "AI Suggested",
  other: "Other",
}

interface LeadRow {
  created_at: string
  source: LeadSource
}

async function fetchLeadsLast30Days(): Promise<LeadRow[]> {
  const supabase = createClient()
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

  const { data, error } = await supabase
    .from("leads")
    .select("created_at, source")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as LeadRow[]
}

interface DayBucket {
  date: string
  label: string
  [key: string]: string | number
}

function buildDailyBuckets(leads: LeadRow[]): { data: DayBucket[]; sources: LeadSource[] } {
  const today = startOfDay(new Date())
  const start = subDays(today, 29)
  const dayMap = new Map<string, DayBucket>()

  for (let i = 0; i < 30; i++) {
    const date = addDays(start, i)
    const key = format(date, "yyyy-MM-dd")
    dayMap.set(key, { date: key, label: format(date, "MMM d") })
  }

  const sourcesPresent = new Set<LeadSource>()

  for (const lead of leads) {
    const key = format(new Date(lead.created_at), "yyyy-MM-dd")
    const bucket = dayMap.get(key)
    if (!bucket) continue
    sourcesPresent.add(lead.source)
    bucket[lead.source] = ((bucket[lead.source] as number) ?? 0) + 1
  }

  // Fill missing values with 0
  const sources = Array.from(sourcesPresent)
  const buckets = Array.from(dayMap.values())
  for (const bucket of buckets) {
    for (const src of sources) {
      if (bucket[src] === undefined) bucket[src] = 0
    }
  }

  return { data: buckets, sources }
}

export function LeadSourceChart() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-source-volume"],
    queryFn: fetchLeadsLast30Days,
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-[#7F1D1D]/50 bg-[#2A1215]/40 p-4 text-sm text-[#F87171]">
        Failed to load source data
      </div>
    )
  }

  const { data: chartData, sources } = buildDailyBuckets(data)

  if (sources.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#9090A8]">
        No leads in the last 30 days
      </div>
    )
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3C" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#9090A8"
            style={{ fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#2A2A3C" }}
            interval={4}
          />
          <YAxis
            stroke="#9090A8"
            style={{ fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#2A2A3C" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111118",
              border: "1px solid #2A2A3C",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#F0F0FA" }}
            formatter={(value, name) => [value as number, sourceLabels[name as LeadSource] ?? String(name)]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => (
              <span style={{ color: "#9090A8" }}>{sourceLabels[value as LeadSource] ?? value}</span>
            )}
          />
          {sources.map((src) => (
            <Bar
              key={src}
              dataKey={src}
              stackId="leads"
              fill={sourceColors[src]}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
