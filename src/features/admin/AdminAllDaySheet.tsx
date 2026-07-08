import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { db } from '@/lib/supabase';
import { formatDisplayDate, formatHours } from '@/lib/utils/dates';
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

  const caregiverNames = new Map(
    caregivers.map((caregiver) => [caregiver.id, caregiver.display_name]),
  );

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

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
          No hours logged for this day.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-accent text-center text-2xl font-bold tabular-nums">
            {formatHours(totalHours)}h total
          </p>

          <ul className="space-y-2">
            {entries.map((entry) => {
              const status = workDate
                ? getDayEntryStatus(workDate, entry)
                : 'editable';
              const badge = getStatusLabel(status);

              return (
                <li
                  key={entry.id}
                  className={[
                    'border-border flex items-center justify-between gap-3 rounded-xl border px-4 py-3',
                    status === 'paid' ? 'bg-success/5' : 'bg-surface-raised',
                  ].join(' ')}
                >
                  <span className="font-medium">
                    {caregiverNames.get(entry.caregiver_id) ?? 'Unknown'}
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
                    <span className="text-accent font-bold tabular-nums">
                      {formatHours(entry.hours)}h
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </BottomSheet>
  );
}
