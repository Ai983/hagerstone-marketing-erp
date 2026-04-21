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

// ── GET: list campaigns with enrollment count ────────────────────
export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Bulk fetch enrollment + message counts so we don't N+1
  const campaignIds = (campaigns ?? []).map((c) => c.id)
  let enrollmentCounts = new Map<string, number>()
  let messageCounts = new Map<string, number>()

  if (campaignIds.length > 0) {
    const [{ data: enrolls }, { data: msgs }] = await Promise.all([
      supabase.from("campaign_enrollments").select("campaign_id").in("campaign_id", campaignIds),
      supabase.from("campaign_messages").select("campaign_id").in("campaign_id", campaignIds),
    ])

    enrollmentCounts = (enrolls ?? []).reduce((map, row) => {
      map.set(row.campaign_id, (map.get(row.campaign_id) ?? 0) + 1)
      return map
    }, new Map<string, number>())

    messageCounts = (msgs ?? []).reduce((map, row) => {
      map.set(row.campaign_id, (map.get(row.campaign_id) ?? 0) + 1)
      return map
    }, new Map<string, number>())
  }

  return NextResponse.json({
    campaigns: (campaigns ?? []).map((c) => ({
      ...c,
      enrollment_count: enrollmentCounts.get(c.id) ?? 0,
      message_count: messageCounts.get(c.id) ?? 0,
    })),
  })
}

// ── POST: create campaign ────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { supabase, user, role } = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!role || !WRITE_ROLES.has(role)) {
    return NextResponse.json(
      { error: "Only marketing/manager/admin can create campaigns" },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const name = (body?.name as string | undefined)?.trim()
  if (!name) {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
  }

  const description = (body?.description as string | undefined)?.trim() || null
  const goal = (body?.goal as string | undefined) || "lead_nurture"
  const serviceLine = (body?.service_line as string | undefined) || "all"
  const status = (body?.status as string | undefined) || "draft"

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      name,
      description,
      type: "whatsapp_drip",
      status,
      created_by: user.id,
      audience_filters: { goal, service_line: serviceLine },
    })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campaign }, { status: 201 })
}
