import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const WRITE_ROLES = new Set(["admin", "manager", "marketing"])

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, role: null as string | null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  return { supabase, user, role: profile?.role ?? null }
}

// ── GET: campaign + messages + enrollments ──────────────────────
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = params.id

  const [campaignRes, messagesRes, enrollmentsRes] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("campaign_messages")
      .select("*")
      .eq("campaign_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("campaign_enrollments")
      .select(
        "*, lead:lead_id(id, full_name, company_name, score, stage:stage_id(name, color))"
      )
      .eq("campaign_id", id)
      .order("enrolled_at", { ascending: false }),
  ])

  if (campaignRes.error || !campaignRes.data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  return NextResponse.json({
    campaign: campaignRes.data,
    messages: messagesRes.data ?? [],
    enrollments: enrollmentsRes.data ?? [],
  })
}

// ── PATCH: update campaign fields ────────────────────────────────
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, role } = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!role || !WRITE_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim()
  if (typeof body?.description === "string") patch.description = body.description.trim() || null
  if (typeof body?.status === "string") patch.status = body.status

  // goal + service_line live in audience_filters
  if (body?.goal !== undefined || body?.service_line !== undefined) {
    const { data: existing } = await supabase
      .from("campaigns")
      .select("audience_filters")
      .eq("id", params.id)
      .maybeSingle()
    const current =
      (existing?.audience_filters as Record<string, unknown> | null) ?? {}
    patch.audience_filters = {
      ...current,
      ...(body.goal !== undefined ? { goal: body.goal } : {}),
      ...(body.service_line !== undefined ? { service_line: body.service_line } : {}),
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }
  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from("campaigns")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data })
}

// ── DELETE: remove campaign (only if no active enrollments) ──────
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, user, role } = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!role || !WRITE_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { count } = await supabase
    .from("campaign_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", params.id)
    .eq("status", "active")

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} active enrollments. Pause or unenroll first.` },
      { status: 409 }
    )
  }

  const { error } = await supabase.from("campaigns").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
