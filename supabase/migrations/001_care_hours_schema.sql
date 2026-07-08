-- =============================================================================
-- Care Hours App — Schema, Functions, and RLS
-- =============================================================================
-- Run this in Supabase Dashboard → SQL Editor.
-- Safe to combine with other apps: everything lives in the `care_hours` schema
-- (separate from public.profiles, reservations, etc.).
--
-- After running:
--   1. Expose the schema: Project Settings → API → Exposed schemas → add care_hours
--   2. Follow docs/SUPABASE_SETUP.md to create users and seed profiles
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS care_hours;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE care_hours.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email        text NOT NULL,
  display_name text NOT NULL,
  role         text NOT NULL CHECK (role IN ('caregiver', 'admin')),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE care_hours.caregiver_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id   uuid NOT NULL REFERENCES care_hours.profiles (id) ON DELETE CASCADE,
  hourly_rate    numeric(8, 2) NOT NULL CHECK (hourly_rate > 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (caregiver_id, effective_from)
);

CREATE TABLE care_hours.payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id  uuid NOT NULL REFERENCES care_hours.profiles (id) ON DELETE RESTRICT,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  total_hours   numeric(8, 2) NOT NULL CHECK (total_hours > 0),
  hourly_rate   numeric(8, 2) NOT NULL CHECK (hourly_rate > 0),
  total_amount  numeric(10, 2) NOT NULL CHECK (total_amount > 0),
  paid_at       timestamptz NOT NULL DEFAULT now(),
  paid_by       uuid NOT NULL REFERENCES care_hours.profiles (id) ON DELETE RESTRICT,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE care_hours.time_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL REFERENCES care_hours.profiles (id) ON DELETE CASCADE,
  work_date    date NOT NULL,
  hours        numeric(4, 2) NOT NULL,
  notes        text,
  payment_id   uuid REFERENCES care_hours.payments (id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid NOT NULL REFERENCES care_hours.profiles (id) ON DELETE RESTRICT,
  updated_by   uuid NOT NULL REFERENCES care_hours.profiles (id) ON DELETE RESTRICT,
  UNIQUE (caregiver_id, work_date),
  CHECK (hours > 0 AND hours <= 24),
  CHECK (mod(hours * 4, 1) = 0)
);

CREATE TABLE care_hours.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES care_hours.profiles (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_time_entries_caregiver_date
  ON care_hours.time_entries (caregiver_id, work_date);

CREATE INDEX idx_time_entries_unpaid
  ON care_hours.time_entries (caregiver_id, work_date)
  WHERE payment_id IS NULL;

CREATE INDEX idx_payments_caregiver
  ON care_hours.payments (caregiver_id, period_start, period_end);

CREATE INDEX idx_caregiver_rates_lookup
  ON care_hours.caregiver_rates (caregiver_id, effective_from DESC);

-- ---------------------------------------------------------------------------
-- Seed settings
-- ---------------------------------------------------------------------------

INSERT INTO care_hours.settings (key, value) VALUES
  ('default_hourly_rate', '30'),
  ('timezone', '"America/Chicago"'),
  ('payment_summary_template', '"{{start}} - {{end}}\n{{hours}} hours\n${{amount}}"');

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION care_hours.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON care_hours.profiles
  FOR EACH ROW EXECUTE FUNCTION care_hours.set_updated_at();

CREATE TRIGGER time_entries_set_updated_at
  BEFORE UPDATE ON care_hours.time_entries
  FOR EACH ROW EXECUTE FUNCTION care_hours.set_updated_at();

CREATE TRIGGER settings_set_updated_at
  BEFORE UPDATE ON care_hours.settings
  FOR EACH ROW EXECUTE FUNCTION care_hours.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies stay simple)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION care_hours.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = care_hours
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM care_hours.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION care_hours.is_caregiver()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = care_hours
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM care_hours.profiles
    WHERE id = auth.uid()
      AND role = 'caregiver'
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION care_hours.has_care_hours_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = care_hours
AS $$
  SELECT care_hours.is_admin() OR care_hours.is_caregiver();
