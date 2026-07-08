import { useCallback, useEffect, useState } from 'react';
import { ALL_CAREGIVERS_ID } from '@/features/admin/CaregiverFilter';
import { db } from '@/lib/supabase';
import type { CalendarEntry } from '@/lib/utils/entry-status';
import type { TimeEntry } from '@/types/database';

interface UseDateRangeEntriesOptions {
  caregiverId: string | undefined;
  start: string | undefined;
  end: string | undefined;
}

function aggregateEntriesByDate(
  entries: TimeEntry[],
): Record<string, CalendarEntry> {
  const byDate = new Map<string, TimeEntry[]>();

  for (const entry of entries) {
    const dayEntries = byDate.get(entry.work_date) ?? [];
    dayEntries.push(entry);
    byDate.set(entry.work_date, dayEntries);
  }

  const map: Record<string, CalendarEntry> = {};

  for (const [workDate, dayEntries] of byDate) {
    const paidCount = dayEntries.filter((entry) => entry.payment_id).length;
    const allPaid = paidCount === dayEntries.length && paidCount > 0;
    const first = dayEntries[0];

    map[workDate] = {
      ...first,
      hours: dayEntries.reduce((sum, entry) => sum + entry.hours, 0),
      payment_id: allPaid ? first.payment_id : null,
      notes: null,
      _aggregate: {
        entryCount: dayEntries.length,
        paidCount,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caregiverId || !start || !end) {
      setEntriesByDate({});
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
    } else {
      const map: Record<string, CalendarEntry> = {};
      if (caregiverId === ALL_CAREGIVERS_ID) {
        Object.assign(map, aggregateEntriesByDate(data ?? []));
      } else {
        for (const entry of data ?? []) {
          map[entry.work_date] = entry;
        }
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
