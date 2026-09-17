-- 013 — Only active ERP members can see data; only Admin controls access.
--
-- Until now almost every policy was `auth.uid() IS NOT NULL` (or `true`),
-- which on the shared Hub project meant *any* signed-in Hub account — and for
-- the `true` ones, even the anon key — could read and write marketing data.
-- And any signed-in user could change anyone's role, including their own.
--
-- After this migration:
--   * data is visible only to a marketing profile that is active;
--   * a new profile starts inactive ("pending") until an Admin activates it;
--   * only an Admin can change role, email or active status;
--   * the anon key has no table access at all (webhooks/cron use the service role).
-- marketing schema only.

BEGIN;

-- ── Helpers ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION marketing.is_active_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketing.profiles p
    WHERE p.id = auth.uid() AND p.is_active
  )
$$;

CREATE OR REPLACE FUNCTION marketing.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketing.profiles p
    WHERE p.id = auth.uid() AND p.is_active AND p.role = 'admin'
  )
$$;

REVOKE EXECUTE ON FUNCTION marketing.is_active_member() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION marketing.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION marketing.is_active_member() TO authenticated;
GRANT EXECUTE ON FUNCTION marketing.is_admin() TO authenticated;

-- ── Every open policy → active members only ──────────────────────────
DO $$
DECLARE
  p record;
  open_expr constant text[] := ARRAY['(auth.uid() IS NOT NULL)', 'true'];
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'marketing' AND tablename <> 'profiles'
  LOOP
    IF p.qual = ANY (open_expr) OR p.with_check = ANY (open_expr) THEN
      EXECUTE format('ALTER POLICY %I ON marketing.%I TO authenticated', p.policyname, p.tablename);
      IF p.qual = ANY (open_expr) THEN
        EXECUTE format('ALTER POLICY %I ON marketing.%I USING (marketing.is_active_member())', p.policyname, p.tablename);
      END IF;
      IF p.with_check = ANY (open_expr) THEN
        EXECUTE format('ALTER POLICY %I ON marketing.%I WITH CHECK (marketing.is_active_member())', p.policyname, p.tablename);
      END IF;
    END IF;
  END LOOP;
END $$;

-- pipeline_stages had RLS off.
ALTER TABLE marketing.pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pipeline_stages_members ON marketing.pipeline_stages;
CREATE POLICY pipeline_stages_members ON marketing.pipeline_stages
  FOR ALL TO authenticated
  USING (marketing.is_active_member())
  WITH CHECK (marketing.is_active_member());

-- Views ran with the owner's rights and so skipped RLS.
ALTER VIEW marketing.overdue_tasks SET (security_invoker = true);
ALTER VIEW marketing.pipeline_overview SET (security_invoker = true);
ALTER VIEW marketing.rep_activity_summary SET (security_invoker = true);
ALTER VIEW marketing.source_performance SET (security_invoker = true);

-- ── Profiles ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_select ON marketing.profiles;
DROP POLICY IF EXISTS profiles_insert ON marketing.profiles;
DROP POLICY IF EXISTS profiles_update ON marketing.profiles;

CREATE POLICY profiles_select ON marketing.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR marketing.is_active_member());

CREATE POLICY profiles_insert ON marketing.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update ON marketing.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR marketing.is_admin())
  WITH CHECK (id = auth.uid() OR marketing.is_admin());

-- Non-admins: a new profile is always a pending Sales Head, and nobody but
-- an Admin may change role, email or access. Service role (webhooks, the
-- create-profile route, migrations) is not a signed-in user and passes.
CREATE OR REPLACE FUNCTION marketing.guard_profile_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF marketing.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'sales_head';
    NEW.is_active := false;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only an admin can change roles, email or access'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION marketing.guard_profile_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_guard ON marketing.profiles;
CREATE TRIGGER profiles_guard
  BEFORE INSERT OR UPDATE ON marketing.profiles
  FOR EACH ROW EXECUTE FUNCTION marketing.guard_profile_write();

-- ── The anon key gets nothing ────────────────────────────────────────
REVOKE ALL ON ALL TABLES IN SCHEMA marketing FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA marketing REVOKE ALL ON TABLES FROM anon;

-- Sample-data reseed is run server-side with the service role only.
REVOKE EXECUTE ON FUNCTION marketing.reseed_sample_data() FROM PUBLIC, anon, authenticated;

COMMIT;
