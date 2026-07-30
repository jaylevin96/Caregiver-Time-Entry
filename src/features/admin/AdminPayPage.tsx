import { useCallback, useEffect, useMemo, useState } from 'react';
import { CaregiverFilter } from '@/features/admin/CaregiverFilter';
import { useCaregivers } from '@/features/admin/useCaregivers';
import { useDefaultHourlyRate } from '@/features/admin/useDefaultHourlyRate';
import { Button } from '@/components/ui/Button';
import { DateRangeFilter } from '@/features/admin/DateRangeFilter';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { db } from '@/lib/supabase';
import {
  entryHours,
  formatHoursReadable,
  getChicagoDateString,
} from '@/lib/utils/dates';
import {
  buildPaymentSummaryText,
  calculatePaymentTotal,
  formatCurrency,
  formatPayPeriodRange,
  formatShortDate,
} from '@/lib/utils/payment-format';
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
  const [paidSnapshot, setPaidSnapshot] = useState<TimeEntry[]>([]);
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
    setPaidSnapshot([]);
    setCopyMessage(null);
  }, [activeCaregiverId, periodStart, periodEnd]);

  const hourEntries = useMemo(
    () => entries.filter((entry) => entryHours(entry.hours) > 0),
    [entries],
  );

  const reimbursementEntries = useMemo(
    () =>
      entries.filter(
        (entry) => entry.expense_amount && entry.expense_amount > 0,
      ),
    [entries],
  );

  const { totalHours, hoursAmount, totalReimbursement, totalAmount } =
    calculatePaymentTotal(entries, rates, defaultRate);

  const displayHourEntries = lastPayment
    ? paidSnapshot.filter((entry) => entryHours(entry.hours) > 0)
    : hourEntries;

  const displayReimbursementEntries = lastPayment
    ? paidSnapshot.filter(
        (entry) => entry.expense_amount && entry.expense_amount > 0,
      )
    : reimbursementEntries;

  const summaryText = useMemo(() => {
    const source = lastPayment ? displayHourEntries : hourEntries;
    if (source.length === 0) return '';

    return buildPaymentSummaryText(
      source.map((entry) => ({
        work_date: entry.work_date,
        hours: entry.hours,
        expense_amount: entry.expense_amount,
      })),
    );
  }, [lastPayment, displayHourEntries, hourEntries]);

  const paidReimbursement = lastPayment
    ? lastPayment.total_reimbursement
    : totalReimbursement;
  const paidHours = lastPayment ? lastPayment.total_hours : totalHours;
  const paidHoursAmount = lastPayment
    ? lastPayment.total_amount - lastPayment.total_reimbursement
    : hoursAmount;
  const paidTotalAmount = lastPayment ? lastPayment.total_amount : totalAmount;

  const paidSuccessMessage = useMemo(() => {
    if (!lastPayment) return null;

    const hasPaidHours = paidHours > 0;
    const hasPaidReimbursement = paidReimbursement > 0;

    if (hasPaidHours && hasPaidReimbursement) {
      return 'Marked paid. Copy the hours summary below for Zelle.';
    }

    if (hasPaidHours) {
      return 'Marked paid. Copy the hours summary below for Zelle.';
    }

    return `Marked paid. Reimbursement total: ${formatCurrency(paidReimbursement)}.`;
  }, [lastPayment, paidHours, paidReimbursement]);

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
    setPaidSnapshot(entries);
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
          <div className="bg-surface/95 supports-[backdrop-filter]:bg-surface/80 sticky top-[var(--app-header-height,calc(env(safe-area-inset-top)+4.5rem))] z-[9] border-border border-b backdrop-blur">
            <CaregiverFilter
              caregivers={caregivers}
              selectedId={activeCaregiverId ?? null}
              onSelect={setSelectedCaregiverId}
              embedded
            />
            <div className="px-3 pb-3 sm:px-4">
              <DateRangeFilter
                startValue={periodStart}
                endValue={periodEnd}
                onStartChange={setPeriodStart}
                onEndChange={setPeriodEnd}
              />
            </div>
          </div>

          <div className="space-y-3 px-3 py-3 sm:px-4 sm:py-4">
            {error ? <ErrorBanner message={error} onRetry={loadSummary} /> : null}

            {loading ? (
              <div className="flex justify-center py-8">
                <InlineSpinner size="sm" />
              </div>
            ) : activeCaregiver && periodStart && periodEnd ? (
              <div className="border-border bg-surface-raised space-y-4 rounded-xl border p-3 sm:p-4">
                <div>
                  <p className="text-text-muted text-sm">Caregiver</p>
                  <p className="font-medium">{activeCaregiver.display_name}</p>
                </div>

                <div>
                  <p className="text-text-muted text-sm">Period</p>
                  <p className="font-medium">
                    {formatPayPeriodRange(periodStart, periodEnd)}
                  </p>
                </div>

                {entries.length === 0 && !lastPayment ? (
                  <p className="text-text-muted text-sm">
                    No unpaid entries in this date range.
                  </p>
                ) : (
                  <>
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold">Hours</h3>
                      {displayHourEntries.length === 0 ? (
                        <p className="text-text-muted text-sm">No unpaid hours.</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-text-muted text-sm">Total hours</p>
                              <p className="text-xl font-semibold">
                                {formatHoursReadable(paidHours)}
                              </p>
                            </div>
                            <div>
                              <p className="text-text-muted text-sm">Hours pay</p>
                              <p className="text-xl font-semibold tabular-nums">
                                {formatCurrency(paidHoursAmount)}
                              </p>
                            </div>
                          </div>
                          {!lastPayment || displayHourEntries.length > 0 ? (
                            <ul className="text-text-muted max-h-32 space-y-1 overflow-y-auto text-sm">
                              {displayHourEntries.map((entry) => (
                                <li key={entry.id}>
                                  {formatShortDate(entry.work_date)} ·{' '}
                                  {formatHoursReadable(entryHours(entry.hours))}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </>
                      )}
                    </section>

                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold">Reimbursements</h3>
                      {displayReimbursementEntries.length === 0 && paidReimbursement <= 0 ? (
                        <p className="text-text-muted text-sm">
                          No expense reimbursements.
                        </p>
                      ) : (
                        <>
                          <div>
                            <p className="text-text-muted text-sm">Total reimbursement</p>
                            <p className="text-xl font-semibold tabular-nums">
                              {formatCurrency(paidReimbursement)}
                            </p>
                          </div>
                          {!lastPayment || displayReimbursementEntries.length > 0 ? (
                            <ul className="text-text-muted max-h-32 space-y-1 overflow-y-auto text-sm">
                              {displayReimbursementEntries.map((entry) => (
                                <li key={entry.id}>
                                  {formatShortDate(entry.work_date)} ·{' '}
                                  {formatCurrency(entry.expense_amount ?? 0)}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </>
                      )}
                    </section>

                    <div className="border-border border-t pt-3">
                      <p className="text-text-muted text-sm">Total owed</p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {formatCurrency(paidTotalAmount)}
                      </p>
                    </div>

                    {paidSuccessMessage ? (
                      <p className="text-success text-sm font-medium">
                        {paidSuccessMessage}
                      </p>
                    ) : null}

                    {summaryText ? (
                      <div>
                        <p className="text-text-muted mb-1 text-sm">Hours copy text</p>
                        <pre className="border-border bg-surface whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed">
                          {summaryText}
                        </pre>
                      </div>
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
                          Copy hours summary
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
