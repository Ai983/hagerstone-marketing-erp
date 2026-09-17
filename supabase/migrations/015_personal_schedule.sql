-- 015 — My Schedule: a personal daily / weekly / monthly plan.
--
-- Kept apart from `tasks`, which are lead follow-ups that drive overdue
-- badges and alerts. A schedule item is the person's own routine ("review
-- pipeline every Monday 10:00", "architect calls daily 11:00"); a lead is
-- optional. Repeats are stored as a rule and expanded in the app, and each
-- ticked-off day is a row in schedule_completions.
-- marketing schema only.

CREATE TABLE IF NOT EXISTS marketing.schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES marketing.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  notes TEXT,
  lead_id UUID REFERENCES marketing.leads(id) ON DELETE SET NULL,

  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  time_of_day TIME,                       -- null = any time that day
  repeat TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none', 'daily', 'weekly', 'monthly')),
  weekdays SMALLINT[] NOT NULL DEFAULT '{}',   -- weekly: 0 = Sunday … 6 = Saturday
  ends_on DATE,                           -- null = keeps repeating

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (repeat <> 'weekly' OR cardinality(weekdays) > 0)
);

CREATE INDEX IF NOT EXISTS idx_schedule_items_owner ON marketing.schedule_items(owner_id, is_active);

CREATE TABLE IF NOT EXISTS marketing.schedule_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES marketing.schedule_items(id) ON DELETE CASCADE,
  occurs_on DATE NOT NULL,
  completed_by UUID REFERENCES marketing.profiles(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, occurs_on)
);

DROP TRIGGER IF EXISTS schedule_items_updated_at ON marketing.schedule_items;
CREATE TRIGGER schedule_items_updated_at
  BEFORE UPDATE ON marketing.schedule_items
  FOR EACH ROW EXECUTE FUNCTION marketing.update_updated_at();

-- A schedule is personal: you see and change your own. Admin can see all.
ALTER TABLE marketing.schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing.schedule_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_items_select ON marketing.schedule_items;
CREATE POLICY schedule_items_select ON marketing.schedule_items FOR SELECT TO authenticated
  USING (marketing.is_active_member() AND (owner_id = auth.uid() OR marketing.is_admin()));

DROP POLICY IF EXISTS schedule_items_write ON marketing.schedule_items;
CREATE POLICY schedule_items_write ON marketing.schedule_items FOR ALL TO authenticated
  USING (marketing.is_active_member() AND owner_id = auth.uid())
  WITH CHECK (marketing.is_active_member() AND owner_id = auth.uid());

DROP POLICY IF EXISTS schedule_completions_select ON marketing.schedule_completions;
CREATE POLICY schedule_completions_select ON marketing.schedule_completions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM marketing.schedule_items i
    WHERE i.id = item_id AND marketing.is_active_member() AND (i.owner_id = auth.uid() OR marketing.is_admin())
  ));

DROP POLICY IF EXISTS schedule_completions_write ON marketing.schedule_completions;
CREATE POLICY schedule_completions_write ON marketing.schedule_completions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM marketing.schedule_items i
    WHERE i.id = item_id AND marketing.is_active_member() AND i.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM marketing.schedule_items i
    WHERE i.id = item_id AND marketing.is_active_member() AND i.owner_id = auth.uid()
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON marketing.schedule_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON marketing.schedule_completions TO authenticated, service_role;
REVOKE ALL ON marketing.schedule_items FROM anon;
REVOKE ALL ON marketing.schedule_completions FROM anon;
