-- ============================================================
-- 019 — OBJECTIONS AND WHO WE LOST TO
-- ============================================================
-- "Which objection do you hear again and again? Where are your NOs
-- stored?" Log Call and Log Meeting now record the objections the
-- client raised as tap chips, and a Lost deal can name the competitor
-- that won it. Both are optional. The option lists live in
-- lib/utils/objections.ts; values are stored as their keys.
--
-- marketing schema only. Additive: existing rows are untouched.
-- ============================================================

SET search_path TO marketing, public;

ALTER TABLE marketing.interactions
  ADD COLUMN IF NOT EXISTS objections TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN marketing.interactions.objections IS
  'Objections the client raised on this call or meeting — keys from lib/utils/objections.ts (price_high, has_vendor, need_to_think…).';

-- Analytics counts objections over a date range; only rows that have any.
CREATE INDEX IF NOT EXISTS idx_interactions_with_objections
  ON marketing.interactions(created_at)
  WHERE cardinality(objections) > 0;

ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS lost_to_competitor TEXT;

COMMENT ON COLUMN marketing.leads.lost_to_competitor IS
  'Competitor that won the deal, when the loss reason is "Chose competitor". Free text.';

NOTIFY pgrst, 'reload schema';
