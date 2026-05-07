"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  Panel,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  MessageSquare,
  HelpCircle,
  ArrowRightLeft,
  CheckSquare,
  UserPlus,
  Bot,
  Image,
  Tag,
  X,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

// ── Node type definitions ──────────────────────────────────────────────────

type NodeType =
  | "send_text" | "send_media" | "send_buttons"
  | "ask_question" | "move_stage" | "create_task"
  | "enroll_campaign" | "end" | "trigger"

interface NodeConfig {
  message?: string
  media_url?: string
  media_type?: string
  media_filename?: string
  caption?: string
  buttons?: { id: string; title: string }[]
  question?: string
  save_to_field?: string
  stage_slug?: string
  task_title?: string
  task_type?: string
  task_due_hours?: number
  campaign_id?: string
  keywords?: string[]
  trigger_type?: string
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

const NODE_DEFS: Record<NodeType, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  trigger:         { label: "Trigger",          color: "#F59E0B", bg: "#F59E0B20", icon: Zap },
  send_text:       { label: "Send Text",         color: "#3B82F6", bg: "#3B82F620", icon: MessageSquare },
  send_media:      { label: "Send Media",        color: "#8B5CF6", bg: "#8B5CF620", icon: Image },
  send_buttons:    { label: "Send Buttons",      color: "#F97316", bg: "#F9731620", icon: Tag },
  ask_question:    { label: "Ask Question",      color: "#06B6D4", bg: "#06B6D420", icon: HelpCircle },
  move_stage:      { label: "Move Stage",        color: "#10B981", bg: "#10B98120", icon: ArrowRightLeft },
  create_task:     { label: "Create Task",       color: "#EF4444", bg: "#EF444420", icon: CheckSquare },
  enroll_campaign: { label: "Enroll Campaign",   color: "#EC4899", bg: "#EC489920", icon: UserPlus },
  end:             { label: "End Flow",          color: "#5A5A72", bg: "#5A5A7220", icon: Bot },
}

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

// ── Custom node component ──────────────────────────────────────────────────

