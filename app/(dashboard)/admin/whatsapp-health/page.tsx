"use client"

import { useEffect, useState } from "react"
import type { ElementType } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Shield,
  Smartphone,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

type WarningLevel = "critical" | "warning" | "info"

interface HealthData {
  phone_id: string
  phone_number: string
  status: string
  is_connected: boolean
  health_score: number
  warnings: { level: WarningLevel; message: string }[]
  stats: {
    total_logs: number
    messages: number
    acks: number
    errors: number
    logouts: number
    qr_screens: number
    dupes: number
    no_lid: number
  }
  tips: string[]
  checked_at: string
}

function formatRelativeTime(date: Date) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (diffSeconds < 60) return "less than a minute ago"

  const units: { label: string; seconds: number }[] = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
  ]

  const unit = units.find((item) => diffSeconds >= item.seconds) ?? units[4]
  const value = Math.floor(diffSeconds / unit.seconds)
  return `${value} ${unit.label}${value === 1 ? "" : "s"} ago`
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444"
  const label = score >= 80 ? "Healthy" : score >= 50 ? "At Risk" : "Critical"
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center"
        style={{ width: 140, height: 140 }}
      >
        <svg width="140" height="140" className="-rotate-90">
          <circle
            cx="70"
            cy="70"
            r="54"
            fill="none"
            stroke="#2A2A3C"
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span
            className="text-3xl font-bold"
            style={{ color, fontFamily: "var(--font-heading)" }}
          >
            {score}
          </span>
          <span className="text-[11px] text-[#9090A8]">/ 100</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>
        {label}
      </span>
    </div>
  )
}

function WarningCard({
  level,
  message,
}: {
  level: WarningLevel
  message: string
}) {
  const config = {
    critical: {
      icon: XCircle,
      color: "#EF4444",
      bg: "#EF444415",
      border: "#EF444430",
      label: "Critical",
    },
    warning: {
      icon: AlertTriangle,
      color: "#F59E0B",
      bg: "#F59E0B15",
      border: "#F59E0B30",
      label: "Warning",
    },
    info: {
      icon: CheckCircle,
      color: "#10B981",
      bg: "#10B98115",
      border: "#10B98130",
      label: "Good",
    },
  }
  const { icon: Icon, color, bg, border, label } = config[level]

  return (
    <div
      className="flex items-start gap-3 rounded-lg p-3"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <Icon size={16} style={{ color, marginTop: 1, flexShrink: 0 }} />
      <div>
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color }}
        >
          {label}
        </span>
        <p className="mt-0.5 text-sm text-[#F0F0FA]">{message}</p>
      </div>
    </div>
  )
}

function StatBox({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: ElementType
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-[#2A2A3C] bg-[#111118] p-4">
      <Icon size={18} style={{ color }} />
      <span className="text-2xl font-bold text-[#F0F0FA]">{value}</span>
      <span className="text-center text-[11px] text-[#5A5A72]">{label}</span>
    </div>
  )
}

export default function WhatsAppHealthPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchHealth(showToast = false) {
    try {
      setRefreshing(true)
      const res = await fetch("/api/whatsapp/health")
      if (!res.ok) throw new Error("Failed to fetch health data")
      const json = await res.json()
      setData(json)
      if (showToast) toast.success("Health data refreshed")
    } catch {
      toast.error("Failed to load WhatsApp health data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(() => fetchHealth(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 bg-[#0A0A0F]">
        <WifiOff size={32} className="text-[#EF4444]" />
        <p className="text-[#9090A8]">Failed to load health data</p>
        <button
          onClick={() => fetchHealth(true)}
          className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm text-white hover:bg-[#2563EB]"
        >
          Retry
        </button>
      </main>
    )
  }

  const criticalCount = data.warnings.filter((w) => w.level === "critical").length
  const warningCount = data.warnings.filter((w) => w.level === "warning").length

  return (
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
              WhatsApp Health Monitor
            </h1>
            <p className="mt-1 text-sm text-[#9090A8]">
              Real-time status of your Maytapi WhatsApp account
            </p>
          </div>
          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#111118] px-4 py-2 text-sm text-[#9090A8] transition hover:border-[#3B82F6] hover:text-[#F0F0FA] disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div
          className="mb-6 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center"
          style={{
            background: data.is_connected ? "#10B98115" : "#EF444415",
            border: `1px solid ${data.is_connected ? "#10B98130" : "#EF444430"}`,
          }}
        >
          {data.is_connected ? (
            <Wifi size={20} className="text-[#10B981]" />
          ) : (
            <WifiOff size={20} className="text-[#EF4444]" />
          )}
          <div className="flex-1">
            <p
              className="text-sm font-semibold"
              style={{ color: data.is_connected ? "#10B981" : "#EF4444" }}
            >
              {data.is_connected ? "Phone Connected" : "Phone Disconnected"}
            </p>
            <p className="text-xs text-[#9090A8]">
              +{data.phone_number} · Phone ID: {data.phone_id} · Status:{" "}
              {data.status}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Smartphone size={14} className="text-[#5A5A72]" />
            <span className="text-xs text-[#5A5A72]">
              Checked {formatRelativeTime(new Date(data.checked_at))}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="flex flex-col items-center justify-center rounded-xl border border-[#2A2A3C] bg-[#111118] p-6">
            <ScoreRing score={data.health_score} />
            <p className="mt-3 text-center text-xs text-[#5A5A72]">
              Based on recent log analysis
            </p>
          </div>

          <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Shield size={16} className="text-[#9090A8]" />
              <h2 className="text-sm font-semibold text-[#F0F0FA]">
                Account Warnings
              </h2>
              {criticalCount > 0 && (
                <span className="rounded-full bg-[#EF444420] px-2 py-0.5 text-[11px] font-semibold text-[#EF4444]">
                  {criticalCount} Critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="rounded-full bg-[#F59E0B20] px-2 py-0.5 text-[11px] font-semibold text-[#F59E0B]">
                  {warningCount} Warning
                </span>
              )}
            </div>
            <div className="space-y-2">
              {data.warnings.map((w, i) => (
                <WarningCard key={i} level={w.level} message={w.message} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity size={16} className="text-[#9090A8]" />
            <h2 className="text-sm font-semibold text-[#F0F0FA]">
              Log Statistics (Last 100 Events)
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <StatBox
              label="Total Logs"
              value={data.stats.total_logs}
              icon={Activity}
              color="#3B82F6"
            />
            <StatBox
              label="Messages"
              value={data.stats.messages}
              icon={MessageSquare}
              color="#8B5CF6"
            />
            <StatBox
              label="Delivered"
              value={data.stats.acks}
              icon={CheckCircle}
              color="#10B981"
            />
            <StatBox
              label="Errors"
              value={data.stats.errors}
              icon={XCircle}
              color="#EF4444"
            />
            <StatBox
              label="Logouts"
              value={data.stats.logouts}
              icon={WifiOff}
              color="#EF4444"
            />
            <StatBox
              label="QR Screens"
              value={data.stats.qr_screens}
              icon={Smartphone}
              color="#F59E0B"
            />
            <StatBox
              label="Dupes"
              value={data.stats.dupes}
              icon={Zap}
              color="#F59E0B"
            />
            <StatBox
              label="No LID"
              value={data.stats.no_lid}
              icon={AlertTriangle}
              color="#F59E0B"
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-[#2A2A3C] bg-[#111118] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Info size={16} className="text-[#3B82F6]" />
            <h2 className="text-sm font-semibold text-[#F0F0FA]">Safety Tips</h2>
          </div>
          <ul className="space-y-2">
            {data.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#9090A8]">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
