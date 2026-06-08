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

export function portfolioImage(
  path: string,
  options: { width?: number; quality?: number } = {}
): string {
  const { width = 800 } = options
  const supabaseUrl = `${SUPABASE_BASE}/${path}`
  const encoded = encodeURIComponent(supabaseUrl)
  const transforms = `w_${width},q_auto,f_auto`
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/${transforms}/${encoded}`
}
