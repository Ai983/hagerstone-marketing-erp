-- 014 — Profiles & Pitches holds three kinds of item, not just files:
--   file  — uploaded to storage (as before)
--   link  — a Google Drive (or any) link; one can be pinned as the main
--           "all profiles" folder shown at the top of the page
--   pitch — written text (usually drafted by AI), edited and kept in the ERP
-- marketing schema only.

ALTER TABLE marketing.documents
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS link_url TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_brief JSONB,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES marketing.profiles(id);

ALTER TABLE marketing.documents ALTER COLUMN file_name DROP NOT NULL;
ALTER TABLE marketing.documents ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE marketing.documents ALTER COLUMN file_url DROP NOT NULL;

ALTER TABLE marketing.documents DROP CONSTRAINT IF EXISTS documents_kind_check;
ALTER TABLE marketing.documents ADD CONSTRAINT documents_kind_check CHECK (
  (kind = 'file'  AND file_path IS NOT NULL AND file_url IS NOT NULL)
  OR (kind = 'link'  AND link_url IS NOT NULL AND link_url ~* '^https?://')
  OR (kind = 'pitch' AND body IS NOT NULL)
);

COMMENT ON COLUMN marketing.documents.kind IS 'file (storage upload) | link (Drive or other URL) | pitch (text kept in the ERP)';
COMMENT ON COLUMN marketing.documents.is_pinned IS 'Shown at the top of Profiles & Pitches — e.g. the Drive folder with every profile.';
COMMENT ON COLUMN marketing.documents.ai_brief IS 'What the pitch was generated from (audience, service line, format, notes).';
