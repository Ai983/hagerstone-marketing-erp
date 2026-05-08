import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

const WRITE_ROLES = new Set(["admin", "manager", "marketing", "founder"])

async function getUserAndRole() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, role: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  return { supabase, user, role: profile?.role as string | null }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase } = await getUserAndRole()
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", params.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ template: data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!role || !WRITE_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const { data, error } = await supabase
    .from("email_templates")
    .update({
      name: body?.name,
      subject: body?.subject,
      body_html: body?.body_html,
      body_text: body?.body_text ?? null,
      category: body?.category ?? "general",
      variables: body?.variables ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ template: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!role || !WRITE_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await supabase
    .from("email_templates")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
