# DATA DICTIONARY — Hagerstone Sales Engine

_Every file, column, code and category. Counts audited 14-Sep-2026._

## 1. SALES_PIPELINE.md (the working pipeline)

Markdown file, ~479 serial rows. Sections:

| Section | Contents | Serial ranges (historic) |
|---|---|---|
| 🔥 CRITICAL THIS WEEK | Top ~13 money moves, updated by daily/weekly runs | refs |
| TARGET TRACKER | ₹20 Cr/month vs billed vs weighted pipeline | — |
| A. Tenders/Quotations · B. Documents · C. Project Follow-ups · D. Leads · E. FACADE · F. Regional Reps · G. Company Pipeline · H. Key Account Farming | Daily working list | 1–46 |
| I. Active Mined · J. Dormant Revival · K. Past Revival · L. North Pool (→Sahil) · M. South/ASC Pool (→Anand C.) | Mined 05–06 Aug | 47–287 |
| N/O/P. Contact Universe top slices | Top-60 samples; full data in CSV | 288+ |
| STAKEHOLDER DIRECTORY | Person-level: phone, email, city, DOB, anniversary, gift notes | — |
| GIFTING & GREETINGS LOG · DAILY LOG · ARCHIVE | History | — |

**Pipeline row columns:** `# | Cat | Party/Contact | Project | Value(₹) | Phone/Contact | Status | Last Update | Next Action | Next Date`

- **Cat:** Interior · Facade · MEP · EPC · Furniture · Channel · Region (reps) · Mixed
- **Status (only these):** NEW · FOLLOW-UP · HOT · TENDER · AWAITING CLIENT · WON · LOST · DROPPED
- **Serials are permanent IDs** — never renumbered, never reused. Gaps are normal (serials share the space with the master CSV).
- Current working-status counts: HOT 23 · TENDER 19 · NEW 31 · FOLLOW-UP 47 · WON 3.

## 2. SALES_LEADS_MASTER.csv (the universe — 97,707 rows)

| Column | Meaning / allowed values |
|---|---|
| serial | Permanent ID (1 … 113,472+; shared numbering with pipeline) |
| name / company / role | Person & org. "?" or blank = unknown (action item) |
| phone | As found; matching uses last-10-digit tail |
| email / city / project | As found. project often holds context ("BOQ sent 12-Jun", "LinkedIn: …") |
| category | Source-list tag, e.g. Apollo-RealEstate, Architects-2023, KIT-Database, SecuredEngineers-Projects, Infra-Hot-Leads, Gifting-Architects, broker, target-client, NCR-B2B, "REDUNDANT of #X" (+" +tag" = also present in other lists) |
| source | Where mined: Gmail:…, Alias:…, Calendar:…, Fireflies:…, WA:<chat>, Drive:<file>, SalesTeam:…, local path |
| last_activity | Date of last known touch (drives recency) |
| suggested_action | Next step written at mining time |
| region | NCR · North · South · West · East · Central · Unknown |
| touch_status | ONGOING (≤2 mo) · WARM (2–6 mo) · NOT-TOUCHED (>6 mo) |
| funnel_stage | 1-AUDIENCE · 2-CONTACTED · 3-ENGAGED · 4-OPPORTUNITY · 5-CLIENT |
| persona | End-Client · Architect · PMC · Developer · Broker-IPC · Channel-Partner · Unknown |
| field | Interior · Facade · MEP · EPC · Furniture |
| recency | 0-1mo · 1-3mo · 3-6mo · 6mo+ |

**Current distribution:** stages — 1-AUDIENCE 86,644 · 5-CLIENT 6,438 · 4-OPPORTUNITY 2,402 · 2-CONTACTED 1,559 · 3-ENGAGED 664. Personas — Architect 70,675 · End-Client 12,746 · Broker-IPC 4,250 · Unknown 9,280 · Channel 298 · PMC 241 · Developer 217. Regions — NCR 21,194 · West 19,498 · South 19,079 · North 5,300 · East 2,759 · Central 455 · Unknown 29,422.

**Dedupe policy:** phone-tail → email → normalized name+company. On a hit, records are MERGED (blanks filled from the duplicate, both list tags kept). ~18k duplicates merged during the build; residual near-dupes are tagged `REDUNDANT of #serial` and live in the REDUNDANT tab.

