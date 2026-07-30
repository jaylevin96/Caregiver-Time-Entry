import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { db } from '@/lib/supabase';
import { textColorForBackground } from '@/lib/utils/calendar-colors';
import {
  entryHours,
  formatDisplayDate,
  formatHours,
  formatHoursReadable,
} from '@/lib/utils/dates';
import { formatCurrency } from '@/lib/utils/payment-format';
import { getDayEntryStatus, getStatusLabel } from '@/lib/utils/entry-status';
import type { Profile, TimeEntry } from '@/types/database';

interface AdminAllDaySheetProps {
  open: boolean;
  workDate: string | null;
  caregivers: Profile[];
  onClose: () => void;
}

export function AdminAllDaySheet({
  open,
  workDate,
  caregivers,
  onClose,
}: AdminAllDaySheetProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !workDate) {
      setEntries([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data, error } = await db
        .from('time_entries')
        .select('*')
        .eq('work_date', workDate)
        .order('caregiver_id');

      if (cancelled) return;

      if (error) {
        setEntries([]);
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
    (sum, entry) => sum + entryHours(entry.hours),
    0,
  );
  const totalReimbursement = entries.reduce(
    (sum, entry) => sum + (entry.expense_amount ?? 0),
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
      ) : entries.length === 0 ? (
        <p className="text-text-muted py-4 text-center text-sm">
          No entries logged for this day.
        </p>
      ) : (
        <div className="space-y-4">
          {totalHours > 0 ? (
            <p className="text-accent text-center text-xl font-bold">
              {formatHoursReadable(totalHours)} total
            </p>
          ) : null}

          <ul className="space-y-2">
            {entries.map((entry) => {
              const caregiver = caregiverById.get(entry.caregiver_id);
              const color = caregiver?.calendar_color ?? '#2563eb';
              const status = workDate
                ? getDayEntryStatus(workDate, entry)
                : 'editable';
              const badge = getStatusLabel(status);
              const hours = entryHours(entry.hours);

              return (
                <li
                  key={entry.id}
                  className={[
                    'border-border flex items-center justify-between gap-3 rounded-xl border px-4 py-3',
                    status === 'paid' ? 'bg-success/5' : 'bg-surface-raised',
                  ].join(' ')}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <span className="font-medium">
                        {caregiver?.display_name ?? 'Unknown'}
                      </span>
                      {entry.expense_amount && entry.expense_amount > 0 ? (
                        <p className="text-text-muted text-sm">
                          Reimbursement {formatCurrency(entry.expense_amount)}
                        </p>
                      ) : null}
                    </div>
                  </div>
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
                    {hours > 0 ? (
                      <span
                        className="rounded-full px-2.5 py-1 text-sm font-bold tabular-nums"
                        style={{
                          backgroundColor: color,
                          color: textColorForBackground(color),
                        }}
                      >
                        {formatHours(hours)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {totalReimbursement > 0 ? (
            <p className="text-text-muted text-center text-sm">
              Reimbursements: {formatCurrency(totalReimbursement)}
            </p>
          ) : null}
        </div>
      )}
    </BottomSheet>
  );
}
