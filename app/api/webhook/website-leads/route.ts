import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ── Helpers ─────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, key, { db: { schema: "marketing" } })
}

/**
 * The "Website" data set id, so enquiries land in their own section
 * instead of the general ERP bucket. Returns null if the row is missing
 * — a lead must never be lost over a labelling lookup; the database
 * trigger then falls back to "ERP".
 */
async function getWebsiteDataSetId(
  supabase: ReturnType<typeof getServiceClient>
): Promise<string | null> {
  const { data } = await supabase
    .from("data_sets")
    .select("id")
    .eq("key", "website")
    .maybeSingle()
  return data?.id ?? null
}

/** Strip spaces, dashes, parens, and leading +91 / 91 country code */
function normalisePhone(raw: string): string {
  let cleaned = raw.replace(/[\s\-()]/g, "")
  // Remove leading +91 or 91 (Indian country code)
  cleaned = cleaned.replace(/^\+?91/, "")
  return cleaned
}

// ── Route handler ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Verify webhook secret
  const secret = request.headers.get("x-webhook-secret")
  const expectedSecret = process.env.WEBHOOK_SECRET

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const fullName = (body.full_name as string | undefined)?.trim()
  const phone = (body.phone as string | undefined)?.trim() || null
  const email = (body.email as string | undefined)?.trim() || null

  if (!fullName || (!phone && !email)) {
    return NextResponse.json(
      { error: "full_name and at least one of phone or email are required" },
      { status: 400 }
    )
  }

  const companyName = (body.company_name as string | undefined)?.trim() || null
  const city = (body.city as string | undefined)?.trim() || null
  const serviceLine = (body.service_line as string | undefined)?.trim() || null
  const message = (body.message as string | undefined)?.trim() || null
  // Which surface on the website captured this — contact form, popup, style
  // quiz or cost estimator. The website sends it so sales can see where the
  // person was and what they were doing, rather than a flat "Website form".
  const sourceDetail = (body.source_detail as string | undefined)?.trim() || null
  const utmSource = (body.utm_source as string | undefined)?.trim() || null
  const utmMedium = (body.utm_medium as string | undefined)?.trim() || null
  const utmCampaign = (body.utm_campaign as string | undefined)?.trim() || null

  // 3. Normalise phone
  const normalisedPhone = phone ? normalisePhone(phone) : null

  const supabase = getServiceClient()
  const websiteDataSetId = await getWebsiteDataSetId(supabase)

  // 4. Check duplicate
  let duplicate: { id: string; full_name?: string | null } | null = null

  if (normalisedPhone) {
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, full_name")
      .or(
        `phone.ilike.%${normalisedPhone}%,phone_alt.ilike.%${normalisedPhone}%`
      )
      .limit(1)
      .maybeSingle()

    duplicate = existingLead
  }

  if (!duplicate && email) {
    const { data: emailDuplicate } = await supabase
      .from("leads")
      .select("id")
      .ilike("email", email.trim())
      .maybeSingle()
    if (emailDuplicate) {
      duplicate = emailDuplicate
    }
  }

  // 5. If duplicate
  if (duplicate) {
    await supabase.from("interactions").insert({
      lead_id: duplicate.id,
      type: "lead_created",
      title: "Duplicate enquiry from website",
      notes: message
        ? `Website form re-submission:\n${message}`
        : "Duplicate enquiry received from website form.",
      is_automated: true,
      data_set_id: websiteDataSetId,
    })

    return NextResponse.json(
      { status: "duplicate", existing_lead_id: duplicate.id },
      { status: 200 }
    )
  }

  // 6. New lead
  // Resolve the entry stage: prefer the canonical "new_lead" slug, but fall
  // back to the first stage by position so a renamed first stage never blocks
  // inbound lead capture.
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, slug, position, stage_type, is_terminal")
    .order("position", { ascending: true })

  const newLeadStage =
    stages?.find((s) => s.slug === "new_lead") ??
    stages?.find((s) => !s.is_terminal && (s.stage_type ?? "active") === "active") ??
    stages?.[0] ??
    null

  if (!newLeadStage) {
    return NextResponse.json(
      { error: "No pipeline stages configured." },
      { status: 500 }
    )
  }

  // Insert lead
  const { data: newLead, error: insertError } = await supabase
    .from("leads")
    .insert({
      full_name: fullName,
      phone,
      email,
      company_name: companyName,
      city,
      service_line: serviceLine,
      initial_notes: message,
      source: "website",
      // Prefer the surface the website reports (e.g. "Cost estimator"), and
      // still append the campaign when there is one. Falls back to the old
      // behaviour for callers that don't send source_detail.
      source_detail: [sourceDetail || "Website form", utmCampaign || utmSource]
        .filter(Boolean)
        .join(" · "),
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      stage_id: newLeadStage.id,
      whatsapp_opted_in: false,
      data_set_id: websiteDataSetId,
    })
    .select("id")
    .single()

  if (insertError || !newLead) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to create lead" },
      { status: 500 }
    )
  }

  // Insert lead_created interaction
  await supabase.from("interactions").insert({
    lead_id: newLead.id,
    type: "lead_created",
    title: "Lead created from website",
    notes: message || null,
    is_automated: true,
    data_set_id: websiteDataSetId,
  })

  const { data: managers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "sales_head"])
    .eq("is_active", true)

  if (managers && managers.length > 0) {
    await supabase.from("notifications").insert(
      managers.map((manager) => ({
        user_id: manager.id,
        type: "new_website_lead",
        title: "New Website Lead",
        body: `${fullName} from ${companyName ?? "Unknown company"} enquired about ${serviceLine ?? "Service not specified"}`,
        lead_id: newLead.id,
        is_read: false,
      }))
    )
  }

  // New leads are announced inside the ERP only (the notifications above).
  // There is deliberately no WhatsApp alert to staff.

  // Fire-and-forget AI categorisation — non-blocking
  // Wrapped in try-catch so it never breaks lead creation
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    fetch(`${appUrl}/api/ai/categorise-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: newLead.id }),
    }).catch(() => {
      // Silently ignore — categorisation failure must never
      // affect lead creation
    })
  } catch {
    // Silently ignore
  }

  return NextResponse.json(
    { status: "created", lead_id: newLead.id },
    { status: 201 }
  )
}
