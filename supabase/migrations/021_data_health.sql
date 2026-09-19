-- ============================================================
-- 021 — DATA HEALTH
-- ============================================================
-- "Garbage in, garbage out." Backs the Admin → Data Health page:
-- reliable duplicate detection, pipeline ↔ universe matches that were
-- never linked, universe counts, and a safe merge of two duplicate leads.
--
-- marketing schema only. Additive except merge_leads, which only runs
-- when someone chooses to merge — it moves the duplicate's history onto
-- the lead being kept and archives the duplicate (restorable, never deleted).
-- ============================================================

SET search_path TO marketing, public;

-- Last 10 digits of the phone, same rule as universe_contacts.phone_tail,
-- so "+91 98100 12345", "098100-12345" and "9810012345" are one number.
ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS phone_tail TEXT GENERATED ALWAYS AS (
    NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10), '')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_leads_phone_tail ON marketing.leads(phone_tail) WHERE phone_tail IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON marketing.leads(LOWER(email)) WHERE email IS NOT NULL AND email <> '';

-- ------------------------------------------------------------
-- Open leads that are also in the universe but not linked to it.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION marketing.lead_universe_matches()
RETURNS TABLE (
  lead_id UUID,
  universe_contact_id UUID,
  universe_name TEXT,
  universe_company TEXT,
  funnel_stage TEXT,
  matched_on TEXT
)
LANGUAGE sql
STABLE
SET search_path = marketing, public
AS $$
  SELECT DISTINCT ON (l.id)
    l.id, u.id, u.name, u.company, u.funnel_stage,
    CASE WHEN u.phone_tail = l.phone_tail THEN 'phone' ELSE 'email' END
  FROM marketing.leads l
  JOIN marketing.universe_contacts u
    ON u.converted_lead_id IS NULL
   AND (
     (l.phone_tail IS NOT NULL AND u.phone_tail = l.phone_tail)
     OR (COALESCE(l.email, '') <> '' AND LOWER(u.email) = LOWER(l.email))
   )
  WHERE NOT l.is_archived
  ORDER BY l.id, u.funnel_stage DESC;
$$;

-- ------------------------------------------------------------
-- Universe counts — shown only, not fixed from the page (for now).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION marketing.universe_health_summary()
RETURNS TABLE (total BIGINT, unreachable BIGINT, phone_duplicate_groups BIGINT, contacts_in_duplicate_groups BIGINT)
LANGUAGE sql
STABLE
SET search_path = marketing, public
AS $$
  WITH dups AS (
    SELECT phone_tail, COUNT(*) AS n
    FROM marketing.universe_contacts
    WHERE phone_tail IS NOT NULL
    GROUP BY phone_tail
    HAVING COUNT(*) > 1
  )
  SELECT
    (SELECT COUNT(*) FROM marketing.universe_contacts),
    (SELECT COUNT(*) FROM marketing.universe_contacts WHERE phone_tail IS NULL AND COALESCE(email, '') = ''),
    (SELECT COUNT(*) FROM dups),
    (SELECT COALESCE(SUM(n), 0) FROM dups);
$$;

