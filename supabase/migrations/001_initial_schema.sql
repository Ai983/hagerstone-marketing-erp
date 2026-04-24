-- ============================================
-- HAGERSTONE ERP — COMPLETE DATABASE SCHEMA
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS / PROFILES
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'sales_rep', 'marketing', 'founder')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PIPELINE STAGES (configurable)
-- ============================================
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6B7280',
  position INTEGER NOT NULL,
  is_terminal BOOLEAN DEFAULT FALSE,  -- Won/Lost stages
  requires_note BOOLEAN DEFAULT FALSE, -- Force note on entry
  requires_value BOOLEAN DEFAULT FALSE, -- Force deal value (Won)
  stage_type TEXT CHECK (stage_type IN ('active', 'won', 'lost', 'on_hold', 'reengagement')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default stages
INSERT INTO pipeline_stages (name, slug, color, position, stage_type, requires_note, requires_value, is_terminal) VALUES
  ('New Lead', 'new_lead', '#6B7280', 1, 'active', false, false, false),
  ('Contacted', 'contacted', '#3B82F6', 2, 'active', false, false, false),
  ('Qualified', 'qualified', '#8B5CF6', 3, 'active', true, false, false),
  ('Site Visit Scheduled', 'site_visit_scheduled', '#F59E0B', 4, 'active', true, false, false),
  ('Proposal Sent', 'proposal_sent', '#EC4899', 5, 'active', true, false, false),
  ('Negotiation', 'negotiation', '#EF4444', 6, 'active', true, false, false),
  ('Won', 'won', '#10B981', 7, 'won', true, true, true),
  ('Lost', 'lost', '#6B7280', 8, 'lost', true, false, true),
  ('On Hold', 'on_hold', '#F97316', 9, 'on_hold', true, false, false),
  ('Re-engagement', 'reengagement', '#06B6D4', 10, 'reengagement', false, false, false);

-- ============================================
-- LEADS (core table)
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Contact info
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  phone_alt TEXT,
  designation TEXT,

  -- Company info
  company_name TEXT,
  company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '500+')),
  industry TEXT,

  -- Location
  city TEXT,
  state TEXT DEFAULT 'Delhi NCR',
  pincode TEXT,
  full_address TEXT,

  -- Service interest
  service_line TEXT CHECK (service_line IN (
    'office_interiors', 'mep', 'facade_glazing',
    'peb_construction', 'civil_works', 'multiple', 'unknown'
  )),
  estimated_budget TEXT,
  project_size_sqft INTEGER,
  expected_timeline TEXT,

  -- Pipeline state
  stage_id UUID REFERENCES pipeline_stages(id),
  stage_entered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ownership
  assigned_to UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),

  -- Source tracking
  source TEXT CHECK (source IN (
    'website', 'manual_sales', 'whatsapp_inbound',
    'referral', 'google_ads', 'linkedin', 'justdial',
    'ai_suggested', 'other'
  )) DEFAULT 'manual_sales',
  source_detail TEXT,  -- e.g. "Google Ads - Office Interiors Campaign"
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referral_name TEXT,

  -- Status flags
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of UUID REFERENCES leads(id),
  whatsapp_opted_in BOOLEAN DEFAULT FALSE,
  whatsapp_opted_in_at TIMESTAMPTZ,

  -- Scoring (Phase 2)
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  score_updated_at TIMESTAMPTZ,

  -- Closure data
  closure_reason TEXT,
  closure_value NUMERIC(12,2),
  closed_at TIMESTAMPTZ,

  -- Re-engagement
  reengagement_eligible_at TIMESTAMPTZ,

  -- Notes
  initial_notes TEXT,

  -- Metadata
  is_sample_data BOOLEAN DEFAULT FALSE,  -- Seeded test data flag
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INTERACTIONS (complete activity timeline)
-- ============================================
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),  -- NULL if automated

  type TEXT NOT NULL CHECK (type IN (
    'call_outbound', 'call_inbound', 'call_missed',
    'whatsapp_sent', 'whatsapp_received', 'whatsapp_delivered', 'whatsapp_read',
    'email_sent', 'email_received',
    'site_visit', 'meeting',
    'note', 'stage_change', 'assignment_change',
    'campaign_enrolled', 'campaign_message_sent', 'campaign_responded',
    'lead_created', 'ai_suggestion_generated'
  )),

  -- Content
  title TEXT,
  notes TEXT,
  outcome TEXT CHECK (outcome IN (
    'interested', 'not_interested', 'callback_requested',
    'no_answer', 'busy', 'wrong_number', 'voicemail',
    'converted', 'lost', 'other'
  )),
  duration_minutes INTEGER,  -- for calls

  -- Stage change details
  stage_from_id UUID REFERENCES pipeline_stages(id),
  stage_to_id UUID REFERENCES pipeline_stages(id),

  -- WhatsApp message details
  whatsapp_message_id TEXT,
  whatsapp_status TEXT,

  -- Campaign reference
  campaign_id UUID,  -- FK added later via migration

  -- Follow-up scheduling
  follow_up_at TIMESTAMPTZ,
  follow_up_type TEXT CHECK (follow_up_type IN ('call', 'whatsapp', 'email', 'site_visit', 'meeting')),
  follow_up_completed BOOLEAN DEFAULT FALSE,
  follow_up_completed_at TIMESTAMPTZ,

  -- Automation flag
  is_automated BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TASKS / FOLLOW-UPS (derived from interactions but queryable)
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),

  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('call', 'whatsapp', 'email', 'site_visit', 'meeting', 'other')),

  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  is_overdue BOOLEAN GENERATED ALWAYS AS (
    completed_at IS NULL AND due_at < NOW()
  ) STORED,

  interaction_id UUID REFERENCES interactions(id),  -- Links back to the interaction that created this task

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CAMPAIGNS
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('whatsapp_drip', 'whatsapp_blast', 'email_drip', 'manual_sequence')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),

  created_by UUID REFERENCES profiles(id),

  -- Audience
  audience_filters JSONB,  -- stored filter criteria
  audience_count INTEGER DEFAULT 0,

  -- Schedule
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,

  -- Stats
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign messages (the sequence)
CREATE TABLE campaign_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,

  message_template TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'template')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign enrollments (which leads are in which campaigns)
