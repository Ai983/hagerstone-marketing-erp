"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Megaphone, Plus } from "lucide-react"

import { CampaignCard, type CampaignCardData } from "@/components/campaigns/CampaignCard"

function CampaignCardSkeleton() {
  return (
    <div className="h-[180px] animate-pulse rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/5 rounded bg-[#1A1A24]" />
          <div className="h-3 w-2/5 rounded bg-[#1A1A24]" />
        </div>
        <div className="h-5 w-14 rounded-full bg-[#1A1A24]" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="h-10 rounded bg-[#1A1A24]" />
        <div className="h-10 rounded bg-[#1A1A24]" />
        <div className="h-10 rounded bg-[#1A1A24]" />
      </div>
      <div className="mt-5 h-3 w-1/3 rounded bg-[#1A1A24]" />
    </div>
  )
}

interface CampaignsResponse {
  campaigns: CampaignCardData[]
}

async function fetchCampaigns(): Promise<CampaignCardData[]> {
  const res = await fetch("/api/campaigns")
  if (!res.ok) throw new Error("Failed to load campaigns")
  const data: CampaignsResponse = await res.json()
  return data.campaigns
}

export default function CampaignsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["campaigns-list"],
    queryFn: fetchCampaigns,
  })

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] pb-20 md:p-6 md:pb-0">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:mb-6 md:px-0 md:py-0">
          <div className="flex items-center gap-3">
            <div className="hidden size-10 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6] md:flex">
              <Megaphone className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#F0F0FA] md:font-[family-name:var(--font-heading)] md:text-2xl md:font-semibold">
                Campaigns
              </h1>
              <p className="mt-1 text-xs text-[#9090A8] md:mt-0 md:text-sm">
                Build WhatsApp message sequences and enroll leads.
              </p>
            </div>
          </div>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#2563EB] md:text-xs"
          >
            <Plus className="size-3" />
            <span className="hidden md:inline">New Campaign</span>
            <span className="md:hidden">New</span>
          </Link>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 px-4 md:grid-cols-2 md:gap-4 md:px-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="mx-4 rounded-xl border border-[#7F1D1D]/50 bg-[#2A1215]/40 p-4 text-sm text-[#F87171] md:mx-0">
            Failed to load campaigns
          </div>
        ) : !data || data.length === 0 ? (
          <div className="mx-4 flex flex-col items-center justify-center rounded-xl border border-[#2A2A3C] bg-[#111118] px-4 py-20 text-center md:mx-0">
            <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-[#1E3A5F] text-[#3B82F6]">
              <Megaphone className="size-7" />
            </div>
            <p className="text-sm font-medium text-[#F0F0FA]">No campaigns yet</p>
            <p className="mt-1 text-xs text-[#9090A8]">
              Create a sequence of WhatsApp messages to nurture your leads.
            </p>
            <Link
              href="/campaigns/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB]"
            >
              <Plus className="size-3" />
              Create your first campaign
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 px-4 md:grid-cols-2 md:gap-4 md:px-0">
            {data.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
