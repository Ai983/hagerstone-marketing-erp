# Hagerstone ERP — Session Build Log

This document captures every change made in the current Claude Code session.
Feed this whole file back to Claude in a future session as context to update
the original PRD / spec MD file. It is **not** a user-facing doc — it is a
developer/AI handoff document.

Project root: `d:\New folder (2)\hagerstone-erp`

---

## 1. Steps completed this session

| # | Step | Status |
|---|---|---|
| 9 | Lead Drawer (480 px right-side panel, 5 tabs) | done |
| 10 | Interaction logging (Log Call / Follow-up / WhatsApp / Note) | done |
| 11 | Supabase Realtime — live Kanban + Tasks updates | done |
| 12 | Website lead webhook receiver | done |
| 14 | Analytics dashboard (`/analytics`) | done |
| 15 | Admin panel (`/admin/*`) | done |
| 16 | Demo mode banner + Inbox + My Tasks + final polish | done |
| 17 | Campaign Builder (list + create + detail with 3 tabs) | done |
| 18 | Lead Scoring Engine (0–100 with breakdown) | done |
| 19 | Real Anthropic AI integration (replaces mocks) | done |
| 20 | Daily WhatsApp briefing (cron + admin config) | done |

Steps 1–8 (scaffold, schema, auth, layout, lead form/table, kanban, DnD)
were already in place before this session started.

Step 13 was not in the spec list received this session.

---

## 2. New routes registered

After all steps, the build produces 34 routes. Notable additions this session:

### Pages
- `/inbox` — manager/admin/founder only. Unassigned-leads triage.
- `/activities` — every role. Open tasks grouped Overdue / Today / Upcoming.
- `/analytics` — KPI cards, funnel, source volume, rep table, heatmap, won/lost.
- `/admin` — overview with section cards + sample data + daily briefing config.
- `/admin/users` — invite, role edit, deactivate.
- `/admin/pipeline-config` — drag-reorder stages, edit color/name.
- `/admin/integrations` — webhook URL + test buttons.
- `/campaigns` — list with empty state.
- `/campaigns/new` — form (name, goal, service line, status).
- `/campaigns/[id]` — 3 tabs: Messages / Enrolled Leads / Settings.
- `/ai-agent` — pipeline summary + lead assistant + quick actions.

### API routes
- `POST /api/whatsapp/send` — single WhatsApp via Maytapi.
- `POST /api/webhook/website-leads` — secret-protected; dedupes by phone.
- `POST /api/leads/score` — score one lead, persist `leads.score`.
- `POST /api/leads/score-all` — admin/manager bulk re-score.
- `POST /api/ai/lead-recap` — Claude (cached 1h in `ai_suggestions`).
- `POST /api/ai/draft-message` — Claude (no cache).
- `POST /api/ai/pipeline-summary` — Claude (cached 30 min).
- `POST /api/ai/daily-summary` — admin or x-cron-secret auth. Hardened
  with try/catch + Anthropic key fallback + non-fatal Maytapi send.
- `GET  /api/cron/daily-summary` — Vercel cron entry; checks
  `Authorization: Bearer ${CRON_SECRET}` and the enabled toggle.
- Admin-only: `/api/admin/{invite-user, clear-sample-data, reseed,
  test-whatsapp, test-anthropic, test-webhook, integrations-status}`.
- Campaigns: `GET/POST /api/campaigns`, `GET/PATCH/DELETE /api/campaigns/[id]`,
  `POST/DELETE /api/campaigns/[id]/enroll`, `PUT /api/campaigns/[id]/messages`.

---

## 3. Files created (by feature area)

### Lead Drawer + interactions
- `components/leads/LeadDrawer.tsx` — main 480 px shell with 5 tabs
  (Overview, Timeline, Tasks, Campaigns, AI). Mounted globally in the
  dashboard layout.
- `components/leads/LeadTimeline.tsx` — vertical timeline with stage-change
  pills, outcome badges, inline Add Note.
- `components/leads/LogCallModal.tsx`
- `components/leads/ScheduleFollowUpModal.tsx`
- `components/leads/SendWhatsAppModal.tsx` — opt-in warning + override checkbox.
- `components/leads/ReassignPopover.tsx` — searchable profile picker.
- `components/leads/StagePickerPopover.tsx` — stage list for Move Stage flow.
- `lib/hooks/useActivities.ts` — interactions/tasks/enrollments + mutations
  for note, complete-task, create-task, log-call, schedule-follow-up.
  Auto-fires `/api/leads/score` after `logCallMutation` succeeds.

