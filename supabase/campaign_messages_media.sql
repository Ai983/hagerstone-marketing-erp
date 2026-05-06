-- ═══════════════════════════════════════════════════════════════════════
--  Add media attachment support to campaign_messages.
--
--  Each message can optionally carry an image/document/video/audio that gets
--  sent via WhatsApp as media-with-caption. When no media is attached,
--  the message is sent as plain text (existing behaviour).
--
--  Paste this whole file into Supabase SQL Editor and run.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE campaign_messages
  ADD COLUMN IF NOT EXISTS media_url      TEXT,
  ADD COLUMN IF NOT EXISTS media_type     TEXT CHECK (media_type IN ('image', 'document', 'video', 'audio')),
  ADD COLUMN IF NOT EXISTS media_filename TEXT;

-- If this migration was run before audio support, widen the existing checks.
ALTER TABLE campaign_messages
  DROP CONSTRAINT IF EXISTS campaign_messages_media_type_check;

ALTER TABLE campaign_messages
  ADD CONSTRAINT campaign_messages_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('image', 'document', 'video', 'audio'));

ALTER TABLE campaign_messages
  DROP CONSTRAINT IF EXISTS campaign_messages_message_type_check;

ALTER TABLE campaign_messages
  ADD CONSTRAINT campaign_messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'document', 'video', 'audio', 'template'));

-- ═══════════════════════════════════════════════════════════════════════
--  MANUAL STEP (one-time): create the Supabase Storage bucket
--
--  Dashboard → Storage → "New bucket"
--    Name:       campaign-media
--    Public:     yes
--    File size limit: 100 MB
--
--  Policies are auto-created for public read; authenticated users can
--  upload because we scope the path with campaigns/{campaignId}/... .
-- ═══════════════════════════════════════════════════════════════════════
