import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { HoursInput } from '@/features/time-entry/HoursInput';
import { getLastHours, saveLastHours } from '@/features/time-entry/last-hours';
import { db } from '@/lib/supabase';
import {
  formatDisplayDate,
  formatHours,
  formatWeekEndLabel,
  getChicagoDateString,
  endOfPayrollWeek,
  isValidQuarterHours,
} from '@/lib/utils/dates';
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
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = workDate ? getDayEntryStatus(workDate, entry) : 'empty';
  const editable =
    !readOnly && (workDate ? canEditEntry(workDate, entry) : false);
  const badge = getStatusLabel(status);

  useEffect(() => {
    if (!open) return;
    const canEdit =
      !readOnly && (workDate ? canEditEntry(workDate, entry) : false);
    setHours(entry?.hours ?? (canEdit ? getLastHours() : 0));
    setNotes(entry?.notes ?? '');
    setError(null);
    setSaved(false);
    setConfirmDelete(false);
  }, [open, entry, workDate, readOnly]);

  if (!workDate) return null;

  async function handleSave() {
    if (!editable) return;

    if (!isValidQuarterHours(hours)) {
      setError('Enter hours in 0.25 increments (max 24).');
      return;
    }

    setSubmitting(true);
    setError(null);

    if (entry) {
      const { error: updateError } = await db
        .from('time_entries')
        .update({
          hours,
          notes: notes.trim() || null,
          updated_by: userId,
        })
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
        hours,
        notes: notes.trim() || null,
        created_by: userId,
        updated_by: userId,
      });

      if (insertError) {
        setError(insertError.message);
        setSubmitting(false);
        return;
      }
    }

    saveLastHours(hours);
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
              <p className="text-text-muted mb-2 text-sm font-medium">Hours worked</p>
              <HoursInput value={hours} onChange={setHours} disabled={submitting} />
            </div>

            <label className="block">
              <span className="text-text-muted mb-1.5 block text-sm font-medium">
                Notes (optional)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Morning shift"
                disabled={submitting}
                className="border-border bg-surface-raised focus:border-accent focus:ring-accent/20 w-full resize-none rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 disabled:opacity-50"
              />
            </label>

            {error ? <ErrorBanner message={error} /> : null}

            <div className="space-y-2">
              <Button
                fullWidth
                disabled={submitting || saved || hours <= 0 || !isValidQuarterHours(hours)}
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
                  'Add hours'
                )}
              </Button>

              {entry ? (
                confirmDelete ? (
                  <div className="border-danger/20 bg-danger/5 space-y-2 rounded-xl border p-3">
                    <p className="text-sm font-medium">
                      Delete {formatHours(entry.hours)} hours for this day?
                    </p>
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
                <div className="border-border bg-surface rounded-2xl border p-4">
                  <p className="text-text-muted text-sm">Hours</p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatHours(entry.hours)}
                    <span className="text-text-muted ml-1 text-xl font-normal">h</span>
                  </p>
                </div>
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
                    : 'No hours recorded for this day.'}
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
