import { createClient } from "@supabase/supabase-js"
import { sendWhatsAppMessage, sendWhatsAppWithButtons, sendWhatsAppMedia } from "@/lib/utils/maytapi"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Check if incoming message matches any active chatbot flow trigger
export async function matchAndRunChatbot(
  phone: string,
  messageText: string,
  leadId: string,
  buttonReplyId?: string
): Promise<boolean> {
  const supabase = getServiceClient()

  try {
    // Check if lead has an active waiting session first
    const { data: activeSession } = await supabase
      .from("chatbot_sessions")
      .select("*, flow:chatbot_flows(*), current_node:chatbot_nodes(*)")
      .eq("lead_id", leadId)
      .eq("status", "waiting_answer")
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeSession) {
      // Lead is in a flow waiting for an answer - process the answer
      await processAnswer(supabase, activeSession, messageText, phone, leadId)
      return true
    }

    // Check for button reply matching a chatbot node
    if (buttonReplyId?.startsWith("flow_")) {
      const nodeId = buttonReplyId.replace("flow_", "")
      const { data: node } = await supabase
        .from("chatbot_nodes")
        .select("*, flow:chatbot_flows(*)")
        .eq("id", nodeId)
        .maybeSingle()

      if (node) {
        await executeNode(supabase, node, messageText, phone, leadId, node.flow_id)
        return true
      }
    }

    // Find matching active flow by keyword
    const { data: flows } = await supabase
      .from("chatbot_flows")
      .select("*")
      .eq("status", "active")
      .order("priority", { ascending: false })

    if (!flows || flows.length === 0) return false

    const text = messageText.toLowerCase().trim()
    let matchedFlow = null

    for (const flow of flows) {
      if (flow.trigger_type === "any_message") {
        matchedFlow = flow
        break
      }

      if (flow.trigger_type === "first_message") {
        const { count } = await supabase
          .from("chatbot_sessions")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", leadId)
        if ((count ?? 0) === 0) {
          matchedFlow = flow
          break
        }
      }

      if (flow.trigger_type === "keyword" && flow.trigger_keywords?.length > 0) {
        const matched = flow.trigger_keywords.some((kw: string) => {
          const k = kw.toLowerCase().trim()
          if (flow.trigger_match === "exact") return text === k
          if (flow.trigger_match === "starts_with") return text.startsWith(k)
          return text.includes(k) // contains (default)
        })
        if (matched) {
          matchedFlow = flow
          break
        }
      }
    }

    if (!matchedFlow) return false

    // Get first node of matched flow
    const { data: firstNode } = await supabase
      .from("chatbot_nodes")
      .select("*")
      .eq("flow_id", matchedFlow.id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!firstNode) return false

    // Create session
    const { data: session } = await supabase
      .from("chatbot_sessions")
      .insert({
        flow_id: matchedFlow.id,
        lead_id: leadId,
        current_node_id: firstNode.id,
        status: "active",
      })
      .select()
      .single()

    if (!session) return false

    // Execute first node
    await executeNode(supabase, firstNode, messageText, phone, leadId, matchedFlow.id, session.id)
    return true

  } catch (error) {
    console.error("Chatbot engine error:", error)
    return false
  }
}

