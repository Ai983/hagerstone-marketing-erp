import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { isRunoConfigured } from "@/lib/utils/runo"
import { resolveRunoDates, syncRunoDates } from "@/lib/utils/runo-ingest"

export const maxDuration = 60

/**
 * Pulls Runo call logs into lead timelines. Runo only serves past dates,
 * so the daily run imports yesterday (IST).
 *
 *   ?date=YYYY-MM-DD   one specific day
 *   ?days=N            the last N days ending yesterday (backfill, max 31)
 *   ?dryRun=1          report what would be imported, write nothing
 *
 * Safe to re-run: calls already imported are skipped.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isRunoConfigured()) {
    return NextResponse.json({ skipped: "RUNO_API_KEY is not set" })
  }

  const params = request.nextUrl.searchParams
  const dryRun = params.get("dryRun") === "1" || params.get("dryRun") === "true"
  const range = resolveRunoDates({ date: params.get("date"), days: params.get("days") })
  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "marketing" } }
  )

  const results = await syncRunoDates(supabase, range.dates, { dryRun, trigger: "cron" })
  return NextResponse.json({ dryRun, results })
}
