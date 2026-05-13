"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Bot, Plus, Loader2, Power, PowerOff,
  Trash2, Edit, MessageSquare, Zap, ChevronRight, CheckCircle2, AlertTriangle, XCircle
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface ChatbotFlow {
  id: string
  name: string
  description: string | null
  status: "active" | "inactive"
  trigger_type: string
  trigger_keywords: string[]
  trigger_match: string
  priority: number
  created_at: string
  nodes: { count: number }[]
  health?: "healthy" | "warning" | "error"
  health_issues?: { message: string }[]
}

const triggerLabels: Record<string, string> = {
  keyword: "Keyword Match",
  first_message: "First Message",
  any_message: "Any Message",
  button_reply: "Button Reply",
}

const healthConfig = {
  healthy: { label: "Healthy", icon: CheckCircle2, color: "#10B981", bg: "#10B98120" },
  warning: { label: "Warning", icon: AlertTriangle, color: "#F59E0B", bg: "#F59E0B20" },
  error: { label: "Error", icon: XCircle, color: "#EF4444", bg: "#EF444420" },
}

export default function ChatbotListPage() {
  const [flows, setFlows] = useState<ChatbotFlow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newFlow, setNewFlow] = useState({
    name: "",
    description: "",
    trigger_type: "keyword",
    trigger_keywords: "",
    trigger_match: "contains",
    priority: 0,
  })

  async function fetchFlows() {
    try {
      const res = await fetch("/api/chatbot/flows")
      const data = await res.json()
      setFlows(data.flows ?? [])
    } catch {
      toast.error("Failed to load chatbots")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFlows() }, [])

  async function toggleStatus(flow: ChatbotFlow) {
    const newStatus = flow.status === "active" ? "inactive" : "active"
    const res = await fetch(`/api/chatbot/flows/${flow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setFlows(flows.map(f => f.id === flow.id ? { ...f, status: newStatus } : f))
      toast.success(`Chatbot ${newStatus === "active" ? "activated" : "deactivated"}`)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Failed to update chatbot")
    }
  }

  async function deleteFlow(id: string) {
    if (!confirm("Delete this chatbot? This cannot be undone.")) return
    const res = await fetch(`/api/chatbot/flows/${id}`, { method: "DELETE" })
    if (res.ok) {
      setFlows(flows.filter(f => f.id !== id))
      toast.success("Chatbot deleted")
    }
  }

  async function createFlow() {
    if (!newFlow.name.trim()) { toast.error("Name is required"); return }
    setCreating(true)
    try {
      const keywords = newFlow.trigger_keywords
        .split(",")
        .map(k => k.trim())
        .filter(Boolean)

      const res = await fetch("/api/chatbot/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newFlow,
          trigger_keywords: keywords,
        }),
      })
      const data = await res.json()
      if (data.flow) {
        toast.success("Chatbot created!")
        setShowCreate(false)
        setNewFlow({ name: "", description: "", trigger_type: "keyword", trigger_keywords: "", trigger_match: "contains", priority: 0 })
        fetchFlows()
      }
    } catch {
      toast.error("Failed to create chatbot")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <main className="flex h-full items-center justify-center bg-[#0A0A0F]">
        <Loader2 className="size-6 animate-spin text-[#9090A8]" />
      </main>
    )
  }

  return (
    <main className="thin-scrollbar h-full overflow-x-hidden overflow-y-auto bg-[#0A0A0F] px-4 py-6 md:p-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="flex min-w-0 items-center gap-2 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F0F0FA]">
              <Bot size={24} className="shrink-0 text-[#3B82F6]" />
              <span className="break-words">WhatsApp Chatbot Builder</span>
            </h1>
            <p className="mt-1 text-sm text-[#9090A8]">
              Automate WhatsApp replies based on keywords and flows
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB]"
          >
            <Plus size={16} /> New Chatbot
          </button>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-[#2A2A3C] bg-[#111118] p-6 shadow-2xl">
              <h2 className="mb-4 text-lg font-semibold text-[#F0F0FA]">Create New Chatbot</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Name *</label>
                  <input
                    value={newFlow.name}
                    onChange={e => setNewFlow({ ...newFlow, name: e.target.value })}
                    placeholder="e.g. Interested Lead Flow"
                    className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Description</label>
                  <input
                    value={newFlow.description}
                    onChange={e => setNewFlow({ ...newFlow, description: e.target.value })}
                    placeholder="What does this chatbot do?"
                    className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Trigger Type</label>
                  <select
                    value={newFlow.trigger_type}
                    onChange={e => setNewFlow({ ...newFlow, trigger_type: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                  >
                    <option value="keyword">Keyword Match</option>
                    <option value="first_message">First Message from Lead</option>
                    <option value="any_message">Any Incoming Message</option>
                  </select>
                </div>
                {newFlow.trigger_type === "keyword" && (
                  <>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                        Keywords (comma separated)
                      </label>
                      <input
                        value={newFlow.trigger_keywords}
                        onChange={e => setNewFlow({ ...newFlow, trigger_keywords: e.target.value })}
                        placeholder="interested, yes, haan, tell me more"
                        className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Match Type</label>
                      <select
                        value={newFlow.trigger_match}
                        onChange={e => setNewFlow({ ...newFlow, trigger_match: e.target.value })}
                        className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                      >
                        <option value="contains">Contains keyword</option>
                        <option value="exact">Exact match</option>
                        <option value="starts_with">Starts with keyword</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Priority (higher = checked first)</label>
                  <input
                    type="number"
                    value={newFlow.priority}
                    onChange={e => setNewFlow({ ...newFlow, priority: parseInt(e.target.value) || 0 })}
                    className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowCreate(false)} className="rounded-lg border border-[#2A2A3C] px-4 py-2 text-sm text-[#9090A8] hover:text-[#F0F0FA]">
                  Cancel
                </button>
                <button
                  onClick={createFlow}
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB] disabled:opacity-50"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Create Chatbot
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {flows.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2A2A3C] bg-[#111118] py-16">
            <Bot size={40} className="mb-3 text-[#3A3A52]" />
            <p className="text-sm font-medium text-[#9090A8]">No chatbots yet</p>
            <p className="mt-1 text-xs text-[#5A5A72]">Create your first chatbot to automate WhatsApp replies</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB]"
            >
              <Plus size={14} /> Create First Chatbot
            </button>
          </div>
        )}

        {/* Flows list */}
        <div className="space-y-3">
          {flows.map((flow) => {
            const nodeCount = flow.nodes?.[0]?.count ?? 0
            const health = healthConfig[flow.health ?? "warning"]
            const HealthIcon = health.icon
            return (
              <div
                key={flow.id}
                className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-5 transition hover:border-[#3A3A52]"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: flow.status === "active" ? "#10B98120" : "#2A2A3C",
                      }}
                    >
                      <Bot size={18} style={{ color: flow.status === "active" ? "#10B981" : "#5A5A72" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 truncate text-sm font-semibold text-[#F0F0FA] md:overflow-visible md:text-clip md:whitespace-normal">{flow.name}</h3>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                          style={{
                            background: flow.status === "active" ? "#10B98120" : "#2A2A3C",
                            color: flow.status === "active" ? "#10B981" : "#5A5A72",
                          }}
                        >
                          {flow.status}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: health.bg, color: health.color }}
                          title={flow.health_issues?.map(issue => issue.message).join("\n")}
                        >
                          <HealthIcon size={10} />
                          {health.label}
                        </span>
                      </div>
                      {flow.description && (
                        <p className="mt-0.5 break-words text-xs text-[#5A5A72]">{flow.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] text-[#9090A8]">
                          <Zap size={11} /> {triggerLabels[flow.trigger_type] ?? flow.trigger_type}
                        </span>
                        {flow.trigger_keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {flow.trigger_keywords.slice(0, 4).map((kw, i) => (
                              <span key={i} className="break-words rounded-full bg-[#1F1F2E] px-2 py-0.5 text-[10px] text-[#9090A8]">
                                {kw}
                              </span>
                            ))}
                            {flow.trigger_keywords.length > 4 && (
                              <span className="text-[10px] text-[#5A5A72]">+{flow.trigger_keywords.length - 4} more</span>
                            )}
                          </div>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-[#9090A8]">
                          <MessageSquare size={11} /> {nodeCount} step{nodeCount !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[11px] text-[#5A5A72]">
                          Created {formatDistanceToNow(new Date(flow.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 md:flex-nowrap">
                    <button
                      onClick={() => toggleStatus(flow)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] px-3 py-1.5 text-xs transition hover:border-[#3B82F6]"
                      style={{ color: flow.status === "active" ? "#EF4444" : "#10B981" }}
                    >
                      {flow.status === "active"
                        ? <><PowerOff size={12} /> Deactivate</>
                        : <><Power size={12} /> Activate</>
                      }
                    </button>
                    <Link
                      href={`/admin/chatbot/${flow.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs text-[#9090A8] transition hover:border-[#3B82F6] hover:text-[#F0F0FA]"
                    >
                      <Edit size={12} /> Edit Flow
                      <ChevronRight size={12} />
                    </Link>
                    <button
                      onClick={() => deleteFlow(flow.id)}
                      className="rounded-lg border border-[#2A2A3C] p-1.5 text-[#5A5A72] transition hover:border-[#EF4444] hover:text-[#EF4444]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
