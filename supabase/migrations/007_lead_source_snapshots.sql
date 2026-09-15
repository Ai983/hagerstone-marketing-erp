-- ============================================================
-- 007 — LEAD SOURCE SNAPSHOTS
-- ============================================================
-- A frozen copy of a lead exactly as it arrived from its source —
-- Dhruv sir's Sales Engine row, or the Delhi team's tracker row.
--
-- The lead itself is live: Manpreet moves stages, fixes values, logs
-- meetings. Without a snapshot, the founder's original status, value,
-- owner and next action would be overwritten and nobody could say
-- "sir handed this over as TENDER; it is in Negotiation now".
-- Snapshots are written only by imports and never edited in the app.
-- ============================================================

CREATE TABLE IF NOT EXISTS marketing.lead_source_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES marketing.leads(id) ON DELETE CASCADE,
  data_set_id UUID NOT NULL REFERENCES marketing.data_sets(id) ON DELETE CASCADE,

  -- The row's id in the source (founder serial "283"; tracker firm name).
  external_ref TEXT,
  source_file TEXT,
  -- When the source itself was current — the founder workbook's 14 Sep
  -- rebuild, the tracker's 24 Dec email — not when we imported it.
  captured_at TIMESTAMPTZ NOT NULL,

  -- The source row, verbatim fields plus a few parsed ones. JSON because
  -- each source has different columns and none of it is edited.
  data JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (lead_id, data_set_id)
);

COMMENT ON TABLE marketing.lead_source_snapshots IS
  'Read-only copy of a lead as received from its source (founder Sales Engine, architect tracker). Written by imports only.';

CREATE INDEX IF NOT EXISTS idx_lead_snapshots_lead ON marketing.lead_source_snapshots(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_snapshots_data_set ON marketing.lead_source_snapshots(data_set_id);

ALTER TABLE marketing.lead_source_snapshots ENABLE ROW LEVEL SECURITY;

-- Readable by anyone who can see the lead. No insert/update/delete
-- policies: only the service role (imports) writes here.
DROP POLICY IF EXISTS "lead_snapshots_select" ON marketing.lead_source_snapshots;
CREATE POLICY "lead_snapshots_select" ON marketing.lead_source_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM marketing.leads l
      WHERE l.id = lead_source_snapshots.lead_id
        AND (
          l.assigned_to = auth.uid()
          OR marketing.current_user_role() IN ('admin', 'manager', 'founder', 'marketing')
        )
    )
  );

GRANT SELECT ON marketing.lead_source_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing.lead_source_snapshots TO service_role;

NOTIFY pgrst, 'reload schema';
