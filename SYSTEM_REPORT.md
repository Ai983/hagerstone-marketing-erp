# Hagerstone ERP — Complete System Report

*Generated from a full codebase read (167 TypeScript/TSX files, 19 SQL files, middleware, cron config, and the public portfolio microsite).*

---

## 1. What This System Is

**Hagerstone ERP** is a production B2B sales-CRM / pipeline platform for the Hagerstone interior-design & construction group. It runs the full sales lifecycle — from lead capture through deal closure — for an organisation that sells **office interiors, MEP engineering, facade glazing, PEB construction, and civil works**, with project sizes from ₹25 L to ₹2 Cr+.

It is two products in one codebase:

1. **The internal ERP** (auth-gated dashboard) — Kanban pipeline, lead management, multi-channel outreach (WhatsApp + email), campaigns, analytics, AI assistants, a visual WhatsApp chatbot builder, and an admin console.
2. **A public marketing microsite** (`/portfolio`) — a personalised, sector-segmented project showcase that sales reps can share with prospects via a tracked link.

---

## ✦ Business Value & Solutions Delivered

This platform replaces a scattered mix of spreadsheets, WhatsApp Web, personal email, and manual reporting with a **single source of truth for the entire sales operation**. Below is what it actually delivers for the business.

### Core business problems it solves

| Problem (before) | How the system solves it | Business benefit |
|---|---|---|
| Leads lost in inboxes, spreadsheets & personal phones | Every lead captured centrally from website, WhatsApp, bulk import, referrals & AI — auto-scored and assigned | **No lead leakage**; faster first response; higher conversion |
| No visibility into the sales pipeline | Live Kanban board + analytics across all reps, stages and deal values | Managers see the **whole pipeline and forecast at a glance** |
| Reps forget follow-ups | Tasks, due dates, overdue flags, stale-lead detection, and automated reminders | **Follow-up compliance** → fewer deals dropped |
| Manual, inconsistent outreach | WhatsApp + email from inside the CRM, AI-drafted messages, and automated drip campaigns | **Consistent, on-brand, scalable outreach** with less effort |
| Slow, generic prospect engagement | Personalised, tracked portfolio microsite per prospect & sector | **Higher-quality first impression**; reps see when a prospect views it |
| Decisions made on gut feel | 100-point lead scoring, funnel/source/rep analytics, AI pipeline summaries | **Data-driven prioritisation** of the hottest, highest-value deals |
| No record of who did what | Full interaction timeline + immutable audit log per lead | **Accountability & compliance**; clean handovers between reps |
| Owner/manager flying blind day-to-day | Automated daily WhatsApp briefing of pipeline health, overdue tasks & wins | **Proactive management** without chasing reports |

### Benefits by business outcome

- **Revenue growth** — leads are scored and categorised (hot/warm/lukewarm/cold) so reps spend time on the deals most likely to close; nothing falls through the cracks; faster response and disciplined follow-up directly lift conversion.
- **Sales productivity** — drafting messages, logging activity, scheduling follow-ups, sending proposals and running campaigns all happen in one screen. The AI assistant drafts context-aware WhatsApp/email messages and recaps a lead's history in seconds.
- **Marketing leverage** — drip campaigns nurture cold/dormant leads automatically; the WhatsApp chatbot qualifies and routes inbound enquiries 24×7; the portfolio microsite turns every rep into a polished brand ambassador with a shareable, trackable link.
- **Management & oversight** — real-time analytics (conversion funnel, lead-source ROI, rep productivity, stage-age heatmap), role-based access, and a daily AI briefing give leadership control without micromanagement.
- **Customer experience** — prospects get fast, personalised, multi-channel engagement (WhatsApp, email, tailored portfolio) instead of slow, generic emails.
- **Cost consolidation** — one in-house platform does the job of a CRM + WhatsApp business tool + email marketing tool + chatbot builder + analytics dashboard + a marketing landing page, with no per-seat SaaS fees and full data ownership.
- **Scalability & continuity** — because everything (leads, history, tasks, campaigns) lives in one auditable database, the business scales reps and survives staff turnover without losing institutional knowledge.

