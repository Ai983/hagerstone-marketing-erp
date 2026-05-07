"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Plus, Save, Loader2, Trash2,
  MessageSquare, HelpCircle, ArrowRightLeft,
  CheckSquare, UserPlus, Tag, Bot, ChevronDown, ChevronUp, Image
} from "lucide-react"
import { toast } from "sonner"

type NodeType =
  | "send_text" | "send_media" | "send_buttons"
  | "ask_question" | "move_stage" | "create_task"
  | "enroll_campaign" | "end"

interface FlowNode {
  id?: string
  temp_id: string
  type: NodeType
  position: number
  config: Record<string, unknown>
}

interface ChatbotFlow {
  id: string
  name: string
  description: string | null
  status: "active" | "inactive"
  trigger_type: string
  trigger_keywords: string[]
  trigger_match: string
  priority: number
}

const NODE_TYPES: { type: NodeType; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { type: "send_text", label: "Send Text", icon: MessageSquare, color: "#3B82F6", desc: "Send a WhatsApp text message" },
  { type: "send_media", label: "Send Media", icon: Image, color: "#8B5CF6", desc: "Send image, PDF or video" },
  { type: "send_buttons", label: "Send Buttons", icon: Tag, color: "#F59E0B", desc: "Send message with up to 3 buttons" },
  { type: "ask_question", label: "Ask Question", icon: HelpCircle, color: "#06B6D4", desc: "Ask and save answer to lead profile" },
  { type: "move_stage", label: "Move Stage", icon: ArrowRightLeft, color: "#10B981", desc: "Move lead to a pipeline stage" },
  { type: "create_task", label: "Create Task", icon: CheckSquare, color: "#F97316", desc: "Create a follow-up task for rep" },
  { type: "enroll_campaign", label: "Enroll Campaign", icon: UserPlus, color: "#EC4899", desc: "Enroll lead in a drip campaign" },
  { type: "end", label: "End Flow", icon: Bot, color: "#5A5A72", desc: "End the chatbot conversation" },
]

const LEAD_FIELDS = [
  { value: "city", label: "City" },
  { value: "estimated_budget", label: "Budget" },
  { value: "company_name", label: "Company Name" },
  { value: "email", label: "Email" },
  { value: "initial_notes", label: "Notes" },
  { value: "service_line", label: "Service Line" },
]

const STAGE_OPTIONS = [
  { value: "new_lead", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "boq_received", label: "BOQ Received" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "on_hold", label: "On Hold" },
  { value: "reengagement", label: "Re-engagement" },
]

