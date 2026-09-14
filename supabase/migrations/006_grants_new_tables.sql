-- ============================================================
-- 006 — GRANTS FOR 003–005
-- ============================================================
-- Tables created in a non-public schema are not reachable through
-- PostgREST until the API roles are granted on them explicitly.
-- RLS still decides which rows each user sees; these grants only
-- open the door.
-- ============================================================

GRANT USAGE ON SCHEMA marketing TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  marketing.data_sets,
  marketing.universe_contacts,
  marketing.documents,
  marketing.document_shares
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  marketing.current_user_role(),
  marketing.universe_summary(),
  marketing.bump_document_downloads(UUID),
  marketing.bump_document_shares(UUID)
TO authenticated, service_role;

-- New functions are executable by PUBLIC by default, which includes the
-- anon key. These are SECURITY DEFINER, so close that off.
REVOKE EXECUTE ON FUNCTION
  marketing.current_user_role(),
  marketing.universe_summary(),
  marketing.bump_document_downloads(UUID),
  marketing.bump_document_shares(UUID)
FROM PUBLIC, anon;

-- PostgREST caches the schema; tell it about the new objects now
-- rather than on its next periodic reload.
NOTIFY pgrst, 'reload schema';
