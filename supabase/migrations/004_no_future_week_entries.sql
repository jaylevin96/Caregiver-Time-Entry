-- =============================================================================
-- Time Tracker — Block time entry beyond the current payroll week
-- =============================================================================
-- Caregivers may not create or edit entries with work_date after the Sunday
-- of the current week (Mon–Sun, America/Chicago).
-- =============================================================================

CREATE OR REPLACE FUNCTION care_hours.current_payroll_week_end(
  p_as_of timestamptz DEFAULT now()
)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = care_hours
AS $$
  SELECT (
    date_trunc(
      'week',
      (
        p_as_of AT TIME ZONE (
          SELECT COALESCE(value #>> '{}', 'America/Chicago')
          FROM care_hours.settings
          WHERE key = 'timezone'
        )
      )::timestamp
    )::date + 6
  );
$$;

CREATE OR REPLACE FUNCTION care_hours.is_beyond_current_week(
  p_work_date date,
  p_as_of timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = care_hours
AS $$
  SELECT p_work_date > care_hours.current_payroll_week_end(p_as_of);
$$;

GRANT EXECUTE ON FUNCTION care_hours.current_payroll_week_end(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION care_hours.is_beyond_current_week(date, timestamptz) TO authenticated;

DROP POLICY IF EXISTS time_entries_insert_own ON care_hours.time_entries;
CREATE POLICY time_entries_insert_own
  ON care_hours.time_entries FOR INSERT TO authenticated
  WITH CHECK (
    caregiver_id = auth.uid()
    AND care_hours.is_caregiver()
    AND NOT care_hours.is_entry_locked(work_date, NULL)
    AND NOT care_hours.is_beyond_current_week(work_date)
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
  );

DROP POLICY IF EXISTS time_entries_update_own ON care_hours.time_entries;
CREATE POLICY time_entries_update_own
  ON care_hours.time_entries FOR UPDATE TO authenticated
  USING (
    caregiver_id = auth.uid()
    AND care_hours.is_caregiver()
    AND NOT care_hours.is_entry_locked(work_date, payment_id)
  )
  WITH CHECK (
    caregiver_id = auth.uid()
    AND NOT care_hours.is_entry_locked(work_date, payment_id)
    AND NOT care_hours.is_beyond_current_week(work_date)
  );

DROP POLICY IF EXISTS time_entries_delete_own ON care_hours.time_entries;
CREATE POLICY time_entries_delete_own
  ON care_hours.time_entries FOR DELETE TO authenticated
  USING (
    caregiver_id = auth.uid()
    AND care_hours.is_caregiver()
    AND payment_id IS NULL
    AND NOT care_hours.is_entry_locked(work_date, NULL)
    AND NOT care_hours.is_beyond_current_week(work_date)
  );
