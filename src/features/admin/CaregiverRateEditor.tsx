import { useEffect, useState } from 'react';
import { AuthField } from '@/features/auth/AuthField';
import { getEffectiveRate } from '@/features/admin/CaregiverFilter';
import { Button } from '@/components/ui/Button';
import { getChicagoDateString } from '@/lib/utils/dates';
import type { CaregiverRate } from '@/types/database';

interface CaregiverRateEditorProps {
  userId: string;
  rates: CaregiverRate[];
  defaultRate: number;
  disabled?: boolean;
  onSave: (userId: string, rate: number) => Promise<void>;
}

export function CaregiverRateEditor({
  userId,
  rates,
  defaultRate,
  disabled = false,
  onSave,
}: CaregiverRateEditorProps) {
  const today = getChicagoDateString();
  const effectiveRate = getEffectiveRate(rates, defaultRate, today);
  const hasCustomRate = rates.some((rate) => rate.effective_from <= today);

  const [rateInput, setRateInput] = useState(String(effectiveRate));
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setRateInput(String(effectiveRate));
  }, [effectiveRate]);

  async function handleSave() {
    const rate = Number(rateInput);
    if (!rate || rate <= 0) {
      setFieldError('Enter a valid rate greater than zero.');
      return;
    }

    setSaving(true);
    setFieldError(null);

    try {
      await onSave(userId, rate);
    } finally {
      setSaving(false);
    }
  }

  const isBusy = disabled || saving;
  const unchanged = Number(rateInput) === effectiveRate;

  return (
    <div className="mt-4">
      <p className="text-text-muted mb-2 text-xs font-medium">Hourly rate</p>
      <p className="text-text-muted mb-3 text-sm">
        {hasCustomRate
          ? `Current: $${effectiveRate.toFixed(2)}/hr`
          : `Uses default ($${defaultRate.toFixed(2)}/hr)`}
      </p>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <AuthField
            compact
            label="Rate ($/hour)"
            type="number"
            inputMode="decimal"
            min={0.01}
            step={0.01}
            value={rateInput}
            disabled={isBusy}
            onChange={(event) => {
              setRateInput(event.target.value);
              setFieldError(null);
            }}
          />
        </div>
        <Button
          variant="secondary"
          className="min-h-10 shrink-0 px-3 text-sm"
          disabled={isBusy || unchanged}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {fieldError ? (
        <p className="text-danger mt-2 text-sm">{fieldError}</p>
      ) : null}
    </div>
  );
}
