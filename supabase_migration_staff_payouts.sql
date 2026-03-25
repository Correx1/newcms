-- Migration: Staff Payouts & Earnings Tracking
-- Description: Adds earnings and amount_paid to project_assignments table and creates staff_payment_logs.

-- 1. Add financial columns and unique surrogate key to assignments
ALTER TABLE public.project_assignments 
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS earnings NUMERIC(15, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15, 2) DEFAULT 0.00;

-- 2. Create the staff payment logs table for granular tracking
CREATE TABLE IF NOT EXISTS public.staff_payment_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_assignment_id UUID REFERENCES public.project_assignments(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    notes TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Security and Policies
ALTER TABLE public.staff_payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to staff_payment_logs" 
    ON public.staff_payment_logs 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Staff can view their own payment logs" 
    ON public.staff_payment_logs 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.project_assignments 
            WHERE project_assignments.id = staff_payment_logs.project_assignment_id
            AND project_assignments.user_id = auth.uid()
        )
    );

-- 4. Indexing for performance
CREATE INDEX IF NOT EXISTS idx_staff_payment_logs_assignment_id ON public.staff_payment_logs(project_assignment_id);
