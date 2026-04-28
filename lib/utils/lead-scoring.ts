import type { LeadSource } from "@/lib/types"

// ── Inputs ──────────────────────────────────────────────────────────

export interface ScorableLead {
  email?: string | null
  company_name?: string | null
  city?: string | null
  service_line?: string | null
  whatsapp_opted_in?: boolean | null
  estimated_budget?: string | null
  source?: LeadSource | string | null
  stage_slug?: string | null
}

export interface ScoreBreakdown {
  budget: number
  source: number
  profile: number
  activity: number
  stage: number
  total: number
}

export interface ScoreResult extends ScoreBreakdown {
  label: "Hot" | "Warm" | "Lukewarm" | "Cold"
  color: string
}

// Plain score badge styling for UIs that show only the numeric score.
export const PLAIN_SCORE_BADGE_STYLE = {
  background: "#1F1F2E",
  color: "#9090A8",
  padding: "2px 8px",
  borderRadius: 20,
  fontSize: 11,
} as const

export const MAX_POINTS = {
  budget: 25,
  source: 15,
  profile: 15,
  activity: 25,
  stage: 20,
  total: 100,
} as const

// ── Individual category scorers ─────────────────────────────────────

export function scoreBudget(budget?: string | null): number {
  if (!budget) return 0
  const b = budget.toLowerCase()
  // Match ranges by keywords/symbols; order matters (check ≥₹2Cr first)
  if (b.includes("2cr+") || /\b2\s*cr\+/.test(b) || b.includes("₹2cr+")) return 25
  if (b.includes("1cr - ₹2cr") || b.includes("1cr-₹2cr") || (b.includes("1cr") && b.includes("2cr"))) return 20
  if (b.includes("50l - ₹1cr") || b.includes("50l-₹1cr") || (b.includes("50l") && b.includes("1cr"))) return 15
  if (b.includes("25l - ₹50l") || b.includes("25l-₹50l") || (b.includes("25l") && b.includes("50l"))) return 8
  if (b.includes("below") || b.includes("< ₹25") || b.includes("<₹25") || b.includes("under")) return 3
  // Fallback: if it mentions "l" (lakhs) alone, treat as small
  if (b.includes("l") && !b.includes("cr")) return 3
  return 0
}

export function scoreSource(source?: LeadSource | string | null): number {
  switch (source) {
    case "referral":
      return 15
    case "website":
      return 12
    case "linkedin":
      return 10
    case "google_ads":
      return 8
    case "manual_sales":
      return 6
    case "justdial":
      return 4
    case "whatsapp_inbound":
      return 8
    case "ai_suggested":
      return 5
    case "other":
      return 2
    default:
      return 2
  }
}

export function scoreProfile(lead: ScorableLead): number {
  let points = 0
  if (lead.email?.trim()) points += 3
  if (lead.company_name?.trim()) points += 3
  if (lead.city?.trim()) points += 3
  if (lead.service_line?.trim()) points += 3
  if (lead.whatsapp_opted_in) points += 3
  return Math.min(points, MAX_POINTS.profile)
}

/**
 * Score activity based on the number of interactions in the last 30 days.
 */
export function scoreActivity(interactionCountLast30Days: number): number {
  const n = Math.max(0, interactionCountLast30Days)
  if (n === 0) return 0
  if (n <= 2) return 8
  if (n <= 5) return 15
  if (n <= 10) return 20
  return 25
}

export function scoreStage(stageSlug?: string | null): number {
  switch (stageSlug) {
    case "new_lead":
      return 5
    case "contacted":
      return 8
    case "qualified":
      return 11
    case "site_visit_scheduled":
      return 14
    case "proposal_sent":
      return 17
    case "negotiation":
      return 20
    case "won":
    case "lost":
      return 0
    case "on_hold":
      return 3
    case "reengagement":
      return 6
    default:
      return 0
  }
}

// ── Label / color mapping ───────────────────────────────────────────

export function getScoreLabel(total: number): { label: ScoreResult["label"]; color: string } {
  if (total >= 80) return { label: "Hot", color: "#EF4444" }
  if (total >= 60) return { label: "Warm", color: "#F59E0B" }
  if (total >= 40) return { label: "Lukewarm", color: "#3B82F6" }
  return { label: "Cold", color: "#6B7280" }
}

// ── Main entry point ────────────────────────────────────────────────

export function scoreLead(
  lead: ScorableLead,
  interactionCountLast30Days: number
): ScoreResult {
  const budget = scoreBudget(lead.estimated_budget)
  const source = scoreSource(lead.source)
  const profile = scoreProfile(lead)
  const activity = scoreActivity(interactionCountLast30Days)
  const stage = scoreStage(lead.stage_slug)
  const total = Math.min(budget + source + profile + activity + stage, MAX_POINTS.total)
  const { label, color } = getScoreLabel(total)

  return { budget, source, profile, activity, stage, total, label, color }
}
