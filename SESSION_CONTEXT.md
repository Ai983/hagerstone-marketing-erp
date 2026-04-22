# Hagerstone ERP — Session Build Log

Project root: `d:\New folder (2)\hagerstone-erp`
GitHub: `https://github.com/Ai983/hagerstone-marketing-erp` (initial commit pushed to `main`)
Canonical PRD: `../hagerstone-sales-erp-cursor-prd.md` (v3.0 — source of truth)

This log captures deltas applied **on top of** PRD v3.0 during the most
recent two sessions. Feed this + the PRD to the next session for full context.

---

## 1. Status

- All 20 MVP steps done (see PRD Section 8)
- 34+ routes, last build zero errors
- Git: initial commit pushed, working tree clean
- Vercel: not yet deployed — all env vars listed in PRD Section 3

---

## 2. Files added this session (not in PRD)

| File | Purpose |
|---|---|
| `components/leads/NewLeadModal.tsx` | Global modal reusing LeadForm via `onSuccess` prop |
| `components/leads/BulkImportModal.tsx` | Excel bulk import (SheetJS), 4-step wizard, preview table with valid/error/dup counts |
| `components/leads/ReassignPopover.tsx` | Searchable rep picker inside drawer |
| `components/leads/StagePickerPopover.tsx` | Stage list popover for Move Stage flow in drawer |
| `components/kanban/BlobBackground.tsx` | Animated canvas (5 organic blobs) behind kanban, `position:absolute`, parent-relative sizing, ResizeObserver, canvas-local mouse coords |
| `components/admin/DailySummaryConfig.tsx` | Admin card for daily WhatsApp briefing toggle + test send |
| `lib/hooks/useUser.ts` | **Shared auth cache** — `useUser()` hook + `getCachedUser()` / `getCachedUserAndProfile()` non-hook helpers. Dedups concurrent `getUser()` calls, listens to `onAuthStateChange`. Fixes the "Lock sb-…-auth-token was released" race. |
| `lib/hooks/useNotifications.ts` | React Query hook + `markAsRead()` mutation |
| `lib/hooks/useSidebarCounts.ts` | `{ unassignedLeads, overdueTasks }`, refetches every 60 s |
| `app/api/notifications/route.ts` | `GET` list + `PATCH` mark-read (accepts `{ id }` or `{ mark_all: true }`) |
| `app/api/leads/bulk-import/route.ts` | Service-role batch insert, max 500/req, returns `{ imported, skipped, errors, total_rows }` |
| `app/api/campaigns/[id]/send-test/route.ts` | Manual test send via Maytapi (see Maytapi payload format below) |
| `supabase/reseed_function.sql` | 14 sample-lead RPC |
| `supabase/daily_summary_migration.sql` | `admin_settings` table + `daily_summary` enum value |
| `supabase/campaign_enrollments_delete_policy.sql` | DELETE RLS policy (fixes Unenroll) |
| `supabase/campaign_messages_policies.sql` | DELETE RLS policy (fixes Save Sequence dup) |
| `supabase/campaign_messages_media.sql` | `media_url`, `media_type`, `media_filename` columns |

---

## 3. Files modified this session

- `app/(dashboard)/layout.tsx` — mounts `LeadDrawer`, `NewLeadModal`, `BulkImportModal` globally; uses `useUser()` instead of ad-hoc `useEffect`+`getUser()`; outer wrapper still `bg-[#0A0A0F]`, inner wrapper + main now `bg-transparent` so BlobBackground shows through on pipeline
- `components/dashboard/Sidebar.tsx` — Logout button (hover red); role-based nav filtering: admin=all, manager=all-except-Admin, founder=Pipeline/All Leads/My Tasks/Analytics/AI Agent/Logout, marketing=Pipeline/All Leads/My Tasks/Campaigns/Analytics/Logout, sales_rep=Pipeline/My Tasks/Logout; empty role string = show all (loading fallback)
- `components/dashboard/TopBar.tsx` — Import button + "+ New Lead" (opens modal, not navigation); real unread notification badge
- `components/dashboard/NotificationCenter.tsx` — full rewrite; rows click → mark-read + open drawer; Mark-all-read; blue left border for unread
- `components/leads/LeadDrawer.tsx` — Reassign popover, Move Stage + StageChangeModal flow, score breakdown in Overview, LogCall/FollowUp/WhatsApp modals wired
- `components/leads/LeadForm.tsx` — `onSuccess` prop (modal path skips navigation); uses `getCachedUser()`
- `components/leads/LogCallModal.tsx` — fires "Hot update" notification on `interested`/`callback_requested` outcome (fire-and-forget, checks assigned_to != currentUserId)
- `components/campaigns/MessageSequenceBuilder.tsx` — drag-reorder, media attachment upload (100 MB cap, `upsert:true`, content-type fallback, canvas-local mouse, session check via `getCachedUser()`), WhatsApp preview with image/video/doc, paperclip badge, TEXT/IMAGE/VIDEO/DOC type badge
- `components/campaigns/EnrollLeadsModal.tsx` — stage filter pill row (horizontal scroll, color dot, count badge), "Select all in stage" row (conditional), combined search+stage filtering, scrollable list fix (`max-h-80 overflow-y-scroll overscroll-contain`)
- `app/(dashboard)/pipeline/page.tsx` — renders BlobBackground first, kanban wrapper `relative z-10`, main `bg-transparent`
- `app/(dashboard)/campaigns/[id]/page.tsx` — Settings tab has `TestSendCard` (amber warning banner + red alert, results table, Maytapi summary toast)
- `app/(dashboard)/activities/page.tsx` — rewritten as client component; `getCachedUserAndProfile()`; expandable cards (max-height transition, chevron rotation); `created_by` stamping + 3-way "Assigned by" logic; Mark Complete with fade-out
- `lib/hooks/useLeads.ts`, `lib/hooks/useKanban.ts`, `lib/hooks/useActivities.ts`, `lib/hooks/useRealtime.ts` — all converted to `getCachedUser()` / `getCachedUserAndProfile()`
- `lib/stores/uiStore.ts` — added `isNewLeadModalOpen` + `isBulkImportModalOpen` + open/close actions
- `app/api/campaigns/[id]/messages/route.ts` — service-role writes, `.select("id")` on delete, accepts media fields on PUT
- `app/api/campaigns/[id]/enroll/route.ts` — DELETE no longer 404s on 0-rows-deleted (returns `{ success: true, deleted: [...] }`); logs `deletedCount`
- `app/api/whatsapp/send/route.ts` — uses `normalisePhone()` (always 12 digits starting `91`); `x-maytapi-key` header (not `x-api-key`)
- `app/api/campaigns/[id]/send-test/route.ts` — same `normalisePhone()`; correct Maytapi payload (see below)
- `vercel.json` — cron `0 8 * * 1-6` → `/api/cron/daily-summary`

