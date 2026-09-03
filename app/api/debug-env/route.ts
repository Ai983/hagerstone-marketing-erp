import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    WHATSAPP_GATEWAY_URL: process.env.WHATSAPP_GATEWAY_URL ?? "using default",
    WHATSAPP_SESSION_ID: process.env.WHATSAPP_SESSION_ID ?? "using default",
    WHATSAPP_GATEWAY_SECRET: process.env.WHATSAPP_GATEWAY_SECRET ? "SET" : "MISSING",
    MAYTAPI_API_TOKEN: process.env.MAYTAPI_API_TOKEN
      ? "STILL EXISTS - DELETE IT (migrated to self-hosted gateway)"
      : "correctly absent",
    WHAPI_TOKEN: process.env.WHAPI_TOKEN ? "STILL EXISTS - DELETE IT" : "correctly absent",
    WHAPI_API_URL: process.env.WHAPI_API_URL ? "STILL EXISTS - DELETE IT" : "correctly absent",
  })
}
