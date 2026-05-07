import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

const ADMIN_ROLES = new Set(["admin"])

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile?.role || !ADMIN_ROLES.has(profile.role)) return null
  return user
}

export async function GET() {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: flows, error } = await supabase
    .from("chatbot_flows")
    .select("*, nodes:chatbot_nodes(count)")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flows })
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: flow, error } = await supabase
    .from("chatbot_flows")
    .insert({
      name: body.name,
      description: body.description ?? null,
      status: "inactive",
      trigger_type: body.trigger_type ?? "keyword",
      trigger_keywords: body.trigger_keywords ?? [],
      trigger_match: body.trigger_match ?? "contains",
      priority: body.priority ?? 0,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flow })
}
