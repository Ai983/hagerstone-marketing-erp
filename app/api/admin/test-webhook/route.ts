import { NextRequest, NextResponse } from "next/server"
import { createClient as createUserClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
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
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const secret = process.env.WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "WEBHOOK_SECRET is not configured" },
      { status: 503 }
    )
  }

  const origin = request.nextUrl.origin
  const url = `${origin}/api/webhook/website-leads`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": secret,
      },
      body: JSON.stringify({
        full_name: "Test Connection",
        phone: "+910000000000",
        email: "test-connection@hagerstone.com",
        company_name: "Integration Test",
        city: "Delhi",
        service_line: "office_interiors",
        message: "This is a test payload from the admin integrations page.",
      }),
    })

    const data = await res.json()
    return NextResponse.json({
      success: res.ok,
      status: res.status,
      response: data,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      { status: 500 }
    )
  }
}
