import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

type SimNode = {
  id: string
  type: string
  position: number
  config: Record<string, unknown>
  branches?: {
    id: string
    label: string
    color: string
    conditions?: { field: string; operator: string; value: string }[]
    next_node_id: string | null
  }[]
  next_node_id: string | null
}

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "admin") return null
  return user
}

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function evaluateCondition(value: string, operator: string, expected: string) {
  const normalizedValue = value.toLowerCase()
  const normalizedExpected = expected.toLowerCase()
  if (operator === "contains") return normalizedValue.includes(normalizedExpected)
  if (operator === "equals") return normalizedValue === normalizedExpected
  if (operator === "starts_with") return normalizedValue.startsWith(normalizedExpected)
  if (operator === "not_equals") return normalizedValue !== normalizedExpected
  if (operator === "greater_than") return parseFloat(value) > parseFloat(expected)
  if (operator === "less_than") return parseFloat(value) < parseFloat(expected)
  return false
}

function chooseConditionBranch(node: SimNode, message: string, lastAnswer: string) {
  const branches = node.branches ?? []
  for (const branch of branches) {
    if (branch.conditions?.length) {
      const matches = branch.conditions.every((condition) => {
        const value = condition.field === "last_answer" ? lastAnswer : message
        return evaluateCondition(value, condition.operator, condition.value)
      })
      if (matches) return branch.next_node_id
    }
  }
  return branches.find((branch) => !branch.conditions || branch.conditions.length === 0)?.next_node_id ?? null
}

function actionLabel(node: SimNode) {
  const cfg = node.config ?? {}
  if (node.type === "move_stage") return `Move stage to ${String(cfg.stage_slug ?? "selected stage")}`
  if (node.type === "create_task") return `Create task: ${String(cfg.task_title ?? "Follow up with lead")}`
  if (node.type === "enroll_campaign") return "Enroll lead in campaign"
  if (node.type === "end") return "End flow"
  return null
}

function messageForNode(node: SimNode) {
  const cfg = node.config ?? {}
  if (node.type === "send_text") return String(cfg.message ?? "")
  if (node.type === "send_buttons") {
    const buttons = Array.isArray(cfg.buttons)
      ? `\n\nButtons: ${cfg.buttons.map((button) => (button as { title?: string }).title).filter(Boolean).join(" | ")}`
      : ""
    return `${String(cfg.message ?? "")}${buttons}`
  }
  if (node.type === "send_media") return String(cfg.caption ?? `[Media: ${cfg.media_type ?? "file"}]`)
  if (node.type === "ask_question") return String(cfg.question ?? "")
  return ""
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const message = String(body?.message ?? "")
  const sessionState = body?.session_state ?? {}
  const supabase = getDb()

  const { data } = await supabase
    .from("chatbot_nodes")
    .select("*")
    .eq("flow_id", params.id)
    .order("position", { ascending: true })

  const nodes = (data ?? []) as SimNode[]
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const actionsTaken: string[] = []
  const transcript: string[] = []

  let currentNodeId = typeof sessionState.current_node_id === "string"
    ? sessionState.current_node_id
    : nodes[0]?.id
  const lastAnswer = message || String(sessionState.last_answer ?? "")

  if (sessionState.waiting_for_answer && currentNodeId) {
    const waitingNode = nodeMap.get(currentNodeId)
    currentNodeId = waitingNode?.next_node_id ?? null
  }

  let guard = 0
  while (currentNodeId && guard < 20) {
    guard += 1
    const node = nodeMap.get(currentNodeId)
    if (!node) break

    const action = actionLabel(node)
    if (action) actionsTaken.push(action)

    const nextMessage = messageForNode(node)
    if (nextMessage) transcript.push(nextMessage)

    if (node.type === "ask_question") {
      return NextResponse.json({
        next_message: nextMessage,
        next_node_id: node.id,
        actions_taken: actionsTaken,
        session_state: {
          current_node_id: node.id,
          waiting_for_answer: true,
          last_answer: lastAnswer,
        },
        transcript,
      })
    }

    if (node.type === "condition") {
      currentNodeId = chooseConditionBranch(node, message, lastAnswer)
      continue
    }

    if (node.type === "end") {
      return NextResponse.json({
        next_message: nextMessage,
        next_node_id: node.id,
        actions_taken: actionsTaken,
        session_state: { current_node_id: node.id, completed: true, waiting_for_answer: false },
        transcript,
      })
    }

    currentNodeId = node.next_node_id
  }

  return NextResponse.json({
    next_message: transcript.at(-1) ?? "",
    next_node_id: currentNodeId,
    actions_taken: actionsTaken,
    session_state: { current_node_id: currentNodeId, completed: !currentNodeId, waiting_for_answer: false },
    transcript,
  })
}
