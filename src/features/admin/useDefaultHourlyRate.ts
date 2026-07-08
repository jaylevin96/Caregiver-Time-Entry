import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/supabase';

export function parseSettingNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function useDefaultHourlyRate() {
  const [defaultRate, setDefaultRate] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const { data } = await db
      .from('settings')
      .select('value')
      .eq('key', 'default_hourly_rate')
      .maybeSingle();

    const parsed = parseSettingNumber(data?.value);
    if (parsed !== null) setDefaultRate(parsed);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { defaultRate, loading, refresh: load, setDefaultRate };
}
