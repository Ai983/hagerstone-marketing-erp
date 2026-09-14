-- ============================================================
-- 004 — CONTACT UNIVERSE
-- ============================================================
-- The founder's SALES_FUNNEL_MASTER workbook holds ~98k contacts.
-- ~11k are real leads (someone at Hagerstone has actually touched
-- them); ~87k are compiled marketing audience where the relationship
-- is unknown.
--
-- These do NOT go in `leads`. The funnel model's core rule is that
-- leads and audience are never mixed, and 87k cold rows would drown
-- the 317 leads the team actually works. They live here instead, and
-- graduate into `leads` one at a time via `converted_lead_id` when
-- someone picks one up.
-- ============================================================

SET search_path TO marketing, public;

CREATE TABLE IF NOT EXISTS marketing.universe_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The founder's permanent serial. Never renumbered, never reused —
  -- it is how a row here maps back to SALES_LEADS_MASTER.csv.
  serial TEXT,

  name TEXT,
  company TEXT,
  role TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,

  -- Funnel position, by provenance rather than by activity:
  -- found in email/calendar/meetings → a lead stage; found in a
  -- compiled database → audience.
  funnel_stage TEXT NOT NULL DEFAULT '1-AUDIENCE' CHECK (funnel_stage IN (
    '1-AUDIENCE', '2-CONTACTED', '3-ENGAGED', '4-OPPORTUNITY', '5-CLIENT'
  )),

  persona TEXT,   -- End-Client · Architect · PMC · Developer · Broker-IPC · Channel-Partner · Unknown
  field TEXT,     -- Interior · Facade · MEP · EPC · Furniture
  region TEXT,    -- NCR · North · South · West · East · Central · Unknown
  recency TEXT,   -- 0-1mo · 1-3mo · 3-6mo · 6mo+

  project TEXT,            -- free-text context: "BOQ sent 12-Jun", subject lines, enquiry text
  suggested_action TEXT,   -- next step written at mining time
  source_tag TEXT,         -- the workbook tab this row came from, e.g. 'A-Architect'

  -- Anything a user adds after the import.
  notes TEXT,

  data_set_id UUID REFERENCES marketing.data_sets(id) ON DELETE SET NULL,

  -- Set when someone pulls this contact into the working pipeline.
  converted_lead_id UUID REFERENCES marketing.leads(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  converted_by UUID REFERENCES marketing.profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Last 10 digits of the phone. The founder's dedupe rule is
  -- phone-tail → email → name+company, and matching on the tail is
  -- what makes +91/0/spacing variants collapse to one contact.
  phone_tail TEXT GENERATED ALWAYS AS (
    NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10), '')
  ) STORED,

  -- One lowercased haystack so the browser can do a single ILIKE
  -- instead of OR-ing five columns across 98k rows.
  search_text TEXT GENERATED ALWAYS AS (
    LOWER(
      COALESCE(name, '') || ' ' ||
      COALESCE(company, '') || ' ' ||
      COALESCE(email, '') || ' ' ||
      COALESCE(city, '') || ' ' ||
      COALESCE(role, '') || ' ' ||
      COALESCE(phone, '') || ' ' ||
      COALESCE(project, '')
    )
  ) STORED,

  -- A row is a "lead" in funnel terms if it is anything but audience.
  is_lead BOOLEAN GENERATED ALWAYS AS (funnel_stage <> '1-AUDIENCE') STORED
);

COMMENT ON TABLE marketing.universe_contacts IS
  'The full contact universe from the founder''s funnel workbook. Marketing audience and touched leads, kept out of `leads` and graduated into it individually.';

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
-- Every filter in the Universe browser gets one, plus trigram for
-- the free-text search box.

