import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// ── GET: list current user's notifications ─────────────────────────
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, lead_id, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Fetch notifications failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notifications: data ?? [] })
  } catch (err) {
    console.error("Notifications GET threw:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ── PATCH: mark one, or all, as read ───────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    // mark_all: true → flag every unread notification for this user as read
    if (body.mark_all === true) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
      if (error) {
        console.error("Mark-all-read failed:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    const id = body.id
    if (typeof id !== "string" || !id) {
      return NextResponse.json(
        { error: "Either { id } or { mark_all: true } is required" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      console.error("Mark-read failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Notifications PATCH threw:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
