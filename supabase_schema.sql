-- ==============================================================================
-- NOPLIN CMS — DEFINITIVE SCHEMA (matches all frontend code exactly)
-- Run this ENTIRE script in: Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================


-- ==============================================================================
-- STEP 0 — WIPE EVERYTHING
-- ==============================================================================

DROP TABLE IF EXISTS public.notifications       CASCADE;
DROP TABLE IF EXISTS public.project_assignments  CASCADE;
DROP TABLE IF EXISTS public.project_staff        CASCADE;  -- old name
DROP TABLE IF EXISTS public.project_files        CASCADE;  -- old table
DROP TABLE IF EXISTS public.projects             CASCADE;
DROP TABLE IF EXISTS public.profiles             CASCADE;

DROP FUNCTION IF EXISTS public.notify_on_project_status_change()  CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_project_assignment()     CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role()                      CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user()                  CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at()                   CASCADE;


-- ==============================================================================
-- STEP 1 — HELPER: SAFE ROLE CHECKER (avoids recursive RLS → 500 errors)
-- Must use LANGUAGE plpgsql so the function can be created BEFORE the table.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER        -- bypasses RLS on profiles, no recursion
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$;


-- ==============================================================================
-- STEP 2 — UPDATED_AT HELPER
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ==============================================================================
-- STEP 3 — TABLES
-- ==============================================================================

-- ── A. profiles (one row per Supabase Auth user) ──────────────────────────────
CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'staff'
                          CHECK (role IN ('admin', 'staff', 'client')),
  phone       TEXT,
  company     TEXT,
  job_title   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── B. projects ───────────────────────────────────────────────────────────────
-- All columns actually referenced by the frontend code are included here.
-- File metadata is stored as JSONB arrays (space-efficient on Supabase free tier).

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  title        TEXT        NOT NULL,
  details      TEXT,
  deliverables TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'active', 'completed', 'approved')),
  deadline     TIMESTAMPTZ,
  client_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  price        TEXT,

  -- Initial file attachments (admin/staff uploads at project creation)
  -- Schema: [{id, name, url, type, uploadedAt}]
  files        JSONB       DEFAULT '[]'::jsonb,

  -- Completion / delivery fields (written when staff marks project complete)
  deliverables_summary  TEXT,
  deliverables_links    TEXT[]  DEFAULT '{}',
  -- Schema: [{name, url, type, uploadedAt}]
  deliverables_files    JSONB   DEFAULT '[]'::jsonb,

  -- Client revision feedback (written when client rejects and requests changes)
  client_feedback  TEXT,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── C. project_assignments (many-to-many: projects ↔ staff/admin profiles) ───
-- Column names match ALL frontend code exactly (user_id, not staff_id).

CREATE TABLE public.project_assignments (
  project_id   UUID  REFERENCES public.projects(id)  ON DELETE CASCADE,
  user_id      UUID  REFERENCES public.profiles(id)  ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);


-- ── D. notifications ──────────────────────────────────────────────────────────

CREATE TABLE public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('alert', 'success', 'message', 'system')),
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  is_read    BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==============================================================================
-- STEP 4 — ENABLE ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- STEP 5 — RLS POLICIES
-- All admin checks use get_my_role() to avoid the recursive-subquery 500 error.
-- ==============================================================================

-- ── profiles ──────────────────────────────────────────────────────────────────

CREATE POLICY "profiles: admin full access"
  ON public.profiles FOR ALL
  USING (public.get_my_role() = 'admin');

-- Every user can read their own profile row
CREATE POLICY "profiles: read own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Every user can update their own profile row
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- ── projects ──────────────────────────────────────────────────────────────────

CREATE POLICY "projects: admin full access"
  ON public.projects FOR ALL
  USING (public.get_my_role() = 'admin');

-- Staff: read projects they are assigned to
CREATE POLICY "projects: staff view assigned"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_assignments pa
      WHERE pa.project_id = projects.id AND pa.user_id = auth.uid()
    )
  );

-- Staff: update projects they are assigned to (status, deliverables fields)
CREATE POLICY "projects: staff update assigned"
  ON public.projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_assignments pa
      WHERE pa.project_id = projects.id AND pa.user_id = auth.uid()
    )
  );

-- Clients: read only their own projects
CREATE POLICY "projects: client view own"
  ON public.projects FOR SELECT
  USING (client_id = auth.uid());

-- Clients: update only their own projects (for client_feedback field)
CREATE POLICY "projects: client update own"
  ON public.projects FOR UPDATE
  USING (client_id = auth.uid());


-- ── project_assignments ───────────────────────────────────────────────────────

CREATE POLICY "project_assignments: admin full access"
  ON public.project_assignments FOR ALL
  USING (public.get_my_role() = 'admin');

-- Staff: see their own assignments
CREATE POLICY "project_assignments: staff view own"
  ON public.project_assignments FOR SELECT
  USING (user_id = auth.uid());


-- ── notifications ─────────────────────────────────────────────────────────────

CREATE POLICY "notifications: admin full access"
  ON public.notifications FOR ALL
  USING (public.get_my_role() = 'admin');

-- Every user owns their own notifications
CREATE POLICY "notifications: user own"
  ON public.notifications FOR ALL
  USING (user_id = auth.uid());


-- ==============================================================================
-- STEP 6 — AUTO-CREATE PROFILE ON NEW AUTH USER
-- Fires when any user is created via admin API, magic link, or invite.
-- Reads role/name/etc. from user_metadata set by /api/create-user.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, phone, company, job_title)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'job_title'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- STEP 7 — NOTIFICATION TRIGGERS
-- Industry-standard: DB-side triggers ensure notifications are never missed,
-- even if the client-side code doesn't run (offline, error, etc.).
-- ==============================================================================

-- ── 7a. Notify on project status change ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    -- Notify the project's client
    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.client_id,
        CASE NEW.status
          WHEN 'completed' THEN 'success'
          WHEN 'approved'  THEN 'success'
          ELSE 'alert'
        END,
        'Project Update: ' || NEW.title,
        'Your project status changed to: ' || UPPER(NEW.status)
      );
    END IF;

    -- Notify all admins (except if an admin caused this, still notify them all)
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT
      p.id,
      'system',
      'Project Status Changed',
      '"' || NEW.title || '" → ' || NEW.status
    FROM public.profiles p
    WHERE p.role = 'admin';

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_project_status ON public.projects;
CREATE TRIGGER trg_notify_project_status
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_project_status_change();


-- ── 7b. Notify newly assigned staff ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_on_project_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title TEXT;
BEGIN
  SELECT title INTO v_project_title
  FROM public.projects WHERE id = NEW.project_id;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    NEW.user_id,
    'message',
    'You have been assigned to a project',
    'You are now assigned to: ' || COALESCE(v_project_title, 'a new project')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_assignment ON public.project_assignments;
CREATE TRIGGER trg_notify_assignment
  AFTER INSERT ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_project_assignment();


-- ==============================================================================
-- STEP 8 — AFTER RUNNING THIS SCRIPT:
--
-- 1. Go to Supabase Dashboard → Authentication → Users → Add User
--    Enter your admin email + password.
--
-- 2. Then run this to make yourself admin:
--    UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
--
-- 3. Go to Storage → New Bucket → Name: "deliverables_vault" → Public: OFF
--    (files are accessed via signed/public URLs stored in the JSONB columns)
--
-- 4. Add to Supabase → Authentication → URL Configuration → Redirect URLs:
--    http://localhost:3000/auth/callback
--    http://localhost:3000/setup-password
--    https://your-production-domain.com/auth/callback
--    https://your-production-domain.com/setup-password
-- ==============================================================================
