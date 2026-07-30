import { useCallback, useEffect, useState } from 'react';
import { ALL_CAREGIVERS_ID } from '@/features/admin/CaregiverFilter';
import { db } from '@/lib/supabase';
import { entryHours } from '@/lib/utils/dates';
import type { CalendarEntry } from '@/lib/utils/entry-status';
import type { TimeEntry } from '@/types/database';

interface UseDateRangeEntriesOptions {
  caregiverId: string | undefined;
  start: string | undefined;
  end: string | undefined;
}

function groupEntriesByDate(
  entries: TimeEntry[],
): Record<string, TimeEntry[]> {
  const byDate: Record<string, TimeEntry[]> = {};

  for (const entry of entries) {
    const dayEntries = byDate[entry.work_date] ?? [];
    dayEntries.push(entry);
    byDate[entry.work_date] = dayEntries;
  }

  return byDate;
}

function aggregateEntriesByDate(
  entries: TimeEntry[],
): Record<string, CalendarEntry> {
  const byDate = groupEntriesByDate(entries);
  const map: Record<string, CalendarEntry> = {};

  for (const [workDate, dayEntries] of Object.entries(byDate)) {
    const paidCount = dayEntries.filter((entry) => entry.payment_id).length;
    const allPaid = paidCount === dayEntries.length && paidCount > 0;
    const first = dayEntries[0];

    map[workDate] = {
      ...first,
      hours: dayEntries.reduce((sum, entry) => sum + entryHours(entry.hours), 0),
      expense_amount: dayEntries.reduce(
        (sum, entry) => sum + (entry.expense_amount ?? 0),
        0,
      ),
      payment_id: allPaid ? first.payment_id : null,
      notes: null,
      _aggregate: {
        entryCount: dayEntries.length,
        paidCount,
        entries: dayEntries,
      },
    };
  }

  return map;
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
    Record<string, TimeEntry[]>
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
      .select('*')
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
      const rows = data ?? [];
      if (caregiverId === ALL_CAREGIVERS_ID) {
        setEntriesByDate(aggregateEntriesByDate(rows));
        setMultiEntriesByDate(groupEntriesByDate(rows));
      } else {
        const map: Record<string, CalendarEntry> = {};
        for (const entry of rows) {
          map[entry.work_date] = entry;
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
