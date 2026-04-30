"use client"

import { useRouter } from "next/navigation"
import { format, formatDistanceToNow } from "date-fns"
import {
  BarChart2,
  Megaphone,
  MessageSquare,
  Send,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"

export interface CampaignCardData {
  id: string
  name: string
  description: string | null
  status: string
  created_at: string
  last_sent_at?: string | null
  message_count?: number
  enrollment_count?: number
}

const statusStyles: Record<string, string> = {
  draft: "bg-[#1A1A24] text-[#9090A8]",
  active: "bg-[#163322] text-[#34D399]",
  paused: "bg-[#3F2A12] text-[#F59E0B]",
  completed: "bg-[#1E3A5F] text-[#60A5FA]",
  archived: "bg-[#1A1A24] text-[#9090A8]",
}

interface CampaignCardProps {
  campaign: CampaignCardData
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const router = useRouter()
  const status = campaign.status || "draft"

  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5 transition hover:border-[#3B82F6]/50">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
          <Megaphone className="size-5" />
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
            statusStyles[status] ?? statusStyles.draft
          )}
        >
          {status}
        </span>
      </div>

      <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[#F0F0FA]">
        {campaign.name}
      </h3>
      <p className="mt-1 line-clamp-1 text-xs text-[#9090A8]">
        {campaign.description || "No description"}
      </p>

      <div className="mt-4 flex items-center gap-4 text-[11px] text-[#9090A8]">
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3" />
          {campaign.message_count ?? 0} message
          {campaign.message_count === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" />
          {campaign.enrollment_count ?? 0} enrolled
        </span>
        <span className="ml-auto">
          {format(new Date(campaign.created_at), "MMM d, yyyy")}
        </span>
      </div>

      {/* Action bar — explicit buttons instead of card-wide click */}
      <div className="mt-2">
        {campaign.last_sent_at ? (
          <div className="flex items-center gap-1 text-[11px] text-[#9090A8]">
            <Send size={10} color="#9090A8" />
            <span>
              Last sent{" "}
              {formatDistanceToNow(new Date(campaign.last_sent_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-[#3A3A52]">
            <Send size={10} color="#3A3A52" />
            <span>Never sent</span>
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid #2A2A3C",
          marginTop: 12,
          paddingTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => router.push(`/campaigns/${campaign.id}`)}
          className="text-xs text-[#9090A8] transition hover:text-white"
        >
          Edit Campaign
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/campaigns/${campaign.id}/report`)
          }}
          className="inline-flex items-center gap-1 rounded-md bg-[#3B82F6] px-3 py-1 text-xs text-white transition hover:bg-[#2563EB]"
        >
          <BarChart2 size={12} />
          View Report
        </button>
      </div>
    </div>
  )
}
