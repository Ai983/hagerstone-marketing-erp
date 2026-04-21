"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Megaphone, Plus } from "lucide-react"

const goals = [
  { value: "lead_nurture", label: "Lead Nurture" },
  { value: "site_visit_followup", label: "Site Visit Follow-up" },
  { value: "proposal_followup", label: "Proposal Follow-up" },
  { value: "reengagement", label: "Re-engagement" },
  { value: "custom", label: "Custom" },
] as const

const serviceLines = [
  { value: "all", label: "All service lines" },
  { value: "office_interiors", label: "Office Interiors" },
  { value: "mep", label: "MEP" },
  { value: "facade_glazing", label: "Facade & Glazing" },
  { value: "peb_construction", label: "PEB Construction" },
  { value: "civil_works", label: "Civil Works" },
  { value: "multiple", label: "Multiple" },
] as const

export default function NewCampaignPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [goal, setGoal] = useState<typeof goals[number]["value"]>("lead_nurture")
  const [serviceLine, setServiceLine] = useState<typeof serviceLines[number]["value"]>("all")
  const [status, setStatus] = useState<"draft" | "active">("draft")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          goal,
          service_line: serviceLine,
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create")
      toast.success("Campaign created")
      router.push(`/campaigns/${data.campaign.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/campaigns"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#9090A8] transition hover:text-[#F0F0FA]"
        >
          <ArrowLeft className="size-4" />
          Back to campaigns
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#1E3A5F] text-[#3B82F6]">
            <Megaphone className="size-5" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
              New Campaign
            </h1>
            <p className="text-sm text-[#9090A8]">
              Set up the basics — you can add messages and enroll leads next.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-[#2A2A3C] bg-[#111118] p-6"
        >
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
              Campaign Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q2 Office Interiors Nurture"
              required
              className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional internal note about this campaign…"
              rows={3}
              className="w-full resize-none rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
            />
          </div>

          {/* Goal + Service line */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                Goal
              </label>
              <select
                value={goal}
                onChange={(e) =>
                  setGoal(e.target.value as typeof goals[number]["value"])
                }
                className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              >
                {goals.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                Target Service Line
              </label>
              <select
                value={serviceLine}
                onChange={(e) =>
                  setServiceLine(
                    e.target.value as typeof serviceLines[number]["value"]
                  )
                }
                className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              >
                {serviceLines.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "active")}
              className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] md:w-48"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Link
              href="/campaigns"
              className="rounded-lg px-4 py-2 text-xs font-medium text-[#9090A8] transition hover:text-[#F0F0FA]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Plus className="size-3" />
              )}
              Create Campaign
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
