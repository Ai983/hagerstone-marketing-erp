-- ============================================================
-- 009 — ARCHITECT DRIVE: STAGES + HAND OVER TO MANPREET SINGH
-- ============================================================
-- Data migration, in this order on purpose:
--
-- 1. Firms the Delhi team actually met (a logged meeting) and still at
--    New Lead move to Contacted — the pipeline said we had never spoken
--    to firms someone sat with. Each move gets a timeline entry.
--    Done BEFORE assignment: `notify_stage_change` notifies the
--    assignee, and these firms have none yet, so no notifications.
--    `on_lead_stage_change_audit` still records each move (correct).
--
-- 2. All unassigned Architect Drive firms go to Manpreet, with the
--    per-lead assignment notification held off for this transaction and
--    replaced by one summary notification.
--
-- Reconnect tasks for P1/P2 are written afterwards by
-- scripts/imports/architect-reconnect-tasks.mjs.
-- ============================================================

-- 1. Met → Contacted -------------------------------------------------

CREATE TEMP TABLE _arch_moves ON COMMIT DROP AS
SELECT l.id AS lead_id, l.stage_id AS from_stage
FROM marketing.leads l
JOIN marketing.data_sets d ON d.id = l.data_set_id AND d.key = 'architect-meetings-dec-2025'
JOIN marketing.pipeline_stages s ON s.id = l.stage_id AND s.slug = 'new_lead'
WHERE EXISTS (
  SELECT 1 FROM marketing.interactions i
  WHERE i.lead_id = l.id AND i.type IN ('meeting', 'site_visit')
);

UPDATE marketing.leads l
SET stage_id = (SELECT id FROM marketing.pipeline_stages WHERE slug = 'contacted'),
    stage_entered_at = NOW()
FROM _arch_moves m
WHERE l.id = m.lead_id;

INSERT INTO marketing.interactions (lead_id, user_id, type, title, notes, stage_from_id, stage_to_id, is_automated, data_set_id)
SELECT m.lead_id,
       NULL,
       'stage_change',
       'Moved to Contacted',
       'Met in person during the Delhi team''s Nov–Dec 2025 architect drive, so this firm is past New Lead. Moved when the drive was handed over to Manpreet Singh.',
       m.from_stage,
       (SELECT id FROM marketing.pipeline_stages WHERE slug = 'contacted'),
       TRUE,
       (SELECT id FROM marketing.data_sets WHERE key = 'architect-meetings-dec-2025')
FROM _arch_moves m;

-- 2. Hand over -------------------------------------------------------

ALTER TABLE marketing.leads DISABLE TRIGGER lead_assignment_notification;

UPDATE marketing.leads l
SET assigned_to = p.id,
    assigned_at = NOW()
FROM marketing.profiles p,
     marketing.data_sets d
WHERE p.full_name = 'Manpreet Singh'
  AND d.key = 'architect-meetings-dec-2025'
  AND l.data_set_id = d.id
  AND l.assigned_to IS NULL;

ALTER TABLE marketing.leads ENABLE TRIGGER lead_assignment_notification;

INSERT INTO marketing.notifications (user_id, type, title, body)
SELECT p.id,
       'new_lead_assigned',
       'The Architect Drive firms are now yours',
       (SELECT COUNT(*) FROM marketing.leads l JOIN marketing.data_sets d ON d.id = l.data_set_id
         WHERE d.key = 'architect-meetings-dec-2025' AND l.assigned_to = p.id AND l.assigned_at > NOW() - INTERVAL '5 minutes')
         || ' architect firms from the Delhi team''s drive are assigned to you. Open Architect Drive to see where each conversation stopped.'
FROM marketing.profiles p
WHERE p.full_name = 'Manpreet Singh';
