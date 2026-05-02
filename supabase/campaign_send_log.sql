CREATE TABLE IF NOT EXISTS campaign_send_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES campaign_enrollments(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  lead_name TEXT,
  phone TEXT,
  message_position INTEGER,
  message_preview TEXT,
  status TEXT CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  sleep_seconds INTEGER,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaign_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "send_log_all" ON campaign_send_log
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_send_log_campaign ON
  campaign_send_log(campaign_id, sent_at DESC);
