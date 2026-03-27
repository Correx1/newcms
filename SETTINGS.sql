-- Create a strictly enforced singleton table for Global Settings
CREATE TABLE IF NOT EXISTS public.settings (
    id smallint PRIMARY KEY CHECK (id = 1),
    business_name text DEFAULT 'Noplin Agency',
    logo_url text,
    contact_email text,
    phone_number text,
    physical_address text,
    
    ai_provider text DEFAULT 'google',
    ai_model_selection text DEFAULT 'gemini-2.5-flash',
    ai_api_key_override text,
    ai_prompt_overview text DEFAULT 'You are an expert agency project manager. Rewrite the provided brief into a clear, single-paragraph project overview. Do not make it overly long. Output only the final overview text, with no introductory filler. No yapping.',
    ai_prompt_deliverables text DEFAULT 'Analyze the following project overview. Extract and generate the exact deliverables required to complete it. Output ONLY a bulleted list of deliverables. Do not use paragraphs. Keep descriptions concise.',
    ai_prompt_kanban_tasks text DEFAULT 'Break this project down into distinct, actionable task cards based on the overview and deliverables. Give each task a straight-to-the-point title and a 1-sentence description. Do not add fluff.',
    
    invoice_template_id text DEFAULT 'minimal',
    updated_at timestamp with time zone DEFAULT now()
);

-- Grant access to authenticated platform users
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to freely view settings (needed for site visuals and project logic)
CREATE POLICY "Allow authenticated read" ON public.settings FOR SELECT USING (auth.role() = 'authenticated');

-- We enforce Admin-only Update mechanics using Next.js Server Components, 
-- but we grant full update ability to authenticated users via DB so the Server Action can pass through safely
CREATE POLICY "Allow authenticated update" ON public.settings FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON public.settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Seed the initial data row so the API never fails gracefully mapping a null table
INSERT INTO public.settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