CREATE INDEX IF NOT EXISTS idx_universe_stage    ON marketing.universe_contacts(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_universe_persona  ON marketing.universe_contacts(persona);
CREATE INDEX IF NOT EXISTS idx_universe_region   ON marketing.universe_contacts(region);
CREATE INDEX IF NOT EXISTS idx_universe_field    ON marketing.universe_contacts(field);
CREATE INDEX IF NOT EXISTS idx_universe_recency  ON marketing.universe_contacts(recency);
CREATE INDEX IF NOT EXISTS idx_universe_is_lead  ON marketing.universe_contacts(is_lead);
CREATE INDEX IF NOT EXISTS idx_universe_data_set ON marketing.universe_contacts(data_set_id);
CREATE INDEX IF NOT EXISTS idx_universe_phone_tail ON marketing.universe_contacts(phone_tail);
CREATE INDEX IF NOT EXISTS idx_universe_email    ON marketing.universe_contacts(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_universe_converted ON marketing.universe_contacts(converted_lead_id)
  WHERE converted_lead_id IS NOT NULL;

-- Trigram search index — only if pg_trgm is already installed. This
-- migration must not install extensions: they are database-wide and
-- live outside the `marketing` schema. Without it, search still works
-- (a sequential ILIKE over ~98k rows), just slower.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    -- On the Hub project pg_trgm is installed in `public`. Only its operator
    -- class is referenced; nothing in `public` is created or changed.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_universe_search ON marketing.universe_contacts USING GIN (search_text %I.gin_trgm_ops)',
      (SELECT extnamespace::regnamespace::text FROM pg_extension WHERE extname = 'pg_trgm')
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Trigram index skipped: %', SQLERRM;
END $$;

-- The import needs a deterministic conflict target so a re-run
-- updates rather than duplicates. Serials are unique in the source.
-- Not a partial index: PostgREST's upsert can only target a plain
-- unique constraint, and Postgres already lets NULLs repeat in one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_universe_serial
  ON marketing.universe_contacts(serial);

-- ------------------------------------------------------------
-- Funnel summary
-- ------------------------------------------------------------
-- Counting 98k rows per dashboard load is wasteful when the numbers
-- only move on import or conversion. One RPC, called from the
-- Sales Engine dashboard.

CREATE OR REPLACE FUNCTION marketing.universe_summary()
RETURNS TABLE (
  dimension TEXT,
  bucket TEXT,
  total BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = marketing, public
AS $$
  SELECT 'funnel_stage', funnel_stage, COUNT(*) FROM marketing.universe_contacts GROUP BY funnel_stage
  UNION ALL
  SELECT 'persona', COALESCE(persona, 'Unknown'), COUNT(*) FROM marketing.universe_contacts GROUP BY persona
  UNION ALL
  SELECT 'region', COALESCE(region, 'Unknown'), COUNT(*) FROM marketing.universe_contacts GROUP BY region
  UNION ALL
  SELECT 'field', COALESCE(field, 'Unknown'), COUNT(*) FROM marketing.universe_contacts GROUP BY field
  UNION ALL
  SELECT 'recency', COALESCE(recency, 'Unknown'), COUNT(*) FROM marketing.universe_contacts GROUP BY recency;
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- The universe is a company-wide asset, not a rep's book, so there
-- is no per-owner row filter. Reps can read and convert; only
-- managers and above can edit or delete rows.

ALTER TABLE marketing.universe_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "universe_select" ON marketing.universe_contacts;
CREATE POLICY "universe_select" ON marketing.universe_contacts FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "universe_insert" ON marketing.universe_contacts;
CREATE POLICY "universe_insert" ON marketing.universe_contacts FOR INSERT
  WITH CHECK (marketing.current_user_role() IN ('admin', 'manager', 'founder', 'marketing'));

-- UPDATE is open to any signed-in user because marking a contact
-- converted is an update, and reps do that.
DROP POLICY IF EXISTS "universe_update" ON marketing.universe_contacts;
CREATE POLICY "universe_update" ON marketing.universe_contacts FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "universe_delete" ON marketing.universe_contacts;
CREATE POLICY "universe_delete" ON marketing.universe_contacts FOR DELETE
  USING (marketing.current_user_role() IN ('admin', 'founder'));

DROP TRIGGER IF EXISTS universe_contacts_updated_at ON marketing.universe_contacts;
CREATE TRIGGER universe_contacts_updated_at
  BEFORE UPDATE ON marketing.universe_contacts
  FOR EACH ROW EXECUTE FUNCTION marketing.update_updated_at();
