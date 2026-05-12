export type EmailEditorMode = "rich" | "html" | "plain"

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function plainTextToEmailHtml(plainText: string): string {
  const paragraphs = plainText
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`)
    .join("")

  return `<div style="font-family: Arial; font-size: 15px; color: #333; line-height: 1.7;">${paragraphs}</div>`
}

export function wrapInEmailTemplate(bodyContent: string): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px 30px;">
  <div style="border-bottom: 3px solid #B8860B; padding-bottom: 15px; margin-bottom: 25px;">
    <h2 style="color: #B8860B; margin: 0; font-size: 20px;">Hagerstone International</h2>
    <p style="color: #666; margin: 4px 0 0; font-size: 12px;">Premium Interior Design & Build</p>
  </div>

  <div style="color: #333; font-size: 15px; line-height: 1.7;">
    ${bodyContent}
  </div>

  <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 15px; text-align: center;">
    <p style="color: #aaa; font-size: 11px; margin: 0;">Hagerstone International Pvt. Ltd. | systems@hagerstone.com | Noida, Delhi NCR</p>
  </div>
</div>`
}