function NodeCard({
  node, index, total, onUpdate, onDelete, onMoveUp, onMoveDown
}: {
  node: FlowNode
  index: number
  total: number
  onUpdate: (temp_id: string, config: Record<string, unknown>) => void
  onDelete: (temp_id: string) => void
  onMoveUp: (temp_id: string) => void
  onMoveDown: (temp_id: string) => void
}) {
  const nodeDef = NODE_TYPES.find(n => n.type === node.type)!
  const Icon = nodeDef.icon
  const [expanded, setExpanded] = useState(true)

  function updateConfig(key: string, value: unknown) {
    onUpdate(node.temp_id, { ...node.config, [key]: value })
  }

  return (
    <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] overflow-hidden">
      {/* Node header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        style={{ borderLeft: `3px solid ${nodeDef.color}` }}
      >
        <div className="flex size-8 items-center justify-center rounded-lg" style={{ background: `${nodeDef.color}20` }}>
          <Icon size={16} style={{ color: nodeDef.color }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#F0F0FA]">{nodeDef.label}</p>
          <p className="text-[11px] text-[#5A5A72]">Step {index + 1} of {total}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onMoveUp(node.temp_id) }} disabled={index === 0}
            className="rounded p-1 text-[#5A5A72] hover:text-[#F0F0FA] disabled:opacity-30">
            <ChevronUp size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onMoveDown(node.temp_id) }} disabled={index === total - 1}
            className="rounded p-1 text-[#5A5A72] hover:text-[#F0F0FA] disabled:opacity-30">
            <ChevronDown size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(node.temp_id) }}
            className="rounded p-1 text-[#5A5A72] hover:text-[#EF4444]">
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={14} className="text-[#5A5A72]" /> : <ChevronDown size={14} className="text-[#5A5A72]" />}
        </div>
      </div>

      {/* Node config */}
      {expanded && node.type !== "end" && (
        <div className="border-t border-[#2A2A3C] p-4 space-y-3">
          {node.type === "send_text" && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Message</label>
              <textarea
                value={String(node.config.message ?? "")}
                onChange={e => updateConfig("message", e.target.value)}
                placeholder="Type your WhatsApp message here..."
                rows={4}
                className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] p-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] resize-none"
              />
              <p className="mt-1 text-[10px] text-[#5A5A72]">Use *bold*, _italic_. Variables: [Name], [Company]</p>
            </div>
          )}

          {node.type === "send_media" && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Media URL</label>
                <input
                  value={String(node.config.media_url ?? "")}
                  onChange={e => updateConfig("media_url", e.target.value)}
                  placeholder="https://... (Supabase Storage URL)"
                  className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Media Type</label>
                <select
                  value={String(node.config.media_type ?? "document")}
                  onChange={e => updateConfig("media_type", e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                >
                  <option value="image">Image</option>
                  <option value="document">Document / PDF</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Caption (optional)</label>
                <input
                  value={String(node.config.caption ?? "")}
                  onChange={e => updateConfig("caption", e.target.value)}
                  placeholder="Caption for the media"
                  className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                />
              </div>
            </>
          )}

          {node.type === "send_buttons" && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Message</label>
                <textarea
                  value={String(node.config.message ?? "")}
                  onChange={e => updateConfig("message", e.target.value)}
                  placeholder="Message to show with buttons..."
                  rows={3}
                  className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] p-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Buttons (max 3)</label>
                {[0, 1, 2].map((i) => {
                  const buttons = (node.config.buttons as { id: string; title: string }[]) ?? []
                  return (
                    <div key={i} className="flex gap-2">
                      <input
                        value={buttons[i]?.title ?? ""}
                        onChange={e => {
                          const updated = [...buttons]
                          updated[i] = { id: `btn_${i}_${Date.now()}`, title: e.target.value }
                          updateConfig("buttons", updated.filter(b => b.title))
                        }}
                        placeholder={`Button ${i + 1} label`}
                        className="h-9 flex-1 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {node.type === "ask_question" && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Question to ask</label>
                <textarea
                  value={String(node.config.question ?? "")}
                  onChange={e => updateConfig("question", e.target.value)}
                  placeholder="e.g. What is your office area in sq ft?"
                  rows={3}
                  className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] p-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] resize-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Save answer to lead field</label>
                <select
                  value={String(node.config.save_to_field ?? "")}
                  onChange={e => updateConfig("save_to_field", e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                >
                  <option value="">Do not save</option>
                  {LEAD_FIELDS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {node.type === "move_stage" && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Move to Stage</label>
              <select
                value={String(node.config.stage_slug ?? "")}
                onChange={e => updateConfig("stage_slug", e.target.value)}
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              >
                <option value="">Select stage...</option>
                {STAGE_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {node.type === "create_task" && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Task Title</label>
                <input
                  value={String(node.config.task_title ?? "")}
                  onChange={e => updateConfig("task_title", e.target.value)}
                  placeholder="e.g. Follow up with interested lead"
                  className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Task Type</label>
                <select
                  value={String(node.config.task_type ?? "call")}
                  onChange={e => updateConfig("task_type", e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                >
                  <option value="call">Call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="site_visit">Site Visit</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Due in (hours)</label>
                <input
                  type="number"
                  value={Number(node.config.task_due_hours ?? 2)}
                  onChange={e => updateConfig("task_due_hours", parseInt(e.target.value) || 2)}
                  min={1}
                  className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                />
              </div>
            </>
          )}

          {node.type === "enroll_campaign" && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Campaign ID</label>
              <input
                value={String(node.config.campaign_id ?? "")}
                onChange={e => updateConfig("campaign_id", e.target.value)}
                placeholder="Paste campaign UUID from campaigns page"
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              />
              <p className="mt-1 text-[10px] text-[#5A5A72]">Go to Campaigns and copy the campaign ID from the URL</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChatbotFlowBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const flowId = params.id as string

  const [flow, setFlow] = useState<ChatbotFlow | null>(null)
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddNode, setShowAddNode] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/chatbot/flows/${flowId}`)
      const data = await res.json()
      setFlow(data.flow)
      setNodes(
        (data.nodes ?? []).map((n: FlowNode & { id: string }) => ({
          ...n,
          temp_id: n.id ?? crypto.randomUUID(),
        }))
      )
      setLoading(false)
    }
    load()
  }, [flowId])

  function addNode(type: NodeType) {
    const newNode: FlowNode = {
      temp_id: crypto.randomUUID(),
      type,
      position: nodes.length,
      config: {},
    }
    setNodes([...nodes, newNode])
    setShowAddNode(false)
  }

  function updateNodeConfig(temp_id: string, config: Record<string, unknown>) {
    setNodes(nodes.map(n => n.temp_id === temp_id ? { ...n, config } : n))
  }

  function deleteNode(temp_id: string) {
    setNodes(nodes.filter(n => n.temp_id !== temp_id))
  }

  function moveUp(temp_id: string) {
    const idx = nodes.findIndex(n => n.temp_id === temp_id)
    if (idx <= 0) return
    const updated = [...nodes]
    ;[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]
    setNodes(updated.map((n, i) => ({ ...n, position: i })))
  }

  function moveDown(temp_id: string) {
    const idx = nodes.findIndex(n => n.temp_id === temp_id)
    if (idx >= nodes.length - 1) return
    const updated = [...nodes]
    ;[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
    setNodes(updated.map((n, i) => ({ ...n, position: i })))
  }

  async function saveFlow() {
    setSaving(true)
    try {
      const res = await fetch(`/api/chatbot/flows/${flowId}/nodes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: nodes.map((n, i) => ({
            type: n.type,
            position: i,
            config: n.config,
          })),
        }),
      })
      if (res.ok) {
        toast.success("Flow saved successfully!")
      } else {
        toast.error("Failed to save flow")
      }
    } catch {
      toast.error("Failed to save flow")
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus() {
    if (!flow) return
    const newStatus = flow.status === "active" ? "inactive" : "active"
    const res = await fetch(`/api/chatbot/flows/${flowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setFlow({ ...flow, status: newStatus })
      toast.success(`Chatbot ${newStatus === "active" ? "activated" : "deactivated"}`)
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
    <main className="thin-scrollbar h-full overflow-y-auto bg-[#0A0A0F] p-6">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin/chatbot")} className="rounded-lg border border-[#2A2A3C] p-2 text-[#9090A8] hover:text-[#F0F0FA]">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[#F0F0FA]">
                {flow?.name}
              </h1>
              <p className="text-xs text-[#5A5A72]">
                Trigger: {flow?.trigger_type} - Keywords: {flow?.trigger_keywords?.join(", ") || "none"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleStatus}
              className="rounded-lg border border-[#2A2A3C] px-3 py-1.5 text-xs transition"
              style={{ color: flow?.status === "active" ? "#EF4444" : "#10B981" }}
            >
              {flow?.status === "active" ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={saveFlow}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB] disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Flow
            </button>
          </div>
        </div>

        {/* Status banner */}
        <div
          className="mb-5 rounded-lg p-3 text-sm"
          style={{
            background: flow?.status === "active" ? "#10B98115" : "#F59E0B15",
            border: `1px solid ${flow?.status === "active" ? "#10B98130" : "#F59E0B30"}`,
            color: flow?.status === "active" ? "#10B981" : "#F59E0B",
          }}
        >
          {flow?.status === "active"
            ? "This chatbot is ACTIVE - it will auto-reply to matching WhatsApp messages"
            : "This chatbot is INACTIVE - activate it when the flow is ready"}
        </div>

        {/* Nodes */}
        <div className="space-y-3">
          {nodes.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#2A2A3C] p-10 text-center">
              <Bot size={32} className="mx-auto mb-2 text-[#3A3A52]" />
              <p className="text-sm text-[#9090A8]">No steps yet - add your first step below</p>
            </div>
          )}
          {nodes.map((node, idx) => (
            <NodeCard
              key={node.temp_id}
              node={node}
              index={idx}
              total={nodes.length}
              onUpdate={updateNodeConfig}
              onDelete={deleteNode}
              onMoveUp={moveUp}
              onMoveDown={moveDown}
            />
          ))}
        </div>

        {/* Add node */}
        <div className="mt-4">
          {showAddNode ? (
            <div className="rounded-xl border border-[#2A2A3C] bg-[#111118] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9090A8]">Choose step type</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {NODE_TYPES.map(({ type, label, icon: Icon, color, desc }) => (
                  <button
                    key={type}
                    onClick={() => addNode(type)}
                    className="flex flex-col items-center gap-2 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3 text-center transition hover:border-[#3B82F6]"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg" style={{ background: `${color}20` }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                    <span className="text-xs font-medium text-[#F0F0FA]">{label}</span>
                    <span className="text-[10px] text-[#5A5A72] leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAddNode(false)} className="mt-3 text-xs text-[#5A5A72] hover:text-[#9090A8]">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddNode(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#2A2A3C] py-4 text-sm text-[#5A5A72] transition hover:border-[#3B82F6] hover:text-[#3B82F6]"
            >
              <Plus size={16} /> Add Step
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
