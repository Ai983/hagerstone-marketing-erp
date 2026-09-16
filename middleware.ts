import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PATHS = new Set(["/login", "/signup", "/portfolio"])
const PUBLIC_PREFIXES = ["/portfolio/"]

export async function middleware(request: NextRequest) {
  // Webhooks (Maytapi inbound, website lead capture, etc.) come from
  // external services with no Supabase session cookie. Same for cron
  // jobs hit by Vercel's scheduler. Skip middleware for both so they
  // aren't bounced to /login. Each route does its own auth/secret
  // verification (e.g. WEBHOOK_SECRET, CRON_SECRET).
  if (request.nextUrl.pathname.startsWith("/api/webhook")) {
    return NextResponse.next()
  }
  if (request.nextUrl.pathname.startsWith("/api/cron")) {
    return NextResponse.next()
  }
  if (request.nextUrl.pathname.startsWith("/api/campaign-unsubscribe")) {
    return NextResponse.next()
  }
  if (request.nextUrl.pathname.startsWith("/api/email/webhook")) {
    return NextResponse.next()
  }
  if (request.nextUrl.pathname.startsWith("/api/ai/categorise-lead")) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/pipeline", request.url))
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "marketing" },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublicPath =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle()

    const hasProfile = Boolean(profile)

    if (!hasProfile && request.nextUrl.pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/onboarding", request.url))
    }

    if (hasProfile && request.nextUrl.pathname === "/onboarding") {
      return NextResponse.redirect(new URL("/pipeline", request.url))
    }

    if (
      request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup"
    ) {
      return NextResponse.redirect(
        new URL(hasProfile ? "/pipeline" : "/onboarding", request.url)
      )
    }

    // Two roles — admin and sales_head — and both may open every page,
    // so there are no per-page role redirects. Signing in and having a
    // profile (checked above) is the only gate.
  }

  return response
}

// Skip middleware for Next internals AND any static asset extension
// served from /public — otherwise unauthenticated requests for files
// like /logo.png or /portfolio/pdfs/mep.pdf get redirected to /login.
// PDF is included so leads can open sector portfolio PDFs without
// being prompted for a login they don't have.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:pdf|png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|map|mp4|webm|mov)$).*)",
  ],
}
