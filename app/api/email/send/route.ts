import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { wrapInEmailTemplate } from "@/lib/utils/email-content"
import { renderTemplate, sendEmail } from "@/lib/utils/resend"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: "marketing" } }
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const leadId = body?.lead_id as string | undefined
    const toEmail = body?.to_email as string | undefined
    const subject = body?.subject as string | undefined
    const html = body?.html as string | undefined
    const templateId = body?.template_id as string | undefined

    if (!leadId || !toEmail || !subject || !html) {
      return NextResponse.json(
        { error: "lead_id, to_email, subject and html are required" },
        { status: 400 }
      )
    }

    const [{ data: lead, error: leadError }, { data: profile }] = await Promise.all([
      supabase
        .from("leads")
        .select("id, full_name, company_name, service_line, city, email_opted_in, email_unsubscribed_at")
        .eq("id", leadId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", user.id)
        .maybeSingle(),
    ])

    if (leadError) throw leadError
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Block when the lead has explicitly opted out (email_opted_in === false),
    // whether via the new-lead form (unchecked) or an unsubscribe link.
    // Leads with a null value (legacy, never set) are still allowed to send.
    if (lead.email_opted_in === false) {
      return NextResponse.json(
        {
          error: lead.email_unsubscribed_at
            ? "This lead has unsubscribed from emails. Cannot send."
            : "This lead has not opted in to emails. Cannot send.",
        },
        { status: 400 }
      )
    }

    const variables = {
      lead_id: lead.id,
      lead_name: lead.full_name ?? "",
      rep_name: profile?.full_name ?? user.email ?? "",
      company_name: lead.company_name ?? "",
      service_line: (lead.service_line ?? "").replaceAll("_", " "),
      city: lead.city ?? "",
      visit_date: "",
    }
    const renderedHtml = renderTemplate(html, variables)
    const finalHtml = renderedHtml.includes("Hagerstone International")
      ? renderedHtml
      : wrapInEmailTemplate(renderedHtml)
    const unsubscribeToken = Buffer.from(leadId).toString("base64")
    const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/campaign-unsubscribe?token=${unsubscribeToken}`
    const finalHtmlWithFooter = finalHtml.replace('{{unsubscribe_url}}', unsubscribeUrl)
    const renderedSubject = renderTemplate(subject, variables)

    const sentAt = new Date().toISOString()
    let email: Awaited<ReturnType<typeof sendEmail>>
    try {
      email = await sendEmail({
        to: toEmail,
        subject: renderedSubject,
        html: finalHtmlWithFooter,
        replyTo: process.env.EMAIL_REPLY_TO ?? profile?.email ?? user.email ?? undefined,
        leadId,
        sentBy: user.id,
        templateId,
      })
    } catch (err) {
      await supabaseAdmin.from("email_logs").insert({
        lead_id: leadId,
        sent_by: user.id,
        template_id: templateId ?? null,
        to_email: toEmail,
        from_email: process.env.EMAIL_FROM!,
        subject: renderedSubject,
        body_html: finalHtmlWithFooter,
        status: "failed",
        sent_at: sentAt,
        failed_at: new Date().toISOString(),
        error_message: err instanceof Error ? err.message : "Email send failed",
      })
      throw err
    }

    const { data: log, error: logError } = await supabaseAdmin
      .from("email_logs")
      .insert({
        lead_id: leadId,
        sent_by: user.id,
        template_id: templateId ?? null,
        resend_email_id: email?.id ?? null,
        to_email: toEmail,
        from_email: process.env.EMAIL_FROM!,
        subject: renderedSubject,
        body_html: finalHtmlWithFooter,
        status: "sent",
        sent_at: sentAt,
      })
      .select("id")
      .single()

    if (logError) throw logError

    await supabase.from("interactions").insert({
      lead_id: leadId,
      user_id: user.id,
      type: "email_sent",
      title: "Email sent",
      notes: renderedSubject,
      is_automated: false,
    })

    return NextResponse.json({ success: true, email_log_id: log.id })
  } catch (err) {
    console.error("email/send failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 }
    )
  }
}
