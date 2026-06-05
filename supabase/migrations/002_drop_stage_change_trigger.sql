-- Migration: drop the redundant log_stage_change trigger.
--
-- Why: the trigger inserts a `stage_change` interaction every time
-- `leads.stage_id` is updated, but the client (LeadDrawer + useKanban)
-- ALSO inserts one — with user_id and notes attached, which the trigger
-- can't capture. Result: every stage move shows up twice in the lead
-- timeline. Killing the trigger keeps the client insert as the single
-- source of truth (with attribution + reason text intact).

DROP TRIGGER IF EXISTS lead_stage_change ON marketing.leads;
DROP TRIGGER IF EXISTS lead_stage_change ON public.leads;

-- Optional cleanup — the function is unused once both triggers are gone.
-- Wrap in DO blocks so the migration succeeds even if the function lives
-- under a different schema or has already been dropped.
DO $$
BEGIN
  EXECUTE 'DROP FUNCTION IF EXISTS marketing.log_stage_change()';
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

DO $$
BEGIN
  EXECUTE 'DROP FUNCTION IF EXISTS public.log_stage_change()';
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
