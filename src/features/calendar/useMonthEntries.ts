import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/supabase';
import { getMonthGridRange } from '@/lib/utils/dates';
import type { TimeEntry } from '@/types/database';

interface UseMonthEntriesOptions {
  caregiverId: string | undefined;
  year: number;
  month: number;
}

/** @deprecated Use useDateRangeEntries via CalendarContainer */
export function useMonthEntries({
  caregiverId,
  year,
  month,
}: UseMonthEntriesOptions) {
  const { start, end } = getMonthGridRange(year, month);
  const [entriesByDate, setEntriesByDate] = useState<
    Record<string, TimeEntry>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caregiverId) {
      setEntriesByDate({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await db
      .from('time_entries')
      .select('*')
      .eq('caregiver_id', caregiverId)
      .gte('work_date', start)
      .lte('work_date', end);

    if (fetchError) {
      setError(fetchError.message);
      setEntriesByDate({});
    } else {
      const map: Record<string, TimeEntry> = {};
      for (const entry of data ?? []) {
        map[entry.work_date] = entry;
      }
      setEntriesByDate(map);
    }

    setLoading(false);
  }, [caregiverId, start, end]);

  useEffect(() => {
    load();
  }, [load]);

  return { entriesByDate, loading, error, refresh: load };
}
