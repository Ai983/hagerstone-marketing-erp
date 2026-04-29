import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { sendWhatsAppMessage } from "@/lib/utils/whapi"

// ── Helpers ─────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, key)
}

/** Strip spaces, dashes, parens, and leading +91 / 91 country code */
function normalisePhone(raw: string): string {
  let cleaned = raw.replace(/[\s\-()]/g, "")
  // Remove leading +91 or 91 (Indian country code)
  cleaned = cleaned.replace(/^\+?91/, "")
  return cleaned
}

async function sendManagerNotification(lead: {
  id: string
  full_name: string
  company_name?: string
  phone: string
  city?: string
  service_line?: string
}) {
  const managerPhone = process.env.MANAGER_WHATSAPP_NUMBER
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://erp.hagerstone.com"

  if (!managerPhone) return

  const message = [
    "\u{1F514} *New Website Lead*",
    `Name: ${lead.full_name}`,
    lead.company_name ? `Company: ${lead.company_name}` : null,
    `Phone: ${lead.phone}`,
    lead.city ? `City: ${lead.city}` : null,
    lead.service_line
      ? `Service: ${lead.service_line
          .split("_")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")}`
      : null,
    `View: ${appUrl}/leads/${lead.id}`,
  ]
    .filter(Boolean)
    .join("\n")

  // Non-critical — fire-and-forget. Don't fail the webhook if WhatsApp
  // delivery fails.
  const result = await sendWhatsAppMessage(managerPhone, message)
  if (!result.success) {
    console.error("Failed to send manager WhatsApp notification:", result.error)
  }
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
  const phone = (body.phone as string | undefined)?.trim()

  if (!fullName || !phone) {
    return NextResponse.json(
      { error: "full_name and phone are required" },
      { status: 400 }
    )
  }

  const email = (body.email as string | undefined)?.trim() || null
  const companyName = (body.company_name as string | undefined)?.trim() || null
  const city = (body.city as string | undefined)?.trim() || null
  const serviceLine = (body.service_line as string | undefined)?.trim() || null
  const message = (body.message as string | undefined)?.trim() || null
  const utmSource = (body.utm_source as string | undefined)?.trim() || null
  const utmMedium = (body.utm_medium as string | undefined)?.trim() || null
  const utmCampaign = (body.utm_campaign as string | undefined)?.trim() || null

  // 3. Normalise phone
  const normalisedPhone = normalisePhone(phone)

  const supabase = getServiceClient()

  // 4. Check duplicate
  const { data: existingLead } = await supabase
    .from("leads")
    .select("id, full_name")
    .or(
      `phone.ilike.%${normalisedPhone}%,phone_alt.ilike.%${normalisedPhone}%`
    )
    .limit(1)
    .maybeSingle()

  // 5. If duplicate
  if (existingLead) {
    await supabase.from("interactions").insert({
      lead_id: existingLead.id,
      type: "lead_created",
      title: "Duplicate enquiry from website",
      notes: message
        ? `Website form re-submission:\n${message}`
        : "Duplicate enquiry received from website form.",
      is_automated: true,
    })

    return NextResponse.json(
      { status: "duplicate", existing_lead_id: existingLead.id },
      { status: 200 }
    )
  }

  // 6. New lead
  // Fetch the "new_lead" stage
  const { data: newLeadStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("slug", "new_lead")
    .maybeSingle()

  if (!newLeadStage) {
    return NextResponse.json(
      { error: "Pipeline stage 'new_lead' not found. Ensure seed data exists." },
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
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      stage_id: newLeadStage.id,
      whatsapp_opted_in: false,
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
  })

  const { data: managers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["manager", "admin"])
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

  // Send WhatsApp notification to manager (fire-and-forget)
  sendManagerNotification({
    id: newLead.id,
    full_name: fullName,
    company_name: companyName ?? undefined,
    phone,
    city: city ?? undefined,
    service_line: serviceLine ?? undefined,
  })

  return NextResponse.json(
    { status: "created", lead_id: newLead.id },
    { status: 201 }
  )
}