### Who benefits

| Role | What they get |
|---|---|
| **Sales reps** | One workspace for their leads, AI-drafted messages, follow-up reminders, and one-click WhatsApp/email/portfolio sharing |
| **Managers** | Team-wide pipeline visibility, lead inbox/assignment, rep productivity, overdue-task oversight |
| **Marketing** | Campaign builder, email templates, chatbot flows, lead-source analytics, AI lead generation |
| **Founders / leadership** | Forecast, won/lost analysis, audit trail, and an automated daily briefing on the whole business |
| **Prospects / clients** | Fast, personalised, professional engagement across WhatsApp, email and a tailored project showcase |

### Solutions it consolidates into one platform

Sales CRM & pipeline · multi-channel outreach (WhatsApp + email) · marketing automation / drip campaigns · WhatsApp chatbot/auto-responder · lead scoring & qualification · BOQ/proposal tracking · sales analytics & reporting · AI sales assistant · a public marketing/portfolio website — **all integrated, all owned in-house.**

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14.2.33 (App Router, server components + route handlers) |
| **Language** | TypeScript 5 |
| **UI / Styling** | Tailwind CSS 3.4 + shadcn/ui, dark-first design system, Framer Motion animations, Lucide icons |
| **Database / Auth** | Supabase (PostgreSQL) via `@supabase/ssr` + `@supabase/supabase-js`. **All tables live in a custom `marketing` Postgres schema**, not `public` |
| **Server state** | TanStack React Query 5 |
| **Client state** | Zustand 5 (UI + Kanban stores) |
| **Forms / validation** | React Hook Form 7 + Zod 4 |
| **Rich text** | Tiptap v3 (email editor) |
| **Charts** | Recharts 3 |
| **Drag & drop** | @dnd-kit (Kanban) |
| **Visual flow editor** | @xyflow/react 12 (chatbot builder) |
| **Spreadsheet import** | SheetJS (`xlsx`) |
| **AI** | Anthropic Claude API — model `claude-haiku-4-5-20251001` |
| **WhatsApp** | MayTAPI (REST) |
| **Email send / render** | Resend + @react-email |
| **Toasts** | Sonner |
| **Hosting / scheduling** | Vercel (cron jobs defined in `vercel.json`) |

---

## 3. High-Level Architecture

```
                         ┌───────────────────────────────────────┐
                         │            Browser (React)            │
                         │  Dashboard SPA  +  /portfolio microsite│
                         └───────────────┬───────────────────────┘
                                         │
                        Next.js middleware.ts (auth + role gate)
                                         │
        ┌────────────────────────────────┼─────────────────────────────────┐
        │                                │                                  │
  App Router pages              API route handlers (app/api/*)        Public portfolio
 (server + client comps)    leads / ai / campaigns / whatsapp /        (server comp +
                            email / chatbot / cron / webhook /          view tracking)
                            admin / notifications / storage
        │                                │
        └──────────────┬─────────────────┘
                       │  Supabase JS (schema: "marketing")
                       ▼
        ┌──────────────────────────────────────────────────────┐
        │  Supabase Postgres  +  Auth  +  Storage  +  Realtime  │
        │  RLS policies · DB triggers · analytics views · RPCs  │
        └──────────────────────────────────────────────────────┘
                       ▲                    ▲                ▲
                       │                    │                │
              Anthropic Claude        MayTAPI WhatsApp    Resend Email
              (AI route handlers)   (send + inbound webhook) (send + tracking webhook)
                                            ▲
                                   Vercel Cron Scheduler
                          (daily summary, overdue, stale, drip)
```

**Two Supabase client patterns** (`lib/supabase/`):
- `client.ts` — browser client (`createBrowserClient`), used inside React Query hooks.
- `server.ts` — server client (`createServerClient`, async cookies) for route handlers and middleware.
- Webhooks/cron use a **service-role** client directly (bypasses RLS). Every client is pinned to `db: { schema: "marketing" }`.

---

## 4. Authentication & Authorization Flow

Implemented entirely in `middleware.ts` (runs on every request except static assets):