-- ------------------------------------------------------------
-- Merge two duplicate leads. Everything attached to p_merge moves to
-- p_keep; blanks on p_keep are filled from p_merge; tags are combined;
-- p_merge is archived with duplicate_of = p_keep.
--
-- SECURITY DEFINER because several child tables (notifications, email
-- logs…) have RLS that would silently skip rows; the caller must still be
-- an active team member.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION marketing.merge_leads(p_keep UUID, p_merge UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marketing, public
AS $$
DECLARE
  k marketing.leads%ROWTYPE;
  m marketing.leads%ROWTYPE;
BEGIN
  IF NOT marketing.is_active_member() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF p_keep IS NULL OR p_merge IS NULL OR p_keep = p_merge THEN
    RAISE EXCEPTION 'Pick two different leads to merge';
  END IF;

  SELECT * INTO k FROM marketing.leads WHERE id = p_keep FOR UPDATE;
  SELECT * INTO m FROM marketing.leads WHERE id = p_merge FOR UPDATE;
  IF k.id IS NULL OR m.id IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  IF m.is_archived THEN
    RAISE EXCEPTION 'That lead is already archived';
  END IF;

  -- Rows with a one-per-lead rule: the kept lead's copy wins.
  DELETE FROM marketing.campaign_enrollments e
   WHERE e.lead_id = p_merge
     AND EXISTS (SELECT 1 FROM marketing.campaign_enrollments x WHERE x.lead_id = p_keep AND x.campaign_id = e.campaign_id);
  DELETE FROM marketing.ai_suggestions s
   WHERE s.lead_id = p_merge
     AND EXISTS (SELECT 1 FROM marketing.ai_suggestions x WHERE x.lead_id = p_keep AND x.type = s.type);
  DELETE FROM marketing.lead_source_snapshots s
   WHERE s.lead_id = p_merge
     AND EXISTS (SELECT 1 FROM marketing.lead_source_snapshots x WHERE x.lead_id = p_keep AND x.data_set_id = s.data_set_id);

  UPDATE marketing.interactions          SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.tasks                 SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.notifications         SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.campaign_enrollments  SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.campaign_send_log     SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.ai_suggestions        SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.lead_price_revisions  SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.chatbot_sessions      SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.chatbot_answers       SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.email_logs            SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.document_shares       SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.lead_source_snapshots SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.schedule_items        SET lead_id = p_keep WHERE lead_id = p_merge;
  UPDATE marketing.universe_contacts     SET converted_lead_id = p_keep WHERE converted_lead_id = p_merge;
  UPDATE marketing.ai_generated_leads    SET pipeline_lead_id = p_keep WHERE pipeline_lead_id = p_merge;
  UPDATE marketing.leads                 SET duplicate_of = p_keep WHERE duplicate_of = p_merge;

  -- Fill blanks on the kept lead; never overwrite what it already has.
  UPDATE marketing.leads SET
    phone             = COALESCE(NULLIF(k.phone, ''), m.phone),
    phone_alt         = COALESCE(NULLIF(k.phone_alt, ''), NULLIF(m.phone_alt, ''),
                                 CASE WHEN NULLIF(k.phone, '') IS NOT NULL AND m.phone_tail IS DISTINCT FROM k.phone_tail THEN m.phone END),
    email             = COALESCE(NULLIF(k.email, ''), m.email),
    designation       = COALESCE(NULLIF(k.designation, ''), m.designation),
    company_name      = COALESCE(NULLIF(k.company_name, ''), m.company_name),
    company_size      = COALESCE(NULLIF(k.company_size, ''), m.company_size),
    industry          = COALESCE(NULLIF(k.industry, ''), m.industry),
    city              = COALESCE(NULLIF(k.city, ''), m.city),
    service_line      = CASE WHEN k.service_line IS NULL OR k.service_line = 'unknown' THEN COALESCE(m.service_line, k.service_line) ELSE k.service_line END,
    estimated_budget  = COALESCE(NULLIF(k.estimated_budget, ''), m.estimated_budget),
    project_size_sqft = COALESCE(k.project_size_sqft, m.project_size_sqft),
    expected_timeline = COALESCE(NULLIF(k.expected_timeline, ''), m.expected_timeline),
    owner_name        = COALESCE(NULLIF(k.owner_name, ''), m.owner_name),
    priority          = COALESCE(k.priority, m.priority),
    tag_ids           = ARRAY(SELECT DISTINCT t FROM unnest(k.tag_ids || m.tag_ids) AS t),
    initial_notes     = CASE
                          WHEN NULLIF(m.initial_notes, '') IS NULL THEN k.initial_notes
                          WHEN NULLIF(k.initial_notes, '') IS NULL THEN m.initial_notes
                          ELSE k.initial_notes || E'\n\n[Merged from duplicate]\n' || m.initial_notes
                        END
  WHERE id = p_keep;

  UPDATE marketing.leads SET
    is_archived  = TRUE,
    archived_at  = NOW(),
    archived_by  = auth.uid(),
    duplicate_of = p_keep
  WHERE id = p_merge;

  INSERT INTO marketing.interactions (lead_id, user_id, type, title, notes)
  VALUES (
    p_keep, auth.uid(), 'note', 'Merged duplicate',
    'Merged duplicate lead "' || m.full_name || COALESCE(' — ' || NULLIF(m.company_name, ''), '') ||
    '" into this lead. Its history moved here; the duplicate is archived and can be restored from Archive.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION
  marketing.lead_universe_matches(),
  marketing.universe_health_summary(),
  marketing.merge_leads(UUID, UUID)
TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION
  marketing.lead_universe_matches(),
  marketing.universe_health_summary(),
  marketing.merge_leads(UUID, UUID)
FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
