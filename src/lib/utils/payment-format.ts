import type { CaregiverRate } from '@/types/database';
import { getEffectiveRate } from '@/features/admin/CaregiverFilter';
import { formatHours } from '@/lib/utils/dates';

export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${m}-${d}-${y}`;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function buildPaymentSummaryText(
  periodStart: string,
  periodEnd: string,
  totalHours: number,
): string {
  return `${formatShortDate(periodStart)} - ${formatShortDate(periodEnd)}\n${formatHours(totalHours)} hours`;
}

export function calculatePaymentTotal(
  entries: { hours: number; work_date: string }[],
  rates: CaregiverRate[],
  defaultRate: number,
): { totalHours: number; totalAmount: number } {
  let totalHours = 0;
  let totalAmount = 0;

  for (const entry of entries) {
    totalHours += entry.hours;
    totalAmount +=
      entry.hours *
      getEffectiveRate(rates, defaultRate, entry.work_date);
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}
