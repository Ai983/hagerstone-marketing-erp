-- ═══════════════════════════════════════════════════════════════════════
--  Step 20 schema changes
--
--  1. Extend ai_suggestions.type CHECK to allow 'daily_summary'
--  2. Create admin_settings key/value table for config like the
--     daily-briefing toggle, send time, and "last sent" timestamp
--
--  Paste this whole file into Supabase SQL Editor and run.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Allow 'daily_summary' as an ai_suggestions type
ALTER TABLE ai_suggestions DROP CONSTRAINT IF EXISTS ai_suggestions_type_check;
ALTER TABLE ai_suggestions ADD CONSTRAINT ai_suggestions_type_check
  CHECK (type IN (
    'pipeline_summary', 'lead_priority', 'follow_up_suggestion',
    'campaign_idea', 'segment_insight', 'bottleneck_alert',
    'lead_recap', 'draft_message', 'daily_summary'
  ));

-- 2. admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write settings from the client.
-- (The cron + API routes use the service role, which bypasses RLS.)
DROP POLICY IF EXISTS "admin_settings_admin_select" ON admin_settings;
CREATE POLICY "admin_settings_admin_select" ON admin_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admin_settings_admin_upsert" ON admin_settings;
CREATE POLICY "admin_settings_admin_upsert" ON admin_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Seed default config row so the UI has something to load on first visit.
INSERT INTO admin_settings (key, value)
VALUES (
  'daily_summary_config',
  jsonb_build_object(
    'enabled',     true,
    'send_time',   '08:00',
    'phone_number', null
  )
)
ON CONFLICT (key) DO NOTHING;