1. **Bypass list** (no auth applied): `/api/webhook/*`, `/api/cron/*`, `/api/campaign-unsubscribe`, `/api/email/webhook`, `/api/ai/categorise-lead`, public pages (`/login`, `/signup`, `/portfolio`, `/portfolio/*`), and all static file extensions (pdf/png/mp4/etc.). These routes do their own secret verification.
2. `/` → redirect to `/pipeline`.
3. **No session + non-public path** → redirect to `/login`.
4. **Session but no `profiles` row** → redirect to `/onboarding` (collects full name).
5. **Session + profile** → into the dashboard.
6. **Role gate on `/admin/*`** (checked in middleware):

| Role | Admin access |
|---|---|
| `admin`, `founder` | All admin routes |
| `manager` | `/admin/tasks`, `/admin/whatsapp-health` only |
| `marketing` | `/admin/email-templates` only |
| `sales_rep` | None → redirected to `/activities` |

**Database-level security:** Supabase **Row Level Security** is enabled on `leads`, `interactions`, `tasks`, `profiles`. A `SECURITY DEFINER` helper `get_user_role()` drives policies — sales reps see only leads `assigned_to = auth.uid()`; managers/admins/founders (and marketing, for reads) see all.

**Auth caching:** `lib/hooks/useUser.ts` keeps a **module-level cache** with in-flight promise dedup to prevent the Supabase "auth-token lock released" race when many components mount at once. Components call `useUser()`; query/mutation functions call `getCachedUser()` / `getCachedUserAndProfile()`.

---

## 5. Database Model (Supabase / `marketing` schema)

Core schema is in `supabase/migrations/001_initial_schema.sql`; later feature migrations add the rest.

**Core tables**
| Table | Purpose |
|---|---|
| `profiles` | Users (FK to `auth.users`), `role`, `is_active` |
| `pipeline_stages` | Configurable Kanban stages (10 seeded by default) |
| `leads` | The central record — contact, company, project, pipeline state, ownership, source/UTM, score, BOQ/proposal/won fields, closure data |
| `interactions` | Full activity timeline per lead (calls, WhatsApp, email, notes, stage changes, campaign events, follow-ups) |
| `tasks` | Follow-ups; `is_overdue` is a **generated column** (`completed_at IS NULL AND due_at < NOW()`) |
| `audit_log` | Immutable entity change trail (actor, old/new JSONB, IP) |
| `ai_suggestions` | Cached AI outputs (pipeline summary, lead recap, draft message, etc.) |

**Campaign tables** — `campaigns`, `campaign_messages` (sequence + media + buttons), `campaign_enrollments` (per-lead position + `next_message_at` + opt-out), `campaign_send_log`.

**Feature tables (added via migrations)** — `chatbot_flows`, `chatbot_nodes`, `chatbot_sessions`; `email_templates`, `email_logs`; `notifications`; `price_revisions`; `admin_settings` (daily-summary config).

**Analytics views** — `pipeline_overview` (lead counts + avg days + stale count per stage), `source_performance` (win rate & days-to-close by source), `rep_activity_summary` (per-rep calls/tasks/overdue).

**DB triggers & automation**
- `update_updated_at()` on leads/profiles/campaigns/tasks.
- `log_stage_change()` — auto-inserted a `stage_change` interaction + reset `stage_entered_at` (this trigger was later **dropped** in migration `002` so stage logging is handled in app code instead).
- `set_reengagement_date()` — when a lead enters `lost`, sets `reengagement_eligible_at = NOW() + 90 days` and stamps `closed_at`.
- A DB trigger also fires `new_lead_assigned` notifications (app code deliberately does *not* duplicate this).

**Sample data:** rows carry `is_sample_data = true`; admin can clear them or call the `reseed_sample_data()` RPC.

---

## 6. The Core Domain — Leads & Pipeline

**Default pipeline (10 stages, configurable in Admin → Pipeline Config):**
`new_lead → contacted → qualified → site_visit_scheduled → proposal_sent → negotiation → won / lost / on_hold / reengagement`. Each stage has a colour, position, and flags: `is_terminal`, `requires_note`, `requires_value` (e.g. Won requires both a note and a deal value).