CREATE TABLE campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  enrolled_by UUID REFERENCES profiles(id),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'opted_out')),
  current_message_position INTEGER DEFAULT 0,
  next_message_at TIMESTAMPTZ,

  completed_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,

  UNIQUE(campaign_id, lead_id)
);

-- Add FK for campaign_id in interactions
ALTER TABLE interactions ADD CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id);

-- ============================================
-- AUDIT LOG (immutable)
-- ============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,  -- 'lead', 'campaign', 'user', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,       -- 'created', 'updated', 'deleted', 'stage_changed'
  actor_id UUID REFERENCES profiles(id),
  actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'webhook', 'automation')),
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI SUGGESTIONS (Phase 3)
-- ============================================
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN (
    'pipeline_summary', 'lead_priority', 'follow_up_suggestion',
    'campaign_idea', 'segment_insight', 'bottleneck_alert',
    'lead_recap', 'draft_message'
  )),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,  -- NULL for pipeline-level suggestions
  content JSONB NOT NULL,  -- The suggestion payload
  acted_upon BOOLEAN DEFAULT FALSE,
  acted_upon_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VIEWS (for analytics & AI)
-- ============================================

-- Pipeline overview (used by AI agent + FunnelChart)
CREATE OR REPLACE VIEW pipeline_overview AS
SELECT
  ps.id AS stage_id,
  ps.name AS stage_name,
  ps.slug AS stage_slug,
  ps.color AS stage_color,
  ps.stage_type,
  ps.position AS stage_position,
  COUNT(l.id) AS lead_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - l.stage_entered_at))/86400) AS avg_days_in_stage,
  COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - l.stage_entered_at))/86400 > 7 THEN 1 END) AS stale_count
