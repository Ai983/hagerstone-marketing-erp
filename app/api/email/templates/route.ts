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

export async function GET() {
  const { supabase } = await getUserAndRole()
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { supabase, user, role } = await getUserAndRole()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!role || !WRITE_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const name = body?.name?.trim()
  const subject = body?.subject?.trim()
  const bodyHtml = body?.body_html?.trim()

  if (!name || !subject || !bodyHtml) {
    return NextResponse.json(
      { error: "name, subject and body_html are required" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name,
      subject,
      body_html: bodyHtml,
      body_text: body?.body_text ?? null,
      category: body?.category ?? "general",
      variables: body?.variables ?? [],
      created_by: user.id,
    })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ template: data })
}
