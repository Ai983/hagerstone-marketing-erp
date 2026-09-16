# Runo ↔ Hagerstone ERP — Integration Plan

Status: **plan / not implemented**
Last updated: 2026-09-07

---

## 0. What Runo is, and what we actually get from it

Runo is a SIM-based call-management CRM. The rep's own phone makes the call; the Runo
Android/iOS app intercepts the call event and logs number, direction, duration, disposition
and a cloud-stored recording. That means Runo owns the *ground truth for telephony* — which
is exactly the data our `interactions` table currently only gets when a rep manually opens
`LogCallModal` and types it in.

So the integration is worth doing for one concrete reason: **calls stop being self-reported.**

Two data flows:

| Direction | What moves | Mechanism |
|---|---|---|
| **ERP → Runo** | New/assigned leads pushed as Runo "allocations" so they appear in the rep's dialler queue with context | `POST https://api.runo.in/v1/crm/allocation` |
| **Runo → ERP** | Every completed call (direction, duration, disposition, recording URL) becomes an `interaction` row | Runo outbound webhook → `/api/webhook/runo-call`, plus a nightly reconciliation pull |

### Confirmed facts (from public sources — must be re-verified against the real docs)

- Base URL: `https://api.runo.in`
- Auth: header `Auth-Key: <api key>` (not `Authorization: Bearer`)
- Allocation endpoint: `POST /v1/crm/allocation`, body shape:
  ```json
  {
    "customer": { "name": "...", "phoneNumber": "...", "email": "..." },
    "priority": 2,
    "notes": "...",
    "processName": "Hagerstone Sales",
    "assignedTo": "+919876543210"
  }
  ```
- API key is generated in the Runo admin web app: **Admin → API config** (`https://app-call.runo.in/#api-config`)
- Webhooks are configured in **Admin → Integrations → Webhooks**
- Runo has public GET / POST / DELETE APIs
- **Important commercial caveat:** Runo's own FAQ says the free API tier moves data
  **once a day**. Real-time push must be enabled by Runo support (`care@runo.ai`). Our
  design must therefore work in *both* modes — webhook when available, nightly pull always.
- Call recordings are stored **6 months** as `.mp3`/`.aac` on AWS, then expire.

