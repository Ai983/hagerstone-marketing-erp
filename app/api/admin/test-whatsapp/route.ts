import { NextResponse } from "next/server"
import { createClient as createUserClient } from "@/lib/supabase/server"

const TEST_NUMBER = process.env.MAYTAPI_TEST_NUMBER || "+919999999999"

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

  const productId = process.env.MAYTAPI_PRODUCT_ID
  const phoneId = process.env.MAYTAPI_PHONE_ID
  const apiToken = process.env.MAYTAPI_API_TOKEN

  if (!productId || !phoneId || !apiToken) {
    return NextResponse.json(
      { error: "Maytapi not configured. Set MAYTAPI_PRODUCT_ID, MAYTAPI_PHONE_ID, MAYTAPI_API_TOKEN." },
      { status: 503 }
    )
  }

  try {
    const res = await fetch(
      `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-maytapi-key": apiToken,
        },
        body: JSON.stringify({
          to_number: TEST_NUMBER.replace(/[\s\-()]/g, ""),
          type: "text",
          message: "Hagerstone ERP test message",
        }),
      }
    )

    const data = await res.json()
    if (!res.ok || data.success === false) {
      return NextResponse.json(
        { error: data.message || "Maytapi returned an error" },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, sent_to: TEST_NUMBER })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      { status: 500 }
    )
  }
}