### Realtime
- `lib/hooks/useRealtime.ts` — single `kanban-realtime` channel listening to
  `postgres_changes` on `leads` (INSERT/UPDATE/DELETE) + `tasks` (`*`).
  On stage change by another user, queries the latest `stage_change`
  interaction to attribute the move and toasts
  `"<rep> moved <lead> to <stage>"`.
- Mounted in `KanbanBoard.tsx` with three callbacks driving slide-in
  animation, green flash, and store removal.

### Website webhook
- `app/api/webhook/website-leads/route.ts` — verifies `x-webhook-secret`,
  normalises phone (strips `+`/spaces/dashes/parens and Indian country code),
  dedupes against `leads.phone` / `leads.phone_alt`. On new lead, sends a
  manager WhatsApp notification (fire-and-forget) and inserts a
  `lead_created` interaction.

### Analytics (`/analytics`)
- `components/analytics/FunnelChart.tsx` — horizontal funnel from
  `pipeline_overview` view with conversion % between bars.
- `components/analytics/LeadSourceChart.tsx` — Recharts stacked BarChart,
  last 30 days, color per source.
- `components/analytics/RepProductivityTable.tsx` — sortable, queries
  `rep_activity_summary` view.
- `components/analytics/StageAgeHeatmap.tsx` — 4 buckets (0–3, 3–7,
  7–14, 14d+); click cell → `/leads?stage=...&age=...`.
- `app/(dashboard)/analytics/page.tsx` — 4 KPI cards, date-range filter
  (This Week / Month / 3 Months / Year / Custom), Won/Lost summary cards.

### Admin
- `app/(dashboard)/admin/layout.tsx` — server component guard
  (`role !== 'admin'` redirects to `/pipeline`).
- `app/(dashboard)/admin/page.tsx` — overview with section cards, Sample
  Data section (Clear / Reseed / Score All Leads), Daily Briefing card.
- `app/(dashboard)/admin/users/page.tsx`
- `app/(dashboard)/admin/pipeline-config/page.tsx` — @dnd-kit reorder.
- `app/(dashboard)/admin/integrations/page.tsx` — copyable webhook URL,
  status dots, three test buttons.
- API: `invite-user`, `clear-sample-data`, `reseed`, `test-whatsapp`,
  `test-anthropic`, `test-webhook`, `integrations-status`. All do
  `role === 'admin'` check.

### Demo mode + nav badges
- `components/dashboard/DemoModeBanner.tsx` — yellow banner when
  `COUNT(*) WHERE is_sample_data = true > 0`. Dismissible per session
  via `sessionStorage`.
- `lib/hooks/useSidebarCounts.ts` — refetches every 60 s.
- `components/dashboard/Sidebar.tsx` — see Section 4.

### Inbox + My Tasks
- `app/(dashboard)/inbox/page.tsx` — manager/admin/founder only.
  Per-row rep `<select>` + Assign button.
- `app/(dashboard)/activities/page.tsx` — role-aware fetch:
  - `sales_rep` / `marketing` → `assigned_to = me`
  - `manager` / `admin` / `founder` → all open tasks
  - Lead names fetched in a separate query so RLS on `leads` cannot
    fail the tasks query. Function never throws (returns `[]`).

### `/leads/[id]`
- Now a thin page that auto-opens the drawer via `setLeadDrawerId(id)`
  on mount and navigates back to `/leads` when the drawer closes.

### Campaigns (Step 17)
- `components/campaigns/CampaignCard.tsx`
- `components/campaigns/MessageSequenceBuilder.tsx` — @dnd-kit sortable,
  1000-char limit, live WhatsApp bubble preview.
- `components/campaigns/EnrollLeadsModal.tsx` — searchable, already-enrolled
  leads grayed-out with green check.
- `app/(dashboard)/campaigns/{page,new/page,[id]/page}.tsx`
- API routes (see Section 2).
- **Schema notes:**
  - Goal + service line are stored in `audience_filters` JSONB
    (`{ goal, service_line }`) since the schema has no dedicated `goal` column.
  - `campaigns.type` is hard-coded to `'whatsapp_drip'` (constraint requires one of
    `whatsapp_drip|whatsapp_blast|email_drip|manual_sequence`).
  - `campaign_enrollments.status` allows only `active|paused|completed|opted_out`
    (no `unsubscribed`); UI labels `opted_out` as "Opted out".
  - "Sending Provider" section is a placeholder card linking to
    `/admin/integrations` — no actual sending wired up.

