"use client"

import Link from "next/link"
import { format } from "date-fns"
import { Megaphone, Users, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CampaignCardData {
  id: string
  name: string
  description: string | null
  status: string
  created_at: string
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
  const status = campaign.status || "draft"
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="group block rounded-xl border border-[#2A2A3C] bg-[#111118] p-5 transition hover:border-[#3B82F6] hover:bg-[#1A1A24]"
    >
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

      <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[#F0F0FA] transition group-hover:text-[#3B82F6]">
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
        <span className="ml-auto">{format(new Date(campaign.created_at), "MMM d, yyyy")}</span>
      </div>
    </Link>
  )
}
