const PRODUCT_ID = process.env.MAYTAPI_PRODUCT_ID!
const PHONE_ID = process.env.MAYTAPI_PHONE_ID!
const API_TOKEN = process.env.MAYTAPI_API_TOKEN!
const BASE_URL = `https://api.maytapi.com/api/${PRODUCT_ID}/${PHONE_ID}/sendMessage`

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  return digits
}

export async function sendWhatsAppMessage(phone: string, message: string) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-maytapi-key': API_TOKEN,
    },
    body: JSON.stringify({
      to_number: formatPhone(phone),
      type: 'text',
      message,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? 'Maytapi send failed')
  return data
}

export async function sendWhatsAppWithButtons(
  phone: string,
  message: string,
  buttons: { id: string; title: string }[]
) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-maytapi-key': API_TOKEN,
    },
    body: JSON.stringify({
      to_number: formatPhone(phone),
      type: 'button',
      message,
      buttons: buttons.map((b) => ({ id: b.id, title: b.title })),
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? 'Maytapi button send failed')
  return data
}

export async function sendWhatsAppMedia(
  phone: string,
  type: 'image' | 'document' | 'media',
  url: string,
  options?: { caption?: string; filename?: string }
) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-maytapi-key': API_TOKEN,
    },
    body: JSON.stringify({
      to_number: formatPhone(phone),
      type: type === 'image' ? 'image' : 'media',
      message: url,
      ...(options?.caption ? { text: options.caption } : {}),
      ...(options?.filename ? { filename: options.filename } : {}),
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? 'Maytapi media send failed')
  return data
}
