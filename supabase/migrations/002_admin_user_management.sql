-- =============================================================================
-- Care Hours — Admin user & role management
-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor (after 001_care_hours_schema.sql).
--
-- Admins can:
--   • Link an existing auth.users account to care_hours (caregiver or admin)
--   • Promote/demote users between caregiver and admin
-- =============================================================================

-- Link an auth user to the care hours app (admin only).
-- The auth user must already exist (Authentication → Users).
CREATE OR REPLACE FUNCTION care_hours.create_care_hours_profile(
  p_user_id uuid,
  p_email text,
  p_display_name text,
  p_role text DEFAULT 'caregiver'
)
RETURNS care_hours.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = care_hours
AS $$
DECLARE
  v_profile care_hours.profiles;
BEGIN
  IF NOT care_hours.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create care hours profiles';
  END IF;

  IF p_role NOT IN ('caregiver', 'admin') THEN
    RAISE EXCEPTION 'role must be caregiver or admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'auth user not found — create the user in Authentication first';
  END IF;

  INSERT INTO care_hours.profiles (id, email, display_name, role)
  VALUES (p_user_id, p_email, p_display_name, p_role)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    is_active = true,
    updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

-- Change a user's role (admin only). Use to promote caregivers to admin.
CREATE OR REPLACE FUNCTION care_hours.set_user_role(
  p_user_id uuid,
  p_role text
)
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
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  IF p_role NOT IN ('caregiver', 'admin') THEN
    RAISE EXCEPTION 'role must be caregiver or admin';
  END IF;

  IF p_user_id = auth.uid() AND p_role = 'caregiver' THEN
    SELECT count(*) INTO v_admin_count
    FROM care_hours.profiles
    WHERE role = 'admin' AND is_active = true;

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last active admin';
    END IF;
  END IF;

  UPDATE care_hours.profiles
  SET role = p_role, updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'care hours profile not found for this user';
  END IF;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION care_hours.create_care_hours_profile(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION care_hours.set_user_role(uuid, text) TO authenticated;
