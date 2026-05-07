import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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

  // Get current max position
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
      config: body.config ?? {},
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

  // Step 1 — Hard delete ALL existing nodes for this flow
  const { error: deleteError } = await supabase
    .from("chatbot_nodes")
    .delete()
    .eq("flow_id", params.id)

  if (deleteError) {
    console.error("Delete nodes error:", deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // Step 2 — If no nodes to insert, return empty
  if (!body.nodes || body.nodes.length === 0) {
    return NextResponse.json({ nodes: [] })
  }

  // Step 3 — Generate fresh UUIDs for all nodes
  const nodeInserts = body.nodes.map((n: {
    type: string
    position: number
    config: Record<string, unknown>
    branches?: unknown[]
    next_node_id?: string | null
  }, idx: number) => ({
    flow_id: params.id,
    type: n.type,
    position: n.position ?? idx,
    config: n.config ?? {},
    branches: ((n.branches ?? []) as {
      id: string
      label: string
      color: string
      conditions: unknown[]
      next_node_id?: string | null
    }[]).map((b) => ({
      ...b,
      next_node_id: null, // Will be resolved after insert
    })),
    next_node_id: null, // Will be resolved after insert
  }))

  // Step 4 — Insert fresh nodes
  const { data: insertedNodes, error: insertError } = await supabase
    .from("chatbot_nodes")
    .insert(nodeInserts)
    .select()

  if (insertError) {
    console.error("Insert nodes error:", insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  if (!insertedNodes || insertedNodes.length === 0) {
    return NextResponse.json({ nodes: [] })
  }

  // Step 5 — Build position-to-new-id map
  const positionToNewId: Record<number, string> = {}
  insertedNodes.forEach((n: { id: string; position: number }) => {
    positionToNewId[n.position] = n.id
  })

  // Step 6 — Wire up next_node_id for regular nodes using position map
  for (let i = 0; i < body.nodes.length; i++) {
    const frontendNode = body.nodes[i]
    const dbNode = insertedNodes[i]
    if (!dbNode) continue

    if (frontendNode.type === "condition" || frontendNode.type === "end") continue

    // Find next_node_id by matching old node id to new position-based id
    const nextId = frontendNode.next_node_id
      ? positionToNewId[
          body.nodes.findIndex((n: { position?: number }, idx: number) =>
            // Match by original position or index
            frontendNode.next_node_id && idx !== i
              ? body.nodes[idx]._original_id === frontendNode.next_node_id ||
                (body.nodes[idx].position ?? idx) === (frontendNode.next_node_position ?? -1)
              : false
          )
        ] ?? null
      : null

    if (nextId) {
      await supabase
        .from("chatbot_nodes")
        .update({ next_node_id: nextId })
        .eq("id", dbNode.id)
    }
  }

  // Step 7 — Fetch final state
  const { data: finalNodes } = await supabase
    .from("chatbot_nodes")
    .select("*")
    .eq("flow_id", params.id)
    .order("position", { ascending: true })

  return NextResponse.json({ nodes: finalNodes ?? [] })
}
