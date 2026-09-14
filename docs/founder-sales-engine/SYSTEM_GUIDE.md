# SYSTEM GUIDE — Hagerstone Sales Engine

_Architecture reference. Updated 14-Sep-2026. For daily operation see TEAM_PLAYBOOK.md._

## 1. Why this exists

Hagerstone targets **₹20 Cr billing/month**. At the MD's conversion rates (Proposal→Closure ~50%), that needs **≥ ₹40 Cr of live proposals at all times**, which needs a constantly-fed funnel. This system makes every lead the company has ever touched — and every contact it could touch — visible, segmented, owned, and followed up daily.

## 2. Architecture (3 layers)

```
LAYER 1 — WORKING PIPELINE (daily)
  SALES_PIPELINE.md  →  Kanban artifact  →  Daily 8:25 AM reminder
  ~120 active rows: every named tender/enquiry with status, owner, next action

LAYER 2 — LEAD & CONTACT UNIVERSE (weekly)
  SALES_LEADS_MASTER.csv (97,707)  →  SALES_FUNNEL_MASTER.xlsx  →  Lead Browser artifact
  Funnel-staged, persona/field/region/recency tagged, deduped by phone+email+name

LAYER 3 — INTAKE (automated)
  Weekly Wednesday 9 PM scan: Gmail (8 aliases) + Drive + desktop files + WhatsApp
  → dedupe → classify → merge into Layers 1-2
```

## 3. The funnel model (core design rule)

**LEADS** = anyone Hagerstone has actually touched (correspondence, meetings, tenders received, quotes sent). **MARKETING AUDIENCE** = compiled databases where the relationship is unknown. *They are never mixed.*

| Stage | Definition | Count (Sep-26) |
|---|---|---|
| 5-CLIENT | Won / billed / existing relationship — farm for repeat | 6,438 |
| 4-OPPORTUNITY | Gave us a tender/enquiry, or we quoted | 2,402 |
| 3-ENGAGED | Live correspondence or meetings | 664 |
| 2-CONTACTED | Touched at least once (trackers, network, phonebook) | 1,559 |
| 1-AUDIENCE | Marketing audience — feed of the funnel | 86,644 |

Stage is assigned by **provenance**: found in email/calendar/meetings/WhatsApp/sales trackers → lead stages; found in a compiled database → audience.

Every contact also carries:
- **Persona:** End-Client · Architect · PMC · Developer · Broker-IPC · Channel-Partner
- **Field:** Interior · Facade · MEP · EPC · Furniture
- **Region:** NCR · North · South · West · East · Central (from city/project text)
- **Recency:** 0-1mo · 1-3mo · 3-6mo · 6mo+ (from last activity)
- **Touch status:** ONGOING (≤2mo) · WARM (2-6mo) · NOT-TOUCHED (>6mo)

## 4. Colour code (system-wide)

| Colour | Meaning | Where applied |
|---|---|---|
| 🔴 Red | HOT — negotiation/urgent | Kanban HOT column & cards, xlsx row fills, critical list |
| 🟡 Yellow | Moving — tender/awaiting/active in last 3 months | Kanban TENDER & AWAITING, xlsx fills |
| 🟣 Purple | Newly entered lead | Kanban NEW, xlsx fills (serials added in latest batch) |
| ⬜ None | Cold / dormant | default |
| 🟢 Green | WON — execution/collection stage | Kanban WON, xlsx fills |

## 5. Ownership model (Kanban bins)

| Bin | Default owner | Responsibility |
|---|---|---|
| NEW | Sahil (Inside Sales) | Qualify, get scope/contact, set first meeting |
| FOLLOW-UP | Sahil | Cadence calls, escalate movement |
| TENDER | Bhaskar Tyagi | Bid submission, techno-commercial rounds |
| HOT | Dhruv (MD) | Negotiation, LOI/closure |
| AWAITING CLIENT | Bhaskar | Chase decisions |
| WON | Divyansh | Handover to execution, advances, compliance docs |
| **All Facade cards** | **Akhilesh** | Facade division head owns regardless of bin |

