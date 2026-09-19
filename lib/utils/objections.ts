/**
 * What clients push back with, and why deals are lost — the raw material
 * for the playbook's feedback loop. Objections are stored as keys on
 * `interactions.objections` (migration 019), so labels can change freely;
 * never rename or reuse a key.
 */

export const OBJECTIONS = [
  { key: "price_high", label: "Price too high / over budget" },
  { key: "has_vendor", label: "Already have a vendor" },
  { key: "need_to_think", label: "Need to think / internal approval" },
  { key: "not_now", label: "Not now — project is later" },
  { key: "send_details", label: "Send details / profile first" },
  { key: "want_proof", label: "Want to see past work / references" },
  { key: "no_decision_maker", label: "Decision-maker not available" },
  { key: "other", label: "Other" },
] as const

export type ObjectionKey = (typeof OBJECTIONS)[number]["key"]

const OBJECTION_LABEL = new Map<string, string>(OBJECTIONS.map((o) => [o.key, o.label]))

/** Short label for chips and charts; unknown keys pass through. */
export function objectionLabel(key: string) {
  return OBJECTION_LABEL.get(key) ?? key
}

/**
 * Loss reasons are stored as their text in `leads.closure_reason` (the
 * column predates this list), so older values like "Budget constraints"
 * or "No response" still read fine in Analytics.
 */
export const LOSS_REASONS = [
  "Price too high",
  "Chose competitor",
  "Went silent",
  "Budget cut",
  "Timeline moved",
  "Project cancelled",
  "Scope we don't do",
  "Did it in-house / via landlord",
  "Other",
] as const

export const COMPETITOR_LOSS_REASON = "Chose competitor"
