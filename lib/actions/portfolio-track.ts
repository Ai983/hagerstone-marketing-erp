"use server"

export async function trackPortfolioView(leadId: string) {
  try {
    const { createClient } = await import("@supabase/supabase-js")
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase.from("interactions").insert({
      lead_id: leadId,
      type: "note",
      notes: "Lead viewed portfolio landing page",
      is_automated: true,
    })
  } catch {
    // Never throw - page must always load even if logging fails.
  }
}
