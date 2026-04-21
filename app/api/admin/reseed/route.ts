import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"

export async function POST() {
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json(
      { error: "Service role credentials not configured" },
      { status: 503 }
    )
  }

  const serviceClient = createServiceClient(url, key)
  const { data, error } = await serviceClient.rpc("reseed_sample_data")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, result: data })
}