async function processAnswer(
  supabase: ReturnType<typeof getServiceClient>,
  session: {
    id: string
    flow_id: string
    lead_id: string
    current_node_id: string
    waiting_for_field: string | null
    current_node: {
      id: string
      next_node_id: string | null
      config: {
        question?: string
        save_to_field?: string
      }
    }
  },
  answer: string,
  phone: string,
  leadId: string
) {
  // Save the answer
  await supabase.from("chatbot_answers").insert({
    session_id: session.id,
    lead_id: leadId,
    flow_id: session.flow_id,
    node_id: session.current_node_id,
    question: session.current_node?.config?.question ?? "",
    answer,
    field_saved: session.waiting_for_field,
  })

  // Save answer to lead field if configured
  if (session.waiting_for_field) {
    const allowedFields = [
      "city", "estimated_budget", "company_name",
      "email", "initial_notes", "service_line"
    ]
    if (allowedFields.includes(session.waiting_for_field)) {
      await supabase
        .from("leads")
        .update({ [session.waiting_for_field]: answer })
        .eq("id", leadId)
    }
  }

  // Move to next node
  const nextNodeId = session.current_node?.next_node_id
  if (!nextNodeId) {
    await supabase
      .from("chatbot_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", session.id)
    return
  }

  const { data: nextNode } = await supabase
    .from("chatbot_nodes")
    .select("*")
    .eq("id", nextNodeId)
    .maybeSingle()

  if (!nextNode) return

  await supabase
    .from("chatbot_sessions")
    .update({
      current_node_id: nextNodeId,
      status: "active",
      waiting_for_field: null,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", session.id)

  await executeNode(supabase, nextNode, answer, phone, leadId, session.flow_id, session.id)
}

async function executeNode(
  supabase: ReturnType<typeof getServiceClient>,
  node: {
    id: string
    type: string
    branches?: {
      id: string
      label: string
      color: string
      conditions: { field: string; operator: string; value: string }[]
      next_node_id: string | null
    }[]
    config: {
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
    }
    next_node_id: string | null
    flow_id?: string
  },
  text: string,
  phone: string,
  leadId: string,
  flowId: string,
  sessionId?: string
) {
  const cfg = node.config

  switch (node.type) {
    case "send_text":
      if (cfg.message) {
        await sendWhatsAppMessage(phone, cfg.message)
      }
      break

    case "send_media":
      if (cfg.media_url) {
        await sendWhatsAppMedia(
          phone,
          cfg.media_type === "image" ? "image" : "document",
          cfg.media_url,
          { caption: cfg.caption, filename: cfg.media_filename }
        )
      }
      break

    case "send_buttons":
      if (cfg.message && cfg.buttons?.length) {
        const buttons = cfg.buttons.map((b: { id: string; title: string }) => ({
          id: `flow_${b.id}`,
          title: b.title,
        }))
        await sendWhatsAppWithButtons(phone, cfg.message, buttons)
      }
      break

    case "ask_question":
      if (cfg.question) {
        await sendWhatsAppMessage(phone, cfg.question)
        if (sessionId) {
          await supabase
            .from("chatbot_sessions")
            .update({
              status: "waiting_answer",
              waiting_for_field: cfg.save_to_field ?? null,
              current_node_id: node.id,
              last_activity_at: new Date().toISOString(),
            })
            .eq("id", sessionId)
        }
        return // Stop here - wait for answer
      }
      break

    case "move_stage":
      if (cfg.stage_slug) {
        const { data: stage } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("slug", cfg.stage_slug)
          .maybeSingle()
        if (stage) {
          await supabase
            .from("leads")
            .update({ stage_id: stage.id })
            .eq("id", leadId)
        }
      }
      break

    case "create_task": {
      const { data: lead } = await supabase
        .from("leads")
        .select("assigned_to")
        .eq("id", leadId)
        .maybeSingle()

      await supabase.from("tasks").insert({
        lead_id: leadId,
        assigned_to: lead?.assigned_to ?? null,
        title: cfg.task_title ?? "Follow up with lead",
        type: cfg.task_type ?? "call",
        due_at: new Date(
          Date.now() + (cfg.task_due_hours ?? 2) * 60 * 60 * 1000
        ).toISOString(),
        completed_at: null,
      })
      break
    }

    case "enroll_campaign":
      if (cfg.campaign_id) {
        const { data: existing } = await supabase
          .from("campaign_enrollments")
          .select("id")
          .eq("campaign_id", cfg.campaign_id)
          .eq("lead_id", leadId)
          .maybeSingle()

        if (!existing) {
          const { data: firstMsg } = await supabase
            .from("campaign_messages")
            .select("delay_days")
            .eq("campaign_id", cfg.campaign_id)
            .eq("position", 1)
            .maybeSingle()

          await supabase.from("campaign_enrollments").insert({
            campaign_id: cfg.campaign_id,
            lead_id: leadId,
            status: "active",
            current_message_position: 0,
            next_message_due_at: new Date(
              Date.now() + (firstMsg?.delay_days ?? 0) * 24 * 60 * 60 * 1000
            ).toISOString(),
          })
        }
      }
      break

    case "condition": {
      if (!node.branches || node.branches.length === 0) break

      // Get current lead data for evaluation
      const { data: leadData } = await supabase
        .from("leads")
        .select("stage:stage_id(slug), category, city, estimated_budget")
        .eq("id", leadId)
        .maybeSingle()

      // Get last answer from chatbot_answers
      const { data: lastAnswer } = await supabase
        .from("chatbot_answers")
        .select("answer")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const leadStage = Array.isArray(leadData?.stage)
        ? leadData?.stage[0]?.slug
        : (leadData?.stage as unknown as { slug?: string } | null)?.slug

      // Evaluate each branch in order, find first matching
      let matchedBranch = null

      for (const branch of node.branches) {
        // Default branch - always matches if no conditions
        if (!branch.conditions || branch.conditions.length === 0) {
          if (!matchedBranch) matchedBranch = branch
          continue
        }

        // Check all conditions in this branch (AND logic)
        const allMatch = branch.conditions.every((cond: {
          field: string
          operator: string
          value: string
        }) => {
          let fieldValue = ""

          switch (cond.field) {
            case "message_text":
              fieldValue = text.toLowerCase()
              break
            case "lead_stage":
              fieldValue = leadStage ?? ""
              break
            case "lead_category":
              fieldValue = leadData?.category ?? ""
              break
            case "lead_city":
              fieldValue = leadData?.city?.toLowerCase() ?? ""
              break
            case "lead_budget":
              fieldValue = String(leadData?.estimated_budget ?? "0")
              break
            case "last_answer":
              fieldValue = (lastAnswer?.answer ?? "").toLowerCase()
              break
          }

          const condValue = cond.value.toLowerCase()

          switch (cond.operator) {
            case "contains":
              return fieldValue.includes(condValue)
            case "equals":
              return fieldValue === condValue
            case "starts_with":
              return fieldValue.startsWith(condValue)
            case "not_equals":
              return fieldValue !== condValue
            case "greater_than":
              return parseFloat(fieldValue) > parseFloat(cond.value)
            case "less_than":
              return parseFloat(fieldValue) < parseFloat(cond.value)
            default:
              return false
          }
        })

        if (allMatch) {
          matchedBranch = branch
          break
        }
      }

      // If no branch matched, use default (last branch with no conditions)
      if (!matchedBranch) {
        matchedBranch = node.branches.find((b: { conditions: unknown[] }) =>
          !b.conditions || b.conditions.length === 0
        )
      }

      console.log("Condition node - matched branch:", matchedBranch?.label)

      if (matchedBranch?.next_node_id) {
        const { data: branchNode } = await supabase
          .from("chatbot_nodes")
          .select("*")
          .eq("id", matchedBranch.next_node_id)
          .maybeSingle()

        if (branchNode) {
          if (sessionId) {
            await supabase
              .from("chatbot_sessions")
              .update({
                current_node_id: matchedBranch.next_node_id,
                last_activity_at: new Date().toISOString(),
              })
              .eq("id", sessionId)
          }
          await new Promise(r => setTimeout(r, 800))
          await executeNode(supabase, branchNode, text, phone, leadId, flowId, sessionId)
        }
      }
      return // Don't auto-advance for condition nodes
    }

    case "end":
      if (sessionId) {
        await supabase
          .from("chatbot_sessions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
      }
      return
  }

  // Auto advance to next node if not ask_question
  if (node.next_node_id && node.type !== "ask_question") {
    const { data: nextNode } = await supabase
      .from("chatbot_nodes")
      .select("*")
      .eq("id", node.next_node_id)
      .maybeSingle()

    if (nextNode) {
      if (sessionId) {
        await supabase
          .from("chatbot_sessions")
          .update({
            current_node_id: node.next_node_id,
            last_activity_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
      }
      // Small delay between nodes
      await new Promise((r) => setTimeout(r, 1500))
      await executeNode(supabase, nextNode, text, phone, leadId, flowId, sessionId)
    } else {
      if (sessionId) {
        await supabase
          .from("chatbot_sessions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", sessionId)
      }
    }
  }
}
