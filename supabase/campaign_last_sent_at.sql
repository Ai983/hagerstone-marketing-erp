-- Add campaign last sent tracking.
-- Run this once in the Supabase SQL Editor.

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;

UPDATE campaigns c
SET last_sent_at = (
  SELECT MAX(ce.updated_at)
  FROM campaign_enrollments ce
  WHERE ce.campaign_id = c.id
    AND ce.current_message_position > 0
)
WHERE c.last_sent_at IS NULL;
