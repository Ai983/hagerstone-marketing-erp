-- ═══════════════════════════════════════════════════════════════════════
--  Fix: "Save Sequence" button duplicates messages instead of replacing.
--
--  Symptom: every click adds another copy of the sequence. The DELETE
--  portion of the PUT handler returns `error: null` but affects 0 rows.
--
--  Why: if RLS is enabled on campaign_messages without a DELETE policy,
--  Postgres silently returns 0 rows affected. The INSERT then stacks
--  the new sequence on top of the old one.
--
--  The API route now uses the service role for writes (bypassing RLS),
--  but running this file keeps the policies correct for any future
--  client-side code that touches campaign_messages.
--
--  Paste the whole file into Supabase SQL Editor and run.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Show current state
SELECT policyname, cmd
FROM   pg_policies
WHERE  tablename = 'campaign_messages';

-- 2. Ensure RLS is enabled (idempotent)
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;

-- 3. SELECT — any authenticated user can read messages
DROP POLICY IF EXISTS "campaign_messages_select" ON campaign_messages;
CREATE POLICY "campaign_messages_select" ON campaign_messages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. INSERT — any authenticated user can insert
DROP POLICY IF EXISTS "campaign_messages_insert" ON campaign_messages;
CREATE POLICY "campaign_messages_insert" ON campaign_messages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. DELETE — THIS IS THE ONE THAT WAS CAUSING THE DUPLICATION
DROP POLICY IF EXISTS "campaign_messages_delete" ON campaign_messages;
CREATE POLICY "campaign_messages_delete" ON campaign_messages
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 6. UPDATE — any authenticated user can update
DROP POLICY IF EXISTS "campaign_messages_update" ON campaign_messages;
CREATE POLICY "campaign_messages_update" ON campaign_messages
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Verify — should show four rows
SELECT policyname, cmd
FROM   pg_policies
WHERE  tablename = 'campaign_messages'
ORDER  BY cmd, policyname;
