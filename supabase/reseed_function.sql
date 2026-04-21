-- ═══════════════════════════════════════════════════════════════════════
--  reseed_sample_data()
--
--  Inserts 14 sample leads across all pipeline stages.
--  Called by the "Reseed Sample Data" button in /admin.
--
--  Safe to re-run: skips leads whose phone already exists.
--  All inserted rows have is_sample_data = TRUE.
--
--  service_line values come from the allowed list:
--    office_interiors | mep | facade_glazing | peb_construction |
--    civil_works | multiple | unknown
--
--  Paste this whole file into Supabase SQL Editor and run.
-- ═══════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS reseed_sample_data();

CREATE OR REPLACE FUNCTION reseed_sample_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  s_new         UUID;
  s_contacted   UUID;
  s_qualified   UUID;
  s_visit       UUID;
  s_proposal    UUID;
  s_neg         UUID;
  s_won         UUID;
  s_lost        UUID;
  s_hold        UUID;
  inserted_count INT := 0;
  skipped_count  INT := 0;
BEGIN
  -- Resolve stage UUIDs
  SELECT id INTO s_new        FROM pipeline_stages WHERE slug = 'new_lead';
  SELECT id INTO s_contacted  FROM pipeline_stages WHERE slug = 'contacted';
  SELECT id INTO s_qualified  FROM pipeline_stages WHERE slug = 'qualified';
  SELECT id INTO s_visit      FROM pipeline_stages WHERE slug = 'site_visit_scheduled';
  SELECT id INTO s_proposal   FROM pipeline_stages WHERE slug = 'proposal_sent';
  SELECT id INTO s_neg        FROM pipeline_stages WHERE slug = 'negotiation';
  SELECT id INTO s_won        FROM pipeline_stages WHERE slug = 'won';
  SELECT id INTO s_lost       FROM pipeline_stages WHERE slug = 'lost';
  SELECT id INTO s_hold       FROM pipeline_stages WHERE slug = 'on_hold';

  -- Count current sample rows (for stats), but don't delete; keep additive.
  SELECT COUNT(*) INTO skipped_count FROM leads WHERE is_sample_data = TRUE;

  -- 1. New Lead stage
  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919876543210') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Rajesh Sharma', '+919876543210', 'rajesh@techcorp.in', 'TechCorp India Pvt Ltd', 'Noida', 'office_interiors', 'website', s_new, '₹50L - ₹1Cr', 'Looking for 8,000 sqft office fit-out', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919812345670') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Rohit Verma', '+919812345670', 'rohit@educorp.in', 'EduCorp Academy', 'Faridabad', 'multiple', 'whatsapp_inbound', s_new, '₹1Cr - ₹2Cr', 'New campus, full scope', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  -- 2. Contacted
  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919988776655') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Priya Mehta', '+919988776655', 'priya@finserv.com', 'FinServ Solutions', 'Gurugram', 'office_interiors', 'manual_sales', s_contacted, '₹1Cr - ₹2Cr', 'Open-plan layout, 120 seats', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919900112233') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Sneha Iyer', '+919900112233', 'sneha@medcare.in', 'MedCare Hospitals', 'Gurugram', 'mep', 'referral', s_contacted, '₹2Cr+', 'Hospital MEP upgrade', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  -- 3. Qualified
  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919123456789') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Vikram Agarwal', '+919123456789', 'v.agarwal@manufacturing.in', 'Agarwal Manufacturing', 'Faridabad', 'peb_construction', 'manual_sales', s_qualified, '₹2Cr+', 'PEB shed 40,000 sqft', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919844556677') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Deepak Joshi', '+919844556677', 'deepak@retailco.in', 'RetailCo', 'Noida', 'office_interiors', 'google_ads', s_qualified, '₹50L - ₹1Cr', 'Showroom + back office', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  -- 4. Site Visit Scheduled
  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919765432100') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Anita Desai', '+919765432100', 'anita@bluewave.in', 'Bluewave Tech', 'Delhi', 'mep', 'referral', s_visit, '₹25L - ₹50L', 'HVAC + electrical retrofit', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  -- 5. Proposal Sent
  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919811223344') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Suresh Kumar', '+919811223344', 'suresh@realtygroup.in', 'Realty Group', 'Gurugram', 'facade_glazing', 'google_ads', s_proposal, '₹1Cr - ₹2Cr', 'Glass facade for corporate tower', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919822334455') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Meera Singh', '+919822334455', 'meera@autotech.in', 'AutoTech Industries', 'Gurugram', 'peb_construction', 'manual_sales', s_proposal, '₹2Cr+', 'Factory shed, 60,000 sqft', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  -- 6. Negotiation
  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919876501234') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Neha Kapoor', '+919876501234', 'neha.k@logistics.com', 'Swift Logistics', 'Noida', 'civil_works', 'linkedin', s_neg, '₹50L - ₹1Cr', 'Warehouse expansion phase 2', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919855667788') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Sanjay Gupta', '+919855667788', 'sanjay@consultpro.com', 'ConsultPro', 'Delhi', 'office_interiors', 'linkedin', s_neg, '₹25L - ₹50L', '5th floor office, 3,500 sqft', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  -- 7. Won
  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919999888877') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data, closed_at, closure_value)
    VALUES ('Arjun Malhotra', '+919999888877', 'arjun@pixeldesign.in', 'Pixel Design Studio', 'Delhi', 'office_interiors', 'website', s_won, '₹25L - ₹50L', 'Creative agency fit-out, closed', TRUE, NOW() - INTERVAL '3 days', 3500000);
    inserted_count := inserted_count + 1;
  END IF;

  -- 8. Lost
  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919876123456') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data, closed_at, closure_reason)
    VALUES ('Kavita Rao', '+919876123456', 'kavita@greenfields.in', 'Greenfields Farms', 'Delhi', 'peb_construction', 'justdial', s_lost, '₹25L - ₹50L', 'Went with a local competitor', TRUE, NOW() - INTERVAL '7 days', 'Price');
    inserted_count := inserted_count + 1;
  END IF;

  -- 9. On Hold
  IF NOT EXISTS (SELECT 1 FROM leads WHERE phone = '+919866778899') THEN
    INSERT INTO leads (full_name, phone, email, company_name, city, service_line, source, stage_id, estimated_budget, initial_notes, is_sample_data)
    VALUES ('Ritu Bansal', '+919866778899', 'ritu@fashionhub.in', 'Fashion Hub', 'Delhi', 'facade_glazing', 'other', s_hold, '₹50L - ₹1Cr', 'Awaiting lease renewal', TRUE);
    inserted_count := inserted_count + 1;
  END IF;

  RETURN json_build_object(
    'inserted',        inserted_count,
    'already_existed', skipped_count,
    'total_sample_leads', (SELECT COUNT(*) FROM leads WHERE is_sample_data = TRUE)
  );
END;
$func$;

-- Allow service role (used by the API) and authenticated admins to call it
GRANT EXECUTE ON FUNCTION reseed_sample_data() TO service_role;
GRANT EXECUTE ON FUNCTION reseed_sample_data() TO authenticated;
