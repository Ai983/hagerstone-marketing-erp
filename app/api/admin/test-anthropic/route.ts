import { NextResponse } from "next/server"
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

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 503 }
    )
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        messages: [{ role: "user", content: "Respond with only the word: OK" }],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Anthropic API error" },
        { status: 502 }
      )
    }

    const text =
      data.content?.[0]?.text ?? "(no text returned)"
    return NextResponse.json({ success: true, response: text, model: data.model })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      { status: 500 }
    )
  }
}
