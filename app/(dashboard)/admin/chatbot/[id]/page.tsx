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
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
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
  GitBranch,
  UserPlus,
  Bot,
  Image,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

// ── Node type definitions ──────────────────────────────────────────────────

type NodeType =
  | "send_text" | "send_media" | "send_buttons"
  | "ask_question" | "move_stage" | "create_task"
  | "enroll_campaign" | "condition" | "end" | "trigger"

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
  branches?: Branch[]
  keywords?: string[]
  trigger_type?: string
  trigger_match?: string
  _canvas_x?: number
  _canvas_y?: number
}

interface Branch {
  id: string
  label: string
  color: string
  conditions: {
    field: string
    operator: string
    value: string
  }[]
  next_node_id: string | null
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
  _canvas_trigger_pos?: { x: number; y: number } | null
  edges_data?: Edge[]
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
  condition:       { label: "Condition",         color: "#A855F7", bg: "#A855F720", icon: GitBranch },
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
      case "condition": {
        const branches = (data.config.branches as Branch[] | undefined) ?? []
        return branches.length > 0
          ? branches.map(b => b.label).join(" / ")
          : "No branches configured"
      }
      case "end": return "Flow ends here"
      default: return ""
    }
  }

  return (
    <div
      className="relative min-w-[200px] max-w-[240px] rounded-xl border-2 bg-[#111118] shadow-lg transition-all"
      style={{
        borderColor: selected ? def.color : "#2A2A3C",
        boxShadow: selected
          ? `0 0 0 3px ${def.color}50, 0 0 20px ${def.color}30`
          : "0 4px 12px rgba(0,0,0,0.4)",
        transform: selected ? "scale(1.03)" : "scale(1)",
        transition: "all 0.15s ease",
      }}
    >
      {/* Selected indicator bar at top */}
      {selected && (
        <div
          className="absolute -top-0.5 left-4 right-4 h-0.5 rounded-full"
          style={{ background: def.color }}
        />
      )}

      {/* Target handle */}
      {data.type !== "trigger" && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: selected ? def.color : "#3A3A52",
            width: 12,
            height: 12,
            border: `2px solid ${selected ? "#111118" : "#2A2A3C"}`,
            left: -6,
            transition: "all 0.15s ease",
          }}
        />
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-xl p-3"
        style={{
          background: selected ? `${def.color}30` : def.bg,
          transition: "background 0.15s ease",
        }}
      >
        <div
          className="flex size-7 items-center justify-center rounded-lg"
          style={{ background: `${def.color}30` }}
        >
          <Icon size={14} style={{ color: def.color }} />
        </div>
        <span className="text-xs font-semibold text-[#F0F0FA]">{def.label}</span>
        {selected && (
          <span
            className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: def.color, color: "#fff" }}
          >
            Selected
          </span>
        )}
      </div>

      {/* Preview */}
      <div className="px-3 py-2">
        <p className="text-[11px] text-[#9090A8] leading-relaxed line-clamp-2">
          {getPreview()}
        </p>
      </div>

      {/* Source handles - multiple for condition node, single for others */}
      {data.type === "condition" ? (
        <>
          {((data.config.branches as Branch[] | undefined) ?? [
            { id: "yes", label: "Yes", color: "#10B981", conditions: [], next_node_id: null },
            { id: "no", label: "No", color: "#EF4444", conditions: [], next_node_id: null },
            { id: "default", label: "Default", color: "#5A5A72", conditions: [], next_node_id: null },
          ]).map((branch: Branch, idx: number, arr: Branch[]) => (
            <Handle
              key={branch.id}
              id={branch.id}
              type="source"
              position={Position.Right}
              style={{
                background: branch.color,
                width: 12,
                height: 12,
                border: "2px solid #111118",
                right: -6,
                top: `${((idx + 1) / (arr.length + 1)) * 100}%`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: branch.color,
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {branch.label}
              </div>
            </Handle>
          ))}
        </>
      ) : (
        data.type !== "end" && (
          <Handle
            type="source"
            position={Position.Right}
            style={{
              background: selected ? def.color : "#3A3A52",
              width: 12,
              height: 12,
              border: `2px solid ${selected ? "#111118" : "#2A2A3C"}`,
              right: -6,
              transition: "all 0.15s ease",
            }}
          />
        )
      )}
    </div>
  )
}

