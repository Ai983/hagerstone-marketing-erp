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
  // Stage context. `stage_slug` alone still works (legacy path); when the
  // position/type are supplied, scoring adapts to any pipeline config so
  // renaming or adding stages never silently zeroes the stage score.
  stage_slug?: string | null
  stage_position?: number | null
  stage_type?: string | null
  stage_is_terminal?: boolean | null
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

// Legacy slug → points map. Retained as a fallback for callers that only
// know the stage slug and have no position/type context.
const LEGACY_STAGE_POINTS: Record<string, number> = {
  new_lead: 5,
  contacted: 8,
  qualified: 11,
  site_visit_scheduled: 14,
  proposal_sent: 17,
  negotiation: 20,
  won: 0,
  lost: 0,
  on_hold: 3,
  reengagement: 6,
}

export function scoreStage(stageSlug?: string | null): number {
  if (!stageSlug) return 0
  return LEGACY_STAGE_POINTS[stageSlug] ?? 0
}

export interface StageScoreInfo {
  slug?: string | null
  position?: number | null
  stage_type?: string | null
  is_terminal?: boolean | null
}

/**
 * Stage score that adapts to ANY pipeline configuration.
 *
 * Terminal / hold / re-engagement stages are recognised by `stage_type`,
 * so renaming them in Pipeline Config never breaks scoring. Active stages
 * are scored by their pipeline `position`. For the standard pipeline this
 * yields the same numbers as before — positions 1-6 → 5, 8, 11, 14, 17, 20 —
 * and a newly added/renamed active stage (e.g. "BOQ Received") is scored by
 * where it sits rather than dropping to 0.
 */
export function scoreStageFromStage(stage?: StageScoreInfo | null): number {
  if (!stage) return 0
  const type = stage.stage_type
  if (stage.is_terminal || type === "won" || type === "lost") return 0
  if (type === "on_hold") return 3
  if (type === "reengagement") return 6
  const pos = stage.position && stage.position > 0 ? stage.position : 1
  return Math.max(5, Math.min(5 + (pos - 1) * 3, MAX_POINTS.stage))
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
  // Prefer the config-agnostic scorer when position/type context is present;
  // fall back to the legacy slug map when only a slug is known.
  const hasStageContext =
    lead.stage_position != null ||
    lead.stage_type != null ||
    lead.stage_is_terminal != null
  const stage = hasStageContext
    ? scoreStageFromStage({
        slug: lead.stage_slug,
        position: lead.stage_position,
        stage_type: lead.stage_type,
        is_terminal: lead.stage_is_terminal,
      })
    : scoreStage(lead.stage_slug)
  const total = Math.min(budget + source + profile + activity + stage, MAX_POINTS.total)
  const { label, color } = getScoreLabel(total)

  return { budget, source, profile, activity, stage, total, label, color }
}
