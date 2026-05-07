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

  // Bulk update all nodes for a flow (used when saving flow)
  const body = await req.json()
  const supabase = getDb()

  // Delete existing nodes and reinsert
  await supabase.from("chatbot_nodes").delete().eq("flow_id", params.id)

  if (body.nodes && body.nodes.length > 0) {
    const { error } = await supabase
      .from("chatbot_nodes")
      .insert(
        body.nodes.map((n: {
          type: string
          position: number
          config: Record<string, unknown>
          branches?: unknown[]
          next_node_id?: string | null
          temp_id?: string
        }, idx: number) => ({
          id: n.temp_id,
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
            next_node_id: b.next_node_id && b.next_node_id !== "" ? b.next_node_id : null,
          })),
          next_node_id: null, // Will be updated after insert with real IDs
        }))
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: nodes } = await supabase
    .from("chatbot_nodes")
    .select("*")
    .eq("flow_id", params.id)
    .order("position", { ascending: true })

  // Wire up next_node_id from saved node data (NOT sequential auto-wiring)
  // The frontend saves next_node_id per node based on actual edge connections
  if (nodes && nodes.length > 0) {
    for (let i = 0; i < body.nodes.length; i++) {
      const frontendNode = body.nodes[i]
      const dbNode = nodes[i]
      if (!dbNode) continue

      const nextId = frontendNode.next_node_id && frontendNode.next_node_id !== ""
        ? frontendNode.next_node_id
        : null

      if (frontendNode.type !== "condition" && frontendNode.type !== "end") {
        await supabase
          .from("chatbot_nodes")
          .update({ next_node_id: nextId })
          .eq("id", dbNode.id)
      }
    }
  }

  return NextResponse.json({ nodes })
}
