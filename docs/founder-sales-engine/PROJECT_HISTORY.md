# PROJECT HISTORY — How this system was built

_The complete narrative of the build conversation (05 Aug → 14 Sep 2026), for context. Nothing here is needed for daily operation._

## Phase 1 — The ask (05-Aug evening)

Dhruv had a 27-item markdown follow-up list and asked for: a sales pipeline that's easy to track and update from mobile, daily reminders, project values, stakeholder details (contacts, DOB/anniversary for personalised gifting), facade included — a "simple yet highly functional standalone sales engine" to support **₹20 Cr/month billing**.

**Built:** upgraded SALES_PIPELINE.md (Value column, ₹20 Cr target tracker, stakeholder directory, gifting log, status rules), daily 8:25 AM reminder task, mobile dashboard artifact. Studio Ardete was split into 3 separate projects on Dhruv's correction, and later Adeesh Garg's name was removed from Studio Ardete rows (he's ONE.618, a different relationship).

## Phase 2 — Overnight deep mining (05→06 Aug, "be at it all night")

Target escalated: 100 → 200 → 750 → 1500+ leads. ~15 parallel research agents swept:

- **Gmail** (2-year, then 7-year window; world@ + 8 company aliases) → ~90 tender/RFQ opportunities with full contacts + 469-contact correspondence universe + alias traffic (sales@/delhi@/ea@/gauri@/facade@/global@/projects@/design@)
- **Google Drive** → 44 opportunities + ~40 sheets incl. the 66,571-row pan-India Architect & ID Database, KIT DB (4.9k), Secured Engineers "Projects Today", ST-04 Infra (₹29.5 Cr Japanese-GC leads), Dream-50 (₹38 Cr Rudrapur quote), Gifting architects list
- **Local disk** → 3 lead-tracker goldmines (Main lead sheet: Inhfra 200 corporates + Cashflow Summit 2,047; ASC South tracker: Decathlon/ITC/JLL/Bosch with phones; UK/Punjab tracker: 43 contacts), 32 project folders, Theon canteen at ORDER stage ₹2.5 Cr, VinFast multi-city, Google Store facade
- **Calendar** (314 contacts) + **Fireflies** (162; revealed UltraTech's 3 live tenders + Sojitz ₹7.9 Cr channel)
- **WhatsApp** (Web then Desktop, read-only) → live-project statuses, inbound leads (Lakhapar caller, Instaspaces), Jitender Yadav identified as Urban Grey Furniture, contact-label bench (Finexra "Priority" etc.)
- **Sales-team books** → Saurabh (=delhi@) resigned Apr-26 & Saumya (=global@) exited Mar-26 → **orphaned deals found:** Kalpved Hospital ₹20–30 Cr, YKK ₹10 Cr via Sojitz, 9 Priority-1 NCR architects

## Phase 3 — Consolidation & funnel (06 Aug)

- Everything merged with **hard dedupe** (phone-tail → email → name+company): ~15k+ duplicates merged/tagged across passes
- **Funnel model created** (Dhruv's core rule): LEADS (touched) vs MARKETING AUDIENCE (unknown), stages 1-AUDIENCE→5-CLIENT, sliced by region × persona × field × recency
- **Colour code** set: red HOT / yellow moving / purple new / no-colour cold / green won
- **Kanban board** built (drag between bins, bin owners, card-level owner reassignment, 📝 feedback notes, "Copy changes" sync loop)
- **Weekly scan habit** created: every Wednesday ~9 PM, last-7-days incremental scan (first run 12-Aug)
- Redundant entries isolated to a tagged tab; missing info marked "?"

## Phase 4 — Ongoing operation (Aug–Sep)

- 11-Aug: Apollo exports imported as audience (Real Estate India 5,207 + Architect Founders 13,227; 2,389 dupes skipped). New leads dictated by Dhruv (Jeevesh ji ref Ar. Sandeep; Ar. Rajesh Verma, Malibu Towne, ref CA Dishant Goel; Vinod Sharma Saturday Gurgaon meeting — his Mohali FACADE went live, Coimbatore dropped; Palm Marina Ludhiana; Ar. Brar Mohali facade; Vishryut ji Gurgaon facade)
- Daily reminder + weekly scans have been maintaining the file since (pipeline grew 29 → ~479 rows; 123 in active working status as of 14-Sep)

## Key discoveries a new team member should know

1. **The ₹20–30 Cr Kalpved/Madan Raj Hospital deal** (Dr. Vibhu Parashar) was orphaned when Saurabh resigned — highest-value single revival.
2. **Facade ≈ one-third of live opportunities** — M3M, DLF, Signature Global, Max (multiple), Hero, Eldeco, Fortis, Nila GIFT City, Metalman ×3 sites, TREVOC, Google Store… Akhilesh's division is the growth engine.
3. **Hero Realty is the deepest relationship** (~8 parallel tenders, 57 contacts; single door = Abhilash Goyal).
4. **Referral architects are gold:** Ar. Sandeep (Arch10) fed 5+ projects; Ar. Anupam (Vivek Consultants); Design I.O; ONE.618; CA Dishant Goel. Service them, gift them (Gifting-Architects tab).
5. **The Sojitz channel already produced ₹7.9 Cr** and holds the YKK ₹10 Cr + Maruti pipeline.
6. **Aliases history:** pre-2024 lead flow ran through ea@ and a dead crm@; sales@/delhi@/facade@/global@ only became active 2024+.
7. **Security flags raised (still open unless fixed):** org-wide-shared "Gmail Password Sheet" and a "Login Credentials" sheet in Drive.

## What was deliberately NOT done

- No message was ever auto-sent (emails, WhatsApp, social) — the system drafts, humans send.
- No social-media scraping for personal data (DOB/anniversary collected only from what contacts share).
- Close CRM not integrated (connector broken).
- WhatsApp full-history mining incomplete (session sync limits) — handled incrementally by the weekly scan.
