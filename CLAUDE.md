# Hagerstone ERP — Project Knowledge Base

> Paste this entire file into your Claude Project's knowledge base.  
> It gives Claude complete context about the codebase, architecture, business logic, and conventions.

---

## 1. Project Overview

**Hagerstone ERP** is a production-ready B2B CRM / sales-pipeline platform built for the Hagerstone interior design and construction group. It manages the full sales cycle from lead capture to deal closure, with multi-channel outreach (WhatsApp, email), AI-assisted workflows, and a visual Kanban pipeline.

**Industry context:** B2B interior design, MEP engineering, facade glazing, PEB construction, and civil works. Projects range from ₹25L to ₹2Cr+. Sales reps manage individual leads; managers/admins have oversight across the team.

**Live URL pattern:** `NEXT_PUBLIC_APP_URL` (env var)  
**App name:** Hagerstone ERP  
**Default landing:** `/` redirects to `/pipeline`

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.33 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS + shadcn/ui | ^3.4.1 |
| Database / Auth | Supabase — Hub Project, `marketing` schema | supabase-js ^2.103.2 |
| State — Server | TanStack React Query | ^5.99.0 |
| State — Client | Zustand | ^5.0.12 |
| Forms | React Hook Form + Zod | ^7 / ^4 |
| Rich Text | Tiptap v3 | ^3.23.x |
| Charts | Recharts | ^3.8.1 |
| Drag & Drop | @dnd-kit | ^6/^10 |
| Visual Flows | @xyflow/react | ^12.10.2 |
| Animations | Framer Motion | ^12.38.0 |
| Icons | Lucide React | ^1.8.0 |
| Email sending | Resend | ^6.12.3 |
| Email rendering | @react-email | ^1.0.12 |
| WhatsApp | Self-hosted gateway (Baileys, Railway) | — |
| AI | Anthropic Claude API | claude-haiku-4-5-20251001 |
| Spreadsheet import | xlsx | ^0.18.5 |
| Toasts | Sonner | ^2.0.7 |

---

## 3. Project Structure

