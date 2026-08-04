import { formatHours } from '@/lib/utils/dates';
import {
  formatCompactExpense,
  getDisplayHours,
  getExpenseReimbursement,
} from '@/lib/utils/expenses';
import type { CalendarEntry } from '@/lib/utils/entry-status';

interface CalendarSummaryBarProps {
  label: string;
  entriesByDate: Record<string, CalendarEntry>;
  dates: string[];
}

export function CalendarSummaryBar({
  label,
  entriesByDate,
  dates,
}: CalendarSummaryBarProps) {
  let totalHours = 0;
  let totalReimbursement = 0;
  let daysWithEntries = 0;

  for (const date of dates) {
    const entry = entriesByDate[date];
    if (entry) {
      totalHours += getDisplayHours(entry);
      totalReimbursement += getExpenseReimbursement(entry.expenses);
      daysWithEntries += 1;
    }
  }

  if (totalHours === 0 && totalReimbursement === 0) return null;

  const summaryParts: string[] = [];
  if (totalHours > 0) summaryParts.push(`${formatHours(totalHours)}h`);
  if (totalReimbursement > 0) {
    summaryParts.push(formatCompactExpense(totalReimbursement));
  }

  return (
    <div className="bg-surface-raised border-border mx-3 mb-3 flex items-center justify-between rounded-xl border px-3 py-2 text-sm sm:mx-4">
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold tabular-nums">
        {summaryParts.join(' · ')}
        <span className="text-text-muted font-normal">
          {' '}
          · {daysWithEntries} {daysWithEntries === 1 ? 'day' : 'days'}
        </span>
      </span>
    </div>
  );
}