function ChatbotNode({ data, selected }: { data: { type: NodeType; config: NodeConfig; label: string }; selected: boolean }) {
  const def = NODE_DEFS[data.type]
  const Icon = def.icon

  function getPreview() {
    switch (data.type) {
      case "trigger": return data.config.keywords?.join(", ") || "Any message"
      case "send_text": return data.config.message?.slice(0, 50) || "No message set"
      case "send_media": return data.config.media_type || "No media set"
      case "send_buttons": return `${data.config.buttons?.length ?? 0} buttons`
      case "ask_question": return data.config.question?.slice(0, 50) || "No question set"
      case "move_stage": return data.config.stage_slug || "No stage set"
      case "create_task": return data.config.task_title?.slice(0, 40) || "No title set"
      case "enroll_campaign": return data.config.campaign_id ? "Campaign set" : "No campaign set"
      case "end": return "Flow ends here"
      default: return ""
    }
  }

  return (
    <div
      className="relative min-w-[200px] max-w-[240px] rounded-xl border-2 bg-[#111118] shadow-lg transition-all"
      style={{
        borderColor: selected ? def.color : "#2A2A3C",
        boxShadow: selected ? `0 0 0 2px ${def.color}40` : "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-center gap-2 rounded-t-xl p-3" style={{ background: def.bg }}>
        <div className="flex size-7 items-center justify-center rounded-lg" style={{ background: `${def.color}30` }}>
          <Icon size={14} style={{ color: def.color }} />
        </div>
        <span className="text-xs font-semibold text-[#F0F0FA]">{def.label}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-[11px] text-[#9090A8] leading-relaxed line-clamp-2">{getPreview()}</p>
      </div>
    </div>
  )
}

const nodeTypes = { chatbotNode: ChatbotNode }

// ── Config panel ───────────────────────────────────────────────────────────

function ConfigPanel({
  node,
  onUpdate,
  onClose,
  onDelete,
}: {
  node: Node
  onUpdate: (id: string, config: NodeConfig) => void
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const data = node.data as { type: NodeType; config: NodeConfig; label: string }
  const def = NODE_DEFS[data.type]
  const Icon = def.icon
  const [config, setConfig] = useState<NodeConfig>(data.config)

  function update(key: string, value: unknown) {
    const updated = { ...config, [key]: value }
    setConfig(updated)
    onUpdate(node.id, updated)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[#2A2A3C] p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg" style={{ background: def.bg }}>
            <Icon size={14} style={{ color: def.color }} />
          </div>
          <span className="text-sm font-semibold text-[#F0F0FA]">{def.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {data.type !== "trigger" && (
            <button
              onClick={() => onDelete(node.id)}
              className="rounded p-1.5 text-[#5A5A72] hover:bg-[#EF444420] hover:text-[#EF4444]"
            >
              <X size={14} />
            </button>
          )}
          <button onClick={onClose} className="rounded p-1.5 text-[#5A5A72] hover:text-[#F0F0FA]">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {data.type === "send_text" && (
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Message</label>
            <textarea
              value={String(config.message ?? "")}
              onChange={e => update("message", e.target.value)}
              placeholder="Type your WhatsApp message..."
              rows={6}
              className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] p-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] resize-none"
            />
            <p className="mt-1 text-[10px] text-[#5A5A72]">Use *bold*, _italic_. Variables: [Name], [Company]</p>
          </div>
        )}

        {data.type === "send_media" && (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Media URL</label>
              <input
                value={String(config.media_url ?? "")}
                onChange={e => update("media_url", e.target.value)}
                placeholder="https://... (Supabase Storage URL)"
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Media Type</label>
              <select
                value={String(config.media_type ?? "document")}
                onChange={e => update("media_type", e.target.value)}
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              >
                <option value="image">Image</option>
                <option value="document">Document / PDF</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Caption</label>
              <input
                value={String(config.caption ?? "")}
                onChange={e => update("caption", e.target.value)}
                placeholder="Optional caption"
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              />
            </div>
          </>
        )}

        {data.type === "send_buttons" && (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Message</label>
              <textarea
                value={String(config.message ?? "")}
                onChange={e => update("message", e.target.value)}
                placeholder="Message shown with buttons..."
                rows={4}
                className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] p-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Buttons (max 3)</label>
              {[0, 1, 2].map((i) => {
                const buttons = (config.buttons ?? []) as { id: string; title: string }[]
                return (
                  <input
                    key={i}
                    value={buttons[i]?.title ?? ""}
                    onChange={e => {
                      const updated = [...buttons]
                      updated[i] = { id: `btn_${i}`, title: e.target.value }
                      update("buttons", updated.filter(b => b.title))
                    }}
                    placeholder={`Button ${i + 1}`}
                    className="h-9 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
                  />
                )
              })}
            </div>
          </>
        )}

        {data.type === "ask_question" && (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Question</label>
              <textarea
                value={String(config.question ?? "")}
                onChange={e => update("question", e.target.value)}
                placeholder="e.g. What is your office area in sq ft?"
                rows={4}
                className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] p-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6] resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Save answer to</label>
              <select
                value={String(config.save_to_field ?? "")}
                onChange={e => update("save_to_field", e.target.value)}
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

        {data.type === "move_stage" && (
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Move to Stage</label>
            <select
              value={String(config.stage_slug ?? "")}
              onChange={e => update("stage_slug", e.target.value)}
              className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
            >
              <option value="">Select stage...</option>
              {STAGE_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        )}

        {data.type === "create_task" && (
          <>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Task Title</label>
              <input
                value={String(config.task_title ?? "")}
                onChange={e => update("task_title", e.target.value)}
                placeholder="e.g. Follow up with interested lead"
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Task Type</label>
              <select
                value={String(config.task_type ?? "call")}
                onChange={e => update("task_type", e.target.value)}
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
                value={Number(config.task_due_hours ?? 2)}
                onChange={e => update("task_due_hours", parseInt(e.target.value) || 2)}
                min={1}
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              />
            </div>
          </>
        )}

        {data.type === "enroll_campaign" && (
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Campaign ID</label>
            <input
              value={String(config.campaign_id ?? "")}
              onChange={e => update("campaign_id", e.target.value)}
              placeholder="Paste campaign UUID"
              className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
            />
            <p className="mt-1 text-[10px] text-[#5A5A72]">Go to Campaigns → copy ID from the URL</p>
          </div>
        )}

        {data.type === "end" && (
          <div className="rounded-lg bg-[#5A5A7220] p-4 text-center">
            <Bot size={24} className="mx-auto mb-2 text-[#5A5A72]" />
            <p className="text-xs text-[#9090A8]">This node ends the chatbot flow. No configuration needed.</p>
          </div>
        )}

        {data.type === "trigger" && (
          <div className="rounded-lg bg-[#F59E0B20] p-4">
            <p className="text-xs text-[#F59E0B]">⚡ Trigger settings are configured in the chatbot settings. This node represents when the flow starts.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

const ADD_NODE_TYPES: { type: NodeType; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { type: "send_text",       label: "Send Text",       icon: MessageSquare,   color: "#3B82F6", desc: "Send a text message" },
  { type: "send_media",      label: "Send Media",      icon: Image,           color: "#8B5CF6", desc: "Image, PDF or video" },
  { type: "send_buttons",    label: "Send Buttons",    icon: Tag,             color: "#F97316", desc: "Message with buttons" },
  { type: "ask_question",    label: "Ask Question",    icon: HelpCircle,      color: "#06B6D4", desc: "Ask & save answer" },
  { type: "move_stage",      label: "Move Stage",      icon: ArrowRightLeft,  color: "#10B981", desc: "Move pipeline stage" },
  { type: "create_task",     label: "Create Task",     icon: CheckSquare,     color: "#EF4444", desc: "Create follow-up task" },
  { type: "enroll_campaign", label: "Enroll Campaign", icon: UserPlus,        color: "#EC4899", desc: "Add to drip campaign" },
  { type: "end",             label: "End Flow",        icon: Bot,             color: "#5A5A72", desc: "End the conversation" },
]

export default function ChatbotFlowBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const flowId = params.id as string

  const [flow, setFlow] = useState<ChatbotFlow | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)

  // Load flow data
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/chatbot/flows/${flowId}`)
      const data = await res.json()
      setFlow(data.flow)

      const dbNodes: {
        id: string
        type: string
        position: number
        config: NodeConfig
        next_node_id: string | null
      }[] = data.nodes ?? []

      // Convert DB nodes to React Flow nodes
      const rfNodes: Node[] = []

      // Add trigger node first
      rfNodes.push({
        id: "trigger",
        type: "chatbotNode",
        position: { x: 100, y: 100 },
        data: {
          type: "trigger",
          label: "Trigger",
          config: {
            keywords: data.flow?.trigger_keywords ?? [],
            trigger_type: data.flow?.trigger_type,
          },
        },
      })

      // Add flow nodes
      dbNodes.forEach((n, i) => {
        rfNodes.push({
          id: n.id,
          type: "chatbotNode",
          position: { x: 100, y: 220 + i * 160 },
          data: {
            type: n.type as NodeType,
            label: NODE_DEFS[n.type as NodeType]?.label ?? n.type,
            config: n.config,
          },
        })
      })

      setNodes(rfNodes)

      // Build edges — trigger → first node, then sequential
      const rfEdges: Edge[] = []
      if (dbNodes.length > 0) {
        rfEdges.push({
          id: `trigger-${dbNodes[0].id}`,
          source: "trigger",
          target: dbNodes[0].id,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#3B82F6" },
          style: { stroke: "#3B82F6", strokeWidth: 2 },
          animated: true,
        })
      }
      dbNodes.forEach((n) => {
        if (n.next_node_id) {
          rfEdges.push({
            id: `${n.id}-${n.next_node_id}`,
            source: n.id,
            target: n.next_node_id,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#3B82F6" },
            style: { stroke: "#3B82F6", strokeWidth: 2 },
            animated: true,
          })
        }
      })
      setEdges(rfEdges)
      setLoading(false)
    }
    load()
  }, [flowId, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(eds => addEdge({
        ...connection,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3B82F6" },
        style: { stroke: "#3B82F6", strokeWidth: 2 },
        animated: true,
      }, eds))
    },
    [setEdges]
  )

  function addNode(type: NodeType) {
    const id = crypto.randomUUID()
    const newNode: Node = {
      id,
      type: "chatbotNode",
      position: { x: 100 + Math.random() * 200, y: 200 + nodes.length * 160 },
      data: {
        type,
        label: NODE_DEFS[type].label,
        config: {},
      },
    }
    setNodes(nds => [...nds, newNode])
    setShowAddPanel(false)
    setSelectedNode(newNode)
  }

  function updateNodeConfig(nodeId: string, config: NodeConfig) {
    setNodes(nds =>
      nds.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config } }
          : n
      )
    )
    if (selectedNode?.id === nodeId) {
      setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, config } } : null)
    }
  }

  function deleteNode(nodeId: string) {
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }

  async function saveFlow() {
    setSaving(true)
    try {
      // Build ordered node list from edges
      const flowNodes = nodes.filter(n => n.id !== "trigger")

      // Build adjacency from edges
      const edgeMap: Record<string, string> = {}
      edges.forEach(e => { if (e.source !== "trigger") edgeMap[e.source] = e.target })

      // Find first node (connected from trigger)
      const triggerEdge = edges.find(e => e.source === "trigger")
      const orderedNodes: Node[] = []
      let current = triggerEdge?.target

      const visited = new Set<string>()
      while (current && !visited.has(current)) {
        const node = flowNodes.find(n => n.id === current)
        if (node) orderedNodes.push(node)
        visited.add(current)
        current = edgeMap[current]
      }

      // Add any unconnected nodes at the end
      flowNodes.forEach(n => {
        if (!visited.has(n.id)) orderedNodes.push(n)
      })

      const res = await fetch(`/api/chatbot/flows/${flowId}/nodes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: orderedNodes.map((n, i) => ({
            type: (n.data as { type: string }).type,
            position: i,
            config: (n.data as { config: NodeConfig }).config,
          })),
        }),
      })

      if (res.ok) {
        toast.success("Flow saved! ✅")
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
      toast.success(`Chatbot ${newStatus === "active" ? "activated ✅" : "deactivated"}`)
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
    <main className="flex h-full flex-col bg-[#0A0A0F]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[#2A2A3C] bg-[#111118] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/chatbot")}
            className="rounded-lg border border-[#2A2A3C] p-2 text-[#9090A8] hover:text-[#F0F0FA]"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-[#F0F0FA]">{flow?.name}</h1>
            <p className="text-[11px] text-[#5A5A72]">
              Trigger: {flow?.trigger_type} · Keywords: {flow?.trigger_keywords?.join(", ") || "none"}
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: flow?.status === "active" ? "#10B98120" : "#2A2A3C",
              color: flow?.status === "active" ? "#10B981" : "#5A5A72",
            }}
          >
            {flow?.status === "active" ? "● Active" : "○ Inactive"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddPanel(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-1.5 text-xs text-[#9090A8] hover:border-[#3B82F6] hover:text-[#F0F0FA]"
          >
            <Plus size={14} /> Add Step
          </button>
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#2563EB] disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>

      {/* Canvas + side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* React Flow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            fitView
            style={{ background: "#0A0A0F" }}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed, color: "#3B82F6" },
              style: { stroke: "#3B82F6", strokeWidth: 2 },
              animated: true,
            }}
          >
            <Background color="#2A2A3C" variant={BackgroundVariant.Dots} gap={24} size={1} />
            <Controls
              style={{
                background: "#111118",
                border: "1px solid #2A2A3C",
                borderRadius: 8,
              }}
            />
            <MiniMap
              style={{ background: "#111118", border: "1px solid #2A2A3C" }}
              nodeColor="#3B82F6"
              maskColor="rgba(10,10,15,0.7)"
            />
            <Panel position="top-left">
              <div className="rounded-lg border border-[#2A2A3C] bg-[#111118] px-3 py-2 text-[11px] text-[#5A5A72]">
                💡 Drag nodes to reposition · Click to edit · Connect by dragging from node handles
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Add node panel */}
        {showAddPanel && (
          <div className="w-72 border-l border-[#2A2A3C] bg-[#111118] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#2A2A3C] p-4">
              <span className="text-sm font-semibold text-[#F0F0FA]">Add Step</span>
              <button onClick={() => setShowAddPanel(false)} className="text-[#5A5A72] hover:text-[#F0F0FA]">
                <X size={16} />
              </button>
            </div>
            <div className="p-3 space-y-2">
              {ADD_NODE_TYPES.map(({ type, label, icon: Icon, color, desc }) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  className="flex w-full items-center gap-3 rounded-lg border border-[#2A2A3C] bg-[#1A1A24] p-3 text-left transition hover:border-[#3B82F6]"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}20` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#F0F0FA]">{label}</p>
                    <p className="text-[10px] text-[#5A5A72]">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Config panel */}
        {selectedNode && !showAddPanel && (
          <div className="w-80 border-l border-[#2A2A3C] bg-[#111118] overflow-y-auto">
            <ConfigPanel
              node={selectedNode}
              onUpdate={updateNodeConfig}
              onClose={() => setSelectedNode(null)}
              onDelete={deleteNode}
            />
          </div>
        )}
      </div>
    </main>
  )
}
