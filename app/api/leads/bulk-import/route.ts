import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { createClient as createUserClient } from "@/lib/supabase/server"

const ALLOWED_SERVICE_LINES = new Set([
  "office_interiors",
  "mep",
  "facade_glazing",
  "peb_construction",
  "civil_works",
  "multiple",
  "unknown",
])

const ALLOWED_SOURCES = new Set([
  "website",
  "manual_sales",
  "whatsapp_inbound",
  "referral",
  "google_ads",
  "linkedin",
  "justdial",
  "other",
])

interface IncomingLead {
  full_name?: string
  phone?: string
  email?: string | null
  company_name?: string | null
  city?: string | null
  service_line?: string | null
  estimated_budget?: string | null
  source?: string | null
  whatsapp_opted_in?: boolean
  initial_notes?: string | null
  /** 1-based row number in the user's spreadsheet (for error messages) */
  row?: number
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2)
  return digits
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const userClient = await createUserClient()
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // ── Parse body ──────────────────────────────────────────────
    const body = await request.json().catch(() => null)
    const incoming = Array.isArray(body?.leads) ? (body.leads as IncomingLead[]) : null
    if (!incoming) {
      return NextResponse.json({ error: "leads array is required" }, { status: 400 })
    }
    if (incoming.length === 0) {
      return NextResponse.json({ imported: 0, skipped: [], errors: [] })
    }
    if (incoming.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 leads per import" },
        { status: 400 }
      )
    }

    // ── Service-role client (bypass RLS for batch writes) ──────
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: "Service role not configured" },
        { status: 503 }
      )
    }
    const service = createServiceClient(url, serviceKey)

    // ── Resolve new_lead stage ─────────────────────────────────
    const { data: stage, error: stageError } = await service
      .from("pipeline_stages")
      .select("id")
      .eq("slug", "new_lead")
      .maybeSingle()

    if (stageError || !stage) {
      return NextResponse.json(
        { error: "Pipeline stage 'new_lead' not found. Run the base schema seed." },
        { status: 500 }
      )
    }

    // ── Build a set of existing phones for fast duplicate check ─
    const { data: existingRows, error: existingError } = await service
      .from("leads")
      .select("phone, phone_alt")
    if (existingError) {
      console.error("bulk-import: failed to fetch existing phones", existingError)
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }
    const existingPhones = new Set<string>()
    for (const row of existingRows ?? []) {
      if (row.phone) existingPhones.add(normalizePhone(row.phone))
      if (row.phone_alt) existingPhones.add(normalizePhone(row.phone_alt))
    }

    // ── Loop through leads ─────────────────────────────────────
    const skipped: Array<{ row: number; phone: string; reason: string }> = []
    const errors: Array<{ row: number; error: string }> = []
    const seenInBatch = new Set<string>()
    let imported = 0

    for (let i = 0; i < incoming.length; i++) {
      const raw = incoming[i]
      const rowNum = raw.row ?? i + 1

      const fullName = raw.full_name?.trim()
      const phoneRaw = raw.phone?.trim()

      if (!fullName) {
        errors.push({ row: rowNum, error: "Full Name is required" })
        continue
      }
      if (!phoneRaw) {
        errors.push({ row: rowNum, error: "Phone is required" })
        continue
      }

      const normalised = normalizePhone(phoneRaw)
      if (normalised.length < 7) {
        errors.push({ row: rowNum, error: "Phone number is too short" })
        continue
      }

      // Duplicate (existing DB row)
      if (existingPhones.has(normalised)) {
        skipped.push({ row: rowNum, phone: phoneRaw, reason: "Already exists" })
        continue
      }
      // Duplicate (same phone earlier in this batch)
      if (seenInBatch.has(normalised)) {
        skipped.push({ row: rowNum, phone: phoneRaw, reason: "Duplicate in file" })
        continue
      }

      // Validate service_line
      const serviceLine = raw.service_line?.trim() || null
      if (serviceLine && !ALLOWED_SERVICE_LINES.has(serviceLine)) {
        errors.push({
          row: rowNum,
          error: `Service Line "${serviceLine}" is invalid`,
        })
        continue
      }

      // Validate source
      const source = raw.source?.trim() || "manual_sales"
      if (!ALLOWED_SOURCES.has(source)) {
        errors.push({ row: rowNum, error: `Source "${source}" is invalid` })
        continue
      }

      const now = new Date().toISOString()

      const insertPayload = {
        full_name: fullName,
        phone: phoneRaw,
        email: raw.email?.trim() || null,
        company_name: raw.company_name?.trim() || null,
        city: raw.city?.trim() || null,
        service_line: serviceLine,
        estimated_budget: raw.estimated_budget?.trim() || null,
        source,
        whatsapp_opted_in: Boolean(raw.whatsapp_opted_in),
        whatsapp_opted_in_at: raw.whatsapp_opted_in ? now : null,
        initial_notes: raw.initial_notes?.trim() || null,
        stage_id: stage.id,
        assigned_to: user.id,
        assigned_at: now,
        created_by: user.id,
      }

      const { error: insertError } = await service.from("leads").insert(insertPayload)
      if (insertError) {
        console.error(`bulk-import row ${rowNum} insert failed:`, insertError)
        errors.push({ row: rowNum, error: insertError.message })
        continue
      }

      imported++
      seenInBatch.add(normalised)
      existingPhones.add(normalised) // guard subsequent rows
    }

    return NextResponse.json({
      imported,
      skipped,
      errors,
      total_rows: incoming.length,
    })
  } catch (err) {
    console.error("bulk-import POST threw:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
