import type {
  LeadRelationshipGroup,
  UniverseContact,
  UniverseRelationshipGroup,
} from "@/lib/types"

/**
 * Relationship groups — "different customers, different conversations".
 *
 * Lead groups are computed in the database (migration 017,
 * `marketing.lead_relationship_groups`); the thresholds below only feed
 * the hint text. Universe groups are a pure function of funnel_stage,
 * recency and converted_lead_id, so they are worked out here and turned
 * into column filters. Keep both in step with 017.
 */

export const GONE_QUIET_DAYS = 30
export const DORMANT_CLIENT_MONTHS = 12

export interface GroupMeta {
  label: string
  color: string
  hint: string
}

export const LEAD_GROUPS: Record<LeadRelationshipGroup, GroupMeta> = {
  new_prospect: { label: "New prospect", color: "#3B82F6", hint: "In New Lead — not worked yet" },
  warm_prospect: { label: "Warm prospect", color: "#8B5CF6", hint: `Being worked, contact in the last ${GONE_QUIET_DAYS} days` },
  proposal_pending: { label: "Proposal pending", color: "#F59E0B", hint: "BOQ, proposal or negotiation — push for a decision" },
  gone_quiet: { label: "Gone quiet", color: "#EF4444", hint: `Open deal with no client contact for ${GONE_QUIET_DAYS}+ days — call, or mark Lost` },
  active_client: { label: "Active client", color: "#10B981", hint: `Won in the last ${DORMANT_CLIENT_MONTHS} months` },
  dormant_client: { label: "Dormant client", color: "#06B6D4", hint: `Won more than ${DORMANT_CLIENT_MONTHS} months ago — ask about new needs` },
  lost: { label: "Lost", color: "#6B7280", hint: "Said no — re-approach later with something new" },
}

/** Display order: what needs attention first. */
export const LEAD_GROUP_ORDER: LeadRelationshipGroup[] = [
  "gone_quiet", "proposal_pending", "warm_prospect", "new_prospect",
  "active_client", "dormant_client", "lost",
]

export const UNIVERSE_GROUPS: Record<UniverseRelationshipGroup, GroupMeta> = {
  past_client: { label: "Past client", color: "#10B981", hint: "Worked with us before — farm for repeat work and referrals" },
  old_opportunity: { label: "Old opportunity", color: "#F59E0B", hint: "Enquiry or quote 6+ months old that never closed" },
  open_opportunity: { label: "Open opportunity", color: "#FBBF24", hint: "Enquiry or quote in the last 6 months" },
  engaged: { label: "Engaged contact", color: "#8B5CF6", hint: "Live correspondence or meetings" },
  contacted: { label: "Contacted", color: "#3B82F6", hint: "Touched at least once" },
  audience: { label: "Audience", color: "#6B7280", hint: "Marketing audience — relationship unknown" },
  in_pipeline: { label: "In pipeline", color: "#34D399", hint: "Already pulled into the working pipeline" },
}

export const UNIVERSE_GROUP_ORDER: UniverseRelationshipGroup[] = [
  "past_client", "old_opportunity", "open_opportunity", "engaged", "contacted", "audience", "in_pipeline",
]

export function isLeadGroup(value: string): value is LeadRelationshipGroup {
  return value in LEAD_GROUPS
}

export function isUniverseGroup(value: string): value is UniverseRelationshipGroup {
  return value in UNIVERSE_GROUPS
}

export function universeGroupOf(
  c: Pick<UniverseContact, "funnel_stage" | "recency" | "converted_lead_id">
): UniverseRelationshipGroup {
  if (c.converted_lead_id) return "in_pipeline"
  switch (c.funnel_stage) {
    case "5-CLIENT": return "past_client"
    case "4-OPPORTUNITY": return c.recency === "6mo+" ? "old_opportunity" : "open_opportunity"
    case "3-ENGAGED": return "engaged"
    case "2-CONTACTED": return "contacted"
    default: return "audience"
  }
}

/** Minimal slice of a PostgREST filter builder, so this stays client-agnostic. */
interface Filterable<T> {
  eq(column: string, value: string): T
  is(column: string, value: null): T
  not(column: string, operator: string, value: null): T
  or(filters: string): T
}

/** Narrow a universe_contacts query to one group — mirrors universeGroupOf. */
export function applyUniverseGroupFilter<T extends Filterable<T>>(q: T, group: UniverseRelationshipGroup): T {
  if (group === "in_pipeline") return q.not("converted_lead_id", "is", null)
  q = q.is("converted_lead_id", null)
  switch (group) {
    case "past_client": return q.eq("funnel_stage", "5-CLIENT")
    case "old_opportunity": return q.eq("funnel_stage", "4-OPPORTUNITY").eq("recency", "6mo+")
    case "open_opportunity": return q.eq("funnel_stage", "4-OPPORTUNITY").or("recency.is.null,recency.neq.6mo+")
    case "engaged": return q.eq("funnel_stage", "3-ENGAGED")
    case "contacted": return q.eq("funnel_stage", "2-CONTACTED")
    case "audience": return q.eq("funnel_stage", "1-AUDIENCE")
  }
}
