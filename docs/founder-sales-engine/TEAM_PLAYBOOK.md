# TEAM PLAYBOOK — Daily Operation

_For the sales team. Read README.md first. Rules of the data live in DATA_DICTIONARY.md._

## Your morning (10 minutes)

1. **8:25 AM** — the daily reminder produces today's list: 🔴 overdue first, then due-today, then birthdays/anniversaries in the next 7 days.
2. Open the **Kanban** (link in README). Your cards = cards where you are the owner (search your name).
3. Work the phone: every card has tap-to-Call and tap-to-WhatsApp.
4. As things move, **drag the card** to its new bin and add a 📝 note ("spoke, revised quote by Fri").
5. End of day: hit **"Copy changes + feedback"** → paste into Claude chat → the master file updates and MD sees the movement.

## Bin owners (who owns what)

| Bin | Owner | Your job in this bin |
|---|---|---|
| NEW 🟣 | Sahil | Qualify within 48h: scope? budget? decision-maker? Fill the "?" fields |
| FOLLOW-UP | Sahil | Weekly touch minimum; escalate anything moving |
| TENDER 🟡 | Bhaskar | Submit before deadline; log submission date; chase evaluation |
| HOT 🔴 | Dhruv | Negotiation & closure — feed him full context before every call |
| AWAITING CLIENT 🟡 | Bhaskar | Chase decision every 3–4 days |
| WON 🟢 | Divyansh | Advance collection, compliance docs, execution handover |
| Any FACADE card | Akhilesh | Owns end-to-end regardless of bin |

## The rules (non-negotiable)

1. **Every lead gets a Value (₹).** "TBD/?" is allowed for max 7 days — the daily reminder nags after that.
2. **Statuses allowed:** NEW · FOLLOW-UP · HOT · TENDER · AWAITING CLIENT · WON · LOST · DROPPED — nothing else.
3. **Never delete or renumber rows** in SALES_PIPELINE.md. Dead leads → ARCHIVE section with reason.
4. **Every new lead** also gets a STAKEHOLDER DIRECTORY row (name, company, role, phone, email, city; DOB/anniversary when shared — powers gifting).
5. **Weighted pipeline math:** HOT×50% + TENDER×30% + others×15%. Keep weighted ≥ ₹40 Cr to hit ₹20 Cr/month.
6. **Missing info = "?"** — a question mark is an action item, not a decoration. Fill it on your next call.
7. **Duplicates:** if the same mobile number appears twice, it's ONE contact — tell Claude and it merges (extra copy goes to the REDUNDANT tab).
8. **Nothing auto-sends.** Claude drafts; you send from your own email/WhatsApp.

## Adding & updating leads (talk to Claude in plain language)

```
add lead Sharma Constructions, office interior Noida, ref Ar. Sandeep
#67 spoke to Deepak, revised quote sent, next follow up Monday
won Theon canteen for ₹2.5 Cr
#128 dropped — client went with L1
give WhatsApp list
```

WhatsApp-format list (what the daily reminder outputs, copy-paste to the team group):

```
*HAGERSTONE – FOLLOW-UP LIST* 📋
_<date>_
1. <Name> – <Project> – <Next Action>
```

## Working the universe (marketing → funnel)

- **A-tabs** of SALES_FUNNEL_MASTER.xlsx = marketing audience by persona. Campaign pools (Arjun's daily campaigns pull from here).
- When an audience contact responds → they become a LEAD: tell Claude ("X from the architect pool replied, wants a meeting") and they move to 2-CONTACTED with a pipeline row if there's a project.
- **North pool (L-tab region view / section L of pipeline)** → Sahil re-qualification calls.
- **South pool (section M / ASC book)** → Anand Choudhari.
- **Priority sub-list**: ~975 decision-makers with corporate emails at 50+ headcount firms (from Apollo imports) — first outreach wave.

## Escalation & review rhythm

- **Daily:** 8:25 list → calls → Kanban drags → paste changes.
- **Wednesday 9 PM:** automated weekly scan brings in the week's new leads (purple) — review Thursday morning.
- **Weekly review (suggested Monday):** open SALES_FUNNEL_MASTER.xlsx → 01-FUNNEL SUMMARY → check stage movement per region/persona; 00-ONGOING TENDERS for the priority list; IMMEDIATE ACTIONS tab is the MD's own list.
- Anything stuck >2 weeks in TENDER/AWAITING → flag to MD in your paste-back note.

## FAQ

**Q: Where do I see only facade leads?** Kanban → "Facade" chip; or pipeline Section E + Cat column = Facade; or xlsx filter field=Facade. Akhilesh owns all of them.
**Q: Someone gave me a visiting card — where does it go?** Tell Claude: "add contact <details>". It lands in the master with dedupe; if there's a live requirement it also becomes a pipeline row.
**Q: How do I find an old contact?** Ask Claude "show universe <name/company/city>" or search the Lead Browser.
**Q: The Kanban shows my change only on my device?** Yes — drags save locally until you "Copy changes" and paste to Claude. That paste is what makes it official for everyone.
