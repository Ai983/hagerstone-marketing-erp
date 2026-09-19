/**
 * "People don't buy products. They hire solutions." Three short answers
 * captured when a deal is won (migration 022, leads.win_*). All optional.
 */
export interface WinStory {
  trigger: string
  whyUs: string
  worry: string
}

export const EMPTY_WIN_STORY: WinStory = { trigger: "", whyUs: "", worry: "" }

export const WIN_QUESTIONS: {
  key: keyof WinStory
  column: "win_trigger" | "win_why_us" | "win_worry"
  label: string
  placeholder: string
}[] = [
  { key: "trigger", column: "win_trigger", label: "What started their search?", placeholder: "e.g. Lease ending in March, team doubling" },
  { key: "whyUs", column: "win_why_us", label: "Why did they choose us?", placeholder: "e.g. Design + build under one roof, fast BOQ" },
  { key: "worry", column: "win_worry", label: "What worried them before saying yes?", placeholder: "e.g. Handover date, budget overrun" },
]

/** The leads-table columns for a win story; blanks are stored as null. */
export function winStoryColumns(story?: WinStory) {
  if (!story) return {}
  return {
    win_trigger: story.trigger.trim() || null,
    win_why_us: story.whyUs.trim() || null,
    win_worry: story.worry.trim() || null,
  }
}