## 3. SALES_FUNNEL_MASTER.xlsx (the deliverable workbook)

| Tab | Contents |
|---|---|
| 00-ONGOING TENDERS | All HOT/TENDER/WON (+working) pipeline rows with Owner column. Colour-filled by status. TOP PRIORITY — kept separate from contact pools |
| 01-FUNNEL SUMMARY | Stage counts + pivots: Recency×Stage, Region×Stage, Persona×Stage, Field×Stage |
| (02-REGION SUMMARY / 03-IMMEDIATE ACTIONS) | Per-region persona×timeline; MD's do-now list (regenerated each rebuild) |
| L-5-CLIENT / L-4-OPPORTUNITY / L-3-ENGAGED / L-2-CONTACTED | LEADS by stage, sorted recency→region→persona; yellow fill = active ≤3 mo; "?" = missing info |
| A-Architect / A-End-Client / A-Broker-IPC / A-Developer / A-PMC / A-Channel-Partner / A-Unknown | MARKETING AUDIENCE by persona (never mixed with leads) |
| REDUNDANT (tagged) | Duplicate entries kept for audit, tagged to their surviving row |

Colour fills: red F4CCCC (HOT) · yellow FFF2CC (moving) · purple E4D7F5 (new) · green D9EAD3 (won).

## 4. Key named lists inside the universe (category tags)

| Tag | What it is | Approx size |
|---|---|---|
| Architects-2023 | Pan-India architect & ID database (marketing) | ~55–60k |
| Apollo-ArchFounders | Architect/interior founders, India (Apollo export, 11-Aug) | 13,227 |
| Apollo-RealEstate | Real-estate people, India rows only | 5,207 |
| KIT-Database / Corporate-KIT | Interior/exhibition firms + corporate contacts | ~5k |
| broker / broker-IPC | NCR broker & IPC databases | ~4.2k |
| target-client | "Target Client Numbers" 2022 cold reservoir | ~2.2k |
| Cashflow Summit | Business-owner mobiles (event list) | ~2k |
| Inhfra | 200 corporate admin/facility heads (Amazon, Amex, BCG, GMR…) | 200 |
| SecuredEngineers-Projects / -Funnel | Partner-shared project leads (live remarks) | ~250 |
| Infra-Hot-Leads (ST-04) | Japanese-GC cluster: Kajima/Unicharm Sanand, Shimizu/Mitsubishi Chennai, Mondelez Sri City — ₹29.5 Cr | 16 |
| Gifting-Architects | Relationship architects for gifting (Semac, DSP, CNT, DDIR…) | 35 |
| Corporate Connections | CEO network incl. Dubai chapter | ~850 |
| RRPL-IM-Deals | Broker channel deal sheet (2022) | 22 |
| North pool (L) / South pool (M) | Tricity/UK re-qual list · ASC Bengaluru book | 40 · 23 |

## 5. People decoder (names that appear everywhere)

| Name | Who |
|---|---|
| Dhruv Agarwal (DA) | MD — HOT bin owner, world@hagerstone.com |
| Bhaskar Tyagi (BT) | Director Ops — TENDER/AWAITING owner |
| Akhilesh Gupta | Facade Division Head — owns ALL facade leads (facade@) |
| Sahil | Inside Sales — NEW/FOLLOW-UP owner, qualification calls |
| Divyansh | Project Coordinator — WON handovers |
| Anand Choudhari | South Sales Head (sales@) — section M book |
| Anand Hiremath | Director West (Pune) |
| Gauri Rawat | Punjab/Uttarakhand sales (gauri@) — UK/Punjab tracker |
| Ritu Sharma | EA to MD (ea@) |
| Saurabh Singh | ex-NCR Sales Head (= delhi@), resigned Apr-26 — his book is the "orphaned" set |
| Saumya | ex-global@, exited Mar-26 |
| Ar. Sandeep Singh | Arch10 Design, Gurgaon (9810173755) — top referring architect |
| Jitender Yadav | Urban Grey Furniture, Manesar — furniture partner (via Corporate Connections) |
| Ar. Adeesh Garg | ONE.618 Architects (CC Delhi) — separate from Studio Ardete |
| Abhimanue Sharma | Studio Ardete PM (Haridwar restaurant, MP mall route) |
| Ar. Anupam Sharma | Vivek Consultants, Jalandhar (9417212245) — Metalman/Proxima route |
