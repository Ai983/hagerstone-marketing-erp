import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    MAYTAPI_PRODUCT_ID: process.env.MAYTAPI_PRODUCT_ID ? "SET" : "MISSING",
    MAYTAPI_PHONE_ID: process.env.MAYTAPI_PHONE_ID ? "SET" : "MISSING",
    MAYTAPI_API_TOKEN: process.env.MAYTAPI_API_TOKEN ? "SET" : "MISSING",
    WHAPI_TOKEN: process.env.WHAPI_TOKEN ? "STILL EXISTS - DELETE IT" : "correctly absent",
    WHAPI_API_URL: process.env.WHAPI_API_URL ? "STILL EXISTS - DELETE IT" : "correctly absent",
    PRODUCT_ID_PREVIEW: process.env.MAYTAPI_PRODUCT_ID?.slice(0, 8) ?? "missing",
    PHONE_ID_PREVIEW: process.env.MAYTAPI_PHONE_ID ?? "missing",
  })
}