const nodeTypes = { chatbotNode: ChatbotNode }

let setEdgesOutside: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void = () => {}

function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: hovered ? "#EF4444" : "#3B82F6",
          strokeWidth: hovered ? 2.5 : 2,
          transition: "stroke 0.2s, stroke-width 0.2s",
        }}
      />
      {/* Wide invisible stroke for easy hover */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={30}
        stroke="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        {hovered && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              zIndex: 1000,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setEdgesOutside((eds: Edge[]) => eds.filter((ed: Edge) => ed.id !== id))
              }}
              className="flex items-center justify-center rounded-full border border-[#EF4444] bg-[#111118] p-1.5 shadow-xl transition hover:scale-110 hover:bg-[#EF4444]"
              title="Delete connection"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

const edgeTypes = { deletable: DeletableEdge }

const CONDITION_FIELDS = [
  { value: "message_text", label: "Message Text" },
  { value: "lead_stage", label: "Lead Stage" },
  { value: "lead_category", label: "Lead Category" },
  { value: "lead_city", label: "Lead City" },
  { value: "lead_budget", label: "Lead Budget" },
  { value: "last_answer", label: "Last Answer" },
]

const CONDITION_OPERATORS = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "starts_with", label: "starts with" },
  { value: "not_equals", label: "does not equal" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
]

const BRANCH_COLORS = ["#10B981", "#EF4444", "#3B82F6", "#F59E0B", "#8B5CF6", "#5A5A72"]

