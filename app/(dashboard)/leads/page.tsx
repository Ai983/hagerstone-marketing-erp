import { Suspense } from "react"

import { LeadsPageContent } from "@/components/leads/LeadsPageContent"

function LeadsPageFallback() {
  return (
    <main className="px-6 py-8 sm:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-[#F0F0FA]">
            All Leads
          </h1>
          <p className="mt-2 text-sm text-[#9090A8]">Loading lead database...</p>
        </div>
        <div className="h-10 w-28 animate-pulse rounded-lg bg-[#1A1A24]" />
      </div>
      <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-6">
        <div className="h-64 animate-pulse rounded-lg bg-[#1A1A24]" />
      </div>
    </main>
  )
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<LeadsPageFallback />}>
      <LeadsPageContent />
    </Suspense>
  )
}
