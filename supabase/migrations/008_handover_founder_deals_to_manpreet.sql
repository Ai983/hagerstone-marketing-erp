-- ============================================================
-- 008 — HAND OVER DHRUV SIR'S DEALS TO MANPREET SINGH
-- ============================================================
-- Data migration. Assigns every Founder Pipeline lead — plus YKK,
-- founder serial #284, which was merged into the Architect Drive lead —
-- to Manpreet. The sheet owner (Bhaskar, Sahil, Akhilesh…) stays in
-- `owner_name`.
--
-- `lead_assignment_notification` would send one "Lead assigned to you"
-- per lead. It is held off for this transaction only, and replaced by a
-- single summary notification. ALTER TABLE … DISABLE TRIGGER inside a
-- transaction is scoped to that transaction's commit: it is re-enabled
-- before COMMIT, so no other session ever sees it disabled.
--
-- Snapshots, tasks and handover notes are written afterwards by
-- scripts/imports/handover-founder-to-manpreet.mjs.
-- ============================================================

ALTER TABLE marketing.leads DISABLE TRIGGER lead_assignment_notification;

WITH manpreet AS (
  SELECT id FROM marketing.profiles WHERE full_name = 'Manpreet Singh' LIMIT 1
),
target AS (
  SELECT l.id
  FROM marketing.leads l
  JOIN marketing.data_sets d ON d.id = l.data_set_id
  WHERE d.key = 'founder-pipeline'
     OR (d.key = 'architect-meetings-dec-2025' AND l.company_name = 'YKK India Pvt. Ltd.')
)
UPDATE marketing.leads l
SET assigned_to = (SELECT id FROM manpreet),
    assigned_at = NOW()
FROM target
WHERE l.id = target.id
  AND (SELECT id FROM manpreet) IS NOT NULL
  AND l.assigned_to IS DISTINCT FROM (SELECT id FROM manpreet);

ALTER TABLE marketing.leads ENABLE TRIGGER lead_assignment_notification;

INSERT INTO marketing.notifications (user_id, type, title, body)
SELECT p.id,
       'new_lead_assigned',
       'Dhruv sir''s deals are now yours',
       (SELECT COUNT(*) FROM marketing.leads WHERE assigned_to = p.id AND assigned_at > NOW() - INTERVAL '5 minutes')
         || ' deals from the founder''s Sales Engine have been assigned to you. Open Founder Desk to start.'
FROM marketing.profiles p
WHERE p.full_name = 'Manpreet Singh';
