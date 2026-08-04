import { useCallback, useEffect, useState } from 'react';
import { ALL_CAREGIVERS_ID } from '@/features/admin/CaregiverFilter';
import { db } from '@/lib/supabase';
import { getBillableHours } from '@/lib/utils/expenses';
import type { CalendarEntry } from '@/lib/utils/entry-status';
import type { TimeEntry, TimeEntryExpense } from '@/types/database';

export type EntryWithExpenses = TimeEntry & {
  time_entry_expenses?: TimeEntryExpense[];
  expenses?: TimeEntryExpense[];
};

interface UseDateRangeEntriesOptions {
  caregiverId: string | undefined;
  start: string | undefined;
  end: string | undefined;
}

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

export function useDateRangeEntries({
  caregiverId,
  start,
  end,
}: UseDateRangeEntriesOptions) {
  const [entriesByDate, setEntriesByDate] = useState<
    Record<string, CalendarEntry>
  >({});
  const [multiEntriesByDate, setMultiEntriesByDate] = useState<
    Record<string, CalendarEntry[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caregiverId || !start || !end) {
      setEntriesByDate({});
      setMultiEntriesByDate({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const query = db
      .from('time_entries')
      .select('*, time_entry_expenses(*)')
      .gte('work_date', start)
      .lte('work_date', end);

    const { data, error: fetchError } =
      caregiverId === ALL_CAREGIVERS_ID
        ? await query
        : await query.eq('caregiver_id', caregiverId);

    if (fetchError) {
      setError(fetchError.message);
      setEntriesByDate({});
      setMultiEntriesByDate({});
    } else {
      const rows = (data ?? []) as EntryWithExpenses[];
      if (caregiverId === ALL_CAREGIVERS_ID) {
        setEntriesByDate(aggregateEntriesByDate(rows));
        setMultiEntriesByDate(groupEntriesByDate(rows));
      } else {
        const map: Record<string, CalendarEntry> = {};
        for (const entry of rows) {
          map[entry.work_date] = toCalendarEntry(entry);
        }
        setEntriesByDate(map);
        setMultiEntriesByDate({});
      }
    }

    setLoading(false);
  }, [caregiverId, start, end]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    entriesByDate,
    multiEntriesByDate,
    loading,
    error,
    refresh: load,
  };
}