Sources: [docs.runo.in](https://docs.runo.in/) · [Runo FAQ](https://runo.ai/faq) ·
[Spur ↔ Runo integration guide](https://help.spurnow.com/en/articles/12167147-spur-runo-crm-integration-guide-custom-ai-action-for-lead-sync) ·
[Make.com Runo app](https://www.make.com/en/integrations/runo-call-management-crm)

> The exact webhook payload schema is **not** publicly documented. Everything in §4 is
> written against an adapter layer so that a single mapping function absorbs whatever
> field names Runo actually sends. Do not hardcode Runo field names anywhere else.

---

## 1. Things I need from Runo before writing code

This is the checklist to send to your Runo account manager / `care@runo.ai`.

### Blocking — cannot build without these

| # | Item | Where it comes from |
|---|---|---|
| 1 | **API key** (`Auth-Key` value) | Runo admin web → Admin → API config → generate |
| 2 | **Confirm base URL + API version** — is it `https://api.runo.in/v1/...` for all endpoints, or does the CRM interactions route sit on `/api/crm/...`? | Runo support |
| 3 | **The full API documentation** — `docs.runo.in` is a JavaScript app and doesn't render for automated fetching. Ask for a **PDF, Postman collection, or OpenAPI/Swagger file**. | Runo support |
| 4 | **Exact `processName`** we should allocate into (Runo groups leads into "Processes"; a wrong name silently misfiles leads) | Runo admin → Processes |
| 5 | **Real-time webhook enablement.** Explicitly ask: "we need call events pushed in real time, not the once-a-day sync — please enable it and confirm any cost." | `care@runo.ai` |
| 6 | **A sample webhook payload** (one real JSON body for an answered outbound call, one for a missed call) | Runo support |
| 7 | **Webhook authentication options.** Ask: can we set a **custom static header** (e.g. `x-runo-secret: <value>`) on the outbound webhook, or is there an HMAC signature? If neither, we fall back to a secret embedded in the URL path. | Runo admin → Integrations → Webhooks |
| 8 | **The exact disposition list** configured on your account, as strings | Runo admin → CRM fields and Dispositions |

### Needed, but work can start without them

| # | Item | Why |
|---|---|---|
| 9 | **Roster of Runo users**: full name + registered mobile number (+ Runo `userId` if exposed) for every rep | To map a Runo call to a `profiles.id`. Without it, calls land unattributed. |
| 10 | **Are call recording URLs included** in the webhook/API response? Are they public, or signed/expiring? | Decides whether we store the URL or must re-fetch and mirror the file to Supabase Storage before the 6-month expiry |
| 11 | **GET endpoint for call logs by date range** (path + query params + pagination) | Powers the nightly reconciliation and the historical backfill |
| 12 | **Rate limits** (requests/min, daily cap) and whether they allowlist source IPs | Batch push sizing; Vercel has no static IP, so an IP allowlist would be a blocker |
| 13 | **Custom CRM field IDs** if we want to push budget / service line / stage into Runo | Optional enrichment |
| 14 | **A sandbox or trial sub-account** | So we don't test against live sales data |
| 15 | **Do they support a "lead updated" or "disposition changed" webhook**, or only call events? | Decides whether stage sync can be two-way |

### What Runo needs from us

- The webhook URL: `https://erp.hagerstone.com/api/webhook/runo-call`
- Confirmation of which events to send (call ended / disposition submitted)

---

## 2. Environment variables to add

```bash
# Runo call-management CRM
RUNO_API_KEY=                 # Auth-Key header value, from Admin → API config
RUNO_BASE_URL=https://api.runo.in
RUNO_PROCESS_NAME=            # e.g. "Hagerstone Sales"
RUNO_WEBHOOK_SECRET=          # our own value; set as a custom header on Runo's webhook
RUNO_SYNC_ENABLED=false       # kill switch — when false, every push is a no-op
RUNO_DEFAULT_PRIORITY=2
```

`RUNO_SYNC_ENABLED` matters: it lets us ship the code dark and turn it on once the Runo
side is configured, and lets us kill the outbound push instantly if it starts double-writing.

---

## 3. Database migration

New file: `runo_integration.sql` (root, alongside the other migration SQL files).

```sql
-- Map an ERP user to their Runo identity
ALTER TABLE marketing.profiles
  ADD COLUMN IF NOT EXISTS runo_user_phone TEXT,
  ADD COLUMN IF NOT EXISTS runo_user_id   TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_runo_phone
  ON marketing.profiles (runo_user_phone);

-- Track which leads have been pushed to Runo
ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS runo_lead_id    TEXT,
  ADD COLUMN IF NOT EXISTS runo_synced_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS runo_sync_error TEXT;

-- Telephony detail on the activity timeline
ALTER TABLE marketing.interactions
  ADD COLUMN IF NOT EXISTS external_source   TEXT,   -- 'runo'
  ADD COLUMN IF NOT EXISTS external_id       TEXT,   -- Runo's call id
  ADD COLUMN IF NOT EXISTS recording_url     TEXT,
  ADD COLUMN IF NOT EXISTS call_disposition  TEXT,   -- raw Runo string, unmapped
  ADD COLUMN IF NOT EXISTS duration_seconds  INTEGER;

-- Idempotency: the same call must never create two interactions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_external
  ON marketing.interactions (external_source, external_id)
  WHERE external_id IS NOT NULL;

-- Audit trail for every Runo exchange (debugging a black-box vendor API)
CREATE TABLE IF NOT EXISTS marketing.runo_sync_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  direction    TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  event_type   TEXT,
  lead_id      UUID REFERENCES marketing.leads(id) ON DELETE SET NULL,
  external_id  TEXT,
  status       TEXT NOT NULL CHECK (status IN ('ok','skipped','error')),
  error        TEXT,
  raw_payload  JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runo_sync_log_created
  ON marketing.runo_sync_log (created_at DESC);
```

Note `duration_seconds` is added alongside the existing `duration_minutes` — Runo reports
seconds, and rounding a 40-second call to "0 minutes" or "1 minute" loses real information.
`duration_minutes` stays populated (rounded) so `LeadTimeline` and analytics keep working
unchanged.

---

## 4. Code to write

### 4.1 `lib/utils/runo.ts` — the gateway client

Mirrors the contract already established by `lib/utils/whatsapp.ts`: **every exported
function returns `{ success, ... , error? }` and never throws.** Callers branch on
`result.success`.

```ts
export interface RunoResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// POST /v1/crm/allocation
export async function createRunoAllocation(input: {
  name: string
  phoneNumber: string
  email?: string | null
  notes?: string | null
  assignedTo?: string | null   // rep's Runo-registered phone
  priority?: number
}): Promise<RunoResult<{ allocationId?: string }>>

// GET call logs for a date range (endpoint TBC — item #11)
export async function fetchRunoCallLogs(
  from: Date,
  to: Date
): Promise<RunoResult<RunoCallLog[]>>

export async function checkRunoHealth(): Promise<RunoResult<{ reachable: boolean }>>
```

Implementation notes:
- Short timeout (`AbortSignal.timeout(10_000)`) — Runo must never hang a request of ours.
- If `RUNO_SYNC_ENABLED !== 'true'`, return `{ success: true, data: undefined }` immediately
  and log a skip. Ship dark by default.
- Phone numbers to Runo go out in **E.164** (`+91XXXXXXXXXX`). Our DB stores them
  unprefixed, so normalise on the way out.

### 4.2 `lib/utils/phone.ts` — extract the existing normaliser

`normalisePhone()` currently lives privately inside
[app/api/webhook/website-leads/route.ts:18](../app/api/webhook/website-leads/route.ts#L18).
The Runo webhook needs the identical logic to match an incoming call to a lead, so lift it
into `lib/utils/phone.ts` and export both `normalisePhone()` (strip `+91`) and
`toE164()` (add `+91`). Update `website-leads` to import it — no behaviour change.

Getting this wrong is the single most likely cause of a silent failure: Runo will send
`+919876543210`, our `leads.phone` may hold `9876543210`, `09876543210`, or
`+91 98765 43210`.

### 4.3 `lib/utils/runo-mapping.ts` — the adapter layer

All Runo-specific field names live here and nowhere else.

```ts
// Runo direction/status → our interactions.type
'outgoing' + answered → 'call_outbound'
'incoming' + answered → 'call_inbound'
any + not answered / rejected / duration 0 → 'call_missed'

// Runo disposition string → our interactions.outcome CHECK enum
// (must be filled in from checklist item #8; unknown values fall through to 'other'
//  and the raw string is preserved in interactions.call_disposition)
'Interested'          → 'interested'
'Not Interested'      → 'not_interested'
'Call Back'/'Callback'→ 'callback_requested'
'Not Answered'/'RNR'  → 'no_answer'
'Busy'                → 'busy'
'Wrong Number'        → 'wrong_number'
'Switched Off'        → 'no_answer'
'Converted'/'Won'     → 'converted'
'Lost'/'Dropped'      → 'lost'
<anything else>       → 'other'
```

Never drop a call because its disposition is unrecognised — map to `other`, keep the raw
string, and the mapping table can be extended later without data loss.

### 4.4 `app/api/webhook/runo-call/route.ts` — inbound (the important half)

Already bypasses auth: `middleware.ts` short-circuits any path starting with
`/api/webhook` ([middleware.ts:13](../middleware.ts#L13)), so this route verifies its own
secret exactly like the website-leads webhook does.

```
POST /api/webhook/runo-call
  header: x-runo-secret: <RUNO_WEBHOOK_SECRET>     (fallback: ?secret= in the URL)
```

Handler steps:

1. **Verify secret** → 401 on mismatch.
2. **Log the raw payload** to `runo_sync_log` *before* processing. With an undocumented
   vendor payload, the first week of raw bodies is how we finish the mapping table.
3. **Extract + normalise the customer phone.**
4. **Idempotency check** — if an interaction already exists with
   `(external_source='runo', external_id=<call id>)`, return `200 {status:'duplicate'}`.
   Runo will retry; we must be safe to replay.
5. **Match the lead** by normalised phone against `phone` and `phone_alt`.
   - Match → attach to it.
   - No match → **auto-create a lead** with `source: 'whatsapp_inbound'`… no: add a new
     `LeadSource` value `'runo_call'` to `lib/types/index.ts` and the `leads.source` CHECK
     constraint. An unknown number that a rep spent 4 minutes on is a real lead; dropping it
     is the wrong default. Gate this behind `RUNO_AUTOCREATE_LEADS` so you can decide.
   - Multiple matches → attach to the most recently updated, and note the ambiguity in
     `runo_sync_log`.
6. **Resolve the agent** — map the Runo caller's number to `profiles.runo_user_phone` →
   `interactions.user_id`. No match → leave `user_id` null and set `is_automated = true`.
7. **Insert the interaction**: `type`, `outcome`, `duration_seconds`, `duration_minutes`
   (rounded), `recording_url`, `call_disposition`, `external_source='runo'`, `external_id`,
   `title` like `"Call — 4m 12s (Interested)"`, `notes` from Runo's remarks field.
8. **Post-processing, all fire-and-forget and individually try/caught** so none of them can
   fail the webhook:
   - Re-score the lead (`/api/leads/score`) — the Activity bucket is worth 25 points and
     call volume is exactly what it measures.
   - If Runo sends a follow-up date, create a row in `tasks` and set `follow_up_at`.
   - If disposition maps to `converted` / `lost`, **do not** auto-move the pipeline stage.
     Notify the assignee instead. Stage moves have `requires_note` / `requires_value`
     rules that a webhook can't satisfy honestly.
   - `notifications` insert for the assigned rep on a missed inbound call.
9. Return `200` always once the secret is valid — a 500 makes Runo retry-storm us.

### 4.5 `app/api/cron/runo-sync/route.ts` — the safety net

Runs hourly (or daily if real-time webhooks aren't enabled — checklist item #5). Standard
`Authorization: Bearer ${CRON_SECRET}` guard like every other route in `app/api/cron/`.

- Pull call logs for the last 48h via `fetchRunoCallLogs()`.
- Feed each through the **same mapping + insert path as the webhook** (extract that into a
  shared `ingestRunoCall()` function so the two paths can't drift).
- The unique index on `(external_source, external_id)` makes the overlap free.
- Push any lead with `assigned_to IS NOT NULL AND runo_synced_at IS NULL` up to Runo,
  in batches, respecting the rate limit.

This is what makes the integration survive a missed webhook, a Vercel cold-start timeout,
or Runo being on the once-a-day free tier.

### 4.6 `app/api/runo/push-lead/route.ts` — outbound

`POST { lead_id }` → builds the allocation payload and calls `createRunoAllocation()`,
then stamps `runo_lead_id` / `runo_synced_at`, or `runo_sync_error` on failure.

Triggered from:
- `ReassignPopover` / assignment change — the new owner needs it in *their* dialler.
- The website-leads webhook, after lead creation (fire-and-forget, same pattern as the
  existing AI-categorise call at
  [website-leads/route.ts:243](../app/api/webhook/website-leads/route.ts#L243)).
- A "Push to Runo" button in `LeadDrawer` for manual retry.

`assignedTo` = the assignee's `runo_user_phone`. If that's null, skip the push and record
why — allocating to nobody is worse than not allocating.

### 4.7 Admin surface

- `app/api/admin/test-runo/route.ts` — health check, alongside the existing
  `test-whatsapp` / `test-anthropic` routes.
- Add a **Runo** card to `/admin/integrations` showing: key present, base URL, last inbound
  webhook timestamp, 7-day call counts, last 20 `runo_sync_log` errors.
- Add `runo_user_phone` as an editable field on `/admin/users` — this is the mapping table
  from checklist item #9, and it needs a UI or it'll rot.

### 4.8 UI changes

- `LeadTimeline` — render an `<audio>` player for `recording_url`, and a "via Runo" badge
  on auto-logged calls so reps can tell them from manual entries.
- `LogCallModal` — once Runo is live, calls arrive automatically. Keep the modal (for calls
  from a landline / a rep without the app) but add a hint that Runo-logged calls appear on
  their own, to stop double-entry.
- Analytics — call volume and connect rate become trustworthy; worth a follow-up card.

---

## 5. Rollout sequence

| Phase | Work | Gate |
|---|---|---|
| **0** | Send §1 checklist to Runo; get key, docs, sample payload, real-time webhook enabled | — |
| **1** | Migration + `lib/utils/phone.ts` extraction + `lib/utils/runo.ts` + admin health card. `RUNO_SYNC_ENABLED=false` | Health check green against the real API |
| **2** | Fill `profiles.runo_user_phone` for every rep via `/admin/users` | 100% of active reps mapped |
| **3** | Webhook route in **log-only mode** — writes `runo_sync_log`, creates no interactions. Point Runo at it. | ~50 real payloads captured; disposition mapping finalised from the actual strings |
| **4** | Enable interaction writes. Pilot on **one rep** for a week. | No duplicates, no orphaned calls, recordings play |
| **5** | Enable `runo-sync` cron + outbound lead push. Full team. | — |
| **6** | Optional: historical backfill of past call logs | — |

Phase 3 is not optional padding. The webhook payload is undocumented; building the mapping
against guessed field names and then discovering the truth in production means dirty rows
in `interactions` that are painful to unwind.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Real-time webhook is a paid add-on, or unavailable | Cron pull is designed as a first-class path, not a fallback afterthought |
| Phone-format mismatch silently orphans every call | Shared `phone.ts`; phase 3 log-only mode surfaces the match rate before we commit |
| Runo retries create duplicate interactions | Unique index on `(external_source, external_id)` — enforced in the DB, not in app code |
| Recording URLs expire at 6 months | Ask (item #10); if signed/expiring, add a cron that mirrors recordings into Supabase Storage |
| Runo rate-limits the outbound push | Batch + backoff in the cron; `runo_sync_at` makes the push resumable |
| Runo requires source-IP allowlisting | **Blocker** — Vercel has no static egress IP. Confirm early (item #12); would need a proxy |
| Double-logging (rep uses `LogCallModal` *and* Runo fires) | Timeline badge + hint copy; optionally dedupe on same lead + same ±2 min window |
| Vendor API changes without notice | Every Runo field name is confined to `runo-mapping.ts` |

---

## 7. Files touched — summary

**New**
```
docs/runo-integration-plan.md          (this file)
runo_integration.sql                   migration
lib/utils/runo.ts                      API client
lib/utils/runo-mapping.ts              payload adapter + disposition map
lib/utils/phone.ts                     extracted normaliser
app/api/webhook/runo-call/route.ts     inbound call events
app/api/cron/runo-sync/route.ts        reconciliation + batch push
app/api/runo/push-lead/route.ts        outbound allocation
app/api/admin/test-runo/route.ts       health check
```

**Modified**
```
lib/types/index.ts                     + 'runo_call' LeadSource, Runo fields on Lead/Interaction/Profile
app/api/webhook/website-leads/route.ts import shared normalisePhone; fire push-lead
app/(dashboard)/admin/integrations/page.tsx   Runo status card
app/(dashboard)/admin/users/page.tsx   runo_user_phone field
components/leads/LeadTimeline.tsx      recording player + "via Runo" badge
components/leads/LogCallModal.tsx      double-entry hint
components/leads/ReassignPopover.tsx   trigger push on reassignment
.env.example                           new RUNO_* vars
CLAUDE.md                              new §  documenting the integration
```
