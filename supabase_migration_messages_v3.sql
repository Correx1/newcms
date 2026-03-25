-- ==============================================================================
-- MIGRATION PATCH v3: Add edit/delete support for messages
-- Run AFTER supabase_migration_messages_v2.sql
-- ==============================================================================

-- Add editing support
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- RLS: allow sender to update (edit body) and soft-delete their own messages
CREATE POLICY "sender can edit own messages"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