**Lead lifecycle / data flow**
1. **Capture** — a lead enters from one of several sources:
   - Manual entry (`/leads/new`, NewLeadModal, or LeadForm).
   - **Bulk import** of CSV/XLSX (`/api/leads/bulk-import`, service-role batch insert up to 500/req).
   - **Website webhook** (`/api/webhook/website-leads`).
   - **Inbound WhatsApp** (auto-matched by phone).
   - **AI-generated** synthetic leads (`/api/ai/generate-leads`).
2. **Scoring** — `lib/utils/lead-scoring.ts` computes a 0–100 score across 5 weighted dimensions (Budget 25, Source 15, Profile 15, Activity 25, Stage 20). `lib/utils/lead-category.ts` maps to **hot / warm / lukewarm / cold**. `/api/leads/score` and `/api/leads/score-all` run this; admins can re-score every lead.
3. **Work the lead** — reps view it on the **Kanban board** (`/pipeline`) or in the **lead drawer**. They log calls (LogCallModal), schedule follow-ups (creates a `task`), send WhatsApp/email, change stage (StageChangeModal enforces `requires_note`/`requires_value`), reassign, and add price revisions. Every action writes an `interaction`.
4. **Stage progression** — dragging a card moves the lead; the move is optimistic in the Zustand `kanbanStore` and persisted via React Query mutation, with stage-change interactions + notifications fired.
5. **Closure** — Won captures final price/area/scope; Lost captures a reason and schedules 90-day re-engagement.

**State split:** Zustand holds **UI/transient state** (`uiStore`: drawer, modals, sidebar; `kanbanStore`: in-memory leads/stages/filters/pending moves). React Query holds **all server state** (leads, activities, notifications, counts), with `useRealtime` subscribing to Supabase Realtime for live updates.

---

## 7. Multi-Channel Outreach

### WhatsApp (MayTAPI) — `lib/utils/maytapi.ts`
- **Outbound:** `/api/whatsapp/send` (to a lead), `/api/whatsapp/send-system` (system alerts to `MANAGER_WHATSAPP_NUMBER`). Phone numbers normalised to 12-digit `91…` form; media sent with MayTAPI's `image`/`media` payload (URL in `message`, caption in `text`).
- **Inbound:** `/api/webhook/whatsapp-reply` (bypasses auth) is the busiest handler. On each inbound message it:
  1. Ignores group messages and self-sent (`fromMe`) messages.
  2. Matches the sender to a lead by the **last 10 digits** of the phone.
  3. Expires stale chatbot sessions (>24 h), de-dupes by `whatsapp_message_id`.
  4. Logs a `whatsapp_received` interaction; if tied to a campaign, increments `total_replies`.
  5. Notifies the assigned rep **and all active admins** (`campaign_reply` notification).
  6. **Button auto-actions:** `btn_interested` → mark lead **hot**; `btn_not_now` → mark **cold**; `btn_call_me` → create a call **task** due in 2 h.
  7. Runs the **chatbot engine** (`matchAndRunChatbot`) for flow automation.
  8. Handles **STOP/UNSUBSCRIBE** → opts the lead out of all active campaign enrollments + sends a confirmation.
- **Health:** `/api/whatsapp/health` and `/admin/whatsapp-health` surface MayTAPI connection status.

### Email (Resend) — `lib/utils/resend.ts`, `lib/utils/email-content.ts`
- `/api/email/send` sends from a saved template or custom HTML; templates CRUD at `/api/email/templates`.
- The **Tiptap rich-text editor** (`components/email/RichTextEditor.tsx`) builds template bodies (headings, links, alignment, colour, font, video-embed panel).
- `/api/email/webhook` ingests Resend **open/click** events for tracking; `email_logs` records sends. Env: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `RESEND_WEBHOOK_SECRET`.

