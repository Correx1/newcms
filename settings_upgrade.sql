-- 1. Revert previous messy columns
ALTER TABLE public.settings DROP COLUMN IF EXISTS invoice_logo_url;
ALTER TABLE public.settings DROP COLUMN IF EXISTS invoice_signature_url;
ALTER TABLE public.settings DROP COLUMN IF EXISTS payment_info;

-- 2. Add Explicit Bank Details separated into fields
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

-- 3. Create a public bucket for storing business imagery (Logos and Signatures) natively
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand_assets', 'brand_assets', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Public Read Access for PDFs to fetch the images
CREATE POLICY "Public Read Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand_assets');

-- 5. Enable Authenticated Uploads
CREATE POLICY "Auth Upload Images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'brand_assets' AND auth.role() = 'authenticated');
