-- ============================================================
-- 023 — RUNO CALLS
-- ============================================================
-- Runo (SIM call tracking on the sales head's phone) becomes the source
-- of truth for calls. Every call Runo logs lands on the matching lead's
-- timeline as an interaction, so calls stop being self-reported.
--
--  - interactions.external_source / external_id: where an automatic row
--    came from ('runo', Runo's callId). The unique index makes the daily
--    sync and the webhook safe to replay — a call is never logged twice.
--  - interactions.duration_seconds: Runo reports seconds; a 40-second
--    call must not read as "0m". duration_minutes stays filled (rounded)
--    so analytics keep working.
--  - interactions.call_disposition: Runo's own status string, kept raw.
--  - Recordings use the existing media_url / media_type ('audio').
--  - runo_sync_log: one row per sync run / webhook hit, raw payload kept,
--    for debugging a vendor API we don't control.
--
-- marketing schema only. Additive.
-- ============================================================

ALTER TABLE marketing.interactions
  ADD COLUMN IF NOT EXISTS external_source  TEXT,
  ADD COLUMN IF NOT EXISTS external_id      TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS call_disposition TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_external
  ON marketing.interactions (external_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS marketing.runo_sync_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction   TEXT NOT NULL CHECK (direction IN ('inbound', 'pull', 'push')),
  event_type  TEXT,
  status      TEXT NOT NULL CHECK (status IN ('ok', 'skipped', 'error')),
  summary     JSONB,
  error       TEXT,
  raw_payload JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runo_sync_log_created
  ON marketing.runo_sync_log (created_at DESC);

-- Written only by the server (service role); admins can read it.
ALTER TABLE marketing.runo_sync_log ENABLE ROW LEVEL SECURITY;

-- No DROP/REVOKE here on purpose: the Supabase MCP server asks for an extra
-- confirmation on "destructive" statements, which the VS Code extension
-- auto-declines. The table is new, so neither is needed.
CREATE POLICY runo_sync_log_select ON marketing.runo_sync_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM marketing.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'founder')
  ));

GRANT SELECT ON marketing.runo_sync_log TO authenticated;
GRANT ALL ON marketing.runo_sync_log TO service_role;
