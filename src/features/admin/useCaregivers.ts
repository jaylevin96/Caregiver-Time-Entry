import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export function useCaregivers() {
  const [caregivers, setCaregivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await db
      .from('profiles')
      .select('*')
      .eq('role', 'caregiver')
      .eq('is_active', true)
      .order('display_name');

    if (fetchError) {
      setError(fetchError.message);
      setCaregivers([]);
    } else {
      setCaregivers(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { caregivers, loading, error, refresh: load };
}
