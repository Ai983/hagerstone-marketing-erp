-- ============================================================
-- 020 — TAGS
-- ============================================================
-- "Tags that trigger the right action." Relationship groups (017) are
-- worked out from data; tags are what the salesperson *knows* — VIP,
-- referral source, do not contact. One shared list so "VIP" is never
-- also "vip"; anyone on the team can add to it straight from the tag
-- picker. Leads and universe contacts carry tag ids, so a rename or a
-- colour change shows everywhere at once.
--
-- marketing schema only. Additive: existing rows start with no tags.
-- ============================================================

SET search_path TO marketing, public;

CREATE TABLE IF NOT EXISTS marketing.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  color TEXT NOT NULL DEFAULT '#9090A8',
  -- Shown on Kanban cards; everything else only in lists and the drawer.
  is_important BOOLEAN NOT NULL DEFAULT FALSE,
  -- Retired tags stay on records but leave the picker.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES marketing.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One name per tag, whatever the case or surrounding spaces.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_unique ON marketing.tags (LOWER(TRIM(name)));

DROP TRIGGER IF EXISTS tags_updated_at ON marketing.tags;
CREATE TRIGGER tags_updated_at
  BEFORE UPDATE ON marketing.tags
  FOR EACH ROW EXECUTE FUNCTION marketing.update_updated_at();

INSERT INTO marketing.tags (name, color, is_important, position) VALUES
  ('VIP / key account',     '#F59E0B', TRUE,  10),
  ('Repeat client',         '#10B981', FALSE, 20),
  ('Referral source',       '#C084FC', FALSE, 30),
  ('Architect',             '#60A5FA', FALSE, 40),
  ('PMC',                   '#38BDF8', FALSE, 50),
  ('Developer',             '#818CF8', FALSE, 60),
  ('End client',            '#2DD4BF', FALSE, 70),
  ('Expansion plans',       '#34D399', FALSE, 80),
  ('Churn risk / unhappy',  '#F87171', FALSE, 90),
  ('Payment issue',         '#FB923C', FALSE, 100),
  ('Do not contact',        '#EF4444', TRUE,  110)
ON CONFLICT DO NOTHING;

ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS tag_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE marketing.universe_contacts
  ADD COLUMN IF NOT EXISTS tag_ids UUID[] NOT NULL DEFAULT '{}';

-- Tag filters use the && (overlaps) operator.
CREATE INDEX IF NOT EXISTS idx_leads_tag_ids ON marketing.leads USING GIN (tag_ids);
CREATE INDEX IF NOT EXISTS idx_universe_tag_ids ON marketing.universe_contacts USING GIN (tag_ids);

-- ------------------------------------------------------------
-- RLS — the whole team reads and grows the list; nothing is deleted
-- (retire a tag with is_active = false so old records keep it).
-- ------------------------------------------------------------

ALTER TABLE marketing.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_select ON marketing.tags;
CREATE POLICY tags_select ON marketing.tags FOR SELECT TO authenticated
  USING (marketing.is_active_member());

DROP POLICY IF EXISTS tags_insert ON marketing.tags;
CREATE POLICY tags_insert ON marketing.tags FOR INSERT TO authenticated
  WITH CHECK (marketing.is_active_member());

DROP POLICY IF EXISTS tags_update ON marketing.tags;
CREATE POLICY tags_update ON marketing.tags FOR UPDATE TO authenticated
  USING (marketing.is_active_member())
  WITH CHECK (marketing.is_active_member());

GRANT SELECT, INSERT, UPDATE ON marketing.tags TO authenticated;
GRANT ALL ON marketing.tags TO service_role;
REVOKE ALL ON marketing.tags FROM anon;

-- ------------------------------------------------------------
-- Bulk tagging from All Leads — one statement instead of one update
-- per lead. SECURITY INVOKER: leads RLS still decides what can change.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION marketing.add_tag_to_leads(p_tag_id UUID, p_lead_ids UUID[])
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
SET search_path = marketing, public
AS $$
  WITH changed AS (
    UPDATE marketing.leads
    SET tag_ids = array_append(tag_ids, p_tag_id)
    WHERE id = ANY(p_lead_ids) AND NOT (p_tag_id = ANY(tag_ids))
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER FROM changed;
$$;

CREATE OR REPLACE FUNCTION marketing.remove_tag_from_leads(p_tag_id UUID, p_lead_ids UUID[])
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
SET search_path = marketing, public
AS $$
  WITH changed AS (
    UPDATE marketing.leads
    SET tag_ids = array_remove(tag_ids, p_tag_id)
    WHERE id = ANY(p_lead_ids) AND p_tag_id = ANY(tag_ids)
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER FROM changed;
$$;

GRANT EXECUTE ON FUNCTION marketing.add_tag_to_leads(UUID, UUID[]), marketing.remove_tag_from_leads(UUID, UUID[])
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION marketing.add_tag_to_leads(UUID, UUID[]), marketing.remove_tag_from_leads(UUID, UUID[])
  FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
