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
import { groupExpensesByEntryId } from '@/lib/utils/expenses';
import {
  buildPaymentSummaryText,
  buildReimbursementSummaryText,
  calculatePaymentTotal,
  formatCurrency,
  formatEntryHoursLine,
  formatPayPeriodRange,
} from '@/lib/utils/payment-format';
import { formatHours, getChicagoDateString } from '@/lib/utils/dates';
import type { CaregiverRate, Payment, TimeEntry, TimeEntryExpense } from '@/types/database';

export function AdminPayPage() {
  const {
    payCaregivers: caregivers,
    unpaidCaregiverIds,
    loading: caregiversLoading,
    error: caregiversError,
    refresh: refreshCaregivers,
  } = useCaregivers();
  const { defaultRate } = useDefaultHourlyRate();
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(
    null,
  );
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [expensesByEntryId, setExpensesByEntryId] = useState<
    Record<string, TimeEntryExpense[]>
  >({});
  const [rates, setRates] = useState<CaregiverRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [paidEntries, setPaidEntries] = useState<TimeEntry[]>([]);
  const [paidExpensesByEntryId, setPaidExpensesByEntryId] = useState<
    Record<string, TimeEntryExpense[]>
  >({});
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const activeCaregiverId =
    selectedCaregiverId ?? caregivers[0]?.id ?? undefined;

  const activeCaregiver = caregivers.find((c) => c.id === activeCaregiverId);

  const loadSummary = useCallback(async () => {
    if (!activeCaregiverId || !periodStart || !periodEnd) {
      setEntries([]);
      setExpensesByEntryId({});
      return;
    }

    if (periodEnd < periodStart) {
      setError('End date must be on or after start date.');
      setEntries([]);
      setExpensesByEntryId({});
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

    if (ratesResult.error) {
      setError(ratesResult.error.message);
      setEntries([]);
      setExpensesByEntryId({});
      setRates([]);
      setLoading(false);
      return;
    }

    setRates(ratesResult.data ?? []);

    if (entriesResult.error) {
      setError(entriesResult.error.message);
      setEntries([]);
      setExpensesByEntryId({});
      setLoading(false);
      return;
    }

    const loadedEntries = entriesResult.data ?? [];
    setEntries(loadedEntries);

    if (loadedEntries.length === 0) {
      setExpensesByEntryId({});
      setLoading(false);
      return;
    }

    const entryIds = loadedEntries.map((entry) => entry.id);
    const { data: expenses, error: expensesError } = await db
      .from('time_entry_expenses')
      .select('*')
      .in('time_entry_id', entryIds)
      .order('created_at');

    if (expensesError) {
      setError(
        `Could not load expenses: ${expensesError.message}. Totals may be incomplete.`,
      );
      setEntries([]);
      setExpensesByEntryId({});
    } else {
      setExpensesByEntryId(groupExpensesByEntryId(expenses ?? []));
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
    setPaidEntries([]);
    setPaidExpensesByEntryId({});
    setCopyMessage(null);
  }, [activeCaregiverId, periodStart, periodEnd]);

  const activeEntries = lastPayment ? paidEntries : entries;
  const activeExpensesByEntryId = lastPayment
    ? paidExpensesByEntryId
    : expensesByEntryId;

  const { totalHours, totalAmount, totalReimbursement } = calculatePaymentTotal(
    activeEntries,
    rates,
    defaultRate,
    activeExpensesByEntryId,
  );

  const hoursSummaryText = useMemo(() => {
    if (activeEntries.length === 0) return '';
    return buildPaymentSummaryText(activeEntries, activeExpensesByEntryId);
  }, [activeEntries, activeExpensesByEntryId]);

  const reimbursementSummaryText = useMemo(() => {
    return buildReimbursementSummaryText(
      activeEntries,
      activeExpensesByEntryId,
    );
  }, [activeEntries, activeExpensesByEntryId]);

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

    setPaidEntries(entries);
    setPaidExpensesByEntryId(expensesByEntryId);
    setLastPayment(data);
    setSubmitting(false);
    await Promise.all([loadSummary(), refreshCaregivers({ silent: true })]);
  }

  async function handleCopyHours() {
    if (!hoursSummaryText) return;

    try {
      await navigator.clipboard.writeText(hoursSummaryText);
      setCopyMessage('Hours payment copied');
    } catch {
      setCopyMessage('Could not copy — select and copy manually');
    }
  }

  async function handleCopyReimbursement() {
    if (!reimbursementSummaryText) return;

    try {
      await navigator.clipboard.writeText(reimbursementSummaryText);
      setCopyMessage('Reimbursement copied');
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
      ) : caregiversError ? (
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <ErrorBanner message={caregiversError} onRetry={refreshCaregivers} />
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
            unpaidIds={unpaidCaregiverIds}
          />

          <div className="space-y-3 px-3 py-3 sm:px-4 sm:py-4">
            <DateRangeFilter
              startValue={periodStart}
              endValue={periodEnd}
              onStartChange={setPeriodStart}
              onEndChange={setPeriodEnd}
            />

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
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Hours payment</p>
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
                            {formatCurrency(lastPayment?.total_amount ?? totalAmount)}
                          </p>
                        </div>
                      </div>

                      {!lastPayment && entries.length > 0 ? (
                        <ul className="text-text-muted max-h-32 space-y-1 overflow-y-auto text-sm">
                          {entries.map((entry) => (
                            <li key={entry.id}>
                              {formatEntryHoursLine(
                                entry,
                                expensesByEntryId[entry.id] ?? [],
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {hoursSummaryText ? (
                        <pre className="border-border bg-surface whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed">
                          {hoursSummaryText}
                        </pre>
                      ) : null}

                      {hoursSummaryText ? (
                        <Button
                          fullWidth
                          variant="secondary"
                          onClick={handleCopyHours}
                        >
                          Copy Hours Payment
                        </Button>
                      ) : null}
                    </div>

                    {(lastPayment?.total_reimbursement ?? totalReimbursement) > 0 ? (
                      <div className="border-border space-y-3 border-t pt-4">
                        <p className="text-sm font-semibold">Expense reimbursement</p>
                        <div>
                          <p className="text-text-muted text-sm">Amount owed</p>
                          <p className="text-xl font-semibold tabular-nums">
                            {formatCurrency(
                              lastPayment?.total_reimbursement ?? totalReimbursement,
                            )}
                          </p>
                        </div>

                        {reimbursementSummaryText ? (
                          <pre className="border-border bg-surface whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed">
                            {reimbursementSummaryText}
                          </pre>
                        ) : null}

                        <Button
                          fullWidth
                          variant="secondary"
                          onClick={handleCopyReimbursement}
                        >
                          Copy Reimbursement
                        </Button>
                      </div>
                    ) : null}

                    {lastPayment ? (
                      <p className="text-success text-sm font-medium">
                        Marked paid. Copy the summaries below for Zelle.
                      </p>
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
