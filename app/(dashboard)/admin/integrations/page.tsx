"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowLeft,
  Copy,
  Loader2,
  Plug,
  MessageSquare,
  Bot,
  Webhook,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface IntegrationsStatus {
  webhook: { secret_set: boolean }
  whapi: { token_set: boolean; api_url_set: boolean }
  anthropic: { key_set: boolean }
  app_url: string | null
}

async function fetchStatus(): Promise<IntegrationsStatus> {
  const res = await fetch("/api/admin/integrations-status")
  if (!res.ok) throw new Error("Failed to load status")
  return res.json()
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
      <span
        className={cn(
          "size-2 rounded-full",
          active ? "bg-[#34D399]" : "bg-[#9090A8]"
        )}
      />
      <span className={active ? "text-[#34D399]" : "text-[#9090A8]"}>
        {label}
      </span>
    </span>
  )
}

function IntegrationCard({
  icon: Icon,
  accent,
  title,
  description,
  status,
  children,
}: {
  icon: typeof Plug
  accent: string
  title: string
  description: string
  status: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
      <div className="mb-3 flex items-start gap-3">
        <div
          className="flex size-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[#F0F0FA]">
              {title}
            </h3>
            {status}
          </div>
          <p className="mt-0.5 text-xs text-[#9090A8]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function IntegrationsPage() {
  const [copied, setCopied] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [testingWa, setTestingWa] = useState(false)
  const [testingClaude, setTestingClaude] = useState(false)

  const { data: status, isLoading } = useQuery({
    queryKey: ["admin-integrations-status"],
    queryFn: fetchStatus,
  })

  const webhookUrl = status?.app_url
    ? `${status.app_url.replace(/\/$/, "")}/api/webhook/website-leads`
    : typeof window !== "undefined"
      ? `${window.location.origin}/api/webhook/website-leads`
      : "/api/webhook/website-leads"

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    toast.success("Webhook URL copied")
    setTimeout(() => setCopied(false), 1500)
  }

  const handleTestWebhook = async () => {
    setTestingWebhook(true)
    try {
      const res = await fetch("/api/admin/test-webhook", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Test failed")
      toast.success(
        data.success
          ? `Webhook responded ${data.status}: ${data.response?.status ?? "ok"}`
          : `Webhook returned ${data.status}`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTestingWebhook(false)
    }
  }

  const handleTestWhatsApp = async () => {
    setTestingWa(true)
    try {
      const res = await fetch("/api/admin/test-whatsapp", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Test failed")
      toast.success(`Test message sent to ${data.sent_to}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTestingWa(false)
    }
  }

  const handleTestClaude = async () => {
    setTestingClaude(true)
    try {
      const res = await fetch("/api/admin/test-anthropic", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Test failed")
      toast.success(`Claude responded: "${data.response}" (${data.model})`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTestingClaude(false)
    }
  }

  const webhookActive = Boolean(status?.webhook.secret_set)
  const whapiActive = Boolean(
    status?.whapi.token_set && status?.whapi.api_url_set
  )
  const claudeActive = Boolean(status?.anthropic.key_set)

  if (isLoading) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/admin"
            className="flex size-8 items-center justify-center rounded-lg border border-[#2A2A3C] text-[#9090A8] transition hover:text-[#F0F0FA]"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
              Integrations
            </h1>
            <p className="text-sm text-[#9090A8]">
              Status and connectivity for external services.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Webhook */}
          <IntegrationCard
            icon={Webhook}
            accent="#3B82F6"
            title="Supabase Webhook"
            description="Receives website contact form submissions."
            status={<StatusDot active={webhookActive} label={webhookActive ? "Active" : "Inactive"} />}
          >
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                  Webhook URL
                </label>
                <div className="flex gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-[#2A2A3C] bg-[#0F0F15] px-3 py-2 text-xs text-[#F0F0FA]">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2 text-xs text-[#F0F0FA] transition hover:bg-[#1F1F2E]"
                  >
                    {copied ? <Check className="size-3 text-[#34D399]" /> : <Copy className="size-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <button
                onClick={handleTestWebhook}
                disabled={testingWebhook || !webhookActive}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2563EB] disabled:opacity-50"
              >
                {testingWebhook && <Loader2 className="size-3 animate-spin" />}
                Test Connection
              </button>
              {!webhookActive && (
                <p className="text-[11px] text-[#F59E0B]">
                  Set <code className="rounded bg-[#1A1A24] px-1">WEBHOOK_SECRET</code> in your environment.
                </p>
              )}
            </div>
          </IntegrationCard>

          {/* Whapi */}
          <IntegrationCard
            icon={MessageSquare}
            accent="#34D399"
            title="Whapi WhatsApp"
            description="WhatsApp messaging via Whapi.Cloud."
            status={<StatusDot active={whapiActive} label={whapiActive ? "Connected" : "Not configured"} />}
          >
            <button
              onClick={handleTestWhatsApp}
              disabled={testingWa || !whapiActive}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#1da851] disabled:opacity-50"
            >
              {testingWa && <Loader2 className="size-3 animate-spin" />}
              Send Test Message
            </button>
            {!whapiActive && (
              <p className="mt-2 text-[11px] text-[#F59E0B]">
                Set <code className="rounded bg-[#1A1A24] px-1">WHAPI_TOKEN</code> and{" "}
                <code className="rounded bg-[#1A1A24] px-1">WHAPI_API_URL</code>.
              </p>
            )}
          </IntegrationCard>

          {/* Anthropic */}
          <IntegrationCard
            icon={Bot}
            accent="#F59E0B"
            title="Anthropic AI"
            description="Powers lead recaps, drafts, and the AI agent."
            status={<StatusDot active={claudeActive} label={claudeActive ? "Connected" : "Not configured"} />}
          >
            <button
              onClick={handleTestClaude}
              disabled={testingClaude || !claudeActive}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F59E0B] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#D97706] disabled:opacity-50"
            >
              {testingClaude && <Loader2 className="size-3 animate-spin" />}
              Test API
            </button>
            {!claudeActive && (
              <p className="mt-2 text-[11px] text-[#F59E0B]">
                Set <code className="rounded bg-[#1A1A24] px-1">ANTHROPIC_API_KEY</code> in your environment.
              </p>
            )}
          </IntegrationCard>
        </div>
      </div>
    </main>
  )
}
