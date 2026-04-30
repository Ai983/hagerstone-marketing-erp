// Shared Whapi.Cloud sender. All ERP routes that send WhatsApp
// messages should call this — keeps phone normalisation, auth, and
// error shaping consistent.

interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export type WhapiMediaType = "image" | "document" | "video"

export interface WhapiButton {
  id: string
  title: string
}

function normalisePhone(to: string): string {
  let phone = to.replace(/[\s\-+()]/g, "")
  if (phone.startsWith("0")) phone = "91" + phone.slice(1)
  if (phone.length === 10) phone = "91" + phone
  return phone
}

function whapiEnv() {
  const apiUrl = process.env.WHAPI_API_URL
  const token = process.env.WHAPI_TOKEN
  if (!apiUrl || !token) {
    return null
  }
  return { apiUrl, token }
}

/**
 * Send a plain-text WhatsApp message via Whapi.
 *
 * Phone normalisation rules (Indian-defaulted):
 *   - Strip spaces, dashes, plus, parens
 *   - "0XXXXXXXXXX" → "91XXXXXXXXXX"   (drop trunk zero, prepend country)
 *   - 10-digit number → "91XXXXXXXXXX" (assume India)
 *   - Already in E.164 form (e.g., 919876543210) → unchanged
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<SendResult> {
  try {
    const phone = normalisePhone(to)
    console.log("Sending to normalized phone:", phone)

    const env = whapiEnv()
    if (!env) {
      console.error("Whapi env not configured (WHAPI_API_URL / WHAPI_TOKEN)")
      return { success: false, error: "Whapi not configured" }
    }

    const response = await fetch(`${env.apiUrl}/messages/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.token}`,
      },
      body: JSON.stringify({
        to: phone,
        body: message,
      }),
    })

    const data = (await response.json().catch(() => ({}))) as {
      id?: string
      error?: { message?: string }
    }

    if (!response.ok) {
      console.error("Whapi error:", data)
      return {
        success: false,
        error: data.error?.message ?? "Failed to send message",
      }
    }

    return {
      success: true,
      messageId: data.id,
    }
  } catch (err) {
    console.error("Whapi send error:", err)
    return { success: false, error: "Network error" }
  }
}

export async function sendWhatsAppWithButtons(
  to: string,
  bodyText: string,
  buttons: WhapiButton[],
  headerText?: string,
  footerText?: string
): Promise<SendResult> {
  try {
    const phone = normalisePhone(to)

    const env = whapiEnv()
    if (!env) {
      console.error("Whapi env not configured (WHAPI_API_URL / WHAPI_TOKEN)")
      return { success: false, error: "Whapi not configured" }
    }

    const response = await fetch(`${env.apiUrl}/messages/interactive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.token}`,
      },
      body: JSON.stringify({
        to: phone,
        type: "button",
        header: headerText
          ? {
              type: "text",
              text: headerText,
            }
          : undefined,
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: "quick_reply",
            title: btn.title,
            id: btn.id,
          })),
        },
      }),
    })

    const data = (await response.json().catch(() => ({}))) as {
      id?: string
      error?: { message?: string }
    }

    if (!response.ok) {
      console.error("Whapi interactive error:", data)
      return {
        success: false,
        error: data.error?.message ?? "Failed to send interactive message",
      }
    }

    return { success: true, messageId: data.id }
  } catch (err) {
    console.error("Whapi buttons error:", err)
    return { success: false, error: "Network error" }
  }
}

/**
 * Send a media message (image / document / video) via Whapi. The media
 * source must be a publicly-reachable URL — Whapi fetches it server-side
 * and forwards to WhatsApp.
 *
 * Whapi endpoints:
 *   POST /messages/image     { to, media: <url>, caption? }
 *   POST /messages/document  { to, media: <url>, caption?, filename? }
 *   POST /messages/video     { to, media: <url>, caption? }
 */
export async function sendWhatsAppMedia(
  to: string,
  type: WhapiMediaType,
  mediaUrl: string,
  options: { caption?: string; filename?: string } = {}
): Promise<SendResult> {
  try {
    const phone = normalisePhone(to)
    console.log(
      `Sending Whapi ${type} to`,
      phone,
      "url:",
      mediaUrl
    )

    const env = whapiEnv()
    if (!env) {
      return { success: false, error: "Whapi not configured" }
    }

    const body: Record<string, string> = { to: phone, media: mediaUrl }
    if (options.caption) body.caption = options.caption
    if (type === "document" && options.filename) body.filename = options.filename

    const response = await fetch(`${env.apiUrl}/messages/${type}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.token}`,
      },
      body: JSON.stringify(body),
    })

    const data = (await response.json().catch(() => ({}))) as {
      id?: string
      error?: { message?: string }
    }

    if (!response.ok) {
      console.error("Whapi media error:", data)
      return {
        success: false,
        error: data.error?.message ?? `Failed to send ${type}`,
      }
    }

    return { success: true, messageId: data.id }
  } catch (err) {
    console.error("Whapi media send error:", err)
    return { success: false, error: "Network error" }
  }
}

/** Whether Whapi credentials are present (used by integrations status). */
export function isWhapiConfigured(): boolean {
  return whapiEnv() !== null
}
