const PORTFOLIO_PUBLIC_PREFIX = "/portfolio"
const PORTFOLIO_BUCKET = "portfolio"

function supabaseBaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url ? url.replace(/\/$/, "") : null
}

/**
 * Resolves a portfolio asset path to its public URL (Supabase Storage or a
 * configured CDN base). Use this for any asset type — videos, PDFs, images.
 */
export function portfolioMedia(path: string) {
  if (!path || path.startsWith("http")) return path

  const configuredBase = process.env.NEXT_PUBLIC_PORTFOLIO_MEDIA_BASE_URL
  const supabaseUrl = supabaseBaseUrl()
  const base =
    configuredBase ||
    (supabaseUrl
      ? `${supabaseUrl}/storage/v1/object/public/${PORTFOLIO_BUCKET}`
      : null)

  if (!base || !path.startsWith(PORTFOLIO_PUBLIC_PREFIX)) return path

  const objectPath = path.slice(PORTFOLIO_PUBLIC_PREFIX.length)
  return `${base.replace(/\/$/, "")}${objectPath}`
}

type ImageTransform = { width?: number; quality?: number }

/**
 * Like portfolioMedia(), but for images: routes through Supabase Storage's
 * on-the-fly image transform endpoint to serve a resized/compressed version.
 * The originals are full-resolution (10+ MB each), so always pass a width that
 * matches the rendered size. Falls back to the plain URL when a custom media
 * base is configured (we can't assume it supports transforms) or off Supabase.
 */
export function portfolioImage(path: string, transform: ImageTransform = {}) {
  if (!path || path.startsWith("http")) return path

  const configuredBase = process.env.NEXT_PUBLIC_PORTFOLIO_MEDIA_BASE_URL
  const supabaseUrl = supabaseBaseUrl()

  if (configuredBase || !supabaseUrl || !path.startsWith(PORTFOLIO_PUBLIC_PREFIX)) {
    return portfolioMedia(path)
  }

  const objectPath = path.slice(PORTFOLIO_PUBLIC_PREFIX.length)
  const params = new URLSearchParams()
  if (transform.width) params.set("width", String(transform.width))
  params.set("quality", String(transform.quality ?? 72))
  // resize=contain scales proportionally to fit the given width while
  // preserving aspect ratio. Without this, Supabase's transform leaves the
  // original height intact and produces a tall sliver that gets badly
  // cropped by object-fit:cover downstream.
  params.set("resize", "contain")

  return `${supabaseUrl}/storage/v1/render/image/public/${PORTFOLIO_BUCKET}${objectPath}?${params.toString()}`
}
