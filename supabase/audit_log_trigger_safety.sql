-- Run this in the Supabase SQL editor if audit triggers are installed.
-- Audit logging should never rollback the main lead operation.

CREATE OR REPLACE FUNCTION log_lead_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  old_stage_name TEXT;
  new_stage_name TEXT;
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    SELECT name INTO old_stage_name
    FROM pipeline_stages
    WHERE id = OLD.stage_id;

    SELECT name INTO new_stage_name
    FROM pipeline_stages
    WHERE id = NEW.stage_id;

    BEGIN
      INSERT INTO audit_log (
        entity_type,
        entity_id,
        action,
        actor_id,
        actor_type,
        old_values,
        new_values
      ) VALUES (
        'lead',
        NEW.id,
        'stage_changed',
        NEW.assigned_to,
        CASE WHEN NEW.assigned_to IS NULL THEN 'system' ELSE 'user' END,
        jsonb_build_object(
          'stage_id', OLD.stage_id,
          'stage_name', COALESCE(old_stage_name, 'Unknown'),
          'lead_name', NEW.full_name,
          'company', NEW.company_name
        ),
        jsonb_build_object(
          'stage_id', NEW.stage_id,
          'stage_name', COALESCE(new_stage_name, 'Unknown'),
          'lead_name', NEW.full_name,
          'company', NEW.company_name
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'audit_log insert failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'lead stage audit trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_lead_created()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO audit_log (
      entity_type,
      entity_id,
      action,
      actor_id,
      actor_type,
      new_values
    ) VALUES (
      'lead',
      NEW.id,
      'created',
      COALESCE(NEW.created_by, NEW.assigned_to),
      CASE
        WHEN COALESCE(NEW.created_by, NEW.assigned_to) IS NULL THEN 'system'
        ELSE 'user'
      END,
      to_jsonb(NEW)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit_log insert failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'lead created audit trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_lead_archived()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    IF OLD.is_archived IS DISTINCT FROM NEW.is_archived AND NEW.is_archived = TRUE THEN
      INSERT INTO audit_log (
        entity_type,
        entity_id,
        action,
        actor_id,
        actor_type,
        old_values,
        new_values
      ) VALUES (
        'lead',
        NEW.id,
        'archived',
        NEW.assigned_to,
        CASE WHEN NEW.assigned_to IS NULL THEN 'system' ELSE 'user' END,
        jsonb_build_object('is_archived', OLD.is_archived),
        jsonb_build_object('is_archived', NEW.is_archived)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit_log insert failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'lead archived audit trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_lead_category_change()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    IF OLD.category IS DISTINCT FROM NEW.category THEN
      INSERT INTO audit_log (
        entity_type,
        entity_id,
        action,
        actor_id,
        actor_type,
        old_values,
        new_values
      ) VALUES (
        'lead',
        NEW.id,
        'updated',
        COALESCE(NEW.category_updated_by, NEW.assigned_to),
        CASE
          WHEN COALESCE(NEW.category_updated_by, NEW.assigned_to) IS NULL THEN 'system'
          ELSE 'user'
        END,
        jsonb_build_object(
          'category', OLD.category,
          'category_remarks', OLD.category_remarks
        ),
        jsonb_build_object(
          'category', NEW.category,
          'category_remarks', NEW.category_remarks
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit_log insert failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'lead category audit trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
