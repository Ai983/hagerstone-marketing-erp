-- ═══════════════════════════════════════════════════════════════════════
--  Fix: "Unenroll" button silently fails because no DELETE policy
--  exists on campaign_enrollments.
--
--  Symptom: the DELETE returns `data: []` with `error: null` — the row
--  is never actually removed from the table. The client toasts success
--  and the row stays visible until page refresh.
--
--  Why: campaign_enrollments has RLS enabled. When RLS is ON but no
--  policy matches for a given action, Postgres returns 0 rows and no
--  error — silently blocking writes.
--
--  Run this whole file in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Check what's currently there (shows up in the result panel)
SELECT policyname, cmd
FROM   pg_policies
WHERE  tablename = 'campaign_enrollments';

-- 2. Make sure RLS is enabled (idempotent)
ALTER TABLE campaign_enrollments ENABLE ROW LEVEL SECURITY;

-- 3. SELECT policy — any authenticated user can read enrollments
DROP POLICY IF EXISTS "enrollments_select" ON campaign_enrollments;
CREATE POLICY "enrollments_select" ON campaign_enrollments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. INSERT policy — any authenticated user can enroll
--    (the API route already gates this by role)
DROP POLICY IF EXISTS "enrollments_insert" ON campaign_enrollments;
CREATE POLICY "enrollments_insert" ON campaign_enrollments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. DELETE policy — THIS IS THE ONE THAT WAS MISSING
--    Without this, every DELETE from the client silently affects 0 rows.
DROP POLICY IF EXISTS "enrollments_delete" ON campaign_enrollments;
CREATE POLICY "enrollments_delete" ON campaign_enrollments
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 6. UPDATE policy — for status changes (active → paused / completed / opted_out)
DROP POLICY IF EXISTS "enrollments_update" ON campaign_enrollments;
CREATE POLICY "enrollments_update" ON campaign_enrollments
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Verify — re-query the policy catalog. You should now see
--    four rows: enrollments_select, enrollments_insert,
--    enrollments_delete, enrollments_update.
SELECT policyname, cmd
FROM   pg_policies
WHERE  tablename = 'campaign_enrollments'
ORDER  BY cmd, policyname;
