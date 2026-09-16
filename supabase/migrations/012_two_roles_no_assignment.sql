-- ============================================================
-- 012 — TWO ROLES, NO LEAD ASSIGNMENT
-- ============================================================
-- The company runs this ERP with one salesperson (Manpreet sir) and
-- whoever joins him later, so the five-role model (manager, sales_rep,
-- marketing, founder) never matched reality and only hid data.
--
--   admin       — admin@hagerstone.com, plus marketing.admin@ as backup.
--                 Owns the system settings.
--   sales_head  — everyone who sells. Full access to every page and
--                 feature for now; anyone who joins gets this role.
--
-- Because both roles are trusted and the team is small, row-level
-- security stops slicing data by role or by who a lead is assigned to:
-- every signed-in user sees the whole book. That is also what makes
-- "assign this lead to someone" unnecessary — nothing is hidden by it.
--
-- `leads.assigned_to` and `tasks.assigned_to` stay in the database
-- (tasks need an owner, and history should not be rewritten), but the
-- app no longer offers assignment anywhere.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Roles
-- ------------------------------------------------------------

ALTER TABLE marketing.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

UPDATE marketing.profiles
SET role = CASE
  WHEN LOWER(email) IN ('admin@hagerstone.com', 'marketing.admin@hagerstone.com') THEN 'admin'
  ELSE 'sales_head'
END;

ALTER TABLE marketing.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'sales_head'));

-- Seeded demo logins are not real people.
UPDATE marketing.profiles
SET is_active = FALSE
WHERE LOWER(email) IN (
  'manager@hagerstone.com',
  'salesrep@hagerstone.com',
  'marketing@hagerstone.com',
  'founder@hagerstone.com'
);

-- ------------------------------------------------------------
-- 2. Row-level security: signed in = full access
-- ------------------------------------------------------------
-- Every policy below used to name roles that no longer exist, or to
-- filter on `assigned_to`. Left as-is they would hide everything from
-- sales_head. Service-role access (imports, webhooks) is unaffected.

-- Leads
DROP POLICY IF EXISTS "leads_select" ON marketing.leads;
CREATE POLICY "leads_select" ON marketing.leads FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "leads_update" ON marketing.leads;
CREATE POLICY "leads_update" ON marketing.leads FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "leads_delete" ON marketing.leads;
CREATE POLICY "leads_delete" ON marketing.leads FOR DELETE USING (auth.uid() IS NOT NULL);

-- Interactions
DROP POLICY IF EXISTS "interactions_select" ON marketing.interactions;
CREATE POLICY "interactions_select" ON marketing.interactions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "interactions_update" ON marketing.interactions;
CREATE POLICY "interactions_update" ON marketing.interactions FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Tasks
DROP POLICY IF EXISTS "tasks_select" ON marketing.tasks;
CREATE POLICY "tasks_select" ON marketing.tasks FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tasks_update" ON marketing.tasks;
CREATE POLICY "tasks_update" ON marketing.tasks FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Profiles
DROP POLICY IF EXISTS "profiles_update" ON marketing.profiles;
CREATE POLICY "profiles_update" ON marketing.profiles FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Campaigns and enrolment
DROP POLICY IF EXISTS "campaigns_select" ON marketing.campaigns;
CREATE POLICY "campaigns_select" ON marketing.campaigns FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "campaigns_insert" ON marketing.campaigns;
CREATE POLICY "campaigns_insert" ON marketing.campaigns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "campaigns_update" ON marketing.campaigns;
CREATE POLICY "campaigns_update" ON marketing.campaigns FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "campaign_messages_select" ON marketing.campaign_messages;
CREATE POLICY "campaign_messages_select" ON marketing.campaign_messages FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "campaign_messages_insert" ON marketing.campaign_messages;
CREATE POLICY "campaign_messages_insert" ON marketing.campaign_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "enrollments_select" ON marketing.campaign_enrollments;
CREATE POLICY "enrollments_select" ON marketing.campaign_enrollments FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "enrollments_insert" ON marketing.campaign_enrollments;
CREATE POLICY "enrollments_insert" ON marketing.campaign_enrollments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "enrollments_update" ON marketing.campaign_enrollments;
CREATE POLICY "enrollments_update" ON marketing.campaign_enrollments FOR UPDATE USING (auth.uid() IS NOT NULL);

-- AI suggestions, audit log, admin settings
DROP POLICY IF EXISTS "ai_suggestions_select" ON marketing.ai_suggestions;
CREATE POLICY "ai_suggestions_select" ON marketing.ai_suggestions FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "audit_select" ON marketing.audit_log;
CREATE POLICY "audit_select" ON marketing.audit_log FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admin_settings_admin_select" ON marketing.admin_settings;
CREATE POLICY "admin_settings_admin_select" ON marketing.admin_settings FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "admin_settings_admin_upsert" ON marketing.admin_settings;
CREATE POLICY "admin_settings_admin_upsert" ON marketing.admin_settings FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Data sets, documents, universe, snapshots
DROP POLICY IF EXISTS "data_sets_write" ON marketing.data_sets;
CREATE POLICY "data_sets_write" ON marketing.data_sets FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "documents_select" ON marketing.documents;
CREATE POLICY "documents_select" ON marketing.documents FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "documents_insert" ON marketing.documents;
CREATE POLICY "documents_insert" ON marketing.documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "documents_update" ON marketing.documents;
CREATE POLICY "documents_update" ON marketing.documents FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "documents_delete" ON marketing.documents;
CREATE POLICY "documents_delete" ON marketing.documents FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "universe_insert" ON marketing.universe_contacts;
CREATE POLICY "universe_insert" ON marketing.universe_contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "universe_delete" ON marketing.universe_contacts;
CREATE POLICY "universe_delete" ON marketing.universe_contacts FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "lead_snapshots_select" ON marketing.lead_source_snapshots;
CREATE POLICY "lead_snapshots_select" ON marketing.lead_source_snapshots FOR SELECT USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- 3. Assignment notifications no longer apply
-- ------------------------------------------------------------
-- Nothing in the app assigns a lead to a person any more, so the
-- "Lead assigned to you" notification can only fire from a script.

DROP TRIGGER IF EXISTS lead_assignment_notification ON marketing.leads;

NOTIFY pgrst, 'reload schema';
