-- 016 — "Sales BD" data set: the business-development pipeline from the
-- sales@hagerstone.com mailbox (Anand S Choudhari, Head – BD, South),
-- reviewed 14 Sep 2026. Kept separate from ERP, Website, Architect Drive
-- and the founder's data. marketing schema only.

INSERT INTO marketing.data_sets (key, name, kind, color, icon, position, description, source_file)
VALUES (
  'sales-bd-mailbox',
  'Sales BD',
  'import',
  '#EC4899',
  'Mail',
  35,
  'Business-development pipeline from the sales@hagerstone.com mailbox (Anand S Choudhari, Head – BD, South) — clients, tenders and prospects with where each email conversation last stopped. Reviewed 14 Sep 2026.',
  'sales-hagerstone-BD-pipeline-report (1).html'
)
ON CONFLICT (key) DO NOTHING;
