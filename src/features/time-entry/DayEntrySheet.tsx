import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { HoursInput } from '@/features/time-entry/HoursInput';
import { getLastHours, saveLastHours } from '@/features/time-entry/last-hours';
import { db } from '@/lib/supabase';
import {
  entryHours,
  formatDisplayDate,
  formatHoursReadable,
  formatWeekEndLabel,
  getChicagoDateString,
  endOfPayrollWeek,
  isValidQuarterHours,
} from '@/lib/utils/dates';
import { formatCurrency } from '@/lib/utils/payment-format';
import {
  canEditEntry,
  getDayEntryStatus,
  getStatusLabel,
} from '@/lib/utils/entry-status';
import type { TimeEntry } from '@/types/database';

interface DayEntrySheetProps {
  open: boolean;
  workDate: string | null;
  entry: TimeEntry | undefined;
  caregiverId: string;
  actorId?: string;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function parseExpenseDraft(value: string): number | null {
  const trimmed = value.trim().replace(/[$,]/g, '');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

function formatExpenseDraft(amount: number | null | undefined): string {
  if (!amount || amount <= 0) return '';
  return String(amount);
}

export function DayEntrySheet({
  open,
  workDate,
  entry,
  caregiverId,
  actorId,
  readOnly = false,
  onClose,
  onSaved,
}: DayEntrySheetProps) {
  const userId = actorId ?? caregiverId;
  const [hours, setHours] = useState(0);
  const [expenseDraft, setExpenseDraft] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = workDate ? getDayEntryStatus(workDate, entry) : 'empty';
  const editable =
    !readOnly && (workDate ? canEditEntry(workDate, entry) : false);
  const badge = getStatusLabel(status);
  const expenseAmount = parseExpenseDraft(expenseDraft);
  const hasHours = hours > 0 && isValidQuarterHours(hours);
  const hasExpense = expenseAmount !== null && expenseAmount > 0;
  const hasInvalidHours = hours > 0 && !isValidQuarterHours(hours);
  const canSave = (hasHours || hasExpense) && !hasInvalidHours;

  useEffect(() => {
    if (!open) return;
    const canEdit =
      !readOnly && (workDate ? canEditEntry(workDate, entry) : false);
    setHours(entry ? entryHours(entry.hours) : canEdit ? getLastHours() : 0);
    setExpenseDraft(formatExpenseDraft(entry?.expense_amount));
    setNotes(entry?.notes ?? '');
    setError(null);
    setSaved(false);
    setConfirmDelete(false);
  }, [open, entry, workDate, readOnly]);

  if (!workDate) return null;

  async function handleSave() {
    if (!editable) return;

    if (hasInvalidHours) {
      setError('Enter hours in 0.25 increments (max 24).');
      return;
    }

    if (!canSave) {
      setError('Enter hours, an expense amount, or both.');
      return;
    }

    const payload = {
      hours: hasHours ? hours : null,
      expense_amount: hasExpense ? expenseAmount : null,
      notes: notes.trim() || null,
      updated_by: userId,
    };

    setSubmitting(true);
    setError(null);

    if (entry) {
      const { error: updateError } = await db
        .from('time_entries')
        .update(payload)
        .eq('id', entry.id);

      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }
    } else {
      const { error: insertError } = await db.from('time_entries').insert({
        caregiver_id: caregiverId,
        work_date: workDate,
        created_by: userId,
        ...payload,
      });

      if (insertError) {
        setError(insertError.message);
        setSubmitting(false);
        return;
      }
    }

    if (hasHours) {
      saveLastHours(hours);
    }
    setSubmitting(false);
    setSaved(true);
    onSaved();

    window.setTimeout(() => {
      onClose();
    }, 500);
  }

  async function handleDelete() {
    if (!entry || !editable) return;

    setSubmitting(true);
    setError(null);

    const { error: deleteError } = await db
      .from('time_entries')
      .delete()
      .eq('id', entry.id);

    if (deleteError) {
      setError(deleteError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSaved();
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={formatDisplayDate(workDate)}>
      <div className="space-y-5">
        {badge ? (
          <span
            className={[
              'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
              status === 'paid'
                ? 'bg-success/10 text-success'
                : 'bg-surface text-text-muted border-border border',
            ].join(' ')}
          >
            {badge}
          </span>
        ) : null}

        {editable ? (
          <>
            <div>
              <p className="text-text-muted mb-2 text-sm font-medium">
                Hours worked <span className="font-normal">(optional)</span>
              </p>
              <HoursInput
                value={hours}
                onChange={setHours}
                disabled={submitting}
                optional
              />
            </div>

            <label className="block">
              <span className="text-text-muted mb-1.5 block text-sm font-medium">
                Expense reimbursement <span className="font-normal">(optional)</span>
              </span>
              <div className="relative">
                <span className="text-text-muted pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  value={expenseDraft}
                  onChange={(event) => setExpenseDraft(event.target.value)}
                  placeholder="0.00"
                  disabled={submitting}
                  className="border-border bg-surface-raised focus:border-accent focus:ring-accent/20 w-full rounded-xl border py-3 pr-4 pl-8 text-base outline-none focus:ring-2 disabled:opacity-50"
                />
              </div>
              <p className="text-text-muted mt-1.5 text-xs">
                Enter hours, an expense amount, or both.
              </p>
            </label>

            <label className="block">
              <span className="text-text-muted mb-1.5 block text-sm font-medium">
                Notes (optional)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Morning shift, gas receipt"
                disabled={submitting}
                className="border-border bg-surface-raised focus:border-accent focus:ring-accent/20 w-full resize-none rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 disabled:opacity-50"
              />
            </label>

            {error ? <ErrorBanner message={error} /> : null}

            {hasInvalidHours ? (
              <p className="text-danger text-center text-xs" role="alert">
                Use 0.25-hour steps (e.g. 4, 4.25, 4.5).
              </p>
            ) : null}

            <div className="space-y-2">
              <Button
                fullWidth
                disabled={submitting || saved || !canSave}
                onClick={handleSave}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <InlineSpinner size="sm" />
                    Saving…
                  </span>
                ) : saved ? (
                  'Saved!'
                ) : entry ? (
                  'Save changes'
                ) : (
                  'Save entry'
                )}
              </Button>

              {entry ? (
                confirmDelete ? (
                  <div className="border-danger/20 bg-danger/5 space-y-2 rounded-xl border p-3">
                    <p className="text-sm font-medium">Delete this day&apos;s entry?</p>
                    <p className="text-text-muted text-sm">This cannot be undone.</p>
                    <div className="flex gap-2">
                      <Button
                        fullWidth
                        variant="danger"
                        disabled={submitting}
                        onClick={handleDelete}
                      >
                        {submitting ? 'Deleting…' : 'Yes, delete'}
                      </Button>
                      <Button
                        fullWidth
                        variant="secondary"
                        disabled={submitting}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    fullWidth
                    variant="ghost"
                    disabled={submitting || saved}
                    onClick={() => setConfirmDelete(true)}
                    className="text-danger hover:bg-danger/5 hover:text-danger"
                  >
                    Delete entry
                  </Button>
                )
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {entry ? (
              <>
                {entryHours(entry.hours) > 0 ? (
                  <div className="border-border bg-surface rounded-2xl border p-4">
                    <p className="text-text-muted text-sm">Hours</p>
                    <p className="text-2xl font-semibold">
                      {formatHoursReadable(entryHours(entry.hours))}
                    </p>
                  </div>
                ) : null}
                {entry.expense_amount && entry.expense_amount > 0 ? (
                  <div className="border-border bg-surface rounded-2xl border p-4">
                    <p className="text-text-muted text-sm">Expense reimbursement</p>
                    <p className="text-2xl font-semibold">
                      {formatCurrency(entry.expense_amount)}
                    </p>
                  </div>
                ) : null}
                {entry.notes ? (
                  <div>
                    <p className="text-text-muted text-sm">Notes</p>
                    <p className="text-base">{entry.notes}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-text-muted text-sm">
                {status === 'locked'
                  ? 'This day is locked — no entry was recorded before the payroll deadline.'
                  : status === 'future'
                    ? `You can only log hours through ${formatWeekEndLabel(endOfPayrollWeek(getChicagoDateString()))}.`
                    : 'No entry recorded for this day.'}
              </p>
            )}
            <Button fullWidth variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
