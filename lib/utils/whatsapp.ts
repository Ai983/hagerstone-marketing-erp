/**
 * WhatsApp sender — Hagerstone self-hosted gateway.
 *
 * Replaces the old MayTAPI vendor. The gateway (Node + Baileys, deployed on
 * Railway, session state in Hub Supabase) exposes a MayTAPI-compatible route:
 *
 *   POST {GATEWAY}/maytapi/:productId/:sessionId/sendMessage
 *   header: x-maytapi-key: <WHATSAPP_GATEWAY_SECRET>
 *   body:   { to_number, type: 'text' | 'media' | 'link', message, text?, filename? }
 *   200:    { success: true, data: { msgId } }
 *
 * `productId` is accepted and ignored by the gateway; `sessionId` is the paired
 * WhatsApp line (e.g. `hagerstone-biz`).
 *
 * Every function here resolves to a SendResult and never throws, because all
 * callers branch on `result.success` rather than catching.
 */

const GATEWAY_URL = (
  process.env.WHATSAPP_GATEWAY_URL ?? "https://wa-gateway-production-26c1.up.railway.app"
).replace(/\/+$/, "")

const SESSION_ID = process.env.WHATSAPP_SESSION_ID ?? "hagerstone-biz"
const GATEWAY_SECRET = process.env.WHATSAPP_GATEWAY_SECRET ?? ""

// Ignored by the gateway, but the path shape is kept for MayTAPI compatibility.
const PRODUCT_ID = "hagerstone"

const SEND_URL = `${GATEWAY_URL}/maytapi/${PRODUCT_ID}/${SESSION_ID}/sendMessage`

export type SendResult = {
  success: boolean
  messageId?: string
  error?: string
}

/** Normalise an Indian number to the 12-digit `91…` form the gateway expects. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("91") && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  return digits
}

type GatewayBody = {
  to_number: string
  type: "text" | "media" | "link"
  message: string
  text?: string
  filename?: string
}

async function postToGateway(body: GatewayBody): Promise<SendResult> {
  if (!GATEWAY_SECRET) {
    return { success: false, error: "WHATSAPP_GATEWAY_SECRET is not configured" }
  }

  try {
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-maytapi-key": GATEWAY_SECRET,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const data = await res.json().catch(() => null)

    if (!res.ok || data?.success === false) {
      return {
        success: false,
        error:
          data?.message ??
          data?.error ??
          `WhatsApp gateway responded ${res.status}`,
      }
    }

    return { success: true, messageId: data?.data?.msgId ?? undefined }
  } catch (err) {
    return { success: false, error: `WhatsApp gateway unreachable: ${String(err)}` }
  }
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<SendResult> {
  return postToGateway({
    to_number: formatPhone(phone),
    type: "text",
    message,
  })
}

/**
 * The gateway speaks Baileys, which no longer supports MayTAPI-style
 * interactive button messages. Rather than fail the send, the choices are
 * appended as a numbered list so the recipient can reply with a number.
 */
export async function sendWhatsAppWithButtons(
  phone: string,
  message: string,
  buttons: { id: string; title: string }[]
): Promise<SendResult> {
  const choices = buttons
    .map((b, i) => `${i + 1}. ${b.title}`)
    .join("\n")

  const body = choices ? `${message}\n\n${choices}\n\n_Reply with a number._` : message

  return postToGateway({
    to_number: formatPhone(phone),
    type: "text",
    message: body,
  })
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"])

/**
 * The gateway infers a MIME type from `filename`, falling back to
 * application/pdf for remote URLs. Without a correct filename an image would
 * be delivered as a PDF document, so one is derived from the URL when the
 * caller does not supply it.
 */
function resolveFilename(
  type: "image" | "document" | "media",
  url: string,
  filename?: string
): string | undefined {
  if (filename) return filename

  const fromUrl = url.split("?")[0].split("#")[0].split("/").pop() ?? ""
  if (fromUrl.includes(".")) return fromUrl

  return type === "image" ? "image.jpg" : undefined
}

export async function sendWhatsAppMedia(
  phone: string,
  type: "image" | "document" | "media",
  url: string,
  options?: { caption?: string; filename?: string }
): Promise<SendResult> {
  const filename = resolveFilename(type, url, options?.filename)

  // Guard against an image URL whose extension is non-image (e.g. a signed
  // storage link ending in .bin) being sent as a document.
  const ext = filename?.split(".").pop()?.toLowerCase() ?? ""
  const finalFilename =
    type === "image" && !IMAGE_EXTENSIONS.has(ext) ? "image.jpg" : filename

  return postToGateway({
    to_number: formatPhone(phone),
    type: "media",
    message: url,
    ...(options?.caption ? { text: options.caption } : {}),
    ...(finalFilename ? { filename: finalFilename } : {}),
  })
}

/** Live status of the paired WhatsApp line, used by the health endpoint. */
export async function getSessionStatus(): Promise<{
  reachable: boolean
  status: string
  phoneNumber: string | null
  error?: string
}> {
  try {
    const res = await fetch(`${GATEWAY_URL}/sessions/${SESSION_ID}/status`, {
      headers: { "x-gateway-key": GATEWAY_SECRET },
      cache: "no-store",
    })
    if (!res.ok) {
      return {
        reachable: false,
        status: "unknown",
        phoneNumber: null,
        error: `Gateway responded ${res.status}`,
      }
    }
    const data = await res.json()
    return {
      reachable: true,
      status: data?.status ?? "unknown",
      phoneNumber: data?.phone_number ?? null,
    }
  } catch (err) {
    return {
      reachable: false,
      status: "unreachable",
      phoneNumber: null,
      error: String(err),
    }
  }
}

export const WHATSAPP_SESSION_ID = SESSION_ID
export const WHATSAPP_GATEWAY_URL = GATEWAY_URL
