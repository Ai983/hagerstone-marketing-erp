import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const WRITE_ROLES = new Set(["admin", "manager", "marketing"])

// POST: enroll an array of lead_ids in this campaign
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  const role = profile?.role
  if (!role || !WRITE_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const leadIds = Array.isArray(body?.lead_ids) ? (body.lead_ids as string[]) : null
  if (!leadIds || leadIds.length === 0) {
    return NextResponse.json({ error: "lead_ids array is required" }, { status: 400 })
  }

  // Skip already-enrolled
  const { data: existing } = await supabase
    .from("campaign_enrollments")
    .select("lead_id")
    .eq("campaign_id", params.id)
    .in("lead_id", leadIds)

  const existingSet = new Set((existing ?? []).map((e) => e.lead_id))
  const newLeadIds = leadIds.filter((id) => !existingSet.has(id))

  if (newLeadIds.length === 0) {
    return NextResponse.json({ enrolled: 0, skipped: leadIds.length })
  }

  const rows = newLeadIds.map((leadId) => ({
    campaign_id: params.id,
    lead_id: leadId,
    enrolled_by: user.id,
    status: "active",
    current_message_position: 0,
  }))

  const { error } = await supabase.from("campaign_enrollments").insert(rows)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log an interaction per lead so the timeline shows it
  await supabase.from("interactions").insert(
    newLeadIds.map((leadId) => ({
      lead_id: leadId,
      user_id: user.id,
      type: "campaign_enrolled",
      campaign_id: params.id,
      title: "Enrolled in campaign",
    }))
  )

  return NextResponse.json({
    enrolled: newLeadIds.length,
    skipped: existingSet.size,
  })
}

// DELETE: unenroll a single lead.
// Accepts lead_id from JSON body (preferred) OR ?lead_id= query string.
//
// Returns { success: true, deleted: [...] } even when the delete matched
// 0 rows. A silent 0-row outcome on an existing enrollment usually means
// an RLS policy blocked the DELETE — see supabase/campaign_enrollments_delete_policy.sql
// for the fix if you see `deleted: []` in the server logs.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    const role = profile?.role
    if (!role || !WRITE_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Read lead_id from body first, fall back to query string
    let leadId: string | null = null
    try {
      const body = await request.json()
      if (body && typeof body.lead_id === "string") leadId = body.lead_id
    } catch {
      // body parse failure is fine — we'll try the query string next
    }
    if (!leadId) {
      const url = new URL(request.url)
      leadId = url.searchParams.get("lead_id")
    }
    if (!leadId) {
      return NextResponse.json({ error: "lead_id required" }, { status: 400 })
    }

    const campaignId = params.id
    console.log("Deleting enrollment:", { campaignId, lead_id: leadId })

    const { data, error } = await supabase
      .from("campaign_enrollments")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("lead_id", leadId)
      .select()

    console.log("Delete result:", {
      data,
      deletedCount: data?.length ?? 0,
      error,
    })

    if (error) {
      console.error("Delete error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Note: we intentionally no longer 404 on empty `data`. The row may have
    // already been removed by another tab, or — more importantly — an RLS
    // policy may be silently blocking the delete. The client toasts success
    // and re-fetches; the server log above tells us which case it was.
    return NextResponse.json({ success: true, deleted: data ?? [] })
  } catch (err) {
    console.error("Unenroll error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
