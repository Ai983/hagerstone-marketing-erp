# HAGERSTONE SALES ENGINE — START HERE

> **Owner:** Dhruv Agarwal (MD) · **Built:** 05–06 Aug 2026 (overnight) · **Goal: ₹20 Cr billing per month, month on month**
> This folder is the complete, self-contained sales system. Share this folder = share the whole system.

## What's in this folder

| File | What it is | Who uses it |
|---|---|---|
| **SALES_PIPELINE.md** | THE working pipeline — every named lead/tender with serial #, category, value, status, next action, next date. Single source of truth. | Everyone, daily |
| **SALES_LEADS_MASTER.csv** | The full contact universe — 97,707 deduped contacts with funnel stage, persona, field, region, recency. | Sales team + marketing |
| **SALES_FUNNEL_MASTER.xlsx** | The same universe as a colour-coded Excel workbook — tenders first, funnel pivots, one tab per segment. | Managers, reviews |
| **SALES_LEADS_MASTER.xlsx** | Older 50-tab list-wise workbook (pre-funnel). Kept for reference. | Archive |
| **README.md** (this file) | Orientation | New joiners |
| **SYSTEM_GUIDE.md** | Full system architecture — automations, artifacts, funnel model, colour code | New joiners, admins |
| **TEAM_PLAYBOOK.md** | How to actually run it daily — owners, updates, kanban, rules | Sales team |
| **DATA_DICTIONARY.md** | Every column, code, category and source explained | Anyone touching the data |
| **PROJECT_HISTORY.md** | How this was built, wave by wave, and everything discovered | Context/reference |

## The 3 live tools (bookmark on phone)

1. **📋 Mobile Dashboard** — https://claude.ai/code/artifact/1740f457-9450-47ab-8557-335e99512041
   Target vs pipeline, critical list, counts. Refreshed by the daily reminder.
2. **🗂️ Sales Kanban** — https://claude.ai/code/artifact/a804b946-a553-42ea-8046-17072d6df558
   Drag leads between stages (NEW → FOLLOW-UP → TENDER → HOT → AWAITING → WON). Each bin has an owner. Tap-to-call/WhatsApp. "Copy changes + feedback" → paste to Claude to sync.
3. **🔎 Lead Browser** — https://claude.ai/code/artifact/f7c906b7-225e-45cf-a82e-f43e0be5d635
   Search the top prioritized contacts of the universe; filter by status/category/region; tap to Call / WhatsApp / Email.

*(Artifacts are private to Dhruv's Claude account; he shares view links from the page's share menu.)*

## The 2 automations

| When | What |
|---|---|
| **Every morning ~8:25 AM** | Daily reminder: reads SALES_PIPELINE.md → overdue 🔴 + due-today list, WhatsApp-format follow-up list, birthday/anniversary alerts, dashboard refresh |
| **Every Wednesday ~9 PM** | Weekly scan: last-7-days sweep of Gmail (all aliases), Drive, desktop, WhatsApp → new leads deduped in, funnel workbook refreshed, immediate-actions summary |

Both run inside Dhruv's Claude Code desktop app (they fire while the app is open, catch up on next launch).

## The funnel in one line

**AUDIENCE (86,644 unknowns) → CONTACTED (1,559) → ENGAGED (664) → OPPORTUNITY (2,402) → CLIENT (6,438)** — leads (touched) and marketing audience (untouched) are NEVER mixed; every contact carries region × persona × field × recency.

## Colour code (used everywhere)

🔴 **Red = HOT** · 🟡 **Yellow = moving** (tender/awaiting, recent activity) · 🟣 **Purple = newly entered** · ⬜ **No colour = cold** · 🟢 **Green = won**

## How to talk to the system (via Claude, desktop or phone)

- `daily update` — walk through due items, log outcomes, get the WhatsApp list
- `add lead <name> <project>` — new serial row + stakeholder entry
- `won <name> for ₹X Cr` — logs against the ₹20 Cr target, archives the row
- `give WhatsApp list` — copy-paste follow-up list
- `show universe <name/company/city>` — pull anyone from the 97k master
- `enrich <name>` — research a contact's public professional profile
- Paste Kanban "Copy changes" output — syncs stage moves, owners, feedback into the master

**Read TEAM_PLAYBOOK.md next.**