$$;

-- ---------------------------------------------------------------------------
-- Business logic: rates, locking, payments
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION care_hours.get_default_hourly_rate()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = care_hours
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::numeric FROM care_hours.settings WHERE key = 'default_hourly_rate'),
    30
  );
$$;

CREATE OR REPLACE FUNCTION care_hours.get_effective_rate(
  p_caregiver_id uuid,
  p_work_date date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = care_hours
AS $$
  SELECT COALESCE(
    (
      SELECT cr.hourly_rate
      FROM care_hours.caregiver_rates cr
      WHERE cr.caregiver_id = p_caregiver_id
        AND cr.effective_from <= p_work_date
      ORDER BY cr.effective_from DESC
      LIMIT 1
    ),
    care_hours.get_default_hourly_rate()
  );
$$;

-- Payroll weeks run Monday–Sunday. A week locks at midnight (Chicago) on the
-- Wednesday of the following week.
CREATE OR REPLACE FUNCTION care_hours.payroll_lock_date(p_work_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (date_trunc('week', p_work_date::timestamp)::date + 9);
$$;

CREATE OR REPLACE FUNCTION care_hours.payroll_lock_at(p_work_date date)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT care_hours.payroll_lock_date(p_work_date)::timestamp AT TIME ZONE (
    SELECT COALESCE(value #>> '{}', 'America/Chicago')
    FROM care_hours.settings
    WHERE key = 'timezone'
  );
$$;

CREATE OR REPLACE FUNCTION care_hours.is_entry_locked(
  p_work_date date,
  p_payment_id uuid,
  p_as_of timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = care_hours
AS $$
  SELECT
    p_payment_id IS NOT NULL
    OR p_as_of >= care_hours.payroll_lock_at(p_work_date);
$$;

-- Admin-only: mark all unpaid entries in a date range as paid (one batch).
CREATE OR REPLACE FUNCTION care_hours.mark_entries_paid(
  p_caregiver_id uuid,
  p_period_start date,
  p_period_end date,
  p_notes text DEFAULT NULL
)
RETURNS care_hours.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = care_hours
AS $$
DECLARE
  v_payment care_hours.payments;
  v_total_hours numeric(8, 2);
  v_total_amount numeric(10, 2);
  v_entry record;
  v_entry_amount numeric(10, 2);
BEGIN
  IF NOT care_hours.is_admin() THEN
    RAISE EXCEPTION 'Only admins can mark entries paid';
  END IF;

  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'period_end must be on or after period_start';
  END IF;

  SELECT COALESCE(SUM(te.hours), 0)
  INTO v_total_hours
  FROM care_hours.time_entries te
  WHERE te.caregiver_id = p_caregiver_id
    AND te.work_date BETWEEN p_period_start AND p_period_end
    AND te.payment_id IS NULL;

  IF v_total_hours = 0 THEN
    RAISE EXCEPTION 'No unpaid entries in the selected date range';
  END IF;

  v_total_amount := 0;
  FOR v_entry IN
    SELECT te.id, te.hours, te.work_date
    FROM care_hours.time_entries te
    WHERE te.caregiver_id = p_caregiver_id
      AND te.work_date BETWEEN p_period_start AND p_period_end
      AND te.payment_id IS NULL
  LOOP
    v_total_amount := v_total_amount + (
      v_entry.hours * care_hours.get_effective_rate(p_caregiver_id, v_entry.work_date)
    );
  END LOOP;

  INSERT INTO care_hours.payments (
    caregiver_id,
    period_start,
    period_end,
    total_hours,
    hourly_rate,
    total_amount,
    paid_by,
    notes
  ) VALUES (
    p_caregiver_id,
    p_period_start,
    p_period_end,
    v_total_hours,
    round(v_total_amount / v_total_hours, 2),
    round(v_total_amount, 2),
    auth.uid(),
    p_notes
  )
  RETURNING * INTO v_payment;

  UPDATE care_hours.time_entries te
  SET
    payment_id = v_payment.id,
    updated_by = auth.uid()
  WHERE te.caregiver_id = p_caregiver_id
    AND te.work_date BETWEEN p_period_start AND p_period_end
    AND te.payment_id IS NULL;

  RETURN v_payment;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE care_hours.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_hours.caregiver_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_hours.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_hours.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_hours.settings ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own
  ON care_hours.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() AND care_hours.has_care_hours_access());

CREATE POLICY profiles_select_admin
  ON care_hours.profiles FOR SELECT TO authenticated
  USING (care_hours.is_admin());

CREATE POLICY profiles_update_own
  ON care_hours.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND care_hours.is_caregiver())
  WITH CHECK (id = auth.uid() AND role = 'caregiver');

CREATE POLICY profiles_insert_admin
  ON care_hours.profiles FOR INSERT TO authenticated
  WITH CHECK (care_hours.is_admin());

CREATE POLICY profiles_update_admin
  ON care_hours.profiles FOR UPDATE TO authenticated
  USING (care_hours.is_admin())
  WITH CHECK (care_hours.is_admin());

-- caregiver_rates
CREATE POLICY caregiver_rates_select_own
  ON care_hours.caregiver_rates FOR SELECT TO authenticated
  USING (caregiver_id = auth.uid() AND care_hours.is_caregiver());

CREATE POLICY caregiver_rates_select_admin
  ON care_hours.caregiver_rates FOR SELECT TO authenticated
  USING (care_hours.is_admin());

CREATE POLICY caregiver_rates_write_admin
  ON care_hours.caregiver_rates FOR ALL TO authenticated
  USING (care_hours.is_admin())
  WITH CHECK (care_hours.is_admin());

-- time_entries
CREATE POLICY time_entries_select_own
  ON care_hours.time_entries FOR SELECT TO authenticated
  USING (caregiver_id = auth.uid() AND care_hours.is_caregiver());

CREATE POLICY time_entries_select_admin
  ON care_hours.time_entries FOR SELECT TO authenticated
  USING (care_hours.is_admin());

CREATE POLICY time_entries_insert_own
  ON care_hours.time_entries FOR INSERT TO authenticated
  WITH CHECK (
    caregiver_id = auth.uid()
    AND care_hours.is_caregiver()
    AND NOT care_hours.is_entry_locked(work_date, NULL)
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
  );

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
  );

CREATE POLICY time_entries_delete_own
  ON care_hours.time_entries FOR DELETE TO authenticated
  USING (
    caregiver_id = auth.uid()
    AND care_hours.is_caregiver()
    AND payment_id IS NULL
    AND NOT care_hours.is_entry_locked(work_date, NULL)
  );

CREATE POLICY time_entries_write_admin
  ON care_hours.time_entries FOR ALL TO authenticated
  USING (care_hours.is_admin())
  WITH CHECK (care_hours.is_admin());

-- payments
CREATE POLICY payments_select_own
  ON care_hours.payments FOR SELECT TO authenticated
  USING (caregiver_id = auth.uid() AND care_hours.is_caregiver());

CREATE POLICY payments_select_admin
  ON care_hours.payments FOR SELECT TO authenticated
  USING (care_hours.is_admin());

CREATE POLICY payments_insert_admin
  ON care_hours.payments FOR INSERT TO authenticated
  WITH CHECK (care_hours.is_admin());

-- settings (admin only)
CREATE POLICY settings_select_admin
  ON care_hours.settings FOR SELECT TO authenticated
  USING (care_hours.is_admin());

CREATE POLICY settings_write_admin
  ON care_hours.settings FOR ALL TO authenticated
  USING (care_hours.is_admin())
  WITH CHECK (care_hours.is_admin());

-- ---------------------------------------------------------------------------
-- Grants (RLS still applies)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA care_hours TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA care_hours TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA care_hours TO authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA care_hours TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA care_hours
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA care_hours
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA care_hours
  GRANT EXECUTE ON FUNCTIONS TO authenticated;
