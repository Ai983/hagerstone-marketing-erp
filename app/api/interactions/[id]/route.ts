import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

import { createClient as createUserClient } from "@/lib/supabase/server"
import { EDITABLE_INTERACTION_TYPES } from "@/lib/utils/interaction-edit"

// Edit, move or delete a timeline entry that a person logged by hand —
// for a note written on the wrong lead or with a mistake in it.
//
// Rules: only the person who wrote it, or an Admin; only hand-logged
// entries (system entries like stage changes and "lead created" stay);
// every change is written to the audit log with the old text.

type Actor = { id: string; role: string }

async function authorise(interactionId: string) {
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const { data: profile } = await userClient
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.is_active) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { error: NextResponse.json({ error: "Service role not configured" }, { status: 503 }) }
  }
  const service = createServiceClient(url, key, { db: { schema: "marketing" } })

  const { data: interaction } = await service
    .from("interactions")
    .select("id, lead_id, user_id, type, title, notes, outcome, is_automated, created_at")
    .eq("id", interactionId)
    .maybeSingle()
  if (!interaction) return { error: NextResponse.json({ error: "Entry not found" }, { status: 404 }) }

  if (!EDITABLE_INTERACTION_TYPES.has(interaction.type) || interaction.is_automated) {
    return { error: NextResponse.json({ error: "System entries can't be changed" }, { status: 403 }) }
  }
  const actor: Actor = { id: profile.id, role: profile.role }
  if (interaction.user_id !== actor.id && actor.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Only the person who wrote this, or an Admin, can change it" },
        { status: 403 }
      ),
    }
  }
  return { service, interaction, actor }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorise(params.id)
  if ("error" in auth) return auth.error
  const { service, interaction, actor } = auth

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (typeof body.notes === "string") {
    const notes = body.notes.trim()
    if (!notes) return NextResponse.json({ error: "Note can't be empty" }, { status: 400 })
    patch.notes = notes
  }

  if (typeof body.lead_id === "string" && body.lead_id !== interaction.lead_id) {
    const { data: target } = await service
      .from("leads")
      .select("id, full_name")
      .eq("id", body.lead_id)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: "That lead doesn't exist" }, { status: 400 })
    patch.lead_id = target.id
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 })
  }

  const { error } = await service.from("interactions").update(patch).eq("id", interaction.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A follow-up created from this entry belongs to the same lead.
  if (patch.lead_id) {
    await service.from("tasks").update({ lead_id: patch.lead_id }).eq("interaction_id", interaction.id)
  }

  await service.from("audit_log").insert({
    entity_type: "interaction",
    entity_id: interaction.id,
    action: patch.lead_id ? "interaction_moved" : "interaction_edited",
    actor_id: actor.id,
    actor_type: "user",
    old_values: { lead_id: interaction.lead_id, notes: interaction.notes },
    new_values: patch,
  })

  return NextResponse.json({ success: true, from_lead_id: interaction.lead_id, ...patch })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorise(params.id)
  if ("error" in auth) return auth.error
  const { service, interaction, actor } = auth

  // tasks.interaction_id has no ON DELETE rule — keep the task, drop the link.
  await service.from("tasks").update({ interaction_id: null }).eq("interaction_id", interaction.id)

  const { error } = await service.from("interactions").delete().eq("id", interaction.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await service.from("audit_log").insert({
    entity_type: "interaction",
    entity_id: interaction.id,
    action: "interaction_deleted",
    actor_id: actor.id,
    actor_type: "user",
    old_values: interaction,
    new_values: null,
  })

  return NextResponse.json({ success: true, lead_id: interaction.lead_id })
}
