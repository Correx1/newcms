-- Module: Noplin CMS Invoice Engine
-- Migration: Create Invoices Table

-- 1. Create the base table
CREATE TABLE public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number VARCHAR(255) UNIQUE NOT NULL, -- e.g. NPN-INV-1001
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'unpaid' CHECK (status IN ('draft', 'unpaid', 'paid', 'overdue')),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal NUMERIC(10, 2) DEFAULT 0,
    tax_name VARCHAR(50),      -- e.g. VAT, IGST
    tax_rate NUMERIC(5, 2),    -- e.g. 10.5 for 10.5%
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    grand_total NUMERIC(10, 2) DEFAULT 0,
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of items {title, description, quantity, rate, amount, project_id}
    notes TEXT,
    terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Define sequence for NPN-INV auto-increment
CREATE SEQUENCE IF NOT EXISTS invoice_serial START 1001;

-- 3. Trigger function to auto-generate the NPN-INV-100X string before insert
CREATE OR REPLACE FUNCTION generate_invoice_number() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'NPN-INV-' || nextval('invoice_serial');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invoice_number
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION generate_invoice_number();

-- 4. Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Admins can do everything
CREATE POLICY "Admins have full access to invoices" ON public.invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Clients can view their own
CREATE POLICY "Clients can view own invoices" ON public.invoices
  FOR SELECT USING (
    client_id = auth.uid()
  );

