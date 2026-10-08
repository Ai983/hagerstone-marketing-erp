import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"
import { isRunoConfigured } from "@/lib/utils/runo"
import { resolveRunoDates, syncRunoDates } from "@/lib/utils/runo-ingest"

export const maxDuration = 60

/**
 * "Sync now" on the Runo Calls page — the same import the daily cron runs,
 * started by a signed-in user.
 *
 * POST { date?: "YYYY-MM-DD", days?: number, dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  const userClient = await createUserClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isRunoConfigured()) {
    return NextResponse.json({ error: "RUNO_API_KEY is not set on the server." }, { status: 503 })
  }

  let body: { date?: string; days?: number; dryRun?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // Empty body → sync yesterday.
  }

  const range = resolveRunoDates({ date: body.date, days: body.days })
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 })

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "marketing" } }
  )

  const results = await syncRunoDates(supabase, range.dates, {
    dryRun: Boolean(body.dryRun),
    trigger: "manual",
  })
  return NextResponse.json({ dryRun: Boolean(body.dryRun), results })
}
