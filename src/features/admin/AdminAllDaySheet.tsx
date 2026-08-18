import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { db } from '@/lib/supabase';
import { formatDisplayDate, formatHours } from '@/lib/utils/dates';
import {
  formatCompactExpense,
  getBillableHours,
  getExpenseReimbursement,
} from '@/lib/utils/expenses';
import { getDayEntryStatus, getStatusLabel } from '@/lib/utils/entry-status';
import type { Profile, TimeEntry, TimeEntryExpense } from '@/types/database';

interface AdminAllDaySheetProps {
  open: boolean;
  workDate: string | null;
  caregivers: Profile[];
  onClose: () => void;
  onSelectEntry: (entry: TimeEntry) => void;
}

export function AdminAllDaySheet({
  open,
  workDate,
  caregivers,
  onClose,
  onSelectEntry,
}: AdminAllDaySheetProps) {
  const [entries, setEntries] = useState<
    (TimeEntry & { time_entry_expenses?: TimeEntryExpense[] })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !workDate) {
      setEntries([]);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await db
        .from('time_entries')
        .select('*, time_entry_expenses(*)')
        .eq('work_date', workDate)
        .order('caregiver_id');

      if (cancelled) return;

      if (fetchError) {
        setEntries([]);
        setError(fetchError.message);
      } else {
        setEntries(data ?? []);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open, workDate]);

  const caregiverById = new Map(
    caregivers.map((caregiver) => [caregiver.id, caregiver]),
  );

  const totalHours = entries.reduce(
    (sum, entry) => sum + getBillableHours(entry, entry.time_entry_expenses),
    0,
  );
  const totalReimbursement = entries.reduce(
    (sum, entry) => sum + getExpenseReimbursement(entry.time_entry_expenses),
    0,
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={workDate ? formatDisplayDate(workDate) : 'Day details'}
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <InlineSpinner />
        </div>
      ) : error ? (
        <ErrorBanner message={error} />
      ) : entries.length === 0 ? (
        <p className="text-text-muted py-4 text-center text-sm">
          No hours logged for this day.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-accent text-2xl font-bold tabular-nums">
              {formatHours(totalHours)}h total
            </p>
            {totalReimbursement > 0 ? (
              <p className="text-text-muted mt-1 text-sm font-semibold tabular-nums">
                {formatCompactExpense(totalReimbursement)} reimbursement
              </p>
            ) : null}
          </div>

          <p className="text-text-muted text-center text-xs">
            Tap a caregiver to view hours and expenses
          </p>

          <ul className="space-y-2">
            {entries.map((entry) => {
              const status = workDate
                ? getDayEntryStatus(workDate, entry)
                : 'editable';
              const badge = getStatusLabel(status);
              const billableHours = getBillableHours(
                entry,
                entry.time_entry_expenses,
              );
              const reimbursement = getExpenseReimbursement(
                entry.time_entry_expenses,
              );
              const caregiver = caregiverById.get(entry.caregiver_id);
              const color = caregiver?.calendar_color ?? '#2563eb';
              const name = caregiver?.display_name ?? 'Unknown';

              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEntry(entry)}
                    aria-label={`View ${name}'s entry`}
                    className={[
                      'border-border flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left active:scale-[0.99]',
                      status === 'paid' ? 'bg-success/5' : 'bg-surface-raised',
                    ].join(' ')}
                  >
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{name}</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {badge ? (
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                            status === 'paid'
                              ? 'bg-success/15 text-success'
                              : 'bg-warning/15 text-warning',
                          ].join(' ')}
                        >
                          {badge}
                        </span>
                      ) : null}
                      <div className="text-right">
                        <span
                          className="font-bold tabular-nums"
                          style={{ color }}
                        >
                          {formatHours(billableHours)}h
                        </span>
                        {reimbursement > 0 ? (
                          <p className="text-text-muted text-xs font-semibold tabular-nums">
                            {formatCompactExpense(reimbursement)}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-text-muted text-xl leading-none" aria-hidden="true">
                        ›
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </BottomSheet>
  );
}
