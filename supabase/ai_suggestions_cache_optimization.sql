ALTER TABLE ai_suggestions
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS content JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE ai_suggestions
SET created_at = COALESCE(created_at, generated_at, NOW())
WHERE created_at IS NULL;

ALTER TABLE ai_suggestions
  DROP CONSTRAINT IF EXISTS ai_suggestions_lead_type_unique;

ALTER TABLE ai_suggestions
  ADD CONSTRAINT ai_suggestions_lead_type_unique
  UNIQUE (lead_id, type);
