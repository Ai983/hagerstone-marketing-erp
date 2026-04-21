"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Loader2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/lib/stores/uiStore"
import type { Lead } from "@/lib/types"

async function fetchLead(id: string): Promise<Lead | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*, stage:stage_id(*), assignee:assigned_to(id, full_name, avatar_url, role)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data as Lead | null
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { leadDrawerId, setLeadDrawerId } = useUIStore()

  const leadId = params?.id

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead-detail-page", leadId],
    queryFn: () => fetchLead(leadId!),
    enabled: Boolean(leadId),
  })

  // Auto-open the drawer when navigating to this page
  useEffect(() => {
    if (leadId) {
      setLeadDrawerId(leadId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  // When drawer closes (user clicks X or backdrop), navigate back to /leads
  useEffect(() => {
    if (leadId && leadDrawerId === null) {
      router.push("/leads")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadDrawerId])

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/leads"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#9090A8] transition hover:text-[#F0F0FA]"
        >
          <ArrowLeft className="size-4" />
          Back to all leads
        </Link>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-[#9090A8]" />
          </div>
        ) : !lead ? (
          <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-6 text-center">
            <h1 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[#F0F0FA]">
              Lead not found
            </h1>
            <p className="mt-2 text-sm text-[#9090A8]">
              This lead may have been deleted or you don&apos;t have access.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
                  {lead.full_name}
                </h1>
                <p className="mt-1 text-sm text-[#9090A8]">
                  {lead.company_name || "No company"}
                  {lead.city && ` · ${lead.city}`}
                </p>
              </div>
              {lead.stage && (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: `${lead.stage.color}20`, color: lead.stage.color }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: lead.stage.color }}
                  />
                  {lead.stage.name}
                </span>
              )}
            </div>

            <p className="mt-6 text-xs text-[#9090A8]">
              Lead details and activity are shown in the drawer on the right.
              Close the drawer to return to the leads list.
            </p>

            <button
              type="button"
              onClick={() => setLeadDrawerId(lead.id)}
              className="mt-3 inline-flex items-center rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2 text-xs font-medium text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
            >
              Reopen drawer
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
