-- ============================================================
-- 017 — RELATIONSHIP GROUPS
-- ============================================================
-- "Different customers, different conversations." Every pipeline lead
-- and every universe contact falls into one relationship group, worked
-- out from data that already exists — stage, won date, last real
-- contact, funnel stage, recency. Nothing is stored and nobody fills
-- anything in: the group moves on its own when the facts change.
--
-- The group rules live here (leads) and in lib/utils/relationship-group.ts
-- (universe filters + labels). Keep the two in step.
--
-- marketing schema only. No new columns.
-- ============================================================

SET search_path TO marketing, public;

-- "Last touch" is a MAX over a lead's interactions; without this every
-- lead scans the whole interactions table.
CREATE INDEX IF NOT EXISTS idx_interactions_lead_id
  ON marketing.interactions(lead_id);

-- ------------------------------------------------------------
-- Pipeline leads
-- ------------------------------------------------------------
-- A "touch" is real contact with the client. Imports, AI categorisation
-- notes, "Handed over" / "Priority updated" system notes and missed calls
-- are not touches — counting them would make every imported lead look
-- recently worked. Imported history keeps its real date in occurred_at.
--
-- Groups, first match wins:
--   won    → active_client (won within 12 months) · dormant_client
--   lost   → lost
--   new_lead stage → new_prospect
--   no touch for 30+ days (falls back to when it entered its stage,
--   then created) → gone_quiet — the deals that died without a "no"
--   BOQ / proposal / negotiation → proposal_pending
--   anything else active → warm_prospect

CREATE OR REPLACE VIEW marketing.lead_relationship_groups
WITH (security_invoker = true) AS
WITH touches AS (
  SELECT i.lead_id, MAX(COALESCE(i.occurred_at, i.created_at)) AS last_touch_at
  FROM marketing.interactions i
  WHERE i.type IN (
      'call_outbound', 'call_inbound',
      'whatsapp_sent', 'whatsapp_received',
      'email_sent', 'email_received',
      'meeting', 'site_visit',
      'campaign_responded'
    )
    OR (i.type = 'note' AND i.title = 'Note added')
    OR (i.type = 'stage_change' AND i.user_id IS NOT NULL)
  GROUP BY i.lead_id
)
SELECT
  l.id AS lead_id,
  t.last_touch_at,
  CASE
    WHEN s.stage_type = 'won' THEN
      CASE
        WHEN COALESCE(l.won_date::timestamptz, l.closed_at, l.stage_entered_at, l.created_at)
             >= NOW() - INTERVAL '12 months'
          THEN 'active_client'
        ELSE 'dormant_client'
      END
    WHEN s.stage_type = 'lost' THEN 'lost'
    WHEN s.slug = 'new_lead' THEN 'new_prospect'
    WHEN COALESCE(t.last_touch_at, l.stage_entered_at, l.created_at)
         < NOW() - INTERVAL '30 days'
      THEN 'gone_quiet'
    WHEN s.slug IN ('boq_received', 'proposal_sent', 'negotiation') THEN 'proposal_pending'
    ELSE 'warm_prospect'
  END AS relationship_group
FROM marketing.leads l
LEFT JOIN marketing.pipeline_stages s ON s.id = l.stage_id
LEFT JOIN touches t ON t.lead_id = l.id
WHERE COALESCE(l.is_archived, FALSE) = FALSE;

COMMENT ON VIEW marketing.lead_relationship_groups IS
  'One relationship group per open (non-archived) lead, plus its last real client contact. Computed, never stored.';

-- ------------------------------------------------------------
-- Universe counts
-- ------------------------------------------------------------
-- The universe group is a pure function of funnel_stage, recency and
-- converted_lead_id, so the app filters on those columns directly. This
-- only counts, so the Sales Engine does not pull 98k rows.

CREATE OR REPLACE FUNCTION marketing.universe_group_summary()
RETURNS TABLE (relationship_group TEXT, total BIGINT)
LANGUAGE sql
STABLE
SET search_path = marketing, public
AS $$
  SELECT
    CASE
      WHEN converted_lead_id IS NOT NULL THEN 'in_pipeline'
      WHEN funnel_stage = '5-CLIENT' THEN 'past_client'
      WHEN funnel_stage = '4-OPPORTUNITY' AND recency = '6mo+' THEN 'old_opportunity'
      WHEN funnel_stage = '4-OPPORTUNITY' THEN 'open_opportunity'
      WHEN funnel_stage = '3-ENGAGED' THEN 'engaged'
      WHEN funnel_stage = '2-CONTACTED' THEN 'contacted'
      ELSE 'audience'
    END AS relationship_group,
    COUNT(*) AS total
  FROM marketing.universe_contacts
  GROUP BY 1;
$$;

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
-- The view runs as the caller (security_invoker), so leads/interactions
-- RLS still applies. The function is SECURITY INVOKER too.

GRANT SELECT ON marketing.lead_relationship_groups TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION marketing.universe_group_summary() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION marketing.universe_group_summary() FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
