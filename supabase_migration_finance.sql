-- ==============================================================================
-- NOPLIN CMS — DYNAMIC FINANCE MIGRATION
-- Run this script in: Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================

-- 1. Ensure projects can track exactly how much has been paid overall
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15, 2) DEFAULT 0.00;

-- 2. Create the payment_logs table to track payment history
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount         NUMERIC(15, 2) NOT NULL,
  payment_date   TIMESTAMPTZ DEFAULT NOW(),
  notes          TEXT,
  recorded_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security for payment_logs
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "payment_logs: admin full access"
  ON public.payment_logs FOR ALL
  USING (public.get_my_role() = 'admin');

-- Clients can view payment logs for their own projects
CREATE POLICY "payment_logs: client view own"
  ON public.payment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = payment_logs.project_id AND p.client_id = auth.uid()
    )
  );

-- Staff can view payment logs for projects they are assigned to
CREATE POLICY "payment_logs: staff view assigned"
  ON public.payment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_assignments pa
      WHERE pa.project_id = payment_logs.project_id AND pa.user_id = auth.uid()
    )
  );
