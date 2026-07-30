import {
  entryExpenseAmount,
  entryHasValue,
  entryHours,
  formatHoursReadable,
} from '@/lib/utils/dates';
import { formatCurrency } from '@/lib/utils/payment-format';
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
  let totalReimbursement = 0;
  let daysWithEntries = 0;

  for (const date of dates) {
    const entry = entriesByDate[date];
    if (entry && entryHasValue(entry)) {
      totalHours += entryHours(entry.hours);
      totalReimbursement += entryExpenseAmount(entry.expense_amount);
      daysWithEntries += 1;
    }
  }

  if (daysWithEntries === 0) return null;

  const summaryParts: string[] = [];
  if (totalHours > 0) summaryParts.push(formatHoursReadable(totalHours));
  if (totalReimbursement > 0) {
    summaryParts.push(`${formatCurrency(totalReimbursement)} reimbursed`);
  }

  return (
    <div className="bg-surface-raised border-border mx-3 mb-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm sm:mx-4">
      <span className="text-text-muted shrink-0">{label}</span>
      <span className="text-right font-semibold tabular-nums">
        {summaryParts.join(' · ')}
        <span className="text-text-muted font-normal">
          {' '}
          · {daysWithEntries} {daysWithEntries === 1 ? 'day' : 'days'}
        </span>
      </span>
    </div>
  );
}
