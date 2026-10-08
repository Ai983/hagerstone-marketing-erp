// Runo — SIM call tracking. Client for the public API at https://api.runo.in/v1
// (OpenAPI spec: https://docs.runo.in/openapi.yaml).
//
// Same contract as lib/utils/whatsapp.ts: every exported function returns
// `{ success, data?, error? }` and never throws.
//
// API facts worth knowing before changing anything here:
//  - Auth is the `Auth-Key` header, generated in the Runo admin web app.
//  - Call logs and CRM interactions are read one *past* date at a time
//    (today is refused), 100 rows per page.
//  - Runo can restrict API use to a window of hours ("This Api access is
//    only available between XX AM to XX AM IST") — that comes back as a 403.
//  - The call-log rows carry no recording link. Recordings only arrive by
//    Runo's webhook (see app/api/webhook/runo-call).

const BASE_URL = process.env.RUNO_BASE_URL || "https://api.runo.in/v1"
const PAGE_SIZE = 100
const MAX_PAGES = 50 // 5,000 rows a day is far beyond one phone's call volume

export interface RunoResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface RunoUser {
  userId: string
  name: string
  phoneNumber: string
  email?: string | null
}

export interface RunoCallLog {
  callId: string
  callerId: string
  calledBy: string
  name: string | null
  customerId: string | null
  phoneNumber: string
  /** epoch seconds */
  startTime: number
  /** seconds — null on the marker rows described below */
  duration: number | null
  /** null on marker rows Runo logs a second after some calls */
  type: "incoming" | "outgoing" | "missed" | null
  /** Disposition the caller picked, e.g. "Appointment Fixed". */
  status: string | null
  tag: "personal" | "unanswered" | null
  createdAt: number
}

export interface RunoInteraction {
  customer: {
    id: string
    name: string | null
    phoneNumber: string
    email?: string | null
  }
  notes: string | null
  assigned?: { from?: string | null; to?: string | null } | null
  /** epoch seconds */
  createdAt: number
}

export function isRunoConfigured(): boolean {
  return Boolean(process.env.RUNO_API_KEY)
}

async function runoGet<T>(path: string, query: Record<string, string> = {}): Promise<RunoResult<T>> {
  const key = process.env.RUNO_API_KEY
  if (!key) return { success: false, error: "RUNO_API_KEY is not set" }

  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)

  try {
    const res = await fetch(url, {
      headers: { "Auth-Key": key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await res.json().catch(() => null)) as
      | { statusCode?: number; message?: string; data?: T }
      | null

    if (!res.ok || !body || body.statusCode !== 0) {
      return {
        success: false,
        error: body?.message || `Runo ${path} failed with HTTP ${res.status}`,
      }
    }
    return { success: true, data: body.data }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : `Runo ${path} request failed`,
    }
  }
}

/** Walks every page of a paged Runo list for one date. */
async function fetchAllPages<T>(path: string, date: string): Promise<RunoResult<T[]>> {
  const rows: T[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await runoGet<{ metadata?: { total?: number }[]; data?: T[] }>(path, {
      date,
      pageNo: String(page),
    })
    if (!result.success) return { success: false, error: result.error }

    const batch = result.data?.data ?? []
    rows.push(...batch)
    const total = result.data?.metadata?.[0]?.total
    if (batch.length < PAGE_SIZE || (total != null && rows.length >= total)) break
  }
  return { success: true, data: rows }
}

export async function fetchRunoUsers(): Promise<RunoResult<RunoUser[]>> {
  const result = await runoGet<RunoUser[]>("/user")
  return result.success
    ? { success: true, data: result.data ?? [] }
    : { success: false, error: result.error }
}

/** All calls on one past date (YYYY-MM-DD, IST). */
export function fetchRunoCallLogs(date: string): Promise<RunoResult<RunoCallLog[]>> {
  return fetchAllPages<RunoCallLog>("/call/logs", date)
}

/** All CRM interactions (disposition + notes the rep typed) on one past date. */
export function fetchRunoInteractions(date: string): Promise<RunoResult<RunoInteraction[]>> {
  return fetchAllPages<RunoInteraction>("/crm/interactions", date)
}
