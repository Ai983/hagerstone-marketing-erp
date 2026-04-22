import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Normalise an Indian phone number for Maytapi.
 * Always aims to return 12 digits starting with "91".
 *   - strip every non-digit (also drops leading `+`)
 *   - 91xxxxxxxxxx (12 digits) → unchanged
 *   - xxxxxxxxxx  (10 digits)  → prepend "91"
 *   - 0xxxxxxxxxx (11 digits with leading 0) → drop 0, prepend "91"
 *   - anything else returned as-is
 *
 * Keep this in sync with app/api/campaigns/[id]/send-test/route.ts.
 */
function normalisePhone(raw: string): string {
  let digits = String(raw).replace(/\D/g, "")
  digits = digits.replace(/^\+/, "")

  if (digits.startsWith("91") && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`
  return digits
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { to_number, message, lead_name } = body

  if (!to_number || !message) {
    return NextResponse.json(
      { error: "Phone number and message are required" },
      { status: 400 }
    )
  }

  const productId = process.env.MAYTAPI_PRODUCT_ID
  const phoneId = process.env.MAYTAPI_PHONE_ID
  const apiToken = process.env.MAYTAPI_API_TOKEN

  if (!productId || !phoneId || !apiToken) {
    return NextResponse.json(
      { error: "WhatsApp API is not configured. Set MAYTAPI_PRODUCT_ID, MAYTAPI_PHONE_ID, and MAYTAPI_API_TOKEN." },
      { status: 503 }
    )
  }

  // Normalise phone number — always ends up as 12 digits with "91" prefix
  const cleanNumber = normalisePhone(to_number)

  try {
    const maytapiRes = await fetch(
      `https://api.maytapi.com/api/${productId}/${phoneId}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-maytapi-key": apiToken,
        },
        body: JSON.stringify({
          to_number: cleanNumber,
          type: "text",
          message,
        }),
      }
    )

    const maytapiData = await maytapiRes.json()

    if (!maytapiRes.ok || maytapiData.success === false) {
      return NextResponse.json(
        { error: maytapiData.message || "Maytapi API returned an error" },
        { status: 502 }
      )
    }

    // Log the interaction in Supabase using service-level access
    // We use the request's auth cookie to identify the current user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Extract lead_id from the request if provided, or look up by phone
      const leadLookup = await supabase
        .from("leads")
        .select("id")
        .or(`phone.eq.${cleanNumber},phone.eq.${to_number}`)
        .limit(1)
        .maybeSingle()

      if (leadLookup.data) {
        await supabase.from("interactions").insert({
          lead_id: leadLookup.data.id,
          type: "whatsapp_sent",
          title: `WhatsApp sent to ${lead_name || cleanNumber}`,
          notes: message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message_id: maytapiData.data?.chatId ?? null,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Failed to send WhatsApp message: ${errorMessage}` },
      { status: 500 }
    )
  }
}
