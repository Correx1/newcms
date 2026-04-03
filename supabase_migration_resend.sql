-- Add Resend Configuration Columns for the Noplin CMS Email Engine

ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_api_key text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_sender_identity text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_reply_domain text;

-- Add lead_emails table or just use lead_notes? 
-- The user request was to just append inbound emails to lead_notes.
-- 'lead_notes' has columns: id, lead_id, admin_id, note, created_at.
-- If an inbound email comes, who is the admin_id? We can just leave it NULL or set it a specific system format? 
-- Wait, the `admin_id` in `lead_notes` currently connects to `profiles`.
-- It might have a NOT NULL constraint! Let's check or handle it in the API later.
-- Actually, let's just make sure admin_id can be NULL, or we make an 'autobot' profile.
ALTER TABLE lead_notes ALTER COLUMN admin_id DROP NOT NULL;
