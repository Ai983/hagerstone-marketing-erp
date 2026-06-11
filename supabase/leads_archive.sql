-- ============================================
-- LEADS ARCHIVE / SOFT-DELETE
-- Adds soft-delete ("archive") support to leads.
-- Run this in the Supabase SQL editor.
-- ============================================

ALTER TABLE marketing.leads
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES marketing.profiles(id);

-- Fast filtering of the (small) archived set, and keeps active-list scans cheap.
CREATE INDEX IF NOT EXISTS idx_leads_is_archived
  ON marketing.leads (is_archived)
  WHERE is_archived = TRUE;

-- NOTE: permanent delete is performed by an admin-only server route using the
-- service-role key (which bypasses RLS), so no DELETE policy is required here.
-- Deleting a lead cascades to its interactions, tasks and campaign_enrollments
-- via the existing ON DELETE CASCADE foreign keys.
