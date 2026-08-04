-- =============================================================================
-- Expense line items on time entries
-- =============================================================================
-- Optional per-day expenses with note, amount (reimbursement), and optional
-- additional billable hours rolled into the hours payment total.
-- =============================================================================

CREATE TABLE care_hours.time_entry_expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id  uuid NOT NULL REFERENCES care_hours.time_entries (id) ON DELETE CASCADE,
  hours          numeric(4, 2) NOT NULL DEFAULT 0,
  note           text NOT NULL,
  amount         numeric(10, 2) NOT NULL CHECK (amount > 0),
  payment_id     uuid REFERENCES care_hours.payments (id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (hours >= 0 AND hours <= 24),
  CHECK (mod(hours * 4, 1) = 0)
);

CREATE INDEX idx_time_entry_expenses_entry
  ON care_hours.time_entry_expenses (time_entry_id);

CREATE INDEX idx_time_entry_expenses_unpaid
  ON care_hours.time_entry_expenses (time_entry_id)
  WHERE payment_id IS NULL;

CREATE TRIGGER time_entry_expenses_set_updated_at
  BEFORE UPDATE ON care_hours.time_entry_expenses
  FOR EACH ROW EXECUTE FUNCTION care_hours.set_updated_at();

-- Reimbursement total stored separately from hourly pay amount.
ALTER TABLE care_hours.payments
  ADD COLUMN IF NOT EXISTS total_reimbursement numeric(10, 2) NOT NULL DEFAULT 0
    CHECK (total_reimbursement >= 0);

-- Enforce max 24 billable hours per day (worked + expense hours).
CREATE OR REPLACE FUNCTION care_hours.check_time_entry_total_hours()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_work_date date;
  v_caregiver_id uuid;
  v_worked_hours numeric(4, 2);
  v_expense_hours numeric(8, 2);
  v_entry_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'time_entries' THEN
    v_entry_id := COALESCE(NEW.id, OLD.id);
    SELECT work_date, caregiver_id, hours
    INTO v_work_date, v_caregiver_id, v_worked_hours
    FROM care_hours.time_entries
    WHERE id = v_entry_id;
  ELSE
    v_entry_id := COALESCE(NEW.time_entry_id, OLD.time_entry_id);
    SELECT work_date, caregiver_id, hours
    INTO v_work_date, v_caregiver_id, v_worked_hours
    FROM care_hours.time_entries
    WHERE id = v_entry_id;
  END IF;

  SELECT COALESCE(SUM(hours), 0)
  INTO v_expense_hours
  FROM care_hours.time_entry_expenses
  WHERE time_entry_id = v_entry_id;

  IF v_worked_hours + v_expense_hours > 24 THEN
    RAISE EXCEPTION 'Total billable hours for the day cannot exceed 24 (%.2f worked + %.2f expense).',
      v_worked_hours, v_expense_hours;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER time_entries_check_total_hours
  AFTER INSERT OR UPDATE OF hours ON care_hours.time_entries
  FOR EACH ROW EXECUTE FUNCTION care_hours.check_time_entry_total_hours();

CREATE TRIGGER time_entry_expenses_check_total_hours
  AFTER INSERT OR UPDATE OR DELETE ON care_hours.time_entry_expenses
  FOR EACH ROW EXECUTE FUNCTION care_hours.check_time_entry_total_hours();

-- ---------------------------------------------------------------------------
-- mark_entries_paid: include expense hours in hourly pay; track reimbursement
-- ---------------------------------------------------------------------------

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
  v_total_reimbursement numeric(10, 2);
  v_entry record;
  v_billable_hours numeric(8, 2);
BEGIN
  IF NOT care_hours.is_admin() THEN
    RAISE EXCEPTION 'Only admins can mark entries paid';
  END IF;

  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'period_end must be on or after period_start';
  END IF;

  SELECT COALESCE(SUM(
    te.hours + COALESCE((
      SELECT SUM(tee.hours)
      FROM care_hours.time_entry_expenses tee
      WHERE tee.time_entry_id = te.id
    ), 0)
  ), 0)
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
    SELECT COALESCE(SUM(tee.hours), 0)
    INTO v_billable_hours
    FROM care_hours.time_entry_expenses tee
    WHERE tee.time_entry_id = v_entry.id;

    v_billable_hours := v_entry.hours + v_billable_hours;

    v_total_amount := v_total_amount + (
      v_billable_hours * care_hours.get_effective_rate(p_caregiver_id, v_entry.work_date)
    );
  END LOOP;

  SELECT COALESCE(SUM(tee.amount), 0)
  INTO v_total_reimbursement
  FROM care_hours.time_entry_expenses tee
  JOIN care_hours.time_entries te ON te.id = tee.time_entry_id
  WHERE te.caregiver_id = p_caregiver_id
    AND te.work_date BETWEEN p_period_start AND p_period_end
    AND te.payment_id IS NULL;

  INSERT INTO care_hours.payments (
    caregiver_id,
    period_start,
    period_end,
    total_hours,
    hourly_rate,
    total_amount,
    total_reimbursement,
    paid_by,
    notes
  ) VALUES (
    p_caregiver_id,
    p_period_start,
    p_period_end,
    v_total_hours,
    round(v_total_amount / v_total_hours, 2),
    round(v_total_amount, 2),
    round(v_total_reimbursement, 2),
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

  UPDATE care_hours.time_entry_expenses tee
  SET payment_id = v_payment.id
  FROM care_hours.time_entries te
  WHERE tee.time_entry_id = te.id
    AND te.caregiver_id = p_caregiver_id
    AND te.work_date BETWEEN p_period_start AND p_period_end
    AND tee.payment_id IS NULL;

  RETURN v_payment;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE care_hours.time_entry_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY time_entry_expenses_select_own
  ON care_hours.time_entry_expenses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM care_hours.time_entries te
      WHERE te.id = time_entry_id
        AND te.caregiver_id = auth.uid()
        AND care_hours.is_caregiver()
    )
  );

CREATE POLICY time_entry_expenses_select_admin
  ON care_hours.time_entry_expenses FOR SELECT TO authenticated
  USING (care_hours.is_admin());

CREATE POLICY time_entry_expenses_insert_own
  ON care_hours.time_entry_expenses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM care_hours.time_entries te
      WHERE te.id = time_entry_id
        AND te.caregiver_id = auth.uid()
        AND care_hours.is_caregiver()
        AND NOT care_hours.is_entry_locked(te.work_date, te.payment_id)
    )
  );

CREATE POLICY time_entry_expenses_update_own
  ON care_hours.time_entry_expenses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM care_hours.time_entries te
      WHERE te.id = time_entry_id
        AND te.caregiver_id = auth.uid()
        AND care_hours.is_caregiver()
        AND NOT care_hours.is_entry_locked(te.work_date, te.payment_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM care_hours.time_entries te
      WHERE te.id = time_entry_id
        AND te.caregiver_id = auth.uid()
        AND NOT care_hours.is_entry_locked(te.work_date, te.payment_id)
    )
  );

CREATE POLICY time_entry_expenses_delete_own
  ON care_hours.time_entry_expenses FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM care_hours.time_entries te
      WHERE te.id = time_entry_id
        AND te.caregiver_id = auth.uid()
        AND care_hours.is_caregiver()
        AND te.payment_id IS NULL
        AND NOT care_hours.is_entry_locked(te.work_date, NULL)
    )
  );

CREATE POLICY time_entry_expenses_write_admin
  ON care_hours.time_entry_expenses FOR ALL TO authenticated
  USING (care_hours.is_admin())
  WITH CHECK (care_hours.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON care_hours.time_entry_expenses TO authenticated;
