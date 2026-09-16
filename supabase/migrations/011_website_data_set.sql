-- ============================================================
-- 011 — WEBSITE AS ITS OWN DATA SET
-- ============================================================
-- Enquiries from hagerstone.com arrive through
-- /api/webhook/website-leads with source = 'website', but they landed
-- in the general "ERP" bucket, so they could not be told apart from
-- WhatsApp inbound, LinkedIn or manually typed leads.
--
-- Website enquiries need their own section: they are the only source
-- where the client wrote in, unprompted, and where speed of reply
-- decides whether the enquiry is worth anything.
-- ============================================================

INSERT INTO marketing.data_sets (key, name, description, kind, color, icon, source_file, position)
VALUES (
  'website',
  'Website',
  'Enquiries submitted on hagerstone.com — the contact and quote forms. Captured automatically by the website webhook.',
  'other', '#06B6D4', 'Globe', NULL, 15
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  position = EXCLUDED.position,
  updated_at = NOW();

-- Move website leads captured before this change out of the ERP bucket.
UPDATE marketing.leads l
SET data_set_id = (SELECT id FROM marketing.data_sets WHERE key = 'website')
WHERE l.source = 'website'
  AND l.data_set_id IS DISTINCT FROM (SELECT id FROM marketing.data_sets WHERE key = 'website');

-- Their capture entries belong with them.
UPDATE marketing.interactions i
SET data_set_id = (SELECT id FROM marketing.data_sets WHERE key = 'website')
FROM marketing.leads l
WHERE l.id = i.lead_id
  AND l.source = 'website'
  AND i.type = 'lead_created';
