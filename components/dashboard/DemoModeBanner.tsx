"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, ArrowRight, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

const DISMISSED_KEY = "hagerstone_demo_banner_dismissed"

async function fetchSampleLeadCount(): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("is_sample_data", true)

  if (error) return 0
  return count ?? 0
}

export function DemoModeBanner() {
  const [dismissed, setDismissed] = useState(true)

  // Restore dismissal from sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = sessionStorage.getItem(DISMISSED_KEY)
    setDismissed(stored === "1")
  }, [])

  const { data: count } = useQuery({
    queryKey: ["demo-sample-count"],
    queryFn: fetchSampleLeadCount,
    refetchInterval: 60_000,
  })

  if (dismissed || !count || count === 0) return null

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISSED_KEY, "1")
    }
    setDismissed(true)
  }

  return (
    <div className="flex items-center gap-3 border-b border-[#F59E0B]/30 bg-[#3F2A12]/60 px-4 py-2">
      <AlertCircle className="size-4 shrink-0 text-[#F59E0B]" />
      <p className="flex-1 text-xs text-[#F0F0FA]">
        <span className="font-semibold text-[#F59E0B]">Demo Mode</span>
        <span className="mx-1.5 text-[#9090A8]">·</span>
        Sample data loaded ({count} lead{count === 1 ? "" : "s"}). Clear it in Admin when ready for production.
      </p>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 rounded-md border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2.5 py-1 text-[11px] font-medium text-[#F59E0B] transition hover:bg-[#F59E0B]/20"
      >
        Go to Admin
        <ArrowRight className="size-3" />
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#9090A8] transition hover:bg-[#1A1A24] hover:text-[#F0F0FA]"
        aria-label="Dismiss demo banner"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
