import { Suspense } from "react"

import { PortfolioPage } from "@/components/portfolio/PortfolioPage"
import { trackPortfolioView } from "@/lib/actions/portfolio-track"

interface Props {
  searchParams: { name?: string; sector?: string; lead_id?: string }
}

export default async function Portfolio({ searchParams }: Props) {
  const { name, sector, lead_id } = searchParams

  if (lead_id) void trackPortfolioView(lead_id)

  return (
    <Suspense fallback={null}>
      <PortfolioPage leadName={name} defaultSector={sector || "office_interiors"} />
    </Suspense>
  )
}
