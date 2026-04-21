import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"

async function requireAdmin() {
  const supabase = await createUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  return profile?.role === "admin" ? user : null
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const email = body?.email as string | undefined
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json(
      { error: "Service role credentials not configured" },
      { status: 503 }
    )
  }

  const serviceClient = createServiceClient(url, key)
  const { error } = await serviceClient.auth.admin.inviteUserByEmail(email.trim())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
