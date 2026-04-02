-- ============================================================
-- LEADS MODULE MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Leads table: promoted from contact_submissions or manually created
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Optional link back to the originating contact form submission
  contact_submission_id UUID REFERENCES contact_submissions(id) ON DELETE SET NULL,

  -- Core contact fields (copied from submission or entered manually)
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  service TEXT,
  message TEXT,

  -- CRM tracking
  stage TEXT NOT NULL DEFAULT 'new',
  -- valid stages: 'new' | 'contacted' | 'in_discussion' | 'proposal_sent' | 'won' | 'lost'

  follow_up_date DATE,
  follow_up_note TEXT,

  -- Set when admin converts lead to a client profile
  converted_client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes / activity timeline per lead
CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on leads
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at_trigger
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_leads_updated_at();

-- RLS: only authenticated users can read/write (admin enforced at API level)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage leads"
  ON leads FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage lead notes"
  ON lead_notes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
