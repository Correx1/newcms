-- ==============================================================================
-- MIGRATION: Precise Status Change Notifications for All Roles
-- Upgrades the trg_notify_project_status to emit tailored exact alerts for
-- Assigned Staff, Client, and Admins dynamically.
-- ==============================================================================

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
  v_staff_msg   TEXT;
  v_notif_type  TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    -- Look up who triggered this change (the currently authenticated user)
    SELECT COALESCE(name, email, 'Someone')
      INTO v_actor_name
      FROM public.profiles
     WHERE id = auth.uid();

    -- Build human-readable messages tailored specifically for the Client
    v_client_msg := CASE NEW.status
      WHEN 'completed' THEN v_actor_name || ' submitted deliverables for "' || NEW.title || '"'
      WHEN 'approved'  THEN 'You approved "' || NEW.title || '"'
      WHEN 'rejected'  THEN 'You requested revisions on "' || NEW.title || '"'
      WHEN 'active'    THEN 'Work has started on your project "' || NEW.title || '"'
      WHEN 'pending'   THEN 'Your project "' || NEW.title || '" was set to pending'
      ELSE              'Status for "' || NEW.title || '" was updated to ' || NEW.status
    END;

    -- Tailored message for Admins overview
    v_admin_msg := CASE NEW.status
      WHEN 'completed' THEN v_actor_name || ' delivered "' || NEW.title || '"'
      WHEN 'approved'  THEN 'Client approved "' || NEW.title || '"'
      WHEN 'rejected'  THEN 'Client requested revisions on "' || NEW.title || '"'
      WHEN 'active'    THEN 'Project "' || NEW.title || '" activated'
      WHEN 'pending'   THEN 'Project "' || NEW.title || '" moved to pending'
      ELSE              v_actor_name || ' changed "' || NEW.title || '" → ' || NEW.status
    END;

    -- Tailored message strictly for Assigned Staff
    v_staff_msg := CASE NEW.status
      WHEN 'completed' THEN 'Deliverables submitted for "' || NEW.title || '"'
      WHEN 'approved'  THEN 'Client approved "' || NEW.title || '"!'
      WHEN 'rejected'  THEN 'Client requested revisions on "' || NEW.title || '"'
      WHEN 'active'    THEN 'Project "' || NEW.title || '" is now active.'
      WHEN 'pending'   THEN 'Project "' || NEW.title || '" was set to pending.'
      ELSE              'Project "' || NEW.title || '" status changed to ' || NEW.status
    END;

    v_notif_type := CASE NEW.status
      WHEN 'completed' THEN 'success'
      WHEN 'approved'  THEN 'success'
      WHEN 'rejected'  THEN 'alert'
      ELSE 'system'
    END;

    -- 1. Notify the client (skip if the client themself performed the action)
    IF NEW.client_id IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.client_id THEN
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (NEW.client_id, v_notif_type, 'Project Update', v_client_msg);
    END IF;

    -- 2. Notify admins (skip if the admin themself performed the action)
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT p.id, 'system', 'Project Status Update', v_admin_msg
    FROM public.profiles p
    WHERE p.role = 'admin' AND p.id IS DISTINCT FROM auth.uid();

    -- 3. Notify assigned staff actively on the project (skip if they performed the action)
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT pa.user_id, v_notif_type, 'Project Update', v_staff_msg
    FROM public.project_assignments pa
    WHERE pa.project_id = NEW.id AND pa.user_id IS DISTINCT FROM auth.uid();

  END IF;
  RETURN NEW;
END;
$$;