```
hagerstone-erp/
├── app/
│   ├── layout.tsx               # Root layout (fonts, metadata, dark theme)
│   ├── globals.css              # Tailwind base + ProseMirror styles + CSS vars
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx       # Animated login (canvas particles, quotes)
│   │   ├── signup/page.tsx      # Signup with password strength indicator
│   │   └── onboarding/page.tsx  # First-login full name collection
│   ├── (dashboard)/
│   │   ├── layout.tsx           # QueryClientProvider + shell (Sidebar/TopBar/MobileBottomNav)
│   │   ├── page.tsx             # Root → redirects to /pipeline
│   │   ├── pipeline/page.tsx    # Kanban board
│   │   ├── leads/
│   │   │   ├── page.tsx         # All leads table
│   │   │   ├── new/page.tsx     # Create lead form
│   │   │   └── [id]/page.tsx    # Lead detail (auto-opens drawer)
│   │   ├── campaigns/
│   │   │   ├── page.tsx         # Campaign grid
│   │   │   ├── new/page.tsx     # Create campaign
│   │   │   ├── [id]/page.tsx    # Campaign detail + message builder
│   │   │   ├── [id]/report/page.tsx  # Campaign performance report
│   │   │   └── monitor/page.tsx      # Live campaign monitor
│   │   ├── inbox/page.tsx       # Unassigned leads (manager/admin only)
│   │   ├── analytics/page.tsx   # KPIs, charts, rep productivity
│   │   ├── activities/page.tsx  # Activity log
│   │   ├── ai-agent/page.tsx    # AI assistant panel
│   │   ├── ai-leads/
│   │   │   ├── page.tsx         # AI lead generation
│   │   │   └── database/page.tsx # AI lead database
│   │   ├── profile/page.tsx     # User profile
│   │   └── admin/
│   │       ├── layout.tsx
│   │       ├── page.tsx         # Admin panel home
│   │       ├── users/page.tsx   # User management (roles, active/inactive)
│   │       ├── pipeline-config/page.tsx  # Stage CRUD
│   │       ├── integrations/page.tsx     # Webhook, WhatsApp, AI health
│   │       ├── chatbot/
│   │       │   ├── page.tsx     # Chatbot flow list
│   │       │   └── [id]/page.tsx # Flow builder (XYFlow)
│   │       ├── email-templates/page.tsx  # Email template CRUD
│   │       ├── tasks/page.tsx   # All team tasks (manager+)
│   │       ├── audit-log/page.tsx        # Audit trail
│   │       └── whatsapp-health/page.tsx  # WhatsApp connection status
│   └── api/
│       ├── auth/create-profile/route.ts
│       ├── leads/
│       │   ├── score/route.ts
│       │   ├── score-all/route.ts
│       │   └── bulk-import/route.ts
│       ├── campaigns/
│       │   ├── route.ts                    # GET list / POST create
│       │   └── [id]/
│       │       ├── route.ts                # GET/PATCH/DELETE
│       │       ├── enroll/route.ts
│       │       ├── messages/route.ts
│       │       ├── send-next/route.ts
│       │       └── send-test/route.ts
│       ├── ai/
│       │   ├── draft-message/route.ts
│       │   ├── generate-leads/route.ts
│       │   ├── lead-recap/route.ts
│       │   ├── pipeline-summary/route.ts
│       │   └── daily-summary/route.ts
│       ├── chatbot/flows/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── nodes/route.ts
│       │       └── simulate/route.ts
│       ├── cron/
│       │   ├── campaign-drip/route.ts
│       │   ├── campaign-drip-test/route.ts
│       │   ├── check-overdue/route.ts
│       │   ├── check-stale/route.ts
│       │   ├── daily-summary/route.ts
│       │   └── overdue-notifications/route.ts
│       ├── webhook/
│       │   ├── whatsapp-reply/route.ts
│       │   └── website-leads/route.ts
│       ├── admin/
│       │   ├── clear-sample-data/route.ts
│       │   ├── reseed/route.ts
│       │   ├── integrations-status/route.ts
│       │   ├── test-anthropic/route.ts
│       │   ├── test-webhook/route.ts
│       │   └── test-whatsapp/route.ts
│       ├── email/
│       │   ├── send/route.ts
│       │   ├── templates/route.ts
│       │   ├── templates/[id]/route.ts
│       │   └── webhook/route.ts           # Resend open/click tracking
│       ├── whatsapp/
│       │   ├── send/route.ts
│       │   ├── send-system/route.ts
│       │   └── health/route.ts
│       ├── notifications/route.ts
│       ├── storage/upload-boq/route.ts
│       └── debug-env/route.ts
├── components/
│   ├── admin/DailySummaryConfig.tsx
│   ├── ai/
│   │   ├── AIAgentPanel.tsx
│   │   ├── LeadRecapPanel.tsx
│   │   └── PipelineSummaryCard.tsx
│   ├── analytics/
│   │   ├── FunnelChart.tsx
│   │   ├── LeadSourceChart.tsx
│   │   ├── RepProductivityTable.tsx
│   │   └── StageAgeHeatmap.tsx
│   ├── campaigns/
│   │   ├── CampaignCard.tsx
│   │   ├── EnrollLeadsModal.tsx
│   │   └── MessageSequenceBuilder.tsx
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── MobileBottomNav.tsx
│   │   ├── DemoModeBanner.tsx
│   │   ├── LeadSearchModal.tsx
│   │   └── NotificationCenter.tsx
│   ├── email/
│   │   ├── RichTextEditor.tsx   # Tiptap editor with toolbar
│   │   └── VideoInsertPanel.tsx
│   ├── kanban/
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanColumn.tsx
│   │   ├── KanbanFilters.tsx
│   │   ├── DraggableLeadCard.tsx
│   │   ├── DroppableColumn.tsx
│   │   ├── LeadCard.tsx
│   │   ├── LeadCardSkeleton.tsx
│   │   ├── StageChangeModal.tsx
│   │   └── BlobBackground.tsx   # Animated gradient blobs
│   ├── leads/
│   │   ├── LeadDrawer.tsx
│   │   ├── LeadForm.tsx
│   │   ├── LeadTimeline.tsx
│   │   ├── LeadTable.tsx
│   │   ├── LeadFilters.tsx
│   │   ├── LeadsPageContent.tsx
│   │   ├── NewLeadModal.tsx
│   │   ├── BulkImportModal.tsx
│   │   ├── LogCallModal.tsx
│   │   ├── ScheduleFollowUpModal.tsx
│   │   ├── SendWhatsAppModal.tsx
│   │   ├── StagePickerPopover.tsx
│   │   ├── WhatsAppChatView.tsx
│   │   └── ReassignPopover.tsx
│   └── ui/
│       ├── button.tsx           # shadcn button
│       ├── select.tsx           # shadcn select
│       └── HagerstoneLogoAnimation.tsx
├── lib/
│   ├── types/index.ts           # All TypeScript types (source of truth)
│   ├── stores/
│   │   ├── uiStore.ts           # Zustand: drawer, modals, sidebar
│   │   └── kanbanStore.ts       # Zustand: leads, stages, filters
│   ├── hooks/
│   │   ├── useUser.ts           # Auth + profile (module-level cache)
│   │   ├── useKanban.ts         # Kanban data + stage move logic
│   │   ├── useLeads.ts          # Lead list queries
│   │   ├── useActivities.ts     # Activity log
│   │   ├── useNotifications.ts  # Notification polling
│   │   ├── useRealtime.ts       # Supabase realtime subscriptions
│   │   ├── useSidebarCounts.ts  # Unassigned leads + overdue tasks
│   │   └── useMediaQuery.ts     # Responsive breakpoints
│   ├── supabase/
│   │   ├── client.ts            # createBrowserClient
│   │   └── server.ts            # createServerClient (async cookies)
│   ├── utils/
│   │   ├── claude.ts            # callClaudeJSON<T>() helper
│   │   ├── lead-scoring.ts      # scoreLead() — 100-pt scoring engine
│   │   ├── lead-category.ts     # hot/warm/lukewarm/cold categorization
│   │   ├── chatbot-engine.ts    # Flow execution logic
│   │   ├── chatbot-flow.ts      # Flow definition + validation
│   │   ├── daily-summary.ts     # AI daily briefing generation
│   │   ├── email-content.ts     # Email template rendering
│   │   ├── whatsapp.ts          # WhatsApp gateway client (self-hosted)
│   │   ├── resend.ts            # Email sending wrapper
│   │   └── video-embed.ts       # YouTube/Vimeo embed helpers
│   └── utils.ts                 # cn() (clsx + tailwind-merge)
├── middleware.ts                 # Auth guard + role-based redirect
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Core Types (`lib/types/index.ts`)

```typescript
type UserRole = 'admin' | 'manager' | 'sales_rep' | 'marketing' | 'founder'

