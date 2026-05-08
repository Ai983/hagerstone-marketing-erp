import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { renderTemplate, sendEmail } from "@/lib/utils/resend"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
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
        .select("id, full_name, company_name, service_line, city")
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

    const variables = {
      lead_name: lead.full_name ?? "",
      rep_name: profile?.full_name ?? user.email ?? "",
      company_name: lead.company_name ?? "",
      service_line: (lead.service_line ?? "").replaceAll("_", " "),
      city: lead.city ?? "",
      visit_date: "",
    }
    const renderedHtml = renderTemplate(html, variables)
    const renderedSubject = renderTemplate(subject, variables)

    const email = await sendEmail({
      to: toEmail,
      subject: renderedSubject,
      html: renderedHtml,
      replyTo: profile?.email ?? user.email ?? undefined,
      leadId,
      sentBy: user.id,
      templateId,
    })

    const { data: log, error: logError } = await supabase
      .from("email_logs")
      .insert({
        lead_id: leadId,
        sent_by: user.id,
        template_id: templateId ?? null,
        resend_email_id: email?.id ?? null,
        to_email: toEmail,
        from_email: process.env.EMAIL_FROM!,
        subject: renderedSubject,
        body_html: renderedHtml,
        status: "sent",
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
