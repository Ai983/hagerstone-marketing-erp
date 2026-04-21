import { NextRequest, NextResponse } from "next/server"
import { generateAndSendDailySummary } from "@/lib/utils/daily-summary"
import { createClient as createServiceClient } from "@supabase/supabase-js"

/**
 * Called by Vercel Cron.
 *
 * Auth: Authorization header must equal `Bearer ${CRON_SECRET}`.
 * This matches Vercel's default cron auth mechanism.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Respect the enabled toggle in admin_settings
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    const supabase = createServiceClient(url, serviceKey)
    const { data: cfg } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "daily_summary_config")
      .maybeSingle()
    const enabled = (cfg?.value as { enabled?: boolean } | null)?.enabled !== false
    if (!enabled) {
      return NextResponse.json({ success: true, skipped: true, reason: "disabled" })
    }
  }

  const result = await generateAndSendDailySummary()

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error ?? "Failed" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    sent_to: result.sent_to,
  })
}
