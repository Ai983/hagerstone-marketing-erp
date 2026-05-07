import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type IncomingBranch = {
  id: string
  label: string
  color: string
  conditions: unknown[]
  next_node_id?: string | null
}

type IncomingNode = {
  id?: string
  _original_id?: string
  type: string
  position: number
  position_x?: number
  position_y?: number
  config: Record<string, unknown>
  branches?: IncomingBranch[]
  next_node_id?: string | null
}

type IncomingEdge = {
  id?: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  label?: string
  markerEnd?: unknown
  style?: unknown
  animated?: boolean
  labelStyle?: unknown
  labelBgStyle?: unknown
}

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile?.role || profile.role !== "admin") return null
  return user
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const supabase = getDb()

  const { data: lastNode } = await supabase
    .from("chatbot_nodes")
    .select("position")
    .eq("flow_id", params.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (lastNode?.position ?? 0) + 1

  const { data: node, error } = await supabase
    .from("chatbot_nodes")
    .insert({
      flow_id: params.id,
      type: body.type,
      position,
      position_x: body.position_x ?? 0,
      position_y: body.position_y ?? 0,
      config: body.config ?? {},
      branches: body.branches ?? [],
      next_node_id: body.next_node_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ node })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const supabase = getDb()

  const incomingNodes = (body.nodes ?? []) as IncomingNode[]
  const incomingEdges = (body.edges ?? []) as IncomingEdge[]

  const { data: existingNodes, error: existingError } = await supabase
    .from("chatbot_nodes")
    .select("id")
    .eq("flow_id", params.id)

  if (existingError) {
    console.error("Fetch existing nodes error:", existingError)
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const existingIds = new Set((existingNodes ?? []).map((n: { id: string }) => n.id))
  const finalIds = new Set<string>()
  const idMap: Record<string, string> = { trigger: "trigger" }

  for (const node of incomingNodes) {
    const clientId = node.id ?? node._original_id
    if (!clientId) continue

    const positionX = node.position_x ?? (
      typeof node.config?._canvas_x === "number" ? node.config._canvas_x : 0
    )
    const positionY = node.position_y ?? (
      typeof node.config?._canvas_y === "number" ? node.config._canvas_y : 0
    )

    const basePayload = {
      flow_id: params.id,
      type: node.type,
      position: node.position,
      position_x: positionX,
      position_y: positionY,
      config: {
        ...(node.config ?? {}),
        _canvas_x: positionX,
        _canvas_y: positionY,
      },
      branches: [],
      next_node_id: null,
    }

    if (existingIds.has(clientId)) {
      const { error: updateError } = await supabase
        .from("chatbot_nodes")
        .update(basePayload)
        .eq("id", clientId)
        .eq("flow_id", params.id)

      if (updateError) {
        console.error("Update node error:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      idMap[clientId] = clientId
      finalIds.add(clientId)
    } else {
      const { data: insertedNode, error: insertError } = await supabase
        .from("chatbot_nodes")
        .insert(basePayload)
        .select("id")
        .single()

      if (insertError) {
        console.error("Insert node error:", insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      idMap[clientId] = insertedNode.id
      finalIds.add(insertedNode.id)
    }
  }

  for (const node of incomingNodes) {
    const clientId = node.id ?? node._original_id
    if (!clientId) continue

    const finalId = idMap[clientId]
    if (!finalId) continue

    const branches = (node.branches ?? []).map((branch) => ({
      ...branch,
      next_node_id: branch.next_node_id
        ? idMap[branch.next_node_id] ?? branch.next_node_id
        : null,
    }))

    const nextNodeId = node.type === "condition" || node.type === "end"
      ? null
      : node.next_node_id
        ? idMap[node.next_node_id] ?? node.next_node_id
        : null

    const { error: referenceError } = await supabase
      .from("chatbot_nodes")
      .update({
        branches,
        next_node_id: nextNodeId,
      })
      .eq("id", finalId)
      .eq("flow_id", params.id)

    if (referenceError) {
      console.error("Update node references error:", referenceError)
      return NextResponse.json({ error: referenceError.message }, { status: 500 })
    }
  }

  const idsToDelete = Array.from(existingIds).filter(id => !finalIds.has(id))
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("chatbot_nodes")
      .delete()
      .eq("flow_id", params.id)
      .in("id", idsToDelete)

    if (deleteError) {
      console.error("Delete removed nodes error:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }
  }

  const remappedEdges: (IncomingEdge & { id: string })[] = incomingEdges
    .map((edge) => {
      const source = idMap[edge.source] ?? edge.source
      const target = idMap[edge.target] ?? edge.target

      if (!source || !target) return null

      return {
        ...edge,
        id: `${source}-${edge.sourceHandle ? `${edge.sourceHandle}-` : ""}${target}`,
        source,
        target,
      }
    })
    .filter((edge): edge is IncomingEdge & { id: string } => edge !== null)

  const { error: flowError } = await supabase
    .from("chatbot_flows")
    .update({
      edges_data: remappedEdges,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)

  if (flowError) {
    console.error("Update flow edges error:", flowError)
    return NextResponse.json({ error: flowError.message }, { status: 500 })
  }

  const { data: finalNodes, error: finalError } = await supabase
    .from("chatbot_nodes")
    .select("*")
    .eq("flow_id", params.id)
    .order("position", { ascending: true })

  if (finalError) {
    console.error("Fetch final nodes error:", finalError)
    return NextResponse.json({ error: finalError.message }, { status: 500 })
  }

  return NextResponse.json({ nodes: finalNodes ?? [], edges: remappedEdges, id_map: idMap })
}
