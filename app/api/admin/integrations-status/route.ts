import { NextResponse } from "next/server"
import { createClient as createUserClient } from "@/lib/supabase/server"

export async function GET() {
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

  return NextResponse.json({
    webhook: {
      secret_set: Boolean(process.env.WEBHOOK_SECRET),
    },
    whapi: {
      token_set: Boolean(process.env.WHAPI_TOKEN),
      api_url_set: Boolean(process.env.WHAPI_API_URL),
    },
    anthropic: {
      key_set: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    app_url: process.env.NEXT_PUBLIC_APP_URL || null,
  })
}
