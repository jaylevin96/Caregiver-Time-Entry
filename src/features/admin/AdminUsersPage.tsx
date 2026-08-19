import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/supabase';
import { useAuth } from '@/features/auth/useAuth';
import { CaregiverColorPicker } from '@/features/admin/CaregiverColorPicker';
import { CaregiverRateEditor } from '@/features/admin/CaregiverRateEditor';
import { useDefaultHourlyRate } from '@/features/admin/useDefaultHourlyRate';
import { isValidCalendarColor } from '@/lib/utils/calendar-colors';
import { getChicagoDateString } from '@/lib/utils/dates';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import type { CaregiverRate, Profile, UserRole } from '@/types/database';

function groupRatesByCaregiver(rates: CaregiverRate[]): Record<string, CaregiverRate[]> {
  const grouped: Record<string, CaregiverRate[]> = {};
  for (const rate of rates) {
    if (!grouped[rate.caregiver_id]) grouped[rate.caregiver_id] = [];
    grouped[rate.caregiver_id].push(rate);
  }
  return grouped;
}

export function AdminUsersPage() {
  const { profile: currentProfile } = useAuth();
  const { defaultRate } = useDefaultHourlyRate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [ratesByCaregiver, setRatesByCaregiver] = useState<
    Record<string, CaregiverRate[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(
    null,
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [profilesResult, ratesResult] = await Promise.all([
      db
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('display_name'),
      db
        .from('caregiver_rates')
        .select('*')
        .order('effective_from', { ascending: false }),
    ]);

    if (profilesResult.error) {
      setError(profilesResult.error.message);
      setUsers([]);
      setRatesByCaregiver({});
    } else {
      setUsers(profilesResult.data ?? []);
      if (ratesResult.error) {
        setError(ratesResult.error.message);
        setRatesByCaregiver({});
      } else {
        setRatesByCaregiver(groupRatesByCaregiver(ratesResult.data ?? []));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleRoleChange(user: Profile, role: UserRole) {
    if (user.role === role) return;

    setBusyUserId(user.id);
    setError(null);
    setConfirmDeactivateId(null);

    const { data, error: rpcError } = await db.rpc('set_user_role', {
      p_user_id: user.id,
      p_role: role,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else if (data) {
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? data : item)),
      );
    }

    setBusyUserId(null);
  }

  async function handleDeactivate(user: Profile) {
    if (!user.is_active) return;

    setBusyUserId(user.id);
    setError(null);
    setConfirmDeactivateId(null);

    const { data, error: rpcError } = await db.rpc('deactivate_user', {
      p_user_id: user.id,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else if (data) {
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
    }

    setBusyUserId(null);
  }

  async function handleColorChange(userId: string, color: string) {
    if (!isValidCalendarColor(color)) return;

    setBusyUserId(userId);
    setError(null);

    const { data, error: updateError } = await db
      .from('profiles')
      .update({ calendar_color: color })
      .eq('id', userId)
      .select('*')
      .single();

    if (updateError) {
      setError(updateError.message);
    } else if (data) {
      setUsers((prev) =>
        prev.map((item) => (item.id === userId ? data : item)),
      );
    }

    setBusyUserId(null);
  }

  async function handleRateChange(userId: string, rate: number) {
    setBusyUserId(userId);
    setError(null);

    const effectiveFrom = getChicagoDateString();
    const { data, error: upsertError } = await db
      .from('caregiver_rates')
      .upsert(
        {
          caregiver_id: userId,
          hourly_rate: rate,
          effective_from: effectiveFrom,
        },
        { onConflict: 'caregiver_id,effective_from' },
      )
      .select('*');

    if (upsertError) {
      setError(upsertError.message);
    } else if (data?.[0]) {
      const saved = data[0];
      setRatesByCaregiver((prev) => {
        const existing = prev[userId] ?? [];
        const withoutToday = existing.filter(
          (item) => item.effective_from !== effectiveFrom,
        );
        return {
          ...prev,
          [userId]: [saved, ...withoutToday],
        };
      });
    }

    setBusyUserId(null);
  }

  return (
    <div className="px-3 py-3 sm:px-4 sm:py-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Users</h2>
        <p className="text-text-muted mt-1 text-sm">
          Promote caregivers to admin, deactivate users, and set calendar colors
          and hourly rates for each caregiver.
        </p>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={loadUsers} />
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <InlineSpinner />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Caregivers appear here after they sign up."
        />
      ) : (
        <ul className="space-y-3">
          {users.map((user) => {
            const isSelf = user.id === currentProfile?.id;
            const isBusy = busyUserId === user.id;

            return (
              <li
                key={user.id}
                className="border-border bg-surface-raised rounded-xl border p-3 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.display_name}</p>
                    <p className="text-text-muted truncate text-sm">{user.email}</p>
                  </div>
                  <span
                    className={[
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize',
                      user.role === 'admin'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-surface text-text-muted',
                    ].join(' ')}
                  >
                    {user.role}
                  </span>
                </div>

                {user.role === 'caregiver' ? (
                  <>
                    <CaregiverColorPicker
                      user={user}
                      disabled={isBusy}
                      onChange={handleColorChange}
                    />
                    <CaregiverRateEditor
                      userId={user.id}
                      rates={ratesByCaregiver[user.id] ?? []}
                      defaultRate={defaultRate}
                      disabled={isBusy}
                      onSave={handleRateChange}
                    />
                  </>
                ) : null}

                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex gap-2">
                    {user.role === 'caregiver' ? (
                      <Button
                        variant="secondary"
                        className="min-h-11 flex-1 text-sm"
                        disabled={isBusy}
                        onClick={() => handleRoleChange(user, 'admin')}
                      >
                        Make admin
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="min-h-11 flex-1 text-sm"
                        disabled={isBusy || isSelf}
                        onClick={() => handleRoleChange(user, 'caregiver')}
                      >
                        {isSelf ? 'You (admin)' : 'Make caregiver'}
                      </Button>
                    )}
                  </div>

                  {confirmDeactivateId === user.id ? (
                    <div className="border-danger/20 bg-danger/5 space-y-2 rounded-xl border p-3">
                      <p className="text-sm font-medium">
                        Deactivate {user.display_name}?
                      </p>
                      <p className="text-text-muted text-sm">
                        They will no longer be able to access the app. Past
                        entries and payments are kept. To regain access they
                        would need to register a new account.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          fullWidth
                          variant="danger"
                          className="min-h-11 text-sm"
                          disabled={isBusy}
                          onClick={() => handleDeactivate(user)}
                        >
                          {isBusy ? 'Deactivating…' : 'Yes, deactivate'}
                        </Button>
                        <Button
                          fullWidth
                          variant="secondary"
                          className="min-h-11 text-sm"
                          disabled={isBusy}
                          onClick={() => setConfirmDeactivateId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : !isSelf ? (
                    <Button
                      variant="danger"
                      className="min-h-11 w-full text-sm"
                      disabled={isBusy}
                      onClick={() => setConfirmDeactivateId(user.id)}
                    >
                      Deactivate
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
