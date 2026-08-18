import { getBillableHours } from '@/lib/utils/expenses';
import type { CalendarEntry } from '@/lib/utils/entry-status';
import type { TimeEntry, TimeEntryExpense } from '@/types/database';

export type EntryWithExpenses = TimeEntry & {
  time_entry_expenses?: TimeEntryExpense[];
  expenses?: TimeEntryExpense[];
};

/** Groups raw DB rows by work_date (used by all-caregivers calendar). */
export function groupEntriesByDate(
  entries: EntryWithExpenses[],
): Record<string, CalendarEntry[]> {
  const byDate: Record<string, CalendarEntry[]> = {};

  for (const entry of entries) {
    const dayEntries = byDate[entry.work_date] ?? [];
    dayEntries.push(toCalendarEntry(entry));
    byDate[entry.work_date] = dayEntries;
  }

  return byDate;
}

/** One aggregate CalendarEntry per day; hours are already billable totals. */
export function aggregateEntriesByDate(
  entries: EntryWithExpenses[],
): Record<string, CalendarEntry> {
  const byDate = groupEntriesByDate(entries);
  const map: Record<string, CalendarEntry> = {};

  for (const [workDate, dayEntries] of Object.entries(byDate)) {
    const paidCount = dayEntries.filter((entry) => entry.payment_id).length;
    const allPaid = paidCount === dayEntries.length && paidCount > 0;
    const first = dayEntries[0];
    const allExpenses = dayEntries.flatMap((entry) => entry.expenses ?? []);

    map[workDate] = {
      ...first,
      hours: dayEntries.reduce(
        (sum, entry) => sum + getBillableHours(entry, entry.expenses),
        0,
      ),
      payment_id: allPaid ? first.payment_id : null,
      notes: null,
      expenses: allExpenses,
      _aggregate: {
        entryCount: dayEntries.length,
        paidCount,
      },
    };
  }

  return map;
}

/** Normalize nested `time_entry_expenses` or `expenses` onto CalendarEntry. */
export function toCalendarEntry(entry: EntryWithExpenses): CalendarEntry {
  const expenses = entry.time_entry_expenses ?? entry.expenses ?? [];
  return {
    id: entry.id,
    caregiver_id: entry.caregiver_id,
    work_date: entry.work_date,
    hours: entry.hours,
    notes: entry.notes,
    payment_id: entry.payment_id,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    created_by: entry.created_by,
    updated_by: entry.updated_by,
    expenses,
  };
}
