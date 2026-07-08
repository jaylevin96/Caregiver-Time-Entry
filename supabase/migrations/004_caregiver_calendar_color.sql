-- =============================================================================
-- Care Hours — Caregiver calendar colors
-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor (after 001–003).
-- =============================================================================

ALTER TABLE care_hours.profiles
  ADD COLUMN IF NOT EXISTS calendar_color text;

UPDATE care_hours.profiles
SET calendar_color = (
  ARRAY[
    '#2563eb', '#dc2626', '#16a34a', '#9333ea',
    '#ea580c', '#0891b2', '#db2777', '#ca8a04'
  ]
)[1 + (abs(hashtext(id::text)) % 8)]
WHERE calendar_color IS NULL;

ALTER TABLE care_hours.profiles
  ALTER COLUMN calendar_color SET DEFAULT '#2563eb',
  ALTER COLUMN calendar_color SET NOT NULL;

ALTER TABLE care_hours.profiles
  DROP CONSTRAINT IF EXISTS profiles_calendar_color_format;

ALTER TABLE care_hours.profiles
  ADD CONSTRAINT profiles_calendar_color_format
  CHECK (calendar_color ~ '^#[0-9A-Fa-f]{6}$');

CREATE OR REPLACE FUNCTION care_hours.default_calendar_color(p_user_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    ARRAY[
      '#2563eb', '#dc2626', '#16a34a', '#9333ea',
      '#ea580c', '#0891b2', '#db2777', '#ca8a04'
    ]
  )[1 + (abs(hashtext(p_user_id::text)) % 8)];
$$;

CREATE OR REPLACE FUNCTION care_hours.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = care_hours, auth, public
AS $$
BEGIN
  INSERT INTO care_hours.profiles (id, email, display_name, role, calendar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    ),
    'caregiver',
    care_hours.default_calendar_color(NEW.id)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

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

  INSERT INTO care_hours.profiles (id, email, display_name, role, calendar_color)
  VALUES (
    v_user.id,
    COALESCE(v_user.email, ''),
    COALESCE(
      NULLIF(trim(v_user.raw_user_meta_data->>'display_name'), ''),
      split_part(COALESCE(v_user.email, 'user'), '@', 1)
    ),
    'caregiver',
    care_hours.default_calendar_color(v_user.id)
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

  INSERT INTO care_hours.profiles (id, email, display_name, role, calendar_color)
  VALUES (
    p_user_id,
    p_email,
    p_display_name,
    p_role,
    care_hours.default_calendar_color(p_user_id)
  )
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
