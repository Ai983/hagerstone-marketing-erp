-- ============================================================
-- 005 — DOCUMENT LIBRARY (company profiles & sales pitches)
-- ============================================================
-- Nearly every architect meeting note ends with "shared our profile".
-- Today that file lives on whoever's laptop ran the meeting, so the
-- version a client gets depends on who they met.
--
-- This is the one shelf: upload once, everyone downloads the current
-- version, and every send is recorded against the lead so the next
-- person can see what the client has already been given.
-- ============================================================

SET search_path TO marketing, public;

CREATE TABLE IF NOT EXISTS marketing.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title TEXT NOT NULL,
  description TEXT,

  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'company_profile',   -- the corporate deck / credentials
    'sales_pitch',       -- pitch decks, capability statements
    'case_study',        -- completed project write-ups
    'brochure',          -- service-line collateral
    'presentation',
    'rate_card',
    'certificate',       -- registrations, ISO, GST, compliance
    'project_photos',
    'other'
  )),

  -- Which service line this is for; 'all' for the general corporate deck.
  service_line TEXT NOT NULL DEFAULT 'all' CHECK (service_line IN (
    'all', 'office_interiors', 'mep', 'facade_glazing',
    'peb_construction', 'civil_works', 'multiple'
  )),

  -- Storage. `file_path` is the key inside the bucket; `file_url` is
  -- the resolved public URL, cached so the list view needs no round trip.
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,

  -- Versioning is deliberately a label, not a chain. Sales asks
  -- "is this the current profile?", and `is_current` answers it;
  -- superseded files stay downloadable for reference.
  version TEXT NOT NULL DEFAULT 'v1',
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes UUID REFERENCES marketing.documents(id) ON DELETE SET NULL,

  tags TEXT[] NOT NULL DEFAULT '{}',

  -- Reps can see and send; restricted files (rate cards, say) can be
  -- limited to the roles listed here. Empty array = visible to all.
  visible_to_roles TEXT[] NOT NULL DEFAULT '{}',

  download_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID REFERENCES marketing.profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE marketing.documents IS
  'Shared shelf of company profiles, pitch decks and collateral. Files live in the `company-documents` storage bucket.';

CREATE INDEX IF NOT EXISTS idx_documents_category ON marketing.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_service_line ON marketing.documents(service_line);
CREATE INDEX IF NOT EXISTS idx_documents_active ON marketing.documents(is_active, is_current);

-- ------------------------------------------------------------
-- Share log
-- ------------------------------------------------------------
-- "Profile shared" written in a meeting note is not searchable.
-- A row here is, and it is what tells the next caller what the
-- client already has.

CREATE TABLE IF NOT EXISTS marketing.document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  document_id UUID NOT NULL REFERENCES marketing.documents(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES marketing.leads(id) ON DELETE CASCADE,

  channel TEXT NOT NULL DEFAULT 'manual' CHECK (channel IN (
    'whatsapp', 'email', 'manual', 'download', 'link'
  )),

  -- Set when the share also produced a timeline entry on the lead.
  interaction_id UUID REFERENCES marketing.interactions(id) ON DELETE SET NULL,

  recipient TEXT,   -- number or address it went to, when known
  note TEXT,

  shared_by UUID REFERENCES marketing.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_shares_lead ON marketing.document_shares(lead_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_document ON marketing.document_shares(document_id);

-- ------------------------------------------------------------
-- Counters
-- ------------------------------------------------------------
-- Incremented from the API without a read-modify-write race.

CREATE OR REPLACE FUNCTION marketing.bump_document_downloads(doc_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = marketing, public
AS $$
  UPDATE marketing.documents
  SET download_count = download_count + 1
  WHERE id = doc_id;
$$;

CREATE OR REPLACE FUNCTION marketing.bump_document_shares(doc_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = marketing, public
AS $$
  UPDATE marketing.documents
  SET share_count = share_count + 1
  WHERE id = doc_id;
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- Reading is the point — a rep who cannot fetch the profile on their
-- phone outside a client's office is the problem this solves. So
-- every signed-in user reads, unless the file names specific roles.
-- Uploading and editing is admin / manager / marketing / founder.

ALTER TABLE marketing.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.document_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select" ON marketing.documents;
CREATE POLICY "documents_select" ON marketing.documents FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      CARDINALITY(visible_to_roles) = 0
      OR marketing.current_user_role() = ANY (visible_to_roles)
      OR marketing.current_user_role() IN ('admin', 'founder')
    )
  );

DROP POLICY IF EXISTS "documents_insert" ON marketing.documents;
CREATE POLICY "documents_insert" ON marketing.documents FOR INSERT
  WITH CHECK (marketing.current_user_role() IN ('admin', 'manager', 'marketing', 'founder'));

DROP POLICY IF EXISTS "documents_update" ON marketing.documents;
CREATE POLICY "documents_update" ON marketing.documents FOR UPDATE
  USING (marketing.current_user_role() IN ('admin', 'manager', 'marketing', 'founder'));

DROP POLICY IF EXISTS "documents_delete" ON marketing.documents;
CREATE POLICY "documents_delete" ON marketing.documents FOR DELETE
  USING (marketing.current_user_role() IN ('admin', 'founder'));

DROP POLICY IF EXISTS "document_shares_select" ON marketing.document_shares;
CREATE POLICY "document_shares_select" ON marketing.document_shares FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "document_shares_insert" ON marketing.document_shares;
CREATE POLICY "document_shares_insert" ON marketing.document_shares FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS documents_updated_at ON marketing.documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON marketing.documents
  FOR EACH ROW EXECUTE FUNCTION marketing.update_updated_at();