### Campaigns — drip sequences
A campaign is a per-lead message sequence (WhatsApp drip/blast, email drip, or manual).
1. Create (`POST /api/campaigns`) → 2. Enroll leads (`/[id]/enroll`, with stage filters) → 3. Build the message sequence (`/[id]/messages`, `MessageSequenceBuilder` with drag-reorder, media up to 100 MB, buttons) → 4. The **drip cron** advances each enrollment when `next_message_at` is due (`/[id]/send-next`) → 5. Replies/opens/conversions tracked on the campaign and surfaced in `/campaigns/[id]/report` and `/campaigns/monitor`. `send-test` allows a manual test send.

---

## 8. AI Layer — `lib/utils/claude.ts`

A single helper `callClaudeJSON<T>()` wraps the Anthropic Messages API (`claude-haiku-4-5-20251001`), and robustly extracts JSON (strips ```json fences, falls back to the first `{…}` block), throwing a typed `ClaudeError` with HTTP status.

**AI features (route handlers):**
| Route | Purpose |
|---|---|
| `/api/ai/draft-message` | Draft a WhatsApp/email message tailored to a lead |
| `/api/ai/lead-recap` | Summarise a lead's full history |
| `/api/ai/pipeline-summary` | Pipeline health / bottleneck overview |
| `/api/ai/daily-summary` | Daily team briefing (`lib/utils/daily-summary.ts`) |
| `/api/ai/generate-leads` | Generate synthetic leads for testing |
| `/api/ai/categorise-lead` | Auto-categorise a lead (auth-bypassed, callable by automation) |

Outputs are cached in `ai_suggestions`. UI surfaces: `/ai-agent` (assistant panel), `/ai-leads` (+ database), and in-drawer `LeadRecapPanel` / `PipelineSummaryCard`.

---

## 9. Visual WhatsApp Chatbot Builder

- **Builder UI:** `/admin/chatbot/[id]` using `@xyflow/react` — a drag-and-drop node graph (canvas positions persisted to DB).
- **Data:** `chatbot_flows`, `chatbot_nodes`, `chatbot_sessions`.
- **Engine:** `lib/utils/chatbot-engine.ts` (`matchAndRunChatbot`) executes a flow against an inbound message/button, advancing the lead's session; `lib/utils/chatbot-flow.ts` validates flow definitions; `/api/chatbot/flows/[id]/simulate` lets admins dry-run a flow.
- Triggered automatically from the inbound WhatsApp webhook.

---

## 10. Scheduled Automation (Vercel Cron — `vercel.json`)

| Cron route | Schedule (UTC) | Job |
|---|---|---|
| `/api/cron/daily-summary` | `0 8 * * 1-6` (Mon–Sat 8 AM) | Generate + WhatsApp the daily AI briefing |
| `/api/cron/check-overdue` | `0 9 * * *` (daily 9 AM) | Flag overdue tasks |
| `/api/cron/check-stale` | `0 10 * * *` (daily 10 AM) | Flag stale leads |
| `/api/cron/campaign-drip` | `10 6 * * *` (daily 6:10 AM) | Send the next due campaign messages |

Also present (manually/secret-triggered): `/api/cron/campaign-drip-test`, `/api/cron/overdue-notifications`. All cron routes require `Authorization: Bearer ${CRON_SECRET}`.

---

## 11. Notifications & Realtime

- `notifications` table is the in-app queue. Types include new-lead-assigned (DB-trigger driven), task assigned/overdue, stage change, hot-call outcome, and WhatsApp/campaign reply.
- `useNotifications` polls `GET /api/notifications` (and `PATCH` to mark read / mark-all); `useRealtime` adds live Supabase subscriptions; `NotificationCenter` renders them in the TopBar with an unread badge.
- `useSidebarCounts` (60 s refetch) drives the Inbox (unassigned leads) and Activities (overdue tasks) badges.

---

## 12. Dashboard Shell & Navigation

`app/(dashboard)/layout.tsx` wraps everything in `QueryClientProvider` and renders the shell:
```
Sidebar (collapsible, role-filtered nav, badge counts)
TopBar (global search, NotificationCenter, +New Lead, Import, profile)
<main> page content   ·   MobileBottomNav (mobile)
Global mounts: LeadDrawer · NewLeadModal · BulkImportModal · Sonner Toaster
```
A **single `useUser()` call** feeds the module-level cache for all children. Sidebar navigation is filtered by role (sales rep sees Pipeline / My Tasks; founder/marketing/manager/admin see progressively more).

**Main internal routes:** `/pipeline` (Kanban), `/leads` (+`/new`, `/[id]`), `/campaigns` (+`new`, `[id]`, `[id]/report`, `monitor`), `/inbox` (unassigned, manager+), `/analytics`, `/activities`, `/ai-agent`, `/ai-leads`, `/profile`, and the `/admin/*` console.

**Analytics** (`/analytics`): KPI cards (active leads, new leads, won deals + value, follow-up compliance), plus FunnelChart, LeadSourceChart, RepProductivityTable, StageAgeHeatmap, and email send/open/click rates — over selectable date ranges.

**Admin console** (`/admin/*`): Users (roles, activate/deactivate), Pipeline Config (stage CRUD), Integrations (webhook/WhatsApp/AI health), Chatbot Builder, Email Templates, All Tasks, Audit Log, WhatsApp Health, plus quick actions (clear/reseed sample data, score all leads, run drip, configure daily summary).

---

## 13. Public Portfolio Microsite (`/portfolio`)

A separate, **unauthenticated** marketing experience composed in `components/portfolio/*` (Hero, SectorTabs, ProjectGrid/Card, ClientLogos, Testimonials, ProcessSection, WhyUs, TrustBar, CTA, PDF banner, Footer). It:
- Accepts `?name=&sector=&lead_id=` query params to **personalise** the page to a named prospect and pre-select a sector.
- Fires `trackPortfolioView(lead_id)` (server action in `lib/actions/portfolio-track`) so reps can see when a prospect opened the shared link.
- Serves real project media from `public/portfolio/*` (facade-glazing, office-interiors, MEP, PEB, hospitality, hero videos, sector PDFs). Build scripts in `scripts/` recompress hero/project videos and warm a Cloudinary cache.

This turns the ERP into an outreach tool: a rep shares a tracked, sector-targeted portfolio link, and the prospect's view is logged back onto the lead timeline.

---

## 14. Environment Variables (from `.env.local`)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
# AI
ANTHROPIC_API_KEY
# WhatsApp (MayTAPI)
MAYTAPI_PRODUCT_ID / MAYTAPI_PHONE_ID / MAYTAPI_API_TOKEN
MANAGER_WHATSAPP_NUMBER
# Email (Resend)
RESEND_API_KEY / EMAIL_FROM / EMAIL_REPLY_TO / RESEND_WEBHOOK_SECRET
# Security
WEBHOOK_SECRET / CRON_SECRET
# App
NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_APP_NAME
```

---

## 15. End-to-End Flow Summary

```
Lead is born (website webhook · manual · bulk import · inbound WhatsApp · AI gen)
        │
        ├─ scored 0–100 + categorised hot/warm/lukewarm/cold
        ├─ assigned to a rep (RLS limits visibility) + notification fired
        ▼
Rep works it on Kanban / drawer  ──►  every touch = an interaction
        │      ├─ log call / schedule follow-up (task)
        │      ├─ send WhatsApp / email (outbound)
        │      ├─ enroll in a campaign drip
        │      └─ share tracked /portfolio link
        ▼
Inbound WhatsApp reply ─► matched to lead ─► logged, rep+admins notified,
        button actions (hot/cold/call), chatbot engine runs, STOP opts out
        ▼
Stage advances (notes/value enforced) ─► Won (final price) or Lost (90-day re-engagement)
        ▼
Cron jobs run nightly/daily: drip messages, overdue/stale flags, AI daily summary
        ▼
Managers/admins read it all in Analytics, Audit Log, and the AI pipeline summary
```

---

*Report reflects the codebase as read on 2026-06-10. Source-of-truth files: `middleware.ts`, `lib/types/index.ts`, `supabase/migrations/001_initial_schema.sql` (+ 18 feature migrations), `app/api/**`, `lib/utils/*`, and `components/**`. A companion `CLAUDE.md` knowledge base also exists with finer-grained conventions.*
