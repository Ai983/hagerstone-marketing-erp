-- ============================================================
-- 018 — FOLLOW-UP RHYTHM PER RELATIONSHIP GROUP
-- ============================================================
-- "Follow up by method, not memory." Each relationship group (017) has
-- a rhythm; a lead is due when its last client contact plus that rhythm
-- has passed. Logging any contact moves the next due date on its own —
-- nothing is ticked off by hand.
--
--   proposal_pending  every 10 days
--   warm_prospect     every 20 days
--   new_prospect      within 4 days of being added — only leads added
--                     from 19 Sep 2026; older untouched ones are a
--                     backlog, not a daily list
--   gone_quiet        due now (it passed 30 days without contact)
--   active_client     every 60 days
--   dormant_client    every 120 days
--   lost              180 days after the loss, then every 180
--
-- The rhythm lives here and in lib/utils/relationship-group.ts
-- (FOLLOW_UP_DAYS). Keep the two in step.
--
-- The only stored value is a snooze: "client asked me to call in two
-- weeks" pushes the due date without faking a contact.
-- marketing schema only.
-- ============================================================

SET search_path TO marketing, public;

ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS follow_up_snoozed_until TIMESTAMPTZ;

COMMENT ON COLUMN marketing.leads.follow_up_snoozed_until IS
  'Follow-up pushed to this date by the salesperson. The lead is not due before it.';

CREATE OR REPLACE VIEW marketing.lead_follow_ups
WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    g.lead_id,
    g.relationship_group,
    g.last_touch_at,
    l.full_name,
    l.company_name,
    l.phone,
    l.priority,
    l.data_set_id,
    l.follow_up_snoozed_until,
    s.name AS stage_name,
    s.color AS stage_color,
    -- New prospects added before this rhythm existed are backlog.
    (g.relationship_group = 'new_prospect'
      AND l.created_at < TIMESTAMPTZ '2026-09-19 00:00:00+05:30') AS is_backlog,
    -- Clock starts at the latest of: last client contact, the win or
    -- loss, else when it entered its stage, else when it was created.
    COALESCE(
      GREATEST(g.last_touch_at, l.closed_at, l.won_date::timestamptz),
      l.stage_entered_at,
      l.created_at
    ) AS clock_from,
    CASE g.relationship_group
      WHEN 'proposal_pending' THEN 10
      WHEN 'warm_prospect'    THEN 20
      WHEN 'new_prospect'     THEN 4
      WHEN 'gone_quiet'       THEN 30   -- the gone-quiet line itself, so already due
      WHEN 'active_client'    THEN 60
      WHEN 'dormant_client'   THEN 120
      WHEN 'lost'             THEN 180
    END AS rhythm_days
  FROM marketing.lead_relationship_groups g
  JOIN marketing.leads l ON l.id = g.lead_id
  LEFT JOIN marketing.pipeline_stages s ON s.id = l.stage_id
)
SELECT
  lead_id,
  relationship_group,
  last_touch_at,
  full_name,
  company_name,
  phone,
  priority,
  data_set_id,
  stage_name,
  stage_color,
  follow_up_snoozed_until,
  rhythm_days,
  is_backlog,
  CASE
    WHEN is_backlog THEN NULL
    -- GREATEST skips NULLs, so an unset snooze changes nothing.
    ELSE GREATEST(clock_from + make_interval(days => rhythm_days), follow_up_snoozed_until)
  END AS due_at
FROM base;

COMMENT ON VIEW marketing.lead_follow_ups IS
  'Next follow-up due date per open lead, from its relationship group rhythm and any snooze. due_at is NULL for the pre-rhythm new-prospect backlog.';

GRANT SELECT ON marketing.lead_follow_ups TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
