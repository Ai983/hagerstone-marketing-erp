import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"

// Who may permanently delete an (archived) lead. Irreversible.
const DELETE_ROLES = new Set(["admin", "founder", "manager"])

/**
 * Permanently deletes a lead and its dependent records.
 *
 * Interactions, tasks, campaign_enrollments and ai_suggestions are removed by
 * ON DELETE CASCADE. A few tables may reference the lead without a cascade
 * (notifications, price_revisions, chatbot_sessions, campaign_send_log) — we
 * best-effort clear those first so the final delete can't be blocked by an FK.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = params.id
  if (!leadId) {
    return NextResponse.json({ error: "Lead id is required" }, { status: 400 })
  }

  const supabase = await createUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || !DELETE_ROLES.has(profile.role)) {
    return NextResponse.json(
      { error: "Only managers, admins and founders can permanently delete leads" },
      { status: 403 }
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json(
      { error: "Service role credentials not configured" },
      { status: 503 }
    )
  }

  const service = createServiceClient(url, key, { db: { schema: "marketing" } })

  // Safety guard: only allow deleting leads that are archived first.
  const { data: lead } = await service
    .from("leads")
    .select("id, is_archived")
    .eq("id", leadId)
    .maybeSingle()

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }
  if (!lead.is_archived) {
    return NextResponse.json(
      { error: "Archive the lead before permanently deleting it." },
      { status: 400 }
    )
  }

  // Best-effort cleanup of non-cascading dependents (ignore missing tables).
  for (const table of ["notifications", "price_revisions", "chatbot_sessions", "campaign_send_log"]) {
    await service.from(table).delete().eq("lead_id", leadId)
  }

  const { error } = await service.from("leads").delete().eq("id", leadId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
