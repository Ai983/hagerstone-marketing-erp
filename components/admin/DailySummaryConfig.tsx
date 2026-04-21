"use client"

import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  Bell,
  Check,
  Loader2,
  Save,
  Send,
  Sparkles,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface DailySummaryConfig {
  enabled: boolean
  send_time: string // "HH:MM"
  phone_number: string | null
}

interface LastSent {
  sent_at: string
  phone_number: string | null
  dry_run: boolean
}

async function fetchSettings(): Promise<{
  config: DailySummaryConfig
  lastSent: LastSent | null
}> {
  const supabase = createClient()
  const { data } = await supabase
    .from("admin_settings")
    .select("key, value")
    .in("key", ["daily_summary_config", "daily_summary_last_sent"])

  const rows = (data ?? []) as Array<{ key: string; value: unknown }>

  const configRow = rows.find((r) => r.key === "daily_summary_config")
  const lastSentRow = rows.find((r) => r.key === "daily_summary_last_sent")

  const config: DailySummaryConfig = {
    enabled: (configRow?.value as DailySummaryConfig | undefined)?.enabled ?? true,
    send_time: (configRow?.value as DailySummaryConfig | undefined)?.send_time ?? "08:00",
    phone_number: (configRow?.value as DailySummaryConfig | undefined)?.phone_number ?? null,
  }

  const lastSent = (lastSentRow?.value as LastSent | undefined) ?? null

  return { config, lastSent }
}

export function DailySummaryConfigCard() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DailySummaryConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["admin-daily-summary-settings"],
    queryFn: fetchSettings,
  })

  useEffect(() => {
    if (data?.config) {
      setForm(data.config)
      setDirty(false)
    }
  }, [data?.config])

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.from("admin_settings").upsert({
        key: "daily_summary_config",
        value: form,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success("Daily summary settings saved")
      queryClient.invalidateQueries({ queryKey: ["admin-daily-summary-settings"] })
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    if (!form) return
    setTesting(true)
    setPreview(null)
    try {
      const res = await fetch("/api/ai/daily-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: form.phone_number || undefined,
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to send")
      }
      setPreview(result.message_preview)
      toast.success(`Test summary sent to ${result.sent_to ?? "configured number"}`)
      queryClient.invalidateQueries({ queryKey: ["admin-daily-summary-settings"] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test")
    } finally {
      setTesting(false)
    }
  }

  const update = <K extends keyof DailySummaryConfig>(key: K, value: DailySummaryConfig[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setDirty(true)
  }

  if (isLoading || !form) {
    return (
      <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-[#9090A8]" />
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="size-4 text-[#F59E0B]" />
        <h2 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[#F0F0FA]">
          Daily WhatsApp Briefing
        </h2>
      </div>
      <p className="mb-4 text-xs text-[#9090A8]">
        Sends a Claude-generated morning briefing to the sales manager with overdue tasks,
        stale hot leads, negotiations, and quick stats. Scheduled via Vercel Cron
        (Mon–Sat, 8:00 AM UTC / 1:30 PM IST).
      </p>

      <div className="grid gap-4">
        {/* Enable toggle */}
        <div className="flex items-center justify-between rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-[#F0F0FA]">Enabled</p>
            <p className="text-[11px] text-[#9090A8]">
              The cron job will skip sending when disabled.
            </p>
          </div>
          <button
            type="button"
            onClick={() => update("enabled", !form.enabled)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
              form.enabled ? "bg-[#3B82F6]" : "bg-[#2A2A3C]"
            )}
            aria-pressed={form.enabled}
          >
            <span
              className={cn(
                "inline-block size-4 transform rounded-full bg-white transition",
                form.enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {/* Send time */}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
            Send Time (IST)
          </label>
          <input
            type="time"
            value={form.send_time}
            onChange={(e) => update("send_time", e.target.value)}
            className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] md:w-48"
          />
          <p className="mt-1 text-[11px] text-[#9090A8]">
            Display only — cron schedule is set in <code className="rounded bg-[#1A1A24] px-1">vercel.json</code>.
          </p>
        </div>

        {/* Phone number */}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
            Manager&apos;s WhatsApp Number
          </label>
          <input
            type="tel"
            value={form.phone_number ?? ""}
            onChange={(e) => update("phone_number", e.target.value)}
            placeholder="+91 98765 43210 (leave blank to use MANAGER_WHATSAPP_NUMBER env var)"
            className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 py-2 text-sm text-[#F0F0FA] placeholder-[#9090A8] outline-none focus:border-[#3B82F6]"
          />
        </div>

        {/* Last sent */}
        <div className="rounded-lg border border-[#2A2A3C] bg-[#0F0F15] px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
            Last Sent
          </p>
          {data?.lastSent ? (
            <p className="mt-0.5 text-xs text-[#F0F0FA]">
              {formatDistanceToNow(new Date(data.lastSent.sent_at), { addSuffix: true })}
              {data.lastSent.phone_number && (
                <span className="text-[#9090A8]"> · to {data.lastSent.phone_number}</span>
              )}
              {data.lastSent.dry_run && (
                <span className="ml-1 rounded bg-[#1A1A24] px-1 text-[10px] text-[#9090A8]">
                  dry run
                </span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[#9090A8]">Never sent</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            Save Settings
          </button>
          <button
            onClick={handleSendTest}
            disabled={testing || saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#F59E0B]/40 bg-[#3F2A12]/40 px-3 py-2 text-xs font-medium text-[#F59E0B] transition hover:bg-[#3F2A12] disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Send className="size-3" />
            )}
            Send Test Summary Now
          </button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="rounded-lg border border-[#34D399]/30 bg-[#163322]/40 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Check className="size-3 text-[#34D399]" />
              <Sparkles className="size-3 text-[#F59E0B]" />
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#34D399]">
                Message Preview
              </p>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg bg-[#0A0A0F] p-3 text-xs leading-relaxed text-[#F0F0FA]">
              {preview}
            </pre>
          </div>
        )}
      </div>
    </section>
  )
}