Card-level owner can be reassigned on the Kanban (dropdown); 📝 on a card = feedback/instruction for that owner. "Copy changes + feedback" exports everything for Claude to sync and to draft owner briefs (drafts only — humans send).

## 6. Files & artifacts registry

| Asset | Location / URL |
|---|---|
| Pipeline (source of truth) | `SALES_PIPELINE.md` (this folder) — rules live inside it under "HOW THIS FILE WORKS" |
| Master universe CSV | `SALES_LEADS_MASTER.csv` |
| Funnel workbook | `SALES_FUNNEL_MASTER.xlsx` (00-Tenders / 01-Funnel Summary / L-stage tabs / A-persona tabs / REDUNDANT) |
| Mobile dashboard | https://claude.ai/code/artifact/1740f457-9450-47ab-8557-335e99512041 |
| Kanban board | https://claude.ai/code/artifact/a804b946-a553-42ea-8046-17072d6df558 |
| Lead browser | https://claude.ai/code/artifact/f7c906b7-225e-45cf-a82e-f43e0be5d635 |
| Daily reminder task | Claude scheduled task `daily-sales-pipeline-reminder`, cron `25 8 * * *` |
| Weekly scan task | Claude scheduled task `weekly-lead-scan`, cron `0 21 * * 3` (Wednesdays) |

## 7. Data sources mined (05–11 Aug 2026 build)

- **Gmail** (92k+ emails, 7-year window): world@ + alias traffic (sales@, delhi@, ea@, gauri@, facade@, global@, projects@, design@). Tenders, RFQs, enquiries, contact signatures.
- **Google Drive**: ~40 sheets incl. Architect & ID Database 2023 (66k), KIT DB (4.9k), Master Contacts, Secured Engineers "Projects Today", ST-04 Infra hot leads, Dream-50/150, Gifting list.
- **Local disk**: ~/Downloads incl. 32 project folders, Main lead sheet.xlsx (Inhfra 200 corporates, Cashflow Summit 2,047), ASC South tracker, UK/Punjab tracker, client phonebooks.
- **Google Calendar**: 314 external meeting contacts (18 months).
- **Fireflies**: 162 meeting participants + transcript intel (UltraTech 3 tenders, Sojitz ₹7.9 Cr channel).
- **WhatsApp Desktop/Web** (read-only): leadership 1:1s + inbound leads. *Partial — full history needs phone-synced session; weekly scan keeps chipping.*
- **Apollo exports** (11-Aug): Real Estate People of India (5,207 India rows) + Architects & Interior Founders (13,227) → audience.

## 8. Safety rules (hard, non-negotiable)

1. **Nothing is ever auto-sent.** No email/WhatsApp/SMS/social goes out from the system. It produces drafts and copy-paste lists; humans send.
2. WhatsApp/computer mining is **read-only**: type only in search boxes, never in a message composer.
3. Personal data (DOB/anniversary for gifting) is recorded only when contacts share it or Dhruv provides it — no social-media scraping.
4. Dedupe is by 10-digit phone tail → email → name+company. Duplicates are merged (info combined) or tagged in the REDUNDANT tab — never silently lost.
5. Pipeline rows are never renumbered or deleted — dead leads move to ARCHIVE with reason.

## 9. Known gaps / open items (as of 14-Sep-2026)

- WhatsApp deep history (Akhilesh/Anand 1:1s, estimation groups, Interarch Lucknow list) — pending a fully synced WhatsApp session; weekly scan retries.
- "Worldwide sheet" never located under that name (closest: Westin Participant List).
- Region = Unknown for ~29k contacts (old phonebooks without city) — backfills as contacts resurface.
- ~6k "Unknown persona" audience rows need triage before campaigns.
- Close CRM connector broken (schema error) — re-authenticate if Close is to be used.
- Security: org-wide-shared "Gmail Password Sheet" + "Login Credentials" sheet in Drive — access must be restricted (flagged 06-Aug).
