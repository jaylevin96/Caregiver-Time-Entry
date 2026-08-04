import { isBeyondCurrentWeek, isPayrollWeekLocked } from '@/lib/utils/dates';
import type { TimeEntry, TimeEntryExpense } from '@/types/database';

export type DayEntryStatus =
  | 'empty'
  | 'editable'
  | 'locked'
  | 'paid'
  | 'partial'
  | 'future';

/** Optional metadata when multiple caregivers' entries are combined per day. */
export interface AggregateEntryMeta {
  entryCount: number;
  paidCount: number;
}

export type CalendarEntry = TimeEntry & {
  _aggregate?: AggregateEntryMeta;
  expenses?: Pick<TimeEntryExpense, 'hours' | 'amount'>[];
};

export function getDayEntryStatus(
  workDate: string,
  entry: CalendarEntry | undefined,
  asOf = new Date(),
): DayEntryStatus {
  if (entry?._aggregate) {
    const { entryCount, paidCount } = entry._aggregate;
    if (paidCount > 0 && paidCount === entryCount) return 'paid';
    if (paidCount > 0) return 'partial';
  } else if (entry?.payment_id) {
    return 'paid';
  }
  if (isBeyondCurrentWeek(workDate, asOf)) return 'future';
  if (isPayrollWeekLocked(workDate, asOf)) return 'locked';
  if (entry) return 'editable';
  return 'empty';
}

export function canEditEntry(
  workDate: string,
  entry: CalendarEntry | undefined,
  asOf = new Date(),
): boolean {
  const status = getDayEntryStatus(workDate, entry, asOf);
  return status === 'empty' || status === 'editable';
}

export function getStatusLabel(status: DayEntryStatus): string | null {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'partial':
      return 'Partially paid';
    case 'locked':
      return 'Locked';
    default:
      return null;
  }
}

export function showsPaymentIndicator(status: DayEntryStatus): boolean {
  return status === 'paid' || status === 'partial';
}
