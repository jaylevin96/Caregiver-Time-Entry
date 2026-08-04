-- =============================================================================
-- Time Tracker — Deactivate users (admin only)
-- =============================================================================
-- Soft-deactivates a profile (is_active = false). Inactive users lose app access
-- via RLS helpers and see "Account inactive" in the UI. Historical entries and
-- payments are preserved. There is no admin reactivate — a former caregiver
-- who needs access again should create a new account.
-- =============================================================================

CREATE OR REPLACE FUNCTION care_hours.deactivate_user(p_user_id uuid)
RETURNS care_hours.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = care_hours
AS $$
DECLARE
  v_profile care_hours.profiles;
  v_admin_count integer;
BEGIN
  IF NOT care_hours.is_admin() THEN
    RAISE EXCEPTION 'Only admins can deactivate users';
  END IF;

  -- Prevent removing the last active admin (including self).
  SELECT count(*) INTO v_admin_count
  FROM care_hours.profiles
  WHERE role = 'admin' AND is_active = true;

  IF EXISTS (
    SELECT 1
    FROM care_hours.profiles
    WHERE id = p_user_id AND role = 'admin' AND is_active = true
  ) AND v_admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot deactivate the last active admin';
  END IF;

  UPDATE care_hours.profiles
  SET is_active = false, updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Time Tracker profile not found for this user';
  END IF;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION care_hours.deactivate_user(uuid) TO authenticated;
