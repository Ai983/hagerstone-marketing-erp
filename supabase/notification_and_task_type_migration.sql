ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_type_check;

ALTER TABLE tasks
ADD CONSTRAINT tasks_type_check
CHECK (type IN (
  'call',
  'whatsapp',
  'email',
  'site_visit',
  'meeting',
  'other',
  'follow_up',
  'proposal'
));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    EXECUTE 'ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check';
    EXECUTE $sql$
      ALTER TABLE notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'new_lead_assigned',
        'follow_up_overdue',
        'stage_changed',
        'new_website_lead',
        'campaign_reply',
        'lead_stale'
      ))
    $sql$;
  END IF;
END $$;
