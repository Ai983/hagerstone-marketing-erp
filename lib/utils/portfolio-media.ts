const PORTFOLIO_PUBLIC_PREFIX = "/portfolio"
const PORTFOLIO_BUCKET = "portfolio"

export function portfolioMedia(path: string) {
  if (!path || path.startsWith("http")) return path

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const configuredBase = process.env.NEXT_PUBLIC_PORTFOLIO_MEDIA_BASE_URL
  const base =
    configuredBase ||
    (supabaseUrl
      ? `${supabaseUrl}/storage/v1/object/public/${PORTFOLIO_BUCKET}`
      : null)

  if (!base || !path.startsWith(PORTFOLIO_PUBLIC_PREFIX)) return path

  const objectPath = path.slice(PORTFOLIO_PUBLIC_PREFIX.length)
  return `${base.replace(/\/$/, "")}${objectPath}`
}