FROM pipeline_stages ps
LEFT JOIN leads l ON l.stage_id = ps.id AND l.closed_at IS NULL
WHERE ps.is_terminal = FALSE
GROUP BY ps.id, ps.name, ps.slug, ps.color, ps.stage_type, ps.position
ORDER BY ps.position;

-- Lead source performance
CREATE OR REPLACE VIEW source_performance AS
SELECT
  source,
  COUNT(*) AS total_leads,
  COUNT(CASE WHEN closed_at IS NOT NULL AND closure_reason = 'won' THEN 1 END) AS won,
  ROUND(
    COUNT(CASE WHEN closed_at IS NOT NULL AND closure_reason = 'won' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS win_rate_pct,
  AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/86400) AS avg_days_to_close
FROM leads
GROUP BY source;

-- Rep activity summary
CREATE OR REPLACE VIEW rep_activity_summary AS
SELECT
  p.id AS rep_id,
  p.full_name,
  COUNT(DISTINCT l.id) AS assigned_leads,
  COUNT(DISTINCT CASE WHEN l.closed_at IS NOT NULL THEN l.id END) AS closed_leads,
  COUNT(CASE WHEN i.type LIKE 'call%' AND i.created_at > NOW() - INTERVAL '7 days' THEN 1 END) AS calls_this_week,
  COUNT(CASE WHEN t.completed_at IS NOT NULL AND t.completed_at > NOW() - INTERVAL '7 days' THEN 1 END) AS tasks_completed_this_week,
  COUNT(CASE WHEN t.completed_at IS NULL AND t.due_at < NOW() THEN 1 END) AS overdue_tasks
FROM profiles p
LEFT JOIN leads l ON l.assigned_to = p.id
LEFT JOIN interactions i ON i.lead_id = l.id AND i.user_id = p.id
LEFT JOIN tasks t ON t.assigned_to = p.id
WHERE p.role IN ('sales_rep', 'manager')
GROUP BY p.id, p.full_name;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Leads: reps see only assigned leads; managers/admins see all
CREATE POLICY "leads_select" ON leads FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR get_user_role() IN ('manager', 'admin', 'founder', 'marketing')
  );

CREATE POLICY "leads_insert" ON leads FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "leads_update" ON leads FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR get_user_role() IN ('manager', 'admin', 'founder')
  );

-- Interactions: same as leads
CREATE POLICY "interactions_select" ON interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = interactions.lead_id
      AND (l.assigned_to = auth.uid() OR get_user_role() IN ('manager', 'admin', 'founder', 'marketing'))
    )
  );

CREATE POLICY "interactions_insert" ON interactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Tasks: user sees their own tasks; managers see all
CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR get_user_role() IN ('manager', 'admin', 'founder')
  );

CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR get_user_role() IN ('manager', 'admin', 'founder')
  );

-- Profiles: everyone can read; only self or admin can update
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR get_user_role() = 'admin');

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Stage change logging trigger
CREATE OR REPLACE FUNCTION log_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO interactions (lead_id, type, stage_from_id, stage_to_id, is_automated)
    VALUES (NEW.id, 'stage_change', OLD.stage_id, NEW.stage_id, false);
    NEW.stage_entered_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_stage_change BEFORE UPDATE OF stage_id ON leads FOR EACH ROW EXECUTE FUNCTION log_stage_change();

-- Re-engagement eligibility (auto-set 90 days after lost)
CREATE OR REPLACE FUNCTION set_reengagement_date()
RETURNS TRIGGER AS $$
DECLARE lost_stage_id UUID;
BEGIN
  SELECT id INTO lost_stage_id FROM pipeline_stages WHERE slug = 'lost';
  IF NEW.stage_id = lost_stage_id AND OLD.stage_id != lost_stage_id THEN
    NEW.reengagement_eligible_at = NOW() + INTERVAL '90 days';
    NEW.closed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_reengagement BEFORE UPDATE OF stage_id ON leads FOR EACH ROW EXECUTE FUNCTION set_reengagement_date();
