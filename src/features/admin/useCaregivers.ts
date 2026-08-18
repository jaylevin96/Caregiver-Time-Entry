import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/supabase';
import {
  getActiveCaregivers,
  getPayCaregivers,
} from '@/lib/utils/caregivers';
import type { Profile } from '@/types/database';

export function useCaregivers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unpaidCaregiverIds, setUnpaidCaregiverIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [profilesResult, unpaidResult] = await Promise.all([
      db.from('profiles').select('*').order('display_name'),
      db.from('time_entries').select('caregiver_id').is('payment_id', null),
    ]);

    if (profilesResult.error) {
      setError(profilesResult.error.message);
      setProfiles([]);
      setUnpaidCaregiverIds([]);
      setLoading(false);
      return;
    }

    setProfiles(profilesResult.data ?? []);

    if (unpaidResult.error) {
      setUnpaidCaregiverIds([]);
    } else {
      const ids = [
        ...new Set(
          (unpaidResult.data ?? []).map((row) => row.caregiver_id),
        ),
      ];
      setUnpaidCaregiverIds(ids);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const caregivers = useMemo(
    () => getActiveCaregivers(profiles),
    [profiles],
  );
  const payCaregivers = useMemo(
    () => getPayCaregivers(profiles, unpaidCaregiverIds),
    [profiles, unpaidCaregiverIds],
  );

  return {
    profiles,
    caregivers,
    payCaregivers,
    loading,
    error,
    refresh: load,
  };
}
