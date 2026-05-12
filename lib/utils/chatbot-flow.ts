export type ChatbotFlowNode = {
  id: string
  type: string
  position?: number
  position_x?: number | null
  position_y?: number | null
  config?: Record<string, unknown> | null
  branches?: {
    id: string
    label?: string
    color?: string
    conditions?: unknown[]
    next_node_id?: string | null
  }[] | null
  next_node_id?: string | null
}

export type ChatbotFlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  animated?: boolean
  style?: Record<string, unknown>
  markerEnd?: Record<string, unknown>
  label?: string
  labelStyle?: Record<string, unknown>
  labelBgStyle?: Record<string, unknown>
}

export type FlowValidationIssue = {
  level: "warning" | "error"
  message: string
}

function regularEdge(source: string, target: string): ChatbotFlowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "deletable",
    animated: true,
    style: { stroke: "#3B82F6", strokeWidth: 2 },
    markerEnd: { type: "arrowclosed", color: "#3B82F6" },
  }
}

export function reconstructEdgesFromNodes(nodes: ChatbotFlowNode[]): ChatbotFlowEdge[] {
  const edges: ChatbotFlowEdge[] = []
  const sortedNodes = [...nodes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  if (sortedNodes[0]) {
    edges.push(regularEdge("trigger", sortedNodes[0].id))
  }

  sortedNodes.forEach((node) => {
    if (node.next_node_id) {
      edges.push(regularEdge(node.id, node.next_node_id))
    }

    if (node.type === "condition" && node.branches?.length) {
      node.branches.forEach((branch) => {
        if (!branch.next_node_id) return
        const color = branch.color || "#3B82F6"
        edges.push({
          id: `${node.id}-${branch.id}-${branch.next_node_id}`,
          source: node.id,
          target: branch.next_node_id,
          sourceHandle: branch.id,
          label: branch.label,
          type: "deletable",
          animated: true,
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: "arrowclosed", color },
          labelStyle: { fill: color, fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: "#111118", fillOpacity: 0.9 },
        })
      })
    }
  })

  return edges
}

export function ensureTriggerEdge(edges: ChatbotFlowEdge[], nodes: ChatbotFlowNode[]): ChatbotFlowEdge[] {
  if (edges.some((edge) => edge.source === "trigger")) return edges
  const firstNode = [...nodes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]
  return firstNode ? [regularEdge("trigger", firstNode.id), ...edges] : edges
}

export function validateChatbotFlow(
  nodes: ChatbotFlowNode[],
  edges: ChatbotFlowEdge[]
): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = []

  if (nodes.length < 2) {
    issues.push({ level: "error", message: "Flow must have at least 2 nodes" })
  }

  const nonEndNodes = nodes.filter((node) => node.type !== "end" && node.id !== "trigger")
  nonEndNodes.forEach((node) => {
    const hasOutgoing = edges.some((edge) => edge.source === node.id)
    if (!hasOutgoing && node.type !== "condition") {
      const label = typeof node.config?.label === "string" ? node.config.label : node.type
      issues.push({ level: "warning", message: `Node "${label}" has no connection` })
    }
  })

  nodes.filter((node) => node.type === "condition").forEach((node) => {
    const branches = node.branches ?? (
      Array.isArray(node.config?.branches) ? node.config.branches as ChatbotFlowNode["branches"] : []
    )
    const connectedBranches = (branches ?? []).filter((branch) => branch.next_node_id)
    if (connectedBranches.length === 0) {
      issues.push({ level: "error", message: "Condition node has no connected branches" })
    }
  })

  nodes.filter((node) => node.type === "send_text").forEach((node) => {
    const message = typeof node.config?.message === "string" ? node.config.message : ""
    if (!message.trim()) {
      issues.push({ level: "error", message: "A \"Send Text\" node has an empty message" })
    }
  })

  return issues
}

export function getFlowHealth(issues: FlowValidationIssue[]) {
  if (issues.some((issue) => issue.level === "error")) return "error"
  if (issues.length > 0) return "warning"
  return "healthy"
}
