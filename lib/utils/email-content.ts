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
  <div style="border-bottom: 3px solid #B8860B; padding-bottom: 15px; margin-bottom: 25px; text-align: center;">
    <img src="https://hagerstone-marketing-erp.vercel.app/logo.png" 
         alt="Hagerstone International" 
         width="180" 
         style="display:inline-block; max-width:180px; height:auto;">
    <p style="color: #666; margin: 8px 0 0; font-size: 12px;">Premium Interior Design & Build</p>
  </div>

  <div style="color: #333; font-size: 15px; line-height: 1.7;">
    ${bodyContent}
  </div>

        <!-- Social + Footer -->
        <div style="background-color:#1a1a1a;padding:24px 40px;text-align:center;">
          
          <!-- Social Icons Row -->
          <div style="margin-bottom:16px;">
            <a href="https://www.instagram.com/hagerstone_international/" target="_blank" style="display:inline-block;margin:0 6px;">
              <div style="width:36px;height:36px;background-color:#333333;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;line-height:36px;">
                <img src="https://cdn-icons-png.flaticon.com/24/2111/2111463.png" width="16" height="16" alt="Instagram" style="vertical-align:middle;">
              </div>
            </a>
            <a href="https://www.facebook.com/HagerstoneInternational/" target="_blank" style="display:inline-block;margin:0 6px;">
              <div style="width:36px;height:36px;background-color:#333333;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;line-height:36px;">
                <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" width="16" height="16" alt="Facebook" style="vertical-align:middle;">
              </div>
            </a>
            <a href="https://www.linkedin.com/company/hagerstone/" target="_blank" style="display:inline-block;margin:0 6px;">
              <div style="width:36px;height:36px;background-color:#333333;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;line-height:36px;">
                <img src="https://cdn-icons-png.flaticon.com/24/733/733561.png" width="16" height="16" alt="LinkedIn" style="vertical-align:middle;">
              </div>
            </a>
            <a href="https://www.hagerstone.com/" target="_blank" style="display:inline-block;margin:0 6px;">
              <div style="width:36px;height:36px;background-color:#333333;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;line-height:36px;">
                <img src="https://cdn-icons-png.flaticon.com/24/841/841364.png" width="16" height="16" alt="Website" style="vertical-align:middle;">
              </div>
            </a>
          </div>

          <!-- Company info -->
          <p style="margin:0 0 8px;font-size:12px;color:#777777;line-height:1.6;">
            Hagerstone International Pvt. Ltd. &nbsp;|&nbsp; ISO Certified &nbsp;|&nbsp; Noida, Delhi NCR
          </p>
          <p style="margin:0 0 12px;font-size:12px;color:#555555;">
            <a href="https://www.hagerstone.com/" style="color:#c9a84c;text-decoration:none;">hagerstone.com</a>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <a href="mailto:sales@hagerstone.com" style="color:#c9a84c;text-decoration:none;">sales@hagerstone.com</a>
          </p>

          <!-- Unsubscribe -->
          <p style="margin:0;font-size:11px;color:#444444;">
            <a href="{{unsubscribe_url}}" style="color:#666666;text-decoration:underline;">Unsubscribe</a>
          </p>

        </div>
</div>`
}
