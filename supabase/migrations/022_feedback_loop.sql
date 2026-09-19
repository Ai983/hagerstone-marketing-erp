-- ============================================================
-- 022 — FEEDBACK LOOP (content that sells · why they bought · actions)
-- ============================================================
-- Phase 3 of the sales playbook: learn from results.
--
--  1. document_performance() — which profiles and pitches were shared on
--     which leads, and what those leads did afterwards.
--  2. leads.win_* — three short answers captured when a deal is won:
--     what started the search, why us, what worried them.
--  3. feedback_actions — the playbook's Feedback → Action matrix: what
--     we heard, what it may mean, the fix, an owner and a due date.
--  4. ai_reviews — saved Claude reviews of recent losses, objections and
--     wins, so a review is read many times but generated on request.
--
-- marketing schema only. Additive: existing rows are untouched.
-- ============================================================

SET search_path TO marketing, public;

-- ------------------------------------------------------------
-- 2. Why they bought
-- ------------------------------------------------------------
ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS win_trigger TEXT,
  ADD COLUMN IF NOT EXISTS win_why_us TEXT,
  ADD COLUMN IF NOT EXISTS win_worry TEXT;

COMMENT ON COLUMN marketing.leads.win_trigger IS 'Won deals: what was happening in their business that started the search (lease ending, expansion, new office…).';
COMMENT ON COLUMN marketing.leads.win_why_us IS 'Won deals: why they chose Hagerstone over the other options.';
COMMENT ON COLUMN marketing.leads.win_worry IS 'Won deals: what worried them before saying yes.';

-- ------------------------------------------------------------
-- 3. Feedback → Action board
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing.feedback_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  heard TEXT NOT NULL CHECK (length(trim(heard)) > 0),   -- "Too expensive"
  objection_key TEXT,                                    -- lib/utils/objections.ts key, when it maps to one
  meaning TEXT,                                          -- "Value not clear / competitor cheaper"
  action TEXT NOT NULL CHECK (length(trim(action)) > 0), -- "Test a new value message"
  owner TEXT NOT NULL DEFAULT 'sales' CHECK (owner IN ('sales', 'marketing', 'founder')),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  outcome TEXT,                                          -- what happened, written when marked done
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  created_by UUID REFERENCES marketing.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_feedback_actions_status ON marketing.feedback_actions(status, due_date);

DROP TRIGGER IF EXISTS feedback_actions_updated_at ON marketing.feedback_actions;
CREATE TRIGGER feedback_actions_updated_at
  BEFORE UPDATE ON marketing.feedback_actions
  FOR EACH ROW EXECUTE FUNCTION marketing.update_updated_at();

ALTER TABLE marketing.feedback_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_actions_all ON marketing.feedback_actions;
CREATE POLICY feedback_actions_all ON marketing.feedback_actions FOR ALL TO authenticated
  USING (marketing.is_active_member())
  WITH CHECK (marketing.is_active_member());

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing.feedback_actions TO authenticated;
GRANT ALL ON marketing.feedback_actions TO service_role;
REVOKE ALL ON marketing.feedback_actions FROM anon;

-- ------------------------------------------------------------
-- 4. Saved AI reviews (written by /api/ai/feedback-review with the
--    service role; the team reads them).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketing.ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'feedback_review',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  content JSONB NOT NULL,
  created_by UUID REFERENCES marketing.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_reviews_kind ON marketing.ai_reviews(kind, created_at DESC);

ALTER TABLE marketing.ai_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_reviews_select ON marketing.ai_reviews;
CREATE POLICY ai_reviews_select ON marketing.ai_reviews FOR SELECT TO authenticated
  USING (marketing.is_active_member());

GRANT SELECT ON marketing.ai_reviews TO authenticated;
GRANT ALL ON marketing.ai_reviews TO service_role;
REVOKE ALL ON marketing.ai_reviews FROM anon;

-- ------------------------------------------------------------
-- 1. Content that moves money
-- ------------------------------------------------------------
-- Per document: how often it was shared, on how many leads, how many of
-- those leads moved to a later stage after the first share, and how many
-- were won after it (with value). "Moved forward" is read from the
-- stage-change log, so it only counts moves made in the ERP.
CREATE OR REPLACE FUNCTION marketing.document_performance()
RETURNS TABLE (
  document_id UUID,
  shares BIGINT,
  leads BIGINT,
  leads_moved_forward BIGINT,
  leads_won BIGINT,
  won_value NUMERIC,
  last_shared_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = marketing, public
AS $$
  WITH first_share AS (
    SELECT document_id, lead_id, MIN(created_at) AS first_at
    FROM marketing.document_shares
    WHERE lead_id IS NOT NULL
    GROUP BY document_id, lead_id
  ),
  moved AS (
    SELECT DISTINCT fs.document_id, fs.lead_id
    FROM first_share fs
    JOIN marketing.interactions i
      ON i.lead_id = fs.lead_id AND i.type = 'stage_change' AND i.created_at > fs.first_at
    JOIN marketing.pipeline_stages sf ON sf.id = i.stage_from_id
    JOIN marketing.pipeline_stages st ON st.id = i.stage_to_id
    WHERE st.position > sf.position AND st.stage_type IN ('active', 'won')
  ),
  won AS (
    SELECT fs.document_id, fs.lead_id,
           COALESCE(l.final_agreed_price, l.closure_value, 0) AS value
    FROM first_share fs
    JOIN marketing.leads l ON l.id = fs.lead_id
    JOIN marketing.pipeline_stages s ON s.id = l.stage_id
    WHERE s.stage_type = 'won'
      AND COALESCE(l.closed_at, l.won_date::timestamptz, l.updated_at) >= fs.first_at
  )
  SELECT
    d.id,
    (SELECT COUNT(*) FROM marketing.document_shares x WHERE x.document_id = d.id),
    (SELECT COUNT(*) FROM first_share f WHERE f.document_id = d.id),
    (SELECT COUNT(*) FROM moved m WHERE m.document_id = d.id),
    (SELECT COUNT(*) FROM won w WHERE w.document_id = d.id),
    (SELECT COALESCE(SUM(w.value), 0) FROM won w WHERE w.document_id = d.id),
    (SELECT MAX(x.created_at) FROM marketing.document_shares x WHERE x.document_id = d.id)
  FROM marketing.documents d
  WHERE d.is_active;
$$;

GRANT EXECUTE ON FUNCTION marketing.document_performance() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION marketing.document_performance() FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
