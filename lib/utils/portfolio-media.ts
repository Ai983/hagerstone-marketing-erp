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

const CLOUDINARY_CLOUD = 'dv9znt7kq'
const SUPABASE_BASE = 'https://tpfvnerrjhqwipyonngf.supabase.co/storage/v1/object/public'
// Bump CACHE_VERSION whenever a source image is re-uploaded to Supabase, so
// Cloudinary refetches the new file instead of serving its stale (or negative)
// cache for the old URL.
const CACHE_VERSION = '2'

export function portfolioImage(
  path: string,
  options: { width?: number; quality?: number } = {}
): string {
  const { width = 800 } = options
  const supabaseUrl = `${SUPABASE_BASE}/${path}?v=${CACHE_VERSION}`
  const encoded = encodeURIComponent(supabaseUrl)
  const transforms = `w_${width},q_auto,f_auto`
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/${transforms}/${encoded}`
}

const VIDEO_CACHE_VERSION = '1'

/**
 * Builds a Cloudinary video fetch URL for a portfolio video path. Routes the
 * compressed Supabase original through Cloudinary's video CDN, which caches
 * + serves it globally so we don't burn Supabase bandwidth on every visit.
 */
export function portfolioVideo(
  path: string,
  options: { width?: number } = {}
): string {
  const { width = 1920 } = options
  const supabaseUrl = `${SUPABASE_BASE}/${path}?v=${VIDEO_CACHE_VERSION}`
  const encoded = encodeURIComponent(supabaseUrl)
  // q_auto picks bitrate by content; f_auto serves webm/h264 per browser
  const transforms = `w_${width},q_auto,f_auto`
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/fetch/${transforms}/${encoded}`
}
