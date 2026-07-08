import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AuthField } from '@/features/auth/AuthField';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { useDefaultHourlyRate } from '@/features/admin/useDefaultHourlyRate';
import { useAuth } from '@/features/auth/useAuth';
import { db } from '@/lib/supabase';

export function AdminSettingsPage() {
  const { profile } = useAuth();
  const { defaultRate, loading, refresh, setDefaultRate } = useDefaultHourlyRate();
  const [rateInput, setRateInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading) {
      setRateInput(String(defaultRate));
    }
  }, [defaultRate, loading]);

  const handleSave = useCallback(async () => {
    const rate = Number(rateInput);
    if (!rate || rate <= 0) {
      setError('Enter a valid hourly rate greater than zero.');
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: updateError } = await db
      .from('settings')
      .update({
        value: rate,
        updated_by: profile?.id ?? null,
      })
      .eq('key', 'default_hourly_rate');

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setDefaultRate(rate);
    setSaved(true);
    setSaving(false);
    await refresh();
  }, [rateInput, profile?.id, refresh, setDefaultRate]);

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-text-muted mt-1 text-sm">
          App-wide defaults for payments.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <InlineSpinner />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="border-border bg-surface-raised rounded-2xl border p-4">
            <h3 className="font-medium">Default hourly rate</h3>
            <p className="text-text-muted mt-1 text-sm">
              Used when a caregiver has no custom rate. Set per-caregiver rates
              on the Users page.
            </p>

            <div className="mt-4 flex items-end gap-3">
              <div className="flex-1">
                <AuthField
                  label="Rate ($/hour)"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step={0.01}
                  value={rateInput}
                  onChange={(e) => {
                    setRateInput(e.target.value);
                    setSaved(false);
                  }}
                />
              </div>
            </div>

            {error ? (
              <div className="mt-3">
                <ErrorBanner message={error} />
              </div>
            ) : null}

            {saved ? (
              <p className="text-success mt-3 text-sm font-medium">Saved</p>
            ) : null}

            <Button
              className="mt-4"
              fullWidth
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save rate'}
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
