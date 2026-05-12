import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import {
  ensureTriggerEdge,
  getFlowHealth,
  reconstructEdgesFromNodes,
  validateChatbotFlow,
  type ChatbotFlowEdge,
  type ChatbotFlowNode,
} from "@/lib/utils/chatbot-flow"

const ADMIN_ROLES = new Set(["admin"])

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile?.role || !ADMIN_ROLES.has(profile.role)) return null
  return user
}

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = getDb()
  const { data: flow } = await supabase
    .from("chatbot_flows")
    .select("*")
    .eq("id", params.id)
    .maybeSingle()

  const { data: nodes } = await supabase
    .from("chatbot_nodes")
    .select("*")
    .eq("flow_id", params.id)
    .order("position", { ascending: true })

  const { data: sessions } = await supabase
    .from("chatbot_sessions")
    .select("id, status, started_at, completed_at, last_activity_at, current_node_id, lead:leads(id, full_name)")
    .eq("flow_id", params.id)
    .order("started_at", { ascending: false })

  const flowNodes = (nodes ?? []) as ChatbotFlowNode[]
  let repairedNodes = flowNodes

  const allAtOrigin = flowNodes.length > 0 && flowNodes.every((node) =>
    (node.position_x ?? 0) === 0 && (node.position_y ?? 0) === 0
  )

  if (allAtOrigin) {
    repairedNodes = flowNodes.map((node, index) => ({
      ...node,
      position_x: index * 280,
      position_y: 200,
      config: {
        ...(node.config ?? {}),
        _canvas_x: index * 280,
        _canvas_y: 200,
      },
    }))

    await Promise.all(repairedNodes.map((node) =>
      supabase
        .from("chatbot_nodes")
        .update({
          position_x: node.position_x,
          position_y: node.position_y,
          config: node.config,
        })
        .eq("id", node.id)
    ))
  }

  const savedEdges = Array.isArray(flow?.edges_data) ? flow.edges_data as ChatbotFlowEdge[] : []
  const edges = savedEdges.length > 0
    ? ensureTriggerEdge(savedEdges, repairedNodes)
    : reconstructEdgesFromNodes(repairedNodes)

  if (flow && JSON.stringify(edges) !== JSON.stringify(savedEdges)) {
    await supabase
      .from("chatbot_flows")
      .update({ edges_data: edges, updated_at: new Date().toISOString() })
      .eq("id", params.id)
    flow.edges_data = edges
  }

  const sessionRows = sessions ?? []
  const stats = {
    sessions: sessionRows.length,
    completed: sessionRows.filter((session) => session.status === "completed").length,
    in_progress: sessionRows.filter((session) => ["active", "waiting_answer"].includes(session.status)).length,
    failed: sessionRows.filter((session) => session.status === "failed").length,
  }

  return NextResponse.json({ flow, nodes: repairedNodes, edges, stats, sessions: sessionRows.slice(0, 10) })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const supabase = getDb()

  if (body?.status === "active" && body?.activate_anyway !== true) {
    const [{ data: flow }, { data: nodes }] = await Promise.all([
      supabase.from("chatbot_flows").select("edges_data").eq("id", params.id).maybeSingle(),
      supabase.from("chatbot_nodes").select("*").eq("flow_id", params.id).order("position", { ascending: true }),
    ])
    const graphNodes = (nodes ?? []) as ChatbotFlowNode[]
    const savedEdges = Array.isArray(flow?.edges_data) ? flow.edges_data as ChatbotFlowEdge[] : []
    const graphEdges = savedEdges.length > 0 ? ensureTriggerEdge(savedEdges, graphNodes) : reconstructEdgesFromNodes(graphNodes)
    const issues = validateChatbotFlow(graphNodes, graphEdges)
    if (getFlowHealth(issues) === "error") {
      return NextResponse.json({ error: "Flow has validation errors", issues }, { status: 400 })
    }
  }

  const updates = { ...(body ?? {}) }
  delete updates.activate_anyway

  const { data: flow, error } = await supabase
    .from("chatbot_flows")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flow })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = getDb()
  await supabase.from("chatbot_flows").delete().eq("id", params.id)
  return NextResponse.json({ success: true })
}
