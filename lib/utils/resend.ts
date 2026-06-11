import { Resend } from "resend"

// Re-exported so existing server-side importers (`import { renderTemplate } from
// "@/lib/utils/resend"`) keep working. The implementation lives in
// email-content.ts so client components can use it without bundling this
// server-only module (which imports the Resend SDK).
export { renderTemplate } from "./email-content"

const resend = new Resend(process.env.RESEND_API_KEY)

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
  leadId?: string
  sentBy?: string
  templateId?: string
  campaignId?: string
}

export async function sendEmail(options: SendEmailOptions) {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: options.to,
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo,
    headers: {
      "X-Entity-Ref-ID": `${options.leadId ?? "none"}:${options.templateId ?? "manual"}`,
    },
    tags: [
      { name: "lead_id", value: options.leadId || "none" },
      { name: "template_id", value: options.templateId || "none" },
      { name: "campaign_id", value: options.campaignId || "none" },
    ],
  })

  if (error) throw new Error(error.message)
  return data
}

