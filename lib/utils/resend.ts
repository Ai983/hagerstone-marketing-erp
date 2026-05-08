import { Resend } from "resend"

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
    tags: [
      { name: "lead_id", value: options.leadId || "none" },
      { name: "template_id", value: options.templateId || "none" },
      { name: "campaign_id", value: options.campaignId || "none" },
    ],
  })

  if (error) throw new Error(error.message)
  return data
}

export function renderTemplate(
  html: string,
  variables: Record<string, string>
): string {
  let rendered = html
  Object.entries(variables).forEach(([key, value]) => {
    rendered = rendered.replaceAll(`{{${key}}}`, value || "")
  })
  return rendered
}
