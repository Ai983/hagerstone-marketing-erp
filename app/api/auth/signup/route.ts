import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"

// Self-signup is intentionally scoped to sales_rep only. The role is
// forced server-side here — client hardcoding wouldn't block a JS
// tamper, and the profiles RLS INSERT policy only guards `id`, not
// `role`, so this route + service key is the enforcement point.

const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().trim().min(7, "Phone number is required").max(30),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Service role not configured" },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const { fullName, email, phone, password } = parsed.data
    const admin = createServiceClient(url, serviceKey)

    // email_confirm: true lets the user sign in right away without the
    // email verification round-trip. Flip to false if you later enable
    // email verification in Supabase auth settings.
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

    if (authError || !authData.user) {
      // 422 covers the common cases: duplicate email, weak password, etc.
      return NextResponse.json(
        { error: authError?.message ?? "Failed to create user" },
        { status: 422 }
      )
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: authData.user.id,
      full_name: fullName,
      email,
      phone,
      role: "sales_rep",
    })

    if (profileError) {
      // Roll back the auth user so we don't leave an orphan in auth.users
      await admin.auth.admin.deleteUser(authData.user.id).catch((err) => {
        console.error("Auth user rollback failed:", err)
      })
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Signup error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
