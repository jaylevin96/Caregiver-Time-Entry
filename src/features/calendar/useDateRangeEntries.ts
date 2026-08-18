import { useCallback, useEffect, useState } from 'react';
import { ALL_CAREGIVERS_ID } from '@/features/admin/CaregiverFilter';
import {
  aggregateEntriesByDate,
  groupEntriesByDate,
  toCalendarEntry,
  type EntryWithExpenses,
} from '@/features/calendar/entry-aggregates';
import { db } from '@/lib/supabase';
import type { CalendarEntry } from '@/lib/utils/entry-status';

export {
  aggregateEntriesByDate,
  groupEntriesByDate,
  toCalendarEntry,
  type EntryWithExpenses,
} from '@/features/calendar/entry-aggregates';

interface UseDateRangeEntriesOptions {
  caregiverId: string | undefined;
  start: string | undefined;
  end: string | undefined;
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
      setMultiEntriesByDate(groupEntriesByDate(rows));
      if (caregiverId === ALL_CAREGIVERS_ID) {
        setEntriesByDate(aggregateEntriesByDate(rows));
      } else {
        const map: Record<string, CalendarEntry> = {};
        for (const entry of rows) {
          map[entry.work_date] = toCalendarEntry(entry);
        }
        setEntriesByDate(map);
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
