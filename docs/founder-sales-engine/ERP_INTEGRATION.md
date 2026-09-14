# Founder Sales Engine → Hagerstone ERP

How the founder's standalone Sales Engine (the other files in this folder) and the Delhi team's architect meeting drive were brought into the ERP.

## Where each thing lives now

| Founder system | ERP |
|---|---|
| `00-ONGOING TENDERS` (120 deals) | Real leads on the pipeline, source **Founder Pipeline**, `external_ref` = founder serial |
| `03-IMMEDIATE ACTIONS` | Those leads get priority **P1** |
| L-/A- tabs (97,707 contacts) | `universe_contacts` table → **Contact Universe** page. Never mixed into `leads`; "Add to pipeline" graduates one contact at a time |
| Bin owners (Dhruv, Bhaskar, Akhilesh, Sahil, Divyansh) | `leads.owner_name` — they have no ERP logins yet |
| Status NEW / FOLLOW-UP / TENDER / HOT / WON / LOST | Stages New Lead / Contacted / Proposal Sent / Negotiation / Won / Lost |
| Weighted pipeline & ₹20 Cr target | **Sales Engine** dashboard (admin, manager, founder, marketing) |
| Mobile dashboard / Kanban / Lead Browser artifacts | Sales Engine page / Pipeline / Contact Universe — shared by everyone, no "copy changes" sync step |
| "Nothing auto-sends" rule | Profiles & Pitches sharing opens WhatsApp/email pre-filled; a person taps send |

| Architect meeting workbook | ERP |
|---|---|
| Master Tracker (35 firms) | Existing leads, source **Architect Drive**, P1–P4 / Dropped in `leads.priority` |
| Meetings Log, 15-Day Report, Weekly Summary (40 meetings) | `meeting` interactions dated when they happened — lead timeline + Meetings page |
| Firms met but not on the tracker (6) | New leads, source **Architect Drive** |

Founder pipeline row **#287** (9 orphaned Priority-1 architect firms) is not a lead: it is written as a note on each of those nine architect leads.

## Telling the data apart

Every lead and interaction has a `data_set_id`: **ERP**, **Architect Drive**, **Founder Pipeline**, **Founder Universe**. It shows as a coloured badge, and All Leads, Meetings and Sales Engine have a tab per source. A lead keeps the source it came from; if a second source also knows it (YKK is in both), that source's information is added as timeline entries tagged with the second source.

## Applying it (in this order)

All four migrations only touch the `marketing` schema.

1. `supabase/migrations/003_data_sets.sql`
2. `supabase/migrations/004_universe_contacts.sql`
3. `supabase/migrations/005_document_library.sql`
4. `supabase/migrations/006_grants_new_tables.sql`

Then the imports (each supports `--dry-run`, and is safe to re-run):

```bash
node scripts/imports/import-architect-meetings.mjs
node scripts/imports/import-founder-pipeline.mjs
node scripts/imports/import-founder-universe.mjs
```

Architect first: the founder pipeline import annotates architect leads (#287) and merges into them (YKK).

## Judgement calls made during import

- **15-Day Report dates 24–29/12/2025** are after the report was sent (08 Dec); recorded as November, original date kept in the note.
- **Sojitz meetings** are logged on the YKK lead — Sojitz is the trading house the YKK tender runs through.
- **Stages** are only moved on leads still at New Lead; anything someone already moved is left alone.
- **Company-only matches** merge only when one side names no person, so separate deals with the same company (Hero Realty ×5, Minebea ×3, SAEL ×3) stay separate leads.
- **Deal value ranges** ("₹2.97–3.38 Cr") use the low end for the weighted pipeline.

## Worth a human look

- Possible duplicates across sources: SAEL (ERP lead "Praveen" vs founder #50/#215/#281), HCL (ERP "HCL - Interior Projects" / "HCL - MEP" vs founder #213), placeholder leads "Hero Realty" and "M3M" from the architect tracker vs the founder's named Hero Realty and M3M deals.
- Founder flags carried over as-is: #75 DSCI "possibly same person as #12"; #219 PSV Urbana "check overlap with #54 Plinth One".
- Company documents are stored in the existing `boq-documents` bucket under `company-documents/` (no new bucket was created).