### Lead Scoring (Step 18)
- `lib/utils/lead-scoring.ts` — pure: `scoreBudget`, `scoreSource`,
  `scoreProfile`, `scoreActivity`, `scoreStage`, `getScoreLabel`,
  aggregate `scoreLead()`. Exports `MAX_POINTS` constants.
  Labels: Hot ≥ 80 (#EF4444), Warm ≥ 60 (#F59E0B),
  Lukewarm ≥ 40 (#3B82F6), Cold (#6B7280).
- `app/api/leads/score/route.ts`
- `app/api/leads/score-all/route.ts` — admin/manager only.
- `KanbanLead` interface and the kanban + realtime queries now select
  `score`. `LeadCard.tsx` shows a colored score pill bottom-right.
- `LeadDrawer` Overview tab computes the breakdown live from already-loaded
  interactions (no extra API call) and renders 5 progress bars + Total.
- Auto-score triggers (all fire-and-forget):
  1. `LeadForm.persistLead` after `createLead`
  2. `useKanban.updateLeadStage` after the interaction insert
  3. `useActivities.logCallMutation.onSuccess`
  4. Manual "Score All Leads" button on `/admin` and `/ai-agent`.

### AI Agent (Step 19)
- `lib/utils/claude.ts` — `callClaudeJSON<T>()` wraps Anthropic Messages API,
  parses fenced/un-fenced JSON, throws typed `ClaudeError`. Model id constant:
  `CLAUDE_MODEL = "claude-sonnet-4-20250514"`.
- `app/api/ai/lead-recap/route.ts` — checks `ai_suggestions` for cached
  recap < 1 h old (`type='lead_recap'`, `lead_id=...`). Bypassed via `force: true`.
- `app/api/ai/draft-message/route.ts` — no cache; logs to
  `ai_suggestions` for audit.
- `app/api/ai/pipeline-summary/route.ts` — cached 30 min
  (`type='pipeline_summary'`, `lead_id IS NULL`). Returns hot lead UUIDs the
  UI then resolves into clickable cards.
- `components/ai/{AIAgentPanel,LeadRecapPanel,PipelineSummaryCard}.tsx`
- `app/(dashboard)/ai-agent/page.tsx` — 3 numbered sections, searchable
  lead picker, copyable draft. Yellow banner if `ANTHROPIC_API_KEY` missing.
- The drawer's AI tab continues to call `/api/ai/lead-recap` and
  `/api/ai/draft-message`, so it inherits real Claude output for free.

### Daily WhatsApp briefing (Step 20)
- `lib/utils/daily-summary.ts` — gathers context, calls Claude (plain text,
  not JSON), formats final WhatsApp message with stats footer + pipeline link.
  Writes to `ai_suggestions` (`type='daily_summary'`) and updates
  `admin_settings.daily_summary_last_sent`. Supports `dryRun` and `skipSend`.
- `app/api/ai/daily-summary/route.ts` — auth path 1: `x-cron-secret` header
  matches `CRON_SECRET`. Path 2: authenticated admin. Inlines the Maytapi fetch
  (digits-only phone, header `x-maytapi-key`). Wrapped in try/catch with
  `console.error('Daily summary error:', error)` and the error string in
  the response. **Falls back to a stats-only hardcoded message** when
  `ANTHROPIC_API_KEY` is missing or when Claude fails. Maytapi send is
  non-fatal: returns `{ success: true, sent: false, send_error }` if it fails.
- `app/api/cron/daily-summary/route.ts` — verifies
  `Authorization: Bearer ${CRON_SECRET}`, reads
  `admin_settings.daily_summary_config.enabled` and skips if false.
- `components/admin/DailySummaryConfig.tsx` — enable toggle, send-time picker
  (display only — schedule is in vercel.json), phone field, last-sent timestamp,
  Save + Send Test buttons, inline preview.
- `vercel.json` — `0 8 * * 1-6` (8 UTC = 1:30 PM IST, Mon–Sat).

---

## 4. Sidebar / layout changes

- **Logout button** added to `Sidebar.tsx`. Below all nav items, above
  Collapse. Calls `supabase.auth.signOut()` then `router.push("/login")`.
  Hover red. Shows spinner during sign-out.
- **Role-based nav filtering** added. Each `NavItem` has a `roles: Role[]`
  field. Visibility:
  - `admin`: all
  - `manager`: all except `Admin`
  - `founder`: Pipeline, All Leads, My Tasks, Analytics, AI Agent, Logout
  - `marketing`: Pipeline, All Leads, My Tasks, Campaigns, Analytics, Logout
  - `sales_rep`: Pipeline, My Tasks, Logout
  - When `role` prop is `""` (not loaded), all items are shown as fallback
    to avoid flashing a too-restricted menu
- **Layout default** changed in `app/(dashboard)/layout.tsx`:
  `useState("sales_rep")` → `useState("")` for role.
- **Demo banner** rendered between TopBar and main content via the layout.
- **LeadDrawer mounted globally** in the dashboard layout (was previously
  inside `/pipeline/page.tsx`). The pipeline page no longer renders it.
- **Sidebar count badges** wired to `useSidebarCounts` and passed in via
  the `badges` prop. Inbox = unassigned leads (blue). My Tasks = overdue
  tasks for current user (red).

---

## 5. Drawer Overview tab — Reassign + Move Stage

Last fix in this session. Replaced two placeholder buttons with working flows.

### Reassign
- Button gated on `role ∈ {admin, manager, founder}`. Sales reps and
  marketing see only the assignee name.
- Click toggles `ReassignPopover` (searchable list, "Unassigned" at top).
- On select: `UPDATE leads SET assigned_to, assigned_at` + insert
  `interactions { type:'note', is_automated:true,
  notes:'Lead reassigned to <name>' }`.
- Invalidates: `lead-drawer-detail`, `lead-interactions`, `kanban-leads`,
  `sidebar-counts`, `inbox-leads`.

### Move Stage
- Click → `StagePickerPopover` opens.
- Pick target → opens existing `StageChangeModal` with `fromStage` (current)
  + `toStage` (picked) prefilled.
- `handleStageConfirm` inside the drawer mirrors `useKanban.updateLeadStage`
  validation (note required, closure_value > 0 for Won, loss_reason for Lost,
  clears terminal columns when moving back to active).
- Inserts `stage_change` interaction. Fires `/api/leads/score` after.
- Built a `KanbanLead`-shape adapter via `useMemo` since `StageChangeModal`
  was originally typed for the kanban shape, not the drawer's richer
  `Lead` type.

---

## 6. Schema migrations the user must apply manually

Both live under `supabase/` and must be pasted into the Supabase SQL Editor.
Neither is run automatically by the app.

### `supabase/reseed_function.sql`
- Drops + recreates `reseed_sample_data()` RPC.
- Inserts 14 sample leads spanning all 9 stages (incl. `won` with
  `closed_at` + `closure_value`, `lost` with `closure_reason`, `on_hold`).
- All `service_line` and `source` values match the existing CHECK
  constraints. Fixes the original "violates leads_service_line_check" error.
- Idempotent — skips phones that already exist.
- Returns `{ inserted, already_existed, total_sample_leads }`.
- Granted EXECUTE to `service_role` and `authenticated`.

### `supabase/daily_summary_migration.sql`
- Extends `ai_suggestions.type` CHECK to include `'daily_summary'`.
- Creates `admin_settings (key TEXT PK, value JSONB, updated_at)` with RLS
  allowing only admins to read/write from the client (service role bypasses).
- Seeds default `daily_summary_config` row:
  `{ enabled: true, send_time: '08:00', phone_number: null }`.

---

## 7. Environment variables added

```
ANTHROPIC_API_KEY=sk-ant-...
WEBHOOK_SECRET=<random>
MANAGER_WHATSAPP_NUMBER=+91xxxxxxxxxx
CRON_SECRET=<random>            # used by Vercel cron auth
MAYTAPI_TEST_NUMBER=+91...      # optional; defaults to +919999999999
NEXT_PUBLIC_APP_URL=https://erp.hagerstone.com
SUPABASE_SERVICE_ROLE_KEY=...   # already required by earlier steps
```

Existing vars still in use: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `MAYTAPI_PRODUCT_ID`, `MAYTAPI_PHONE_ID`,
`MAYTAPI_API_TOKEN`.

---

## 8. Bugs fixed during the session

| Bug | Fix |
|---|---|
| Reseed: `violates leads_service_line_check` | Rewrote RPC to use only constraint-allowed values. |
| Reseed: `relation "s_new" does not exist` | Caused by nested `$json$` inside `$$` body — switched to plain INSERTs with single `$func$` tag. |
| Daily summary: `invalid x-api-key` from Maytapi | Maytapi expects `x-maytapi-key`. Removed the briefly-added `x-api-key` header from all 4 Maytapi call sites. Anthropic call sites correctly keep `x-api-key`. |
| Daily summary returning 500 | Wrapped handler in try/catch, added `ANTHROPIC_API_KEY` fallback (stats-only message), made Maytapi send non-fatal. |
| Daily summary: `+` not stripped from phone | Phone cleaning regex changed to `/[\s\-()+]/g`. |
| `/activities` showing "Failed to load tasks" for sales_rep | The embed `lead:lead_id(...)` in the tasks query failed when RLS hid the lead. Decoupled into two queries (tasks first, leads `.in()` second). Now never throws — returns `[]` on any error. Also added role check so manager/admin/founder see all tasks. |

---

## 9. Conventions used (consistent across this session)

- Dark theme tokens: bg `#0A0A0F` / `#111118` / `#1A1A24` / `#1F1F2E`,
  border `#2A2A3C`, text `#F0F0FA` / `#9090A8`, accent blue `#3B82F6`,
  success green `#34D399`, warning amber `#F59E0B`, error red `#F87171`.
- Headings use `font-[family-name:var(--font-heading)]` (Syne).
- Toasts via `sonner`. Loading spinners use `Loader2` from lucide.
- Modals via Framer Motion (`AnimatePresence`, `motion.div`) at z-index 60–61.
- API routes: always check `auth.getUser()`, then re-query
  `profiles.role` for role-gated routes. Never trust roles client-side
  for security; client checks only hide UI.
- Service role client (`createClient` from `@supabase/supabase-js`) is used
  only in server routes that need to bypass RLS — never imported in client
  components.
- React Query keys are stable strings: `["lead-drawer-detail", id]`,
  `["kanban-leads"]`, `["sidebar-counts", userId]`, `["my-tasks"]`,
  `["campaign-detail", id]`, `["analytics-funnel"]`, etc.
- Dollar quoting in PL/pgSQL: use a single tag (`$func$`) — never nest tags.

---

## 10. Known limitations / pending work

- Campaign sending is **not** wired up. The Settings tab shows a
  "Sending Provider" placeholder linking to `/admin/integrations`.
  Future step needs to: (a) loop through enrollments daily, (b) match
  `current_message_position` against the next message, (c) check
  `delay_days`, (d) send via Maytapi, (e) advance position + log
  interaction. Likely a Vercel cron similar to the daily briefing.
- `AITab` in the drawer is older Step-9 code that uses local state for
  recap/draft. It still works because the API routes are now real, but
  it doesn't share cache state with `/ai-agent`.
- `/leads/[id]` page is a thin redirect — opens the global drawer and
  navigates back to `/leads` on close. Reasonable but not "true" full-page
  view. Direct deep links work via the drawer.
- Founder can NOT score-all-leads or move Won/Lost back to active
  (admin/manager only). Worth flagging as a possible inconsistency
  with their otherwise-broad permissions.
- The `tasks` table CHECK constraint allows only
  `call|whatsapp|email|site_visit|meeting|other`. Several task-create
  flows in the UI offer `follow_up` and `proposal` as types — those
  inserts will fail the constraint. Either the constraint should be
  loosened or the UI options trimmed.
- Real-time hot-lead toast attribution queries the latest
  `stage_change` interaction. If two stage changes happen within the
  same realtime tick the toast may attribute the wrong user.

---

## 11. Role permissions matrix (current truth)

| Capability | admin | manager | founder | marketing | sales_rep |
|---|---|---|---|---|---|
| `/admin/*` and admin API routes | ✓ | | | | |
| Move Won/Lost back to active | ✓ | ✓ | | | |
| Score All Leads (batch) | ✓ | ✓ | | | |
| `/inbox` (assign unassigned) | ✓ | ✓ | ✓ | | |
| Filter leads/kanban by other reps | ✓ | ✓ | ✓ | | |
| Schedule follow-up for other reps | ✓ | ✓ | ✓ | | |
| Reassign lead in drawer | ✓ | ✓ | ✓ | | |
| Rep Productivity table | ✓ | ✓ | ✓ | | |
| Enroll lead in campaign (drawer) | ✓ | ✓ | ✓ | ✓ | |
| Create / edit campaigns | ✓ | ✓ | | ✓ | |
| Create lead, log call, drag stage,
  AI tools, send WhatsApp | ✓ | ✓ | ✓ | ✓ | ✓ |

Hidden in sidebar nav per role (see Section 4 for the full list).

---

## 12. Build status

Last `npm run build` output: 34 routes, zero errors, zero warnings.
First-load JS shared: ~87.5 kB. Largest page: `/analytics` at 287 kB
(due to recharts).

---

End of session log.
