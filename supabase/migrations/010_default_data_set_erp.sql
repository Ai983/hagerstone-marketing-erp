-- ============================================================
-- 010 — EVERYTHING NEW DEFAULTS TO THE "ERP" DATA SET
-- ============================================================
-- Imports set `data_set_id` explicitly. Everything else that creates a
-- lead or an interaction — the New Lead form, WhatsApp inbound, the
-- website webhook, Excel import, AI lead generation, a meeting Manpreet
-- logs — did not, so new rows had no source: no badge on the card, and
-- they vanished from the "ERP" filter.
--
-- A column DEFAULT cannot look up the ERP row's id, so a BEFORE INSERT
-- trigger fills it when the insert left it empty. Explicit values
-- (imports, "Add to pipeline" from the universe) are never overridden.
--
-- For interactions this records where the RECORD was made (in the ERP),
-- not which body of data the lead belongs to; pages that filter
-- activity "by source" use the lead's data set for that.
-- ============================================================

CREATE OR REPLACE FUNCTION marketing.default_data_set_erp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = marketing, public
AS $$
BEGIN
  IF NEW.data_set_id IS NULL THEN
    NEW.data_set_id := (SELECT id FROM marketing.data_sets WHERE key = 'erp-native');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_default_data_set ON marketing.leads;
CREATE TRIGGER leads_default_data_set
  BEFORE INSERT ON marketing.leads
  FOR EACH ROW EXECUTE FUNCTION marketing.default_data_set_erp();

DROP TRIGGER IF EXISTS interactions_default_data_set ON marketing.interactions;
CREATE TRIGGER interactions_default_data_set
  BEFORE INSERT ON marketing.interactions
  FOR EACH ROW EXECUTE FUNCTION marketing.default_data_set_erp();

REVOKE EXECUTE ON FUNCTION marketing.default_data_set_erp() FROM PUBLIC, anon;
