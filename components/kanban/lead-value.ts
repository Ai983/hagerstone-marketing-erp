import type { KanbanLead } from "@/lib/hooks/useKanban"

/** The deal's best-known value: agreed price, then won value, then quote. */
export function leadValue(lead: KanbanLead) {
  return lead.final_agreed_price ?? lead.closure_value ?? lead.proposal_estimated_cost ?? 0
}

/** ₹2.5 Cr / ₹56.4 L / ₹80,000 */
export function formatInrShort(value: number) {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(value >= 1e8 ? 0 : 2).replace(/\.00$/, "")} Cr`
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1).replace(/\.0$/, "")} L`
  return `₹${Math.round(value).toLocaleString("en-IN")}`
}