function ConditionNodeConfig({
  branches,
  onChange,
}: {
  branches: Branch[]
  onChange: (branches: Branch[]) => void
}) {
  function addBranch() {
    const newBranch: Branch = {
      id: crypto.randomUUID(),
      label: `Branch ${branches.length + 1}`,
      color: BRANCH_COLORS[branches.length % BRANCH_COLORS.length],
      conditions: [],
      next_node_id: null,
    }
    onChange([...branches, newBranch])
  }

  function updateBranch(id: string, updates: Partial<Branch>) {
    onChange(branches.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  function deleteBranch(id: string) {
    if (branches.length <= 1) return
    onChange(branches.filter(b => b.id !== id))
  }

  function addCondition(branchId: string) {
    const branch = branches.find(b => b.id === branchId)
    if (!branch) return
    updateBranch(branchId, {
      conditions: [
        ...branch.conditions,
        { field: "message_text", operator: "contains", value: "" },
      ],
    })
  }

  function updateCondition(
    branchId: string,
    condIdx: number,
    updates: Partial<{ field: string; operator: string; value: string }>
  ) {
    const branch = branches.find(b => b.id === branchId)
    if (!branch) return
    const updated = branch.conditions.map((c, i) =>
      i === condIdx ? { ...c, ...updates } : c
    )
    updateBranch(branchId, { conditions: updated })
  }

  function deleteCondition(branchId: string, condIdx: number) {
    const branch = branches.find(b => b.id === branchId)
    if (!branch) return
    updateBranch(branchId, {
      conditions: branch.conditions.filter((_, i) => i !== condIdx),
    })
  }

  return (
    <div className="box-border w-full min-w-0 space-y-3 overflow-x-hidden">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
          Branches ({branches.length})
        </p>
        <button
          onClick={addBranch}
          className="inline-flex items-center gap-1 rounded-lg bg-[#A855F720] px-2 py-1 text-[11px] text-[#A855F7] hover:bg-[#A855F730]"
        >
          <Plus size={11} /> Add Branch
        </button>
      </div>

      <div className="space-y-3">
        {branches.map((branch, bIdx) => (
          <div
            key={branch.id}
            className="w-full overflow-hidden rounded-lg border"
            style={{ borderColor: `${branch.color}40` }}
          >
            {/* Branch header */}
            <div
              className="flex min-w-0 items-start gap-2 px-3 py-2"
              style={{ background: `${branch.color}15` }}
            >
              <div
                className="size-3 shrink-0 rounded-full"
                style={{ background: branch.color }}
              />
              <input
                value={branch.label}
                onChange={e => updateBranch(branch.id, { label: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#F0F0FA] outline-none"
                placeholder="Branch label"
              />
              <div className="flex shrink-0 items-start gap-1">
                <div className="flex max-w-[92px] flex-wrap gap-1">
                  {BRANCH_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => updateBranch(branch.id, { color })}
                      className="size-4 rounded-full border-2 transition"
                      style={{
                        background: color,
                        borderColor: branch.color === color ? "#fff" : "transparent",
                      }}
                    />
                  ))}
                </div>
                {branches.length > 1 && (
                  <button
                    onClick={() => deleteBranch(branch.id)}
                    className="ml-1 rounded p-0.5 text-[#5A5A72] hover:text-[#EF4444]"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Conditions */}
            <div className="w-full min-w-0 space-y-2 p-3">
              {branch.conditions.length === 0 ? (
                <p className="py-1 text-center text-[10px] text-[#5A5A72]">
                  {bIdx === branches.length - 1
                    ? "Default - matches when no other branch matches"
                    : "No conditions - click + to add"}
                </p>
              ) : (
                branch.conditions.map((cond, cIdx) => (
                  <div key={cIdx} className="flex w-full min-w-0 items-center gap-1.5">
                    <select
                      value={cond.field}
                      onChange={e => updateCondition(branch.id, cIdx, { field: e.target.value })}
                      className="h-8 w-[98px] shrink-0 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-1.5 text-[10px] text-[#F0F0FA] outline-none focus:border-[#A855F7]"
                    >
                      {CONDITION_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <select
                      value={cond.operator}
                      onChange={e => updateCondition(branch.id, cIdx, { operator: e.target.value })}
                      className="h-8 w-[82px] shrink-0 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-1.5 text-[10px] text-[#F0F0FA] outline-none focus:border-[#A855F7]"
                    >
                      {CONDITION_OPERATORS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      value={cond.value}
                      onChange={e => updateCondition(branch.id, cIdx, { value: e.target.value })}
                      placeholder="value"
                      className="h-8 min-w-0 flex-1 rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-1.5 text-[10px] text-[#F0F0FA] outline-none focus:border-[#A855F7]"
                    />
                    <button
                      onClick={() => deleteCondition(branch.id, cIdx)}
                      className="rounded p-1 text-[#5A5A72] hover:text-[#EF4444]"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))
              )}
              <button
                onClick={() => addCondition(branch.id)}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[#2A2A3C] py-1.5 text-[10px] text-[#5A5A72] hover:border-[#A855F7] hover:text-[#A855F7]"
              >
                <Plus size={10} /> Add Condition
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-[#A855F715] p-3 border border-[#A855F730]">
        <p className="text-[10px] text-[#A855F7]">
          Branches are checked top to bottom. First matching branch wins.
          Last branch with no conditions = Default fallback.
          Connect each branch handle (right side) to the next node.
        </p>
      </div>
    </div>
  )
}

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

  // Re-sync config when selected node changes
  useEffect(() => {
    setConfig(data.config)
  }, [node.id, data.config])

  function update(key: string, value: unknown) {
    const updated = { ...config, [key]: value }
    setConfig(updated)
    onUpdate(node.id, updated)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div
        className="flex items-center justify-between p-4"
        style={{
          borderBottom: `2px solid ${def.color}40`,
          background: `${def.color}10`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ background: def.bg }}
          >
            <Icon size={16} style={{ color: def.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#F0F0FA]">{def.label}</p>
            <p className="text-[10px] text-[#5A5A72]">Configure this step</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {data.type !== "trigger" && (
            <button
              onClick={() => onDelete(node.id)}
              title="Delete this node"
              className="rounded-lg p-1.5 text-[#5A5A72] transition hover:bg-[#EF444420] hover:text-[#EF4444]"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close panel"
            className="rounded-lg p-1.5 text-[#5A5A72] transition hover:bg-[#2A2A3C] hover:text-[#F0F0FA]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Current value preview badge */}
      <div className="border-b border-[#2A2A3C] bg-[#0A0A0F] px-4 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#5A5A72]">Current Value</p>
        <p className="mt-0.5 truncate text-xs text-[#9090A8]">
          {(() => {
            switch (data.type) {
              case "trigger": return config.keywords?.join(", ") || "No keywords"
              case "send_text": return config.message?.slice(0, 60) || "No message set"
              case "send_media": return config.media_url ? `${config.media_type} - ${config.media_url.split("/").pop()}` : "No media set"
              case "send_buttons": return config.buttons?.map((b: { title: string }) => b.title).join(" | ") || "No buttons set"
              case "ask_question": return config.question?.slice(0, 60) || "No question set"
              case "move_stage": return config.stage_slug ? STAGE_OPTIONS.find(s => s.value === config.stage_slug)?.label ?? config.stage_slug : "No stage set"
              case "create_task": return config.task_title ? `${config.task_title} (${config.task_type ?? "call"}, ${config.task_due_hours ?? 2}h)` : "No task configured"
              case "enroll_campaign": return config.campaign_id ? `Campaign: ${config.campaign_id.slice(0, 12)}...` : "No campaign set"
              case "end": return "Flow ends here"
              default: return "Not configured"
            }
          })()}
        </p>
      </div>

      {/* Panel body */}
      <div className="box-border flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">

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
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Save answer to lead field</label>
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
            <p className="mt-1 text-[10px] text-[#5A5A72]">Go to Campaigns and copy ID from the URL</p>
          </div>
        )}

        {data.type === "condition" && (
          <ConditionNodeConfig
            branches={(config.branches as Branch[] | undefined) ?? [
              { id: crypto.randomUUID(), label: "Yes", color: "#10B981", conditions: [], next_node_id: null },
              { id: crypto.randomUUID(), label: "No", color: "#EF4444", conditions: [], next_node_id: null },
              { id: crypto.randomUUID(), label: "Default", color: "#5A5A72", conditions: [], next_node_id: null },
            ]}
            onChange={(branches) => update("branches", branches)}
          />
        )}

        {data.type === "end" && (
          <div className="rounded-lg bg-[#5A5A7220] p-4 text-center">
            <Bot size={24} className="mx-auto mb-2 text-[#5A5A72]" />
            <p className="text-xs text-[#9090A8]">This node ends the chatbot flow.</p>
          </div>
        )}

        {data.type === "trigger" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#F59E0B15] p-3 border border-[#F59E0B30]">
              <p className="text-xs text-[#F59E0B]">Edit trigger keywords and settings below. Click Save in toolbar to persist changes.</p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Trigger Type</label>
              <select
                value={String(config.trigger_type ?? "keyword")}
                onChange={e => update("trigger_type", e.target.value)}
                className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#F59E0B]"
              >
                <option value="keyword">Keyword Match</option>
                <option value="first_message">First Message from Lead</option>
                <option value="any_message">Any Incoming Message</option>
              </select>
            </div>

            {(config.trigger_type === "keyword" || !config.trigger_type) && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">
                    Keywords (comma separated)
                  </label>
                  <textarea
                    value={(config.keywords ?? []).join(", ")}
                    onChange={e => {
                      const keywords = e.target.value
                        .split(",")
                        .map(k => k.trim())
                        .filter(Boolean)
                      update("keywords", keywords)
                    }}
                    placeholder="interested, yes, haan, tell me more, batao"
                    rows={4}
                    className="w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] p-3 text-sm text-[#F0F0FA] outline-none focus:border-[#F59E0B] resize-none"
                  />
                  <p className="mt-1 text-[10px] text-[#5A5A72]">Separate keywords with commas. Case insensitive.</p>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Match Type</label>
                  <select
                    value={String(config.trigger_match ?? "contains")}
                    onChange={e => update("trigger_match", e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#2A2A3C] bg-[#1F1F2E] px-3 text-sm text-[#F0F0FA] outline-none focus:border-[#F59E0B]"
                  >
                    <option value="contains">Contains keyword</option>
                    <option value="exact">Exact match only</option>
                    <option value="starts_with">Starts with keyword</option>
                  </select>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#9090A8]">Current Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(config.keywords ?? []).length === 0 ? (
                      <p className="text-xs text-[#5A5A72]">No keywords set</p>
                    ) : (
                      (config.keywords ?? []).map((kw: string, i: number) => (
                        <div key={i} className="flex items-center gap-1 rounded-full bg-[#F59E0B20] pl-2.5 pr-1 py-1">
                          <span className="text-xs text-[#F59E0B]">{kw}</span>
                          <button
                            onClick={() => {
                              const updated = (config.keywords ?? []).filter((_: string, idx: number) => idx !== i)
                              update("keywords", updated)
                            }}
                            className="flex size-4 items-center justify-center rounded-full hover:bg-[#F59E0B40]"
                          >
                            <X size={10} className="text-[#F59E0B]" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer - save hint */}
      <div className="border-t border-[#2A2A3C] bg-[#0A0A0F] px-4 py-3">
        <p className="text-center text-[10px] text-[#5A5A72]">
          Changes auto-update. Click <span className="text-[#3B82F6]">Save</span> in toolbar to persist
        </p>
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
  { type: "condition",       label: "Condition",       icon: GitBranch,       color: "#A855F7", desc: "Branch based on reply or lead data" },
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

  setEdgesOutside = setEdges

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
        position_x?: number | null
        position_y?: number | null
        config: NodeConfig
        branches?: Branch[]
        next_node_id: string | null
      }[] = data.nodes ?? []

      // Convert DB nodes to React Flow nodes
      const rfNodes: Node[] = []

      // Add trigger node first
      const triggerPos = data.flow?._canvas_trigger_pos
      rfNodes.push({
        id: "trigger",
        type: "chatbotNode",
        position: triggerPos
          ? { x: triggerPos.x, y: triggerPos.y }
          : { x: 80, y: 200 },
        data: {
          type: "trigger",
          label: "Trigger",
          config: {
            keywords: data.flow?.trigger_keywords ?? [],
            trigger_type: data.flow?.trigger_type,
            trigger_match: data.flow?.trigger_match,
          },
        },
      })

      // Add flow nodes
      dbNodes.forEach((n, i) => {
        // Use saved canvas position if available, otherwise calculate default
        const savedX = typeof n.position_x === "number"
          ? n.position_x
          : typeof n.config._canvas_x === "number"
            ? n.config._canvas_x
            : null
        const savedY = typeof n.position_y === "number"
          ? n.position_y
          : typeof n.config._canvas_y === "number"
            ? n.config._canvas_y
            : null
        const position = savedX !== null && savedY !== null
          ? { x: savedX, y: savedY }
          : { x: 380 + i * 300, y: 200 }

        rfNodes.push({
          id: n.id,
          type: "chatbotNode",
          position,
          data: {
            type: n.type as NodeType,
            label: NODE_DEFS[n.type as NodeType]?.label ?? n.type,
            config: n.type === "condition"
              ? { ...n.config, branches: n.branches ?? [] }
              : n.config,
          },
        })
      })

      setNodes(rfNodes)

      // Build edges — trigger → first node, then sequential
      const savedEdges = Array.isArray(data.flow?.edges_data)
        ? (data.flow.edges_data as Edge[])
        : []
      const rfEdges: Edge[] = savedEdges.length > 0
        ? savedEdges.map(edge => ({ ...edge, type: "deletable" }))
        : []
      if (rfEdges.length === 0) {
      if (dbNodes.length > 0) {
        rfEdges.push({
          id: `trigger-${dbNodes[0].id}`,
          source: "trigger",
          target: dbNodes[0].id,
          type: "deletable",
          markerEnd: { type: MarkerType.ArrowClosed, color: "#3B82F6" },
          style: { stroke: "#3B82F6", strokeWidth: 2 },
          animated: true,
        })
      }
      dbNodes.forEach((n: {
        id: string
        type: string
        next_node_id: string | null
        branches?: Branch[]
        config: NodeConfig
      }) => {
        if (n.type === "condition" && n.branches && n.branches.length > 0) {
          // Add one edge per branch
          n.branches.forEach((branch: Branch) => {
            if (branch.next_node_id) {
              rfEdges.push({
                id: `${n.id}-${branch.id}-${branch.next_node_id}`,
                source: n.id,
                sourceHandle: branch.id,
                target: branch.next_node_id,
                type: "deletable",
                label: branch.label,
                labelStyle: { fill: branch.color, fontWeight: 700, fontSize: 10 },
                labelBgStyle: { fill: "#111118", fillOpacity: 0.9 },
                markerEnd: { type: MarkerType.ArrowClosed, color: branch.color },
                style: { stroke: branch.color, strokeWidth: 2 },
                animated: true,
              })
            }
          })
        } else if (n.next_node_id) {
          rfEdges.push({
            id: `${n.id}-${n.next_node_id}`,
            source: n.id,
            target: n.next_node_id,
            type: "deletable",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#3B82F6" },
            style: { stroke: "#3B82F6", strokeWidth: 2 },
            animated: true,
          })
        }
      })
      }
      setEdges(rfEdges)
      setLoading(false)
    }
    load()
  }, [flowId, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      // Find source node to determine color
      const sourceNode = nodes.find(n => n.id === connection.source)
      const sourceData = sourceNode?.data as { type: NodeType; config: NodeConfig } | undefined

      let edgeColor = "#3B82F6"
      let edgeLabel = ""

      if (sourceData?.type === "condition" && connection.sourceHandle) {
        const branches = (sourceData.config.branches as Branch[] | undefined) ?? []
        const branch = branches.find(b => b.id === connection.sourceHandle)
        if (branch) {
          edgeColor = branch.color
          edgeLabel = branch.label
        }
      }

      setEdges(eds => addEdge({
        ...connection,
        type: "deletable",
        label: edgeLabel || undefined,
        labelStyle: edgeLabel ? { fill: edgeColor, fontWeight: 700, fontSize: 10 } : undefined,
        labelBgStyle: edgeLabel ? { fill: "#111118", fillOpacity: 0.9 } : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
        style: { stroke: edgeColor, strokeWidth: 2 },
        animated: true,
      }, eds))
    },
    [setEdges, nodes]
  )

  function addNode(type: NodeType) {
    const id = crypto.randomUUID()
    const maxX = nodes.reduce((max, n) => Math.max(max, n.position.x), 0)
    const defaultConfig: NodeConfig = type === "condition"
      ? {
          branches: [
            { id: crypto.randomUUID(), label: "Yes", color: "#10B981", conditions: [], next_node_id: null },
            { id: crypto.randomUUID(), label: "No", color: "#EF4444", conditions: [], next_node_id: null },
            { id: crypto.randomUUID(), label: "Default", color: "#5A5A72", conditions: [], next_node_id: null },
          ],
        }
      : {}
    const newNode: Node = {
      id,
      type: "chatbotNode",
      position: { x: maxX + 300, y: 200 },
      data: {
        type,
        label: NODE_DEFS[type].label,
        config: defaultConfig,
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

      // Build adjacency from edges - handle both regular and condition (branched) edges
      const edgeMap: Record<string, string> = {}
      const branchEdgeMap: Record<string, Record<string, string>> = {}

      edges.forEach(e => {
        if (e.source === "trigger") return
        if (e.sourceHandle) {
          // Condition branch edge
          if (!branchEdgeMap[e.source]) branchEdgeMap[e.source] = {}
          branchEdgeMap[e.source][e.sourceHandle] = e.target
        } else {
          edgeMap[e.source] = e.target
        }
      })

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
          nodes: orderedNodes.map((n, i) => {
            const nodeData = n.data as { type: string; config: NodeConfig }
            const branches = (nodeData.config.branches as Branch[] | undefined) ?? []

            // For condition nodes, resolve next_node_id per branch from edges
            const resolvedBranches = nodeData.type === "condition"
              ? branches.map((b: Branch) => ({
                  ...b,
                  next_node_id: branchEdgeMap[n.id]?.[b.id] ?? b.next_node_id ?? null,
                }))
              : branches

            // Find what this node connects to via regular edges
            const nextNodeId = edgeMap[n.id] ?? null

            // Find position of next node
            const nextNodeIndex = nextNodeId
              ? orderedNodes.findIndex(on => on.id === nextNodeId)
              : -1

            return {
              id: n.id,
              _original_id: n.id,
              type: nodeData.type,
              position: i,
              position_x: n.position.x,
              position_y: n.position.y,
              config: {
                ...nodeData.config,
                _canvas_x: n.position.x,
                _canvas_y: n.position.y,
              },
              branches: resolvedBranches,
              next_node_id: nodeData.type === "condition" ? null : nextNodeId,
              next_node_position: nextNodeIndex >= 0 ? nextNodeIndex : null,
            }
          }),
          edges: edges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle ?? null,
            targetHandle: edge.targetHandle ?? null,
            type: "deletable",
            label: edge.label,
            markerEnd: edge.markerEnd,
            style: edge.style,
            animated: edge.animated,
            labelStyle: edge.labelStyle,
            labelBgStyle: edge.labelBgStyle,
          })),
        }),
      })

      if (res.ok) {
        const saveData = await res.json()
        const idMap = (saveData.id_map ?? {}) as Record<string, string>
        if (Object.keys(idMap).length > 0) {
          setNodes(nds => nds.map(node => ({
            ...node,
            id: idMap[node.id] ?? node.id,
          })))
          setEdges(eds => eds.map(edge => ({
            ...edge,
            source: idMap[edge.source] ?? edge.source,
            target: idMap[edge.target] ?? edge.target,
          })))
          setSelectedNode(prev => prev ? { ...prev, id: idMap[prev.id] ?? prev.id } : null)
        }
        // Also update trigger settings if trigger node was edited
        const triggerNode = nodes.find(n => n.id === "trigger")
        if (triggerNode) {
          const triggerConfig = triggerNode.data as { config: NodeConfig }
          if (triggerConfig.config.keywords !== undefined || triggerConfig.config.trigger_type !== undefined) {
            await fetch(`/api/chatbot/flows/${flowId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                trigger_keywords: triggerConfig.config.keywords ?? flow?.trigger_keywords ?? [],
                trigger_type: triggerConfig.config.trigger_type ?? flow?.trigger_type ?? "keyword",
                trigger_match: triggerConfig.config.trigger_match ?? flow?.trigger_match ?? "contains",
                _canvas_trigger_pos: triggerNode
                  ? { x: triggerNode.position.x, y: triggerNode.position.y }
                  : undefined,
              }),
            })
            // Update local flow state
            if (flow) {
              setFlow({
                ...flow,
                trigger_keywords: (triggerConfig.config.keywords as string[]) ?? flow.trigger_keywords,
                trigger_type: (triggerConfig.config.trigger_type as string) ?? flow.trigger_type,
                trigger_match: (triggerConfig.config.trigger_match as string) ?? flow.trigger_match,
                _canvas_trigger_pos: { x: triggerNode.position.x, y: triggerNode.position.y },
              })
            }
          }
        }
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
            edgeTypes={edgeTypes}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            fitView
            style={{ background: "#0A0A0F" }}
            defaultEdgeOptions={{
              type: "deletable",
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
                overflow: "hidden",
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
          <div className="w-[320px] min-w-[320px] max-w-[320px] overflow-y-auto overflow-x-hidden border-l border-[#2A2A3C] bg-[#111118]">
            <ConfigPanel
              node={selectedNode}
              onUpdate={updateNodeConfig}
              onClose={() => setSelectedNode(null)}
              onDelete={deleteNode}
            />
          </div>
        )}
      </div>
      <style>{`
        .react-flow__controls-button {
          background: #111118 !important;
          border-bottom: 1px solid #2A2A3C !important;
          color: #9090A8 !important;
          fill: #9090A8 !important;
        }
        .react-flow__controls-button:hover {
          background: #1A1A24 !important;
          fill: #F0F0FA !important;
        }
        .react-flow__controls-button svg {
          fill: #9090A8 !important;
        }
        .react-flow__controls-button:hover svg {
          fill: #F0F0FA !important;
        }
        .react-flow__minimap {
          background: #111118 !important;
          border: 1px solid #2A2A3C !important;
          border-radius: 8px !important;
        }
        .react-flow__attribution {
          display: none !important;
        }
        .react-flow__handle {
          cursor: crosshair !important;
        }
        .react-flow__edge-path {
          cursor: pointer !important;
        }
      `}</style>
    </main>
  )
}
