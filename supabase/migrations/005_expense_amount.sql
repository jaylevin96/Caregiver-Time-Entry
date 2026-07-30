-- Optional expense reimbursement on time entries; separate pay-tab totals.

ALTER TABLE care_hours.time_entries
  ALTER COLUMN hours DROP NOT NULL;

ALTER TABLE care_hours.time_entries
  ADD COLUMN IF NOT EXISTS expense_amount numeric(10, 2)
    CHECK (expense_amount IS NULL OR expense_amount > 0);

ALTER TABLE care_hours.time_entries
  DROP CONSTRAINT IF EXISTS time_entries_hours_check;

ALTER TABLE care_hours.time_entries
  ADD CONSTRAINT time_entries_hours_check
    CHECK (
      hours IS NULL
      OR (hours > 0 AND hours <= 24 AND mod(hours * 4, 1) = 0)
    );

ALTER TABLE care_hours.time_entries
  ADD CONSTRAINT time_entries_has_value
    CHECK (
      (hours IS NOT NULL AND hours > 0)
      OR (expense_amount IS NOT NULL AND expense_amount > 0)
    );

ALTER TABLE care_hours.payments
  ADD COLUMN IF NOT EXISTS total_reimbursement numeric(10, 2) NOT NULL DEFAULT 0
    CHECK (total_reimbursement >= 0);

ALTER TABLE care_hours.payments
  DROP CONSTRAINT IF EXISTS payments_total_hours_check;

ALTER TABLE care_hours.payments
  ADD CONSTRAINT payments_total_hours_check
    CHECK (total_hours >= 0);

ALTER TABLE care_hours.payments
  DROP CONSTRAINT IF EXISTS payments_total_amount_check;

ALTER TABLE care_hours.payments
  ADD CONSTRAINT payments_has_value
    CHECK (total_hours > 0 OR total_reimbursement > 0);

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
  v_total_reimbursement numeric(10, 2);
  v_hours_pay numeric(10, 2);
  v_entry record;
BEGIN
  IF NOT care_hours.is_admin() THEN
    RAISE EXCEPTION 'Only admins can mark entries paid';
  END IF;

  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'period_end must be on or after period_start';
  END IF;

  SELECT
    COALESCE(SUM(te.hours), 0),
    COALESCE(SUM(te.expense_amount), 0)
  INTO v_total_hours, v_total_reimbursement
  FROM care_hours.time_entries te
  WHERE te.caregiver_id = p_caregiver_id
    AND te.work_date BETWEEN p_period_start AND p_period_end
    AND te.payment_id IS NULL;

  IF v_total_hours = 0 AND v_total_reimbursement = 0 THEN
    RAISE EXCEPTION 'No unpaid entries in the selected date range';
  END IF;

  v_hours_pay := 0;
  FOR v_entry IN
    SELECT te.id, te.hours, te.work_date
    FROM care_hours.time_entries te
    WHERE te.caregiver_id = p_caregiver_id
      AND te.work_date BETWEEN p_period_start AND p_period_end
      AND te.payment_id IS NULL
      AND te.hours IS NOT NULL
      AND te.hours > 0
  LOOP
    v_hours_pay := v_hours_pay + (
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
    total_reimbursement,
    paid_by,
    notes
  ) VALUES (
    p_caregiver_id,
    p_period_start,
    p_period_end,
    v_total_hours,
    CASE
      WHEN v_total_hours > 0 THEN round(v_hours_pay / v_total_hours, 2)
      ELSE 0
    END,
    round(v_hours_pay + v_total_reimbursement, 2),
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

  RETURN v_payment;
END;
$$;