type ServiceLine =
  | 'office_interiors' | 'mep' | 'facade_glazing'
  | 'peb_construction' | 'civil_works' | 'multiple' | 'unknown'

type LeadSource =
  | 'website' | 'manual_sales' | 'whatsapp_inbound'
  | 'referral' | 'google_ads' | 'linkedin' | 'justdial'
  | 'ai_suggested' | 'other'

type StageType = 'active' | 'won' | 'lost' | 'on_hold' | 'reengagement'

type InteractionType =
  | 'call_outbound' | 'call_inbound' | 'call_missed'
  | 'whatsapp_sent' | 'whatsapp_received'
  | 'email_sent' | 'email_received'
  | 'site_visit' | 'meeting'
  | 'note' | 'stage_change' | 'assignment_change'
  | 'campaign_enrolled' | 'campaign_message_sent' | 'campaign_responded'
  | 'lead_created' | 'ai_suggestion_generated'
```

### Key Interfaces

**Profile** — `id`, `full_name`, `email`, `phone?`, `role: UserRole`, `avatar_url?`, `is_active: boolean`, `created_at`

**PipelineStage** — `id`, `name`, `slug`, `color`, `position`, `is_terminal`, `requires_note`, `requires_value`, `stage_type: StageType`

**Lead** — Full contact record including:
- Contact: `full_name`, `email`, `phone`, `phone_alt`, `designation`, `company_name`, `company_size`, `industry`, `city`, `state`
- Project: `service_line`, `estimated_budget`, `project_size_sqft`, `expected_timeline`
- Pipeline: `stage_id`, `stage?`, `stage_entered_at`, `assigned_to`, `assignee?`
- Tracking: `source: LeadSource`, `source_detail`, `utm_source`, `utm_campaign`, `whatsapp_opted_in`
- Score: `score: number`, `category: "hot"|"warm"|"lukewarm"|"cold"|null`, `category_remarks`, `category_updated_at`, `category_updated_by`
- BOQ fields: `boq_received_date`, `boq_document_url`, `boq_deadline`, `boq_scope`, `boq_area_sqft`, `boq_floors`, `boq_remarks`, `boq_received_by`
- Proposal fields: `proposal_pdf_url`, `proposal_estimated_cost`, `proposal_sent_date`, `proposal_deadline`, `proposal_validity_days`, `proposal_remarks`, `proposal_sent_by`
- Final/Won: `final_boq_url`, `final_agreed_price`, `final_area_sqft`, `final_floors`, `final_scope`, `final_remarks`, `won_date`, `won_by`
- Closure: `closure_reason`, `closure_value`, `closed_at`
- Meta: `initial_notes`, `is_sample_data`, `created_at`, `updated_at`
- Computed: `interactions?`, `tasks?`, `next_task?`, `stage_age_days?`

**PriceRevision** — `id`, `lead_id`, `revised_price`, `revision_note`, `revised_by`, `created_at`, `profile?`

**Interaction** — Full activity log entry with `type: InteractionType`, outcome, duration, stage transitions, follow-up scheduling

**Task** — Follow-up action: `title`, `type`, `due_at`, `completed_at`, `is_overdue`, assigned to a profile

**Campaign** — `name`, `description`, `type`, `status`, audience/delivery/reply metrics, `starts_at`, `ends_at`, `last_sent_at`

**AuditLog** — `entity_type`, `entity_id`, `action`, `actor_id`, `old_values`, `new_values`, `ip_address`

**KanbanColumn** — `{ stage: PipelineStage, leads: Lead[] }`

**LeadFilters** — `assignedTo[]`, `stages[]`, `sources[]`, `serviceLines[]`, `cities[]`, `dateFrom`, `dateTo`, `searchQuery`, `staleOnly`, `overdueOnly`

---

## 5. Database Tables (Supabase / PostgreSQL)

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts with roles |
| `leads` | All lead/contact records |
| `pipeline_stages` | Configurable kanban stages |
| `interactions` | Activity log per lead |
| `tasks` | Follow-up tasks per lead |
| `campaigns` | WhatsApp message campaigns |
| `campaign_messages` | Message sequence for each campaign |
| `email_logs` | Sent email records |
| `email_templates` | Saved email templates |
| `notifications` | In-app notification queue |
| `audit_logs` | Entity change trail |
| `chatbot_flows` | WhatsApp chatbot flow definitions |
| `chatbot_nodes` | Nodes within each chatbot flow |
| `price_revisions` | Revision history for lead pricing |

**Important:** Supabase's `reseed_sample_data()` RPC reseeds demo data. Sample leads are flagged with `is_sample_data = true`.

---

## 6. Authentication & Authorization

### Auth Flow

1. All routes protected by `middleware.ts`
2. Unauthenticated → redirect to `/login`
3. Authenticated, no profile → redirect to `/onboarding`
4. Authenticated, has profile → allowed into dashboard
5. `/api/webhook/*` and `/api/cron/*` bypass middleware (they do their own secret verification)
6. Root `/` → redirect to `/pipeline`

### Role-Based Access (middleware)

| Role | Admin routes allowed |
|------|---------------------|
| `admin`, `founder` | All `/admin/*` routes |
| `manager` | `/admin/tasks`, `/admin/whatsapp-health` |
| `marketing` | `/admin/email-templates` only |
| `sales_rep` | None — redirected to `/activities` |

### `useUser` Hook Pattern

`lib/hooks/useUser.ts` uses a **module-level cache** to avoid Supabase auth-token lock races when many components mount simultaneously. Key exports:
- `useUser()` — React hook (loading state, user, profile)
- `getCachedUser()` — async fn for use in queryFns outside React tree
- `getCachedUserAndProfile()` — returns both user + profile

Cache is invalidated on `SIGNED_OUT`, `SIGNED_IN`, `TOKEN_REFRESHED`, `USER_UPDATED` auth events.

---

## 7. State Management

### Zustand Stores

**`useUIStore`** (`lib/stores/uiStore.ts`) — UI state only:
- `isSidebarCollapsed`, `isMobileSidebarOpen`, `isMobileNavOpen`
- `isLeadDrawerOpen`, `leadDrawerId`, `drawerActiveTab`, `drawerOpenLogCall`
- `isNewLeadModalOpen`, `isBulkImportModalOpen`
- Actions: `setLeadDrawerId(id)` — also sets `isLeadDrawerOpen: true` automatically

**`useKanbanStore`** (`lib/stores/kanbanStore.ts`) — Kanban state:
- `leads: KanbanLead[]`, `stages: PipelineStage[]`
- `filters: KanbanFiltersState` — `myLeadsOnly`, `overdueOnly`, `serviceLines[]`, `sources[]`, `assignedTo[]`, `category`
- `selectedLeadId`, `pendingStageChange: { leadId, fromStageId, toStageId } | null`
- Actions: `moveLeadToStage()`, `revertLeadStage()`, `setFilter()`, `clearFilters()`, `setPendingStageChange()`

### React Query

Used for all server-state. QueryClient is created in `DashboardLayout` and provided via `QueryClientProvider`. All dashboard components use `useQuery` / `useMutation` with the Supabase client.

---

## 8. Lead Scoring (`lib/utils/lead-scoring.ts`)

100-point scoring system with 5 categories:

| Category | Max Points | Logic |
|----------|-----------|-------|
| Budget | 25 | ₹2Cr+ = 25, ₹1-2Cr = 20, ₹50L-1Cr = 15, ₹25-50L = 8, Below ₹25L = 3 |
| Source | 15 | referral=15, website=12, linkedin=10, google_ads=8, whatsapp_inbound=8, manual_sales=6, justdial=4, ai_suggested=5, other=2 |
| Profile | 15 | +3 each: email, company_name, city, service_line, whatsapp_opted_in |
| Activity | 25 | 0 interactions=0, 1-2=8, 3-5=15, 6-10=20, 11+=25 (last 30 days) |
| Stage | 20 | new_lead=5, contacted=8, qualified=11, site_visit_scheduled=14, proposal_sent=17, negotiation=20, won/lost=0, on_hold=3, reengagement=6 |

**Labels:** Hot (≥80, red), Warm (≥60, amber), Lukewarm (≥40, blue), Cold (<40, gray)

**Entry point:** `scoreLead(lead: ScorableLead, interactionCountLast30Days: number): ScoreResult`

---

## 9. Pipeline Stages

Configurable in Admin → Pipeline Config. Default stages (by slug):

| Slug | Type | Notes |
|------|------|-------|
| `new_lead` | active | Starting stage |
| `contacted` | active | |
| `qualified` | active | |
| `site_visit_scheduled` | active | |
| `proposal_sent` | active | requires_value = true |
| `negotiation` | active | |
| `won` | won | Terminal, requires_note + requires_value |
| `lost` | lost | Terminal, requires_note |
| `on_hold` | on_hold | |
| `reengagement` | reengagement | |

Each stage has a `color` (hex), `position` (order), `is_terminal`, `requires_note`, `requires_value`.

---

## 10. AI Integration (`lib/utils/claude.ts`)

**Model:** `claude-haiku-4-5-20251001`  
**Entry point:** `callClaudeJSON<T>(options: ClaudeCallOptions)`

Options: `{ system, userMessage, maxTokens?: number, temperature?: number }`

The function:
1. Calls `https://api.anthropic.com/v1/messages`
2. Handles markdown-fenced JSON (`\`\`\`json ... \`\`\``)
3. Falls back to extracting first `{...}` block from prose responses
4. Throws `ClaudeError` with HTTP status on failures

**AI API routes:**
- `POST /api/ai/draft-message` — Generate WhatsApp/email message for a lead
- `POST /api/ai/generate-leads` — Generate synthetic leads for testing
- `POST /api/ai/lead-recap` — AI summary of a lead's history
- `POST /api/ai/pipeline-summary` — Pipeline health overview
- `POST /api/ai/daily-summary` — Daily team briefing generation

---

## 11. WhatsApp Integration (self-hosted gateway)

**Library:** `lib/utils/whatsapp.ts`
**Provider:** Hagerstone's own gateway — Node + Fastify + Baileys, deployed on Railway
(project `hagerstone-wa-gateway`, service `wa-gateway`), with session state in the Hub
Supabase **`public`** schema (`wa_sessions`, `wa_auth_store`, `wa_messages`, `wa_contacts`).
Gateway source: `D:\hs\Plumbline\Plumbline\whatsapp-gateway`.

**MayTAPI has been fully removed.** The gateway deliberately exposes a
MayTAPI-compatible send route, so the migration was a URL + secret swap:

```
POST {WHATSAPP_GATEWAY_URL}/maytapi/:productId/:sessionId/sendMessage
  header: x-maytapi-key: <WHATSAPP_GATEWAY_SECRET>
  body:   { to_number, type: 'text'|'media'|'link', message, text?, filename? }
  200:    { success: true, data: { msgId } }
```
`productId` is accepted and ignored; `sessionId` is the paired line (`hagerstone-biz`, +918448992377).

**Env vars:** `WHATSAPP_GATEWAY_URL`, `WHATSAPP_SESSION_ID`, `WHATSAPP_GATEWAY_SECRET`, `MANAGER_WHATSAPP_NUMBER`

**Two behavioural differences from MayTAPI:**
1. **No interactive buttons.** Baileys/WhatsApp dropped them. `sendWhatsAppWithButtons()`
   degrades to a numbered text list ("Reply with a number") instead of failing the send.
2. **Media needs a filename.** The gateway infers MIME type from `filename` and falls back
   to `application/pdf` for remote URLs — so an image sent without one would arrive as a
   document. `sendWhatsAppMedia()` derives a filename from the URL and forces an image
   extension when `type === 'image'`.

All exported senders return `{ success, messageId?, error? }` and **never throw** — every
caller branches on `result.success`.

**API routes:**
- `POST /api/whatsapp/send` — Send WhatsApp message to a lead
- `POST /api/whatsapp/send-system` — Send system notifications
- `GET /api/whatsapp/health` — Gateway + session status, with 7-day delivery stats read from `public.wa_messages`
- `POST /api/webhook/whatsapp-reply` — Inbound message handler (bypasses middleware auth)

The webhook handler processes inbound WhatsApp messages, matches them to leads, creates interactions, and can trigger chatbot flows.

---

## 12. Email Integration (Resend)

**Library:** `lib/utils/resend.ts`  
**Provider:** Resend  
**Env vars:** `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`

**Email rendering:** `lib/utils/email-content.ts` + `@react-email/render`

**API routes:**
- `POST /api/email/send` — Send email from a template or custom content
- `GET/POST /api/email/templates` — Template CRUD
- `PATCH/DELETE /api/email/templates/[id]` — Template operations
- `POST /api/email/webhook` — Resend open/click tracking webhook

**Rich text editor:** `components/email/RichTextEditor.tsx` uses Tiptap v3 with extensions: StarterKit, Underline, Link, TextAlign, Highlight, Color, TextStyle, FontFamily, Placeholder. Heading styles are defined in `globals.css` under `.ProseMirror h1/h2/h3`. Email preview uses `.email-preview h1/h2/h3` classes.

---

## 13. Campaign System

Campaigns are WhatsApp message sequences enrolled per-lead.

**Workflow:**
1. Create campaign at `POST /api/campaigns`
2. Enroll leads at `POST /api/campaigns/[id]/enroll`
3. Define message sequence at `POST /api/campaigns/[id]/messages`
4. Drip cron at `/api/cron/campaign-drip` runs every hour (Vercel scheduler)
5. `send-next` advances each enrolled lead to the next message
6. Track opens/replies/conversions

**Campaign goals:** `lead_nurture`, `site_visit_followup`, `proposal_followup`, `reengagement`, `custom`

**Campaign service lines target filter:** `all`, `office_interiors`, `mep`, `facade_glazing`, `peb_construction`, `civil_works`, `multiple`

---

## 14. Chatbot Builder

Visual flow builder at `/admin/chatbot/[id]` using `@xyflow/react`.

**Entities:**
- `chatbot_flows` — Flow definition (name, status, trigger conditions)
- `chatbot_nodes` — Individual flow nodes with type and config

**Execution:** `lib/utils/chatbot-engine.ts`  
**Validation:** `lib/utils/chatbot-flow.ts`  
**Simulation:** `POST /api/chatbot/flows/[id]/simulate`

---

## 15. Cron Jobs

All protected by `Authorization: Bearer ${CRON_SECRET}` header check.

| Route | Purpose | Frequency |
|-------|---------|-----------|
| `/api/cron/campaign-drip` | Send next campaign messages | Hourly |
| `/api/cron/check-overdue` | Mark overdue tasks | Daily |
| `/api/cron/check-stale` | Flag stale leads | Daily |
| `/api/cron/daily-summary` | Generate + send daily briefing | Daily morning |
| `/api/cron/overdue-notifications` | Create overdue notifications | Daily |

---

## 16. Dashboard Shell Architecture

`app/(dashboard)/layout.tsx` renders:
```
QueryClientProvider
└── DashboardShell
    ├── Sidebar (collapsible, badge counts)
    ├── Mobile backdrop overlay (AnimatePresence)
    └── Main column
        ├── TopBar (search, notifications, profile)
        ├── DemoModeBanner
        ├── <main> (page content)
        └── MobileBottomNav
    + LeadDrawer (global, controlled by uiStore.leadDrawerId)
    + NewLeadModal
    + BulkImportModal
    + Sonner Toaster
```

`DashboardShell` makes a single `useUser()` call — all child components read from the same module-level cache. `useSidebarCounts(userId)` provides badge numbers for inbox (unassigned leads) and activities (overdue tasks).

---

## 17. Design System

### Colors (CSS custom properties in `globals.css`)

| Variable | Value | Usage |
|----------|-------|-------|
| `--background` | `#0A0A0F` | Page background |
| `--foreground` | `#F0F0FA` | Primary text |
| `--card` | `#111118` | Card/panel backgrounds |
| `--border` | `#2A2A3C` | Borders, dividers |
| `--muted` | `#1F1F2E` | Secondary backgrounds |
| `--muted-foreground` | `#9090A8` | Secondary text |
| `--primary` | `#3B82F6` | Blue — primary actions |
| `--destructive` | `#EF4444` | Red — errors, delete |
| `--sidebar` | `#111118` | Sidebar background |

### Chart Colors
`--chart-1` `#3B82F6` (blue), `--chart-2` `#8B5CF6` (purple), `--chart-3` `#10B981` (green), `--chart-4` `#F59E0B` (amber), `--chart-5` `#06B6D4` (cyan)

### Typography
- **Body/UI:** DM Sans (Google Font)
- **Monospace:** JetBrains Mono (Google Font)
- **Headings:** Syne (Google Font, `--font-heading` CSS var)

### Border Radius
`--radius 0.75rem`, `--radius-sm 0.5rem`, `--radius-md 0.75rem`, `--radius-lg 1rem`, `--radius-xl 1.25rem`

### Scrollbar Utility
`.thin-scrollbar` — 8px wide, dark track `#0F0F15`, thumb `#2A2A3C`  
`.kanban-board` — hidden scrollbar (custom arrow buttons instead)

### Tailwind Config
Dark-mode-first using shadcn CSS variable integration. Custom `font-heading` family. All colors reference `hsl(var(--...))` pattern from shadcn.

---

## 18. Key Patterns & Conventions

### Imports
All imports use `@/` path alias (maps to project root).

### Component files
- All client components have `"use client"` at top
- Server components (pages) fetch data inline or via server actions
- Page files are named `page.tsx`, layouts `layout.tsx`

### Supabase queries
- Browser: `createClient()` from `@/lib/supabase/client`
- Server (route handlers, middleware): `createServerClient` from `@supabase/ssr`
- All queries use `.maybeSingle()` instead of `.single()` to avoid 406 errors

### Error handling
- API routes return `{ error: string }` JSON with appropriate HTTP status
- Client components use `toast.error()` from Sonner
- AI calls use `ClaudeError` with `.status` property

### Form validation
- All forms use React Hook Form + Zod schemas
- `@hookform/resolvers/zod` for integration

### Tailwind usage
- Direct color values (`text-[#F0F0FA]`, `bg-[#111118]`) are used alongside CSS variables
- `cn()` from `lib/utils.ts` (clsx + tailwind-merge) used for conditional classes

### Animations
- Framer Motion for page transitions, drawer slides, modal appears
- `AnimatePresence` wraps conditionally rendered animated elements
- `tw-animate-css` for CSS-based animations

### Mobile support
- `md:` breakpoint separates mobile/desktop layouts
- Mobile gets `MobileBottomNav` (fixed bottom bar)
- Mobile lead list shows cards; desktop shows table
- `useMediaQuery` hook for JS-based breakpoint checks

---

## 19. Environment Variables

```bash
# Supabase — the "Hub Project" (ref tpfvnerrjhqwipyonngf); app reads the `marketing` schema
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=               # Claude API key (haiku model)

# WhatsApp (self-hosted gateway)
WHATSAPP_GATEWAY_URL=            # e.g. https://wa-gateway-production-26c1.up.railway.app
WHATSAPP_SESSION_ID=             # e.g. hagerstone-biz
WHATSAPP_GATEWAY_SECRET=         # the gateway's GATEWAY_SECRET
MANAGER_WHATSAPP_NUMBER=         # Receives system notifications

# Email (Resend)
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=           # For verifying open/click webhooks

# Security
WEBHOOK_SECRET=                  # For /api/webhook/* routes
CRON_SECRET=                     # For /api/cron/* routes (Bearer token)

# App config
NEXT_PUBLIC_APP_URL=             # e.g. https://erp.hagerstone.com
NEXT_PUBLIC_APP_NAME=            # e.g. "Hagerstone ERP"
```

---

## 20. Admin Panel Features

Located at `/admin/*`. Access requires role `admin` or `founder` (managers see only tasks + whatsapp-health).

| Section | Path | Description |
|---------|------|-------------|
| Admin Home | `/admin` | Overview + quick actions |
| Users | `/admin/users` | Manage roles, activate/deactivate |
| Pipeline Config | `/admin/pipeline-config` | Stage CRUD (name, color, order, flags) |
| Integrations | `/admin/integrations` | Webhook, WhatsApp, AI health checks |
| Chatbot Builder | `/admin/chatbot/[id]` | Visual WhatsApp flow builder |
| Email Templates | `/admin/email-templates` | Create/edit email templates |
| All Tasks | `/admin/tasks` | Team-wide task overview |
| Audit Log | `/admin/audit-log` | Entity change history |
| WhatsApp Health | `/admin/whatsapp-health` | Gateway session + delivery stats |

**Admin quick actions (on `/admin` page):**
- Clear sample data (`DELETE` flagged `is_sample_data=true` leads)
- Reseed sample data (calls `reseed_sample_data()` Supabase RPC)
- Score all leads (runs scoring engine on every lead)
- Test/Run campaign drip manually
- Configure daily WhatsApp summary recipients and timing

---

## 21. Analytics Page

At `/analytics`. Date range options: `this_week`, `this_month`, `last_3_months`, `this_year`, `custom`.

**KPI Cards:**
- Active leads count
- New leads (in selected period)
- Won deals + value
- Follow-up compliance %

**Charts:**
- `FunnelChart` — Stage-by-stage conversion funnel
- `LeadSourceChart` — Lead volume by source
- `RepProductivityTable` — Per-rep stats (manager/admin only)
- `StageAgeHeatmap` — How long leads sit in each stage

**Additional metrics:**
- Email send/open/click rates
- Won vs Lost breakdown with top loss reasons

---

## 22. Bulk Import

Route: `POST /api/leads/bulk-import`  
Component: `BulkImportModal`

Accepts CSV or XLSX files. Maps columns to lead fields. Respects `is_sample_data` flag. Uses `xlsx` library for parsing.

---

## 23. Notifications

`useNotifications` hook polls `GET /api/notifications` for unread notifications. Real-time updates also via `useRealtime` (Supabase realtime subscription).

Notification types include: new lead assigned, task overdue, stage change, campaign reply, etc.

`NotificationCenter` component in TopBar renders the notification list.

---

## 24. Common UI Patterns

### Opening a lead in the drawer
```typescript
const { setLeadDrawerId } = useUIStore()
setLeadDrawerId(leadId)  // also sets isLeadDrawerOpen: true
```

### Opening new lead modal
```typescript
const { openNewLeadModal } = useUIStore()
openNewLeadModal()
```

### Kanban filter
```typescript
const { setFilter } = useKanbanStore()
setFilter('myLeadsOnly', true)
setFilter('serviceLines', ['mep', 'office_interiors'])
```

### Supabase query in a React Query hook
```typescript
const { data } = useQuery({
  queryKey: ['leads', filters],
  queryFn: async () => {
    const user = await getCachedUser()
    const supabase = createClient()
    const { data, error } = await supabase
      .from('leads')
      .select('*, stage:pipeline_stages(*), assignee:profiles(*)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  }
})
```

### Calling Claude from a server route
```typescript
import { callClaudeJSON, CLAUDE_MODEL } from '@/lib/utils/claude'

const result = await callClaudeJSON<{ message: string }>({
  system: 'You are a sales assistant...',
  userMessage: `Draft a follow-up message for ${lead.full_name}`,
  maxTokens: 500,
  temperature: 0.6,
})
// result.data.message
```

---

## 25. File Naming & Organization Rules

- Pages: `app/(group)/route/page.tsx`
- API routes: `app/api/resource/route.ts`
- Shared components: `components/feature/ComponentName.tsx`
- Hooks: `lib/hooks/useHookName.ts` (camelCase with `use` prefix)
- Stores: `lib/stores/storeName.ts` (camelCase)
- Utils: `lib/utils/util-name.ts` (kebab-case)
- Types: all in `lib/types/index.ts` (single source of truth)

---

## 26. Known Constraints & Notes

1. **Claude model is Haiku** — cost-optimized. For complex reasoning tasks consider upgrading to Sonnet in `lib/utils/claude.ts`.
2. **Webhook routes bypass middleware** — `/api/webhook/*` and `/api/cron/*` skip auth middleware. Each handler verifies its own secret.
3. **WhatsApp line** — One session (`hagerstone-biz`) is wired via `WHATSAPP_SESSION_ID`. A second session `hagerstone-grp` exists in the gateway but is not used by this app.
4. **Sample data flag** — `is_sample_data = true` on fake leads. Admin can clear/reseed these safely.
5. **Supabase RPC** — `reseed_sample_data()` must exist as a PostgreSQL function in your Supabase project.
6. **Auth token lock race** — Solved in `useUser.ts` with module-level promise deduplication. Do not call `supabase.auth.getUser()` directly in multiple components on the same page.
7. **Tiptap heading styles** — Tailwind preflight resets all heading styles. Styles are re-applied in `globals.css` under `.ProseMirror h1/h2/h3`. Email previews use `.email-preview h1/h2/h3`.
8. **CRON_SECRET hardcoded in admin page** — `/admin/page.tsx` sends `Authorization: Bearer hagerstone-cron-2024` when manually triggering the drip. This should match `CRON_SECRET` env var.

---

*Generated from full codebase scan — covers all 130+ TypeScript files.*
