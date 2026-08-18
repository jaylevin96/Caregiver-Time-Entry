-- =============================================================================
-- Time Tracker — Let deactivated users read their own profile
-- =============================================================================
-- Inactive users fail is_admin()/is_caregiver(), so the old own-profile SELECT
-- policy hid the row. The app then could not show "Account inactive" unless
-- ensure_caregiver_profile() ran. Own-row SELECT does not restore access to
-- hours, payments, or admin tools.
-- =============================================================================

DROP POLICY IF EXISTS profiles_select_own ON care_hours.profiles;

CREATE POLICY profiles_select_own
  ON care_hours.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
