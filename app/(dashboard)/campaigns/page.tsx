"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Megaphone, Plus } from "lucide-react"

import { CampaignCard, type CampaignCardData } from "@/components/campaigns/CampaignCard"

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
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
              <Megaphone className="size-5" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
                Campaigns
              </h1>
              <p className="text-sm text-[#9090A8]">
                Build WhatsApp message sequences and enroll leads.
              </p>
            </div>
          </div>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB]"
          >
            <Plus className="size-3" />
            New Campaign
          </Link>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[#9090A8]" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-[#7F1D1D]/50 bg-[#2A1215]/40 p-4 text-sm text-[#F87171]">
            Failed to load campaigns
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[#2A2A3C] bg-[#111118] py-20 text-center">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
