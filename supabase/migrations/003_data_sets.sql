-- ============================================================
-- 003 — DATA SETS
-- ============================================================
-- Every lead, interaction and universe contact now says where it
-- came from. Until now the only provenance we kept was `source`
-- (website / whatsapp_inbound / …), which says how a lead reached
-- us but not which import batch or which team's book it belongs to.
--
-- A data set is that second axis: "the architect field meetings the
-- Delhi team ran in Dec 2025" vs "the founder's Sales Engine
-- universe" vs "captured directly in the ERP". It is what lets the
-- UI badge a row and lets anyone filter one body of data out of
-- another without guessing from dates.
-- ============================================================

SET search_path TO marketing, public;

CREATE TABLE IF NOT EXISTS marketing.data_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable, human-readable identifier used by import scripts so a
  -- re-run updates the same set instead of creating a second one.
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,

  kind TEXT NOT NULL DEFAULT 'import' CHECK (kind IN (
    'erp_native',        -- created inside the ERP by a user
    'field_meetings',    -- an on-ground meeting drive
    'founder_pipeline',  -- the founder's working deal list
    'founder_universe',  -- the founder's compiled contact universe
    'import',            -- generic spreadsheet import
    'other'
  )),

  -- Presentation. `color` is a hex value so badges can be rendered
  -- without a lookup table in the client.
  color TEXT NOT NULL DEFAULT '#6B7280',
  icon TEXT,

  -- Provenance of the import itself.
  source_file TEXT,
  source_note TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ,
  imported_by UUID REFERENCES marketing.profiles(id),

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 100,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE marketing.data_sets IS
  'Provenance groups. Answers "which body of data is this row from", separate from `leads.source` which answers "how did this lead reach us".';

-- ------------------------------------------------------------
-- Tag the existing tables
-- ------------------------------------------------------------

ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS data_set_id UUID REFERENCES marketing.data_sets(id) ON DELETE SET NULL;

ALTER TABLE marketing.interactions
  ADD COLUMN IF NOT EXISTS data_set_id UUID REFERENCES marketing.data_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_data_set ON marketing.leads(data_set_id);
CREATE INDEX IF NOT EXISTS idx_interactions_data_set ON marketing.interactions(data_set_id);

-- The row's identity in its source system — the founder's permanent
-- pipeline serial, say. Lets an import find its own rows again on a
-- re-run instead of fuzzy-matching names.
ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS external_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external_ref
  ON marketing.leads(data_set_id, external_ref)
  WHERE external_ref IS NOT NULL;

-- Who owns the deal, by name. The founder's pipeline assigns work to
-- people (Bhaskar, Akhilesh, Sahil…) who may not have ERP logins, and
-- `assigned_to` can only point at a profile. When they get accounts,
-- this is what `assigned_to` gets backfilled from.
ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_owner_name ON marketing.leads(owner_name)
  WHERE owner_name IS NOT NULL;

-- ------------------------------------------------------------
-- Field priority (P1–P4 / dropped)
-- ------------------------------------------------------------
-- The architect meeting drive rates every firm Priority 1–4, or
-- "Client Dropped". That rating is a human judgement from the person
-- who sat in the room, so it is kept as its own column rather than
-- folded into `category`, which the scoring engine overwrites.

ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS priority TEXT
  CHECK (priority IN ('P1', 'P2', 'P3', 'P4', 'dropped'));

ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS priority_note TEXT;

ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS priority_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_priority ON marketing.leads(priority)
  WHERE priority IS NOT NULL;

COMMENT ON COLUMN marketing.leads.priority IS
  'Field rating set by the person who met the client. P1 = high-value, act now … P4 = opportunistic, quarterly check-in. Never written by the scoring engine.';

-- ------------------------------------------------------------
-- Seed the known sets
-- ------------------------------------------------------------

INSERT INTO marketing.data_sets (key, name, description, kind, color, icon, source_file, position)
VALUES
  (
    'erp-native',
    'ERP',
    'Captured directly in the ERP — web form, WhatsApp inbound, manual entry or AI lead generation.',
    'erp_native', '#3B82F6', 'Database', NULL, 10
  ),
  (
    'architect-meetings-dec-2025',
    'Architect Drive',
    'Delhi/NCR architect and designer meeting drive, Dec 2025. Field visits by Saurabh and Vishal, reported to the MD in the "Meeting Report : Last 15 Days" thread.',
    'field_meetings', '#8B5CF6', 'Users', 'Hagerstone Architect Meeting Data.xlsx', 20
  ),
  (
    'founder-pipeline',
    'Founder Pipeline',
    'The founder''s Sales Engine working pipeline — every named tender and enquiry with status, value and owner (00-ONGOING TENDERS).',
    'founder_pipeline', '#F59E0B', 'Flame', 'SALES_FUNNEL_MASTER.xlsx', 30
  ),
  (
    'founder-universe',
    'Founder Universe',
    'The founder''s compiled contact universe — deduped leads and marketing audience mined from Gmail, Drive, Calendar, Fireflies, WhatsApp and partner lists.',
    'founder_universe', '#10B981', 'Globe', 'SALES_FUNNEL_MASTER.xlsx', 40
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  source_file = EXCLUDED.source_file,
  position = EXCLUDED.position,
  updated_at = NOW();

-- Everything that already exists predates the imports, so it is ERP-native.
-- The architect rows get re-tagged by the import script, which matches them
-- on phone and company rather than on a date guess.
UPDATE marketing.leads
SET data_set_id = (SELECT id FROM marketing.data_sets WHERE key = 'erp-native')
WHERE data_set_id IS NULL;

UPDATE marketing.interactions
SET data_set_id = (SELECT id FROM marketing.data_sets WHERE key = 'erp-native')
WHERE data_set_id IS NULL;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- Data sets are reference data: everyone signed in reads them,
-- only admins and the founder write them.

ALTER TABLE marketing.data_sets ENABLE ROW LEVEL SECURITY;

-- Own helper so the policies do not depend on `get_user_role()`
-- resolving through the search path from another schema.
CREATE OR REPLACE FUNCTION marketing.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = marketing, public
AS $$
  SELECT role FROM marketing.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "data_sets_select" ON marketing.data_sets;
CREATE POLICY "data_sets_select" ON marketing.data_sets FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "data_sets_write" ON marketing.data_sets;
CREATE POLICY "data_sets_write" ON marketing.data_sets FOR ALL
  USING (marketing.current_user_role() IN ('admin', 'founder'))
  WITH CHECK (marketing.current_user_role() IN ('admin', 'founder'));

-- marketing.update_updated_at() already exists (from 001) and is used by
-- existing triggers, so it is reused here rather than redefined.
DROP TRIGGER IF EXISTS data_sets_updated_at ON marketing.data_sets;
CREATE TRIGGER data_sets_updated_at
  BEFORE UPDATE ON marketing.data_sets
  FOR EACH ROW EXECUTE FUNCTION marketing.update_updated_at();
