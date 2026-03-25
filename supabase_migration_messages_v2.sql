-- ==============================================================================
-- MIGRATION PATCH: Add project_id to messages + multi-participant conversations
-- Run AFTER supabase_migration_messages.sql
-- ==============================================================================

-- Add optional project reference to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Update RLS: allow reading project info on tagged messages
-- (project RLS already covers this via the projects table's own policies)

-- Add a title column to conversations for group naming
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS title TEXT;
