-- ==============================================================================
-- MIGRATION: Add 'rejected' project status + specific notification messages
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- DO NOT run the full supabase_schema.sql — this is a safe incremental patch.
-- ==============================================================================


-- ── 1. Extend the status CHECK constraint to include 'rejected' ───────────────

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'approved', 'rejected'));


-- ── 2. Replace the status-change notification trigger with specific messages ──
--    Messages now read: "John marked your project as completed"
--    Uses auth.uid() to look up the acting user's name from profiles.

CREATE OR REPLACE FUNCTION public.notify_on_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name  TEXT;
  v_client_msg  TEXT;
  v_admin_msg   TEXT;
  v_notif_type  TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    -- Look up who triggered this change (the currently authenticated user)
    SELECT COALESCE(name, email, 'Someone')
      INTO v_actor_name
      FROM public.profiles
     WHERE id = auth.uid();

    -- Build human-readable messages based on the new status
    v_client_msg := CASE NEW.status
      WHEN 'completed' THEN v_actor_name || ' marked your project as completed and submitted the delivery'
      WHEN 'approved'  THEN 'You approved the project "' || NEW.title || '"'
      WHEN 'rejected'  THEN v_actor_name || ' requested revisions on "' || NEW.title || '"'
      WHEN 'active'    THEN v_actor_name || ' set your project to active'
      WHEN 'pending'   THEN v_actor_name || ' set your project back to pending'
      ELSE              v_actor_name || ' updated your project status to ' || NEW.status
    END;

    v_admin_msg := CASE NEW.status
      WHEN 'completed' THEN v_actor_name || ' marked "' || NEW.title || '" as completed'
      WHEN 'approved'  THEN 'Client approved "' || NEW.title || '"'
      WHEN 'rejected'  THEN 'Client rejected "' || NEW.title || '" and requested revisions'
      WHEN 'active'    THEN v_actor_name || ' set "' || NEW.title || '" to active'
      WHEN 'pending'   THEN v_actor_name || ' set "' || NEW.title || '" to pending'
      ELSE              v_actor_name || ' changed "' || NEW.title || '" → ' || NEW.status
    END;

    v_notif_type := CASE NEW.status
      WHEN 'completed' THEN 'success'
      WHEN 'approved'  THEN 'success'
      WHEN 'rejected'  THEN 'alert'
      ELSE 'alert'
    END;

    -- Notify the project's client
    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (
        NEW.client_id,
        v_notif_type,
        'Project Update: ' || NEW.title,
        v_client_msg
      );
    END IF;

    -- Notify all admins
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT
      p.id,
      'system',
      'Project Status Changed',
      v_admin_msg
    FROM public.profiles p
    WHERE p.role = 'admin';

  END IF;
  RETURN NEW;
END;
$$;

-- Re-attach the trigger (CREATE OR REPLACE FUNCTION already replaces the body,
-- but we drop/recreate the trigger too to be safe)
DROP TRIGGER IF EXISTS trg_notify_project_status ON public.projects;
CREATE TRIGGER trg_notify_project_status
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_project_status_change();
