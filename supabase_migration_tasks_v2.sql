-- ==============================================================================
-- MIGRATION: Tasks V2 (Advanced Kanban Features)
-- ==============================================================================

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;

-- Example of subtasks format:
-- [
--   { "id": "123", "title": "Design Header", "is_completed": true },
--   { "id": "456", "title": "Design Footer", "is_completed": false }
-- ]
