import { entryHours, formatHoursReadable } from '@/lib/utils/dates';
import type { TimeEntry } from '@/types/database';

interface CalendarSummaryBarProps {
  label: string;
  entriesByDate: Record<string, TimeEntry>;
  dates: string[];
}

export function CalendarSummaryBar({
  label,
  entriesByDate,
  dates,
}: CalendarSummaryBarProps) {
  let totalHours = 0;
  let daysWithEntries = 0;

  for (const date of dates) {
    const entry = entriesByDate[date];
    if (entry) {
      totalHours += entryHours(entry.hours);
      daysWithEntries += 1;
    }
  }

  if (totalHours === 0) return null;

  return (
    <div className="bg-surface-raised border-border mx-3 mb-3 flex items-center justify-between rounded-xl border px-3 py-2 text-sm sm:mx-4">
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold tabular-nums">
        {formatHoursReadable(totalHours)}
        <span className="text-text-muted font-normal">
          {' '}
          · {daysWithEntries} {daysWithEntries === 1 ? 'day' : 'days'}
        </span>
      </span>
    </div>
  );
}