---

## 4. Shared `normalisePhone()` (used in both WhatsApp routes)

```ts
function normalisePhone(raw: string): string {
  let digits = String(raw).replace(/\D/g, "")
  digits = digits.replace(/^\+/, "")
  if (digits.startsWith("91") && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  if (digits.startsWith("0") && digits.length === 11) return `91${digits.slice(1)}`
  return digits
}
```
Keep in sync across `app/api/whatsapp/send/route.ts` and `app/api/campaigns/[id]/send-test/route.ts`.

## 5. Correct Maytapi payloads (verified working)

```ts
// Image
{ to_number, type: "image",  message: <URL>, text: <caption>, filename: "image.jpg",    skip_filter: false }
// Document / video
{ to_number, type: "media",  message: <URL>, text: <caption>, filename: "document.pdf", skip_filter: false }
// Plain text
{ to_number, type: "text",   message: <body> }
```

- **URL goes in `message`**, **caption goes in `text`** — NOT `media_url`
- Maytapi does not have a `media_url` field. Adding one caused `Error: Invalid URI Hiiiii%20*Shubh*…` because Maytapi fell back to treating the caption as the URL
- Header: `x-maytapi-key: ${process.env.MAYTAPI_API_TOKEN}`

## 6. Notification split (IMPORTANT — don't re-add lead-assignment inserts to client code)

- **DB trigger** handles lead assignment + reassignment on the `leads` table
- **Client code** handles: task creation, stage change, hot call outcome (`interested`/`callback_requested`)
- Previously had duplicate notifications — removed from `LeadForm.tsx` and `LeadDrawer.tsx handleReassign`
- Kept task notification in `useActivities.ts notifyTaskAssigned` (fire-and-forget, no await)
- Kept stage-change in `useKanban.ts updateLeadStage` (fire-and-forget)
- Kept hot-outcome in `LogCallModal.tsx` (fire-and-forget)

## 7. Auth cache (useUser) — critical design notes

- `cachedUser`, `cachedProfile`, `inFlight` live in module scope
- In-flight promise dedup: second caller awaits first, no parallel `getUser()`
- `onAuthStateChange` clears cache on `SIGNED_OUT` / `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED`
- Use `useUser()` inside components; use `getCachedUser()` / `getCachedUserAndProfile()` inside queryFns, mutation handlers, upload handlers
- Auth pages (`login`, `onboarding`) and server routes intentionally still use direct `supabase.auth.getUser()`

## 8. Storage bucket — one-time manual setup

`campaign-media` bucket in Supabase Storage, Public enabled, 100 MB file-size limit. Storage policies: public SELECT, authenticated INSERT/UPDATE/DELETE.

## 9. SQL migrations to run if starting fresh (in order)

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/seed.sql` (optional — quick 3-lead seed)
3. `supabase/reseed_function.sql`
4. `supabase/daily_summary_migration.sql`
5. `supabase/campaign_enrollments_delete_policy.sql`
6. `supabase/campaign_messages_policies.sql`
7. `supabase/campaign_messages_media.sql`
8. Manual: create `campaign-media` Storage bucket
9. Manual: ensure DB trigger on leads for `new_lead_assigned` notifications exists (user confirmed this)

## 10. Known outstanding / tomorrow's work

- Phase 2: campaign automated drip engine (Vercel cron, Interakt/AiSensy for bulk — not Maytapi)
- `AITab` in drawer uses local state, not shared with `/ai-agent` cache
- `/leads/[id]` is thin redirect to drawer
- `tasks.type` CHECK is narrower than UI options (`follow_up`, `proposal` will fail insert)
- `request` param unused in `send-test/route.ts` (Hint only, not build failure)

## 11. Env vars needed for Vercel deploy (from PRD)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
MAYTAPI_PRODUCT_ID / PHONE_ID / API_TOKEN
MAYTAPI_TEST_NUMBER (optional)
WEBHOOK_SECRET
MANAGER_WHATSAPP_NUMBER
CRON_SECRET
NEXT_PUBLIC_APP_URL  (update to real domain after first deploy)
NEXT_PUBLIC_APP_NAME=Hagerstone ERP
```

---

## 12. Picking up in a fresh session

Next session should:
1. Read `../hagerstone-sales-erp-cursor-prd.md` (PRD v3.0)
2. Read this file (SESSION_CONTEXT.md) for deltas
3. Check `git log --oneline -10` for recent commits
4. Run `npm run build` once to confirm clean state before touching code

End of log.
