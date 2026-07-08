import { useCallback, useEffect, useMemo, useState } from 'react';
import { CaregiverFilter } from '@/features/admin/CaregiverFilter';
import { useCaregivers } from '@/features/admin/useCaregivers';
import { useDefaultHourlyRate } from '@/features/admin/useDefaultHourlyRate';
import { Button } from '@/components/ui/Button';
import { AuthField } from '@/features/auth/AuthField';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { db } from '@/lib/supabase';
import {
  buildPaymentSummaryText,
  calculatePaymentTotal,
  formatCurrency,
  formatShortDate,
} from '@/lib/utils/payment-format';
import { formatHours, getChicagoDateString } from '@/lib/utils/dates';
import type { CaregiverRate, Payment, TimeEntry } from '@/types/database';

export function AdminPayPage() {
  const { caregivers, loading: caregiversLoading } = useCaregivers();
  const { defaultRate } = useDefaultHourlyRate();
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(
    null,
  );
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [rates, setRates] = useState<CaregiverRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const activeCaregiverId =
    selectedCaregiverId ?? caregivers[0]?.id ?? undefined;

  const activeCaregiver = caregivers.find((c) => c.id === activeCaregiverId);

  const loadSummary = useCallback(async () => {
    if (!activeCaregiverId || !periodStart || !periodEnd) {
      setEntries([]);
      return;
    }

    if (periodEnd < periodStart) {
      setError('End date must be on or after start date.');
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);

    const [entriesResult, ratesResult] = await Promise.all([
      db
        .from('time_entries')
        .select('*')
        .eq('caregiver_id', activeCaregiverId)
        .is('payment_id', null)
        .gte('work_date', periodStart)
        .lte('work_date', periodEnd)
        .order('work_date'),
      db
        .from('caregiver_rates')
        .select('*')
        .eq('caregiver_id', activeCaregiverId)
        .order('effective_from', { ascending: false }),
    ]);

    if (entriesResult.error) {
      setError(entriesResult.error.message);
      setEntries([]);
    } else {
      setEntries(entriesResult.data ?? []);
    }

    if (!ratesResult.error) {
      setRates(ratesResult.data ?? []);
    }

    setLoading(false);
  }, [activeCaregiverId, periodStart, periodEnd]);

  useEffect(() => {
    if (activeCaregiverId && periodStart && periodEnd) {
      loadSummary();
    }
  }, [activeCaregiverId, periodStart, periodEnd, loadSummary]);

  useEffect(() => {
    const today = getChicagoDateString();
    const [y, m] = today.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    setPeriodStart(start);
    setPeriodEnd(today);
  }, []);

  useEffect(() => {
    setLastPayment(null);
    setCopyMessage(null);
  }, [activeCaregiverId, periodStart, periodEnd]);

  const { totalHours, totalAmount } = calculatePaymentTotal(
    entries,
    rates,
    defaultRate,
  );

  const summaryText = useMemo(() => {
    if (lastPayment) {
      return buildPaymentSummaryText(
        lastPayment.period_start,
        lastPayment.period_end,
        lastPayment.total_hours,
      );
    }

    if (periodStart && periodEnd && entries.length > 0) {
      return buildPaymentSummaryText(
        periodStart,
        periodEnd,
        totalHours,
      );
    }

    return '';
  }, [lastPayment, periodStart, periodEnd, entries.length, totalHours]);

  async function handleMarkPaid() {
    if (!activeCaregiverId || !periodStart || !periodEnd || entries.length === 0) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data, error: rpcError } = await db.rpc('mark_entries_paid', {
      p_caregiver_id: activeCaregiverId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }

    setLastPayment(data);
    setSubmitting(false);
    await loadSummary();
  }

  async function handleCopy() {
    if (!summaryText) return;

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyMessage('Copied to clipboard');
    } catch {
      setCopyMessage('Could not copy — select and copy manually');
    }
  }

  return (
    <>
      {caregiversLoading ? (
        <div className="flex justify-center py-12">
          <InlineSpinner />
        </div>
      ) : caregivers.length === 0 ? (
        <EmptyState
          title="No caregivers yet"
          description="Caregivers can create an account from the login page."
        />
      ) : (
        <>
          <CaregiverFilter
            caregivers={caregivers}
            selectedId={activeCaregiverId ?? null}
            onSelect={setSelectedCaregiverId}
          />

          <div className="space-y-3 px-3 py-3 sm:px-4 sm:py-4">
            <div className="bg-surface border-border rounded-xl border p-3">
              <div className="grid grid-cols-2 gap-2">
                <AuthField
                  compact
                  label="Start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
                <AuthField
                  compact
                  label="End"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            {error ? <ErrorBanner message={error} onRetry={loadSummary} /> : null}

            {loading ? (
              <div className="flex justify-center py-8">
                <InlineSpinner size="sm" />
              </div>
            ) : activeCaregiver && periodStart && periodEnd ? (
              <div className="border-border bg-surface-raised space-y-3 rounded-xl border p-3 sm:p-4">
                <div>
                  <p className="text-text-muted text-sm">Caregiver</p>
                  <p className="font-medium">{activeCaregiver.display_name}</p>
                </div>

                <div>
                  <p className="text-text-muted text-sm">Period</p>
                  <p className="font-medium">
                    {formatShortDate(periodStart)} – {formatShortDate(periodEnd)}
                  </p>
                </div>

                {entries.length === 0 && !lastPayment ? (
                  <p className="text-text-muted text-sm">
                    No unpaid entries in this date range.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-text-muted text-sm">Total hours</p>
                        <p className="text-xl font-semibold tabular-nums">
                          {formatHours(lastPayment?.total_hours ?? totalHours)}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted text-sm">Amount owed</p>
                        <p className="text-xl font-semibold tabular-nums">
                          {formatCurrency(
                            lastPayment?.total_amount ?? totalAmount,
                          )}
                        </p>
                      </div>
                    </div>

                    {!lastPayment && entries.length > 0 ? (
                      <ul className="text-text-muted max-h-32 space-y-1 overflow-y-auto text-sm">
                        {entries.map((entry) => (
                          <li key={entry.id}>
                            {formatShortDate(entry.work_date)} —{' '}
                            {formatHours(entry.hours)}h
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {lastPayment ? (
                      <p className="text-success text-sm font-medium">
                        Marked paid. Copy the summary below for Zelle.
                      </p>
                    ) : null}

                    {summaryText ? (
                      <pre className="border-border bg-surface whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed">
                        {summaryText}
                      </pre>
                    ) : null}

                    <div className="space-y-2">
                      {!lastPayment && entries.length > 0 ? (
                        <Button
                          fullWidth
                          disabled={submitting}
                          onClick={handleMarkPaid}
                        >
                          {submitting ? 'Processing…' : 'Mark paid'}
                        </Button>
                      ) : null}

                      {summaryText ? (
                        <Button
                          fullWidth
                          variant="secondary"
                          onClick={handleCopy}
                        >
                          Copy Payment Info
                        </Button>
                      ) : null}

                      {copyMessage ? (
                        <p className="text-success text-center text-sm">
                          {copyMessage}
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
