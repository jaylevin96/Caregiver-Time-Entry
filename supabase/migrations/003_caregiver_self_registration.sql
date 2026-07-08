-- =============================================================================
-- Time Tracker — Caregiver self-registration
-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor (after 001 and 002).
--
-- Also enable email sign-ups: Authentication → Providers → Email → Enable signups
--
-- New auth users automatically get care_hours.profiles with role = 'caregiver'.
-- Admins are never self-assigned; promote via set_user_role() only.
-- =============================================================================

-- Auto-create caregiver profile when a new auth user is created.
CREATE OR REPLACE FUNCTION care_hours.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = care_hours, auth, public
AS $$
BEGIN
  INSERT INTO care_hours.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    ),
    'caregiver'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_care_hours ON auth.users;

CREATE TRIGGER on_auth_user_created_care_hours
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION care_hours.handle_new_auth_user();

-- For existing auth users signing in without a care_hours profile yet.
CREATE OR REPLACE FUNCTION care_hours.ensure_caregiver_profile()
RETURNS care_hours.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = care_hours, auth, public
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_profile care_hours.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile
  FROM care_hours.profiles
  WHERE id = auth.uid();

  IF FOUND THEN
    RETURN v_profile;
  END IF;

  SELECT * INTO v_user
  FROM auth.users
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  INSERT INTO care_hours.profiles (id, email, display_name, role)
  VALUES (
    v_user.id,
    COALESCE(v_user.email, ''),
    COALESCE(
      NULLIF(trim(v_user.raw_user_meta_data->>'display_name'), ''),
      split_part(COALESCE(v_user.email, 'user'), '@', 1)
    ),
    'caregiver'
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_profile;

  IF v_profile IS NULL THEN
    SELECT * INTO v_profile
    FROM care_hours.profiles
    WHERE id = auth.uid();
  END IF;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION care_hours.ensure_caregiver_profile() TO authenticated;
