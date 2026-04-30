-- Add optional WhatsApp quick reply buttons to campaign messages.
-- Run this once in the Supabase SQL Editor.

ALTER TABLE campaign_messages
ADD COLUMN IF NOT EXISTS buttons JSONB DEFAULT '[]';
