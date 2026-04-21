-- ═══════════════════════════════════════════════════════════════════════
--  Add media attachment support to campaign_messages.
--
--  Each message can optionally carry an image/document/video that gets
--  sent via WhatsApp as media-with-caption. When no media is attached,
--  the message is sent as plain text (existing behaviour).
--
--  Paste this whole file into Supabase SQL Editor and run.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE campaign_messages
  ADD COLUMN IF NOT EXISTS media_url      TEXT,
  ADD COLUMN IF NOT EXISTS media_type     TEXT CHECK (media_type IN ('image', 'document', 'video')),
  ADD COLUMN IF NOT EXISTS media_filename TEXT;

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
