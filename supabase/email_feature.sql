-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general', 'follow_up', 'proposal',
    'site_visit', 'negotiation', 'welcome'
  )),
  variables JSONB DEFAULT '[]',
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email logs table (tracks every sent email)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES profiles(id),
  template_id UUID REFERENCES email_templates(id),
  resend_email_id TEXT,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN (
    'sent', 'delivered', 'opened',
    'clicked', 'bounced', 'failed'
  )),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  campaign_id UUID REFERENCES campaigns(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_templates_all" ON email_templates;
DROP POLICY IF EXISTS "email_logs_select" ON email_logs;
DROP POLICY IF EXISTS "email_logs_insert" ON email_logs;
DROP POLICY IF EXISTS "email_logs_update" ON email_logs;

CREATE POLICY "email_templates_all" ON email_templates FOR ALL USING (true);
CREATE POLICY "email_logs_select" ON email_logs FOR SELECT USING (true);
CREATE POLICY "email_logs_insert" ON email_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "email_logs_update" ON email_logs FOR UPDATE USING (true);

ALTER TABLE campaign_messages
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'email')),
  ADD COLUMN IF NOT EXISTS email_subject TEXT,
  ADD COLUMN IF NOT EXISTS email_template_id UUID
    REFERENCES email_templates(id);

CREATE INDEX IF NOT EXISTS email_logs_lead_id_created_at_idx
  ON email_logs (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_logs_resend_email_id_idx
  ON email_logs (resend_email_id);

INSERT INTO email_templates (name, subject, body_html, category)
SELECT * FROM (VALUES
(
  'Initial Follow-up',
  'Following up on your interior design enquiry - Hagerstone',
  '<h2>Hi {{lead_name}},</h2><p>Thank you for reaching out to Hagerstone International. We specialize in premium interior design and build solutions.</p><p>I would love to understand your requirements better. Could we schedule a quick call this week?</p><p>Looking forward to hearing from you.</p><p>Warm regards,<br/>{{rep_name}}<br/>Hagerstone International</p>',
  'follow_up'
),
(
  'Site Visit Confirmation',
  'Site Visit Confirmed - Hagerstone International',
  '<h2>Hi {{lead_name}},</h2><p>This is to confirm your site visit scheduled on <strong>{{visit_date}}</strong>.</p><p>Our team will be present to understand your space and requirements. Please feel free to share any reference images or mood boards beforehand.</p><p>See you soon!</p><p>Best,<br/>{{rep_name}}<br/>Hagerstone International</p>',
  'site_visit'
),
(
  'Proposal Sent',
  'Your Interior Design Proposal - Hagerstone International',
  '<h2>Dear {{lead_name}},</h2><p>Please find attached the detailed proposal for your <strong>{{service_line}}</strong> project.</p><p>The proposal covers design concept, material specifications, timeline, and investment breakdown.</p><p>I am available for a call to walk you through the details. Please let me know a convenient time.</p><p>Warm regards,<br/>{{rep_name}}<br/>Hagerstone International</p>',
  'proposal'
),
(
  'Re-engagement',
  'Still thinking about it? We are here - Hagerstone',
  '<h2>Hi {{lead_name}},</h2><p>We noticed it has been a while since we last connected. We completely understand that decisions like these take time.</p><p>If you are still considering upgrading your space, we would love to reconnect and share some of our recent project work that might inspire you.</p><p>No pressure - just here when you are ready.</p><p>Best,<br/>{{rep_name}}<br/>Hagerstone International</p>',
  'general'
)) AS starter(name, subject, body_html, category)
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates WHERE email_templates.name = starter.name
);
