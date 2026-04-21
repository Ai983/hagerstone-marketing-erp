-- Run this AFTER the schema to populate test data
-- All sample records have is_sample_data = TRUE for easy cleanup

-- First create test users in Supabase Auth, then run:
-- (Replace UUIDs with actual auth.users UUIDs after creating test accounts)

-- INSERT INTO profiles ...
-- INSERT INTO leads (50 sample leads across all stages) ...
-- See /supabase/seed.sql for full seed file

-- QUICK SEED: At least create one lead per stage for UI testing
DO $$
DECLARE
  stage_new UUID; stage_contacted UUID; stage_qualified UUID;
  stage_visit UUID; stage_proposal UUID; stage_neg UUID;
  stage_won UUID; stage_lost UUID;
BEGIN
  SELECT id INTO stage_new FROM pipeline_stages WHERE slug = 'new_lead';
  SELECT id INTO stage_contacted FROM pipeline_stages WHERE slug = 'contacted';
  SELECT id INTO stage_qualified FROM pipeline_stages WHERE slug = 'qualified';
  SELECT id INTO stage_visit FROM pipeline_stages WHERE slug = 'site_visit_scheduled';
  SELECT id INTO stage_proposal FROM pipeline_stages WHERE slug = 'proposal_sent';
  SELECT id INTO stage_neg FROM pipeline_stages WHERE slug = 'negotiation';
  SELECT id INTO stage_won FROM pipeline_stages WHERE slug = 'won';
  SELECT id INTO stage_lost FROM pipeline_stages WHERE slug = 'lost';

  -- Sample lead 1
  INSERT INTO leads (full_name, email, phone, company_name, city, service_line, source, stage_id, estimated_budget, is_sample_data)
  VALUES ('Rajesh Sharma', 'rajesh@techcorp.in', '+919876543210', 'TechCorp India Pvt Ltd', 'Noida', 'office_interiors', 'website', stage_new, '₹50L - ₹1Cr', TRUE);

  -- Sample lead 2
  INSERT INTO leads (full_name, email, phone, company_name, city, service_line, source, stage_id, estimated_budget, is_sample_data)
  VALUES ('Priya Mehta', 'priya@finserv.com', '+919988776655', 'FinServ Solutions', 'Gurugram', 'office_interiors', 'manual_sales', stage_contacted, '₹1Cr - ₹2Cr', TRUE);

  -- Sample lead 3
  INSERT INTO leads (full_name, email, phone, company_name, city, service_line, source, stage_id, estimated_budget, is_sample_data)
  VALUES ('Vikram Agarwal', 'v.agarwal@manufacturing.in', '+919123456789', 'Agarwal Manufacturing', 'Faridabad', 'peb_construction', 'manual_sales', stage_qualified, '₹2Cr+', TRUE);

  -- Continue for remaining stages...
END $$;
