import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Creates the sales-rep profile after client-side supabase.auth.signUp.
// Role is forced to sales_rep regardless of what the client sends — do
// NOT trust `role` from the request body.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { id, full_name, email, phone } = body

    if (!id || !full_name || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      console.error(
        "create-profile: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      )
      return NextResponse.json(
        { error: "Service role not configured" },
        { status: 503 }
      )
    }

    const supabase = createClient(url, serviceKey)

    const { error } = await supabase.from("profiles").insert({
      id,
      full_name,
      email,
      phone: phone || null,
      role: "sales_rep", // always sales_rep — never trust the client
      is_active: true,
    })

    if (error) {
      console.error("Profile insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Create profile error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
