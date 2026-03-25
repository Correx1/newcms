-- ==============================================================================
-- MIGRATION: Create Tasks Table for Kanban Board
-- ==============================================================================

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Turn on RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- ====================================================================================
-- ROW LEVEL SECURITY POLICIES
-- ====================================================================================

-- 1. Admins have full access to all tasks
CREATE POLICY "Admins have full access to tasks"
    ON public.tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 2. Staff can read and write tasks for projects assigned to them
CREATE POLICY "Staff can manage assigned project tasks"
    ON public.tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.project_assignments pa 
            WHERE pa.project_id = tasks.project_id 
            AND pa.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_assignments pa 
            WHERE pa.project_id = tasks.project_id 
            AND pa.user_id = auth.uid()
        )
    );

-- 3. Clients get READ ONLY access to tasks for projects assigned to them
CREATE POLICY "Clients can view their project tasks"
    ON public.tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = tasks.project_id 
            AND projects.client_id = auth.uid()
        )
    );
