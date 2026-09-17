import { format, getDate, getDay, lastDayOfMonth, parseISO } from "date-fns"

export type ScheduleRepeat = "none" | "daily" | "weekly" | "monthly"

export interface ScheduleItem {
  id: string
  owner_id: string
  title: string
  notes: string | null
  lead_id: string | null
  lead?: { id: string; full_name: string; company_name: string | null } | null
  starts_on: string // yyyy-MM-dd
  time_of_day: string | null // HH:mm:ss
  repeat: ScheduleRepeat
  weekdays: number[] // 0 = Sunday … 6 = Saturday
  ends_on: string | null
  is_active: boolean
}

export interface ScheduleOccurrence {
  item: ScheduleItem
  date: string // yyyy-MM-dd
  done: boolean
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd")

/** Does this item fall on this day? */
export function occursOn(item: ScheduleItem, day: Date): boolean {
  const key = dayKey(day)
  if (!item.is_active || key < item.starts_on) return false
  if (item.ends_on && key > item.ends_on) return false

  switch (item.repeat) {
    case "none":
      return key === item.starts_on
    case "daily":
      return true
    case "weekly":
      return item.weekdays.includes(getDay(day))
    case "monthly": {
      // Same date each month; a 31st falls on the last day of shorter months.
      const wanted = getDate(parseISO(item.starts_on))
      const last = getDate(lastDayOfMonth(day))
      return getDate(day) === Math.min(wanted, last)
    }
  }
}

export function occurrences(
  items: ScheduleItem[],
  days: Date[],
  doneKeys: Set<string>
): ScheduleOccurrence[] {
  const out: ScheduleOccurrence[] = []
  for (const day of days) {
    for (const item of items) {
      if (!occursOn(item, day)) continue
      const date = dayKey(day)
      out.push({ item, date, done: doneKeys.has(`${item.id}|${date}`) })
    }
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.item.time_of_day ?? "99").localeCompare(b.item.time_of_day ?? "99") ||
      a.item.title.localeCompare(b.item.title)
  )
}

export function repeatLabel(item: Pick<ScheduleItem, "repeat" | "weekdays" | "starts_on">) {
  switch (item.repeat) {
    case "none":
      return "Once"
    case "daily":
      return "Every day"
    case "weekly": {
      const days = [...item.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "Weekdays"
      return `Every ${days.map((d) => WEEKDAY_SHORT[d]).join(", ")}`
    }
    case "monthly":
      return `Monthly on the ${ordinal(getDate(parseISO(item.starts_on)))}`
  }
}

export function timeLabel(time: string | null) {
  if (!time) return null
  const [h, m] = time.split(":").map(Number)
  const suffix = h >= 12 ? "pm" : "am"
  const hour = h % 12 || 12
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}
