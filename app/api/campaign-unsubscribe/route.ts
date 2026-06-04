import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  if (!token) {
    return new NextResponse(unsubscribePage("Invalid link", false), {
      headers: { "Content-Type": "text/html" },
    })
  }

  let enrollmentId: string
  try {
    enrollmentId = Buffer.from(token, "base64").toString("utf-8")
  } catch {
    return new NextResponse(unsubscribePage("Invalid link", false), {
      headers: { "Content-Type": "text/html" },
    })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "marketing" } }
  )

  const { data: enrollment, error } = await supabase
    .from("campaign_enrollments")
    .select("id, status, email_opted_out, lead:leads(id, full_name), campaign:campaigns(name)")
    .eq("id", enrollmentId)
    .maybeSingle()

  if (error || !enrollment) {
    return new NextResponse(unsubscribePage("Link not found", false), {
      headers: { "Content-Type": "text/html" },
    })
  }

  if (enrollment.email_opted_out === true) {
    return new NextResponse(unsubscribePage("You are already unsubscribed", true), {
      headers: { "Content-Type": "text/html" },
    })
  }

  await supabase
    .from("campaign_enrollments")
    .update({ email_opted_out: true })
    .eq("id", enrollmentId)

  // Get lead_id from enrollment
  const { data: enrollmentData } = await supabase
    .from("campaign_enrollments")
    .select("lead_id, campaign:campaigns(name)")
    .eq("id", enrollmentId)
    .maybeSingle()

  if (enrollmentData?.lead_id) {
    const campaignName = Array.isArray(enrollmentData.campaign)
      ? enrollmentData.campaign[0]?.name
      : (enrollmentData.campaign as { name?: string } | null)?.name

    await supabase
      .from("leads")
      .update({
        email_opted_in: false,
        email_unsubscribed_at: new Date().toISOString(),
        email_unsubscribed_campaign: campaignName ?? null,
      })
      .eq("id", enrollmentData.lead_id)
  }

  const lead = Array.isArray(enrollment.lead) ? enrollment.lead[0] : enrollment.lead
  const campaign = Array.isArray(enrollment.campaign) ? enrollment.campaign[0] : enrollment.campaign

  // Log interaction
  if (lead) {
    await supabase.from("interactions").insert({
      lead_id: (lead as { id?: string }).id ?? null,
      type: "note",
      title: "Unsubscribed from campaign",
      notes: `Lead unsubscribed from campaign: ${(campaign as { name?: string })?.name ?? "Unknown"}`,
      is_automated: true,
    })
  }

  return new NextResponse(unsubscribePage("You have been unsubscribed successfully", true), {
    headers: { "Content-Type": "text/html" },
  })
}

function unsubscribePage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribe - Hagerstone</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 400px; text-align: center; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; color: #111; margin: 0 0 8px; }
    p { color: #666; font-size: 14px; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "❌"}</div>
    <h1>${message}</h1>
    <p>You will no longer receive messages from this campaign.<br>Contact us at admin@hagerstone.com if this was a mistake.</p>
  </div>
</body>
</html>`
}
