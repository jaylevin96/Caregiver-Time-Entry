import type { CaregiverRate } from '@/types/database';
import { getEffectiveRate } from '@/features/admin/CaregiverFilter';
import {
  entryHours,
  formatHours,
  formatHoursCopy,
  formatPayCopyDate,
  parseDateOnly,
} from '@/lib/utils/dates';

function formatMonthDay(y: number, m: number, d: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
  }).format(new Date(y, m - 1, d));
}

function formatMonthDayYear(y: number, m: number, d: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

/** Compact date for entry lines within a pay period, e.g. "July 1". */
export function formatShortDate(dateStr: string): string {
  const { y, m, d } = parseDateOnly(dateStr);
  return formatMonthDay(y, m, d);
}

/** Pay period range, e.g. "July 1 – 7, 2026" or "June 28 – July 4, 2026". */
export function formatPayPeriodRange(periodStart: string, periodEnd: string): string {
  const start = parseDateOnly(periodStart);
  const end = parseDateOnly(periodEnd);
  const startFmt = formatMonthDay(start.y, start.m, start.d);

  if (start.y === end.y && start.m === end.m) {
    return `${startFmt} – ${end.d}, ${end.y}`;
  }

  if (start.y === end.y) {
    const endFmt = formatMonthDay(end.y, end.m, end.d);
    return `${startFmt} – ${endFmt}, ${end.y}`;
  }

  return `${formatMonthDayYear(start.y, start.m, start.d)} – ${formatMonthDayYear(end.y, end.m, end.d)}`;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export interface PaymentSummaryEntry {
  work_date: string;
  hours: number | null;
  expense_amount: number | null;
}

export function buildPaymentSummaryText(
  entries: PaymentSummaryEntry[],
): string {
  const lines: string[] = [];

  for (const entry of entries) {
    const hours = entryHours(entry.hours);
    if (hours > 0) {
      lines.push(
        `${formatPayCopyDate(entry.work_date)} ${formatHoursCopy(hours)}`,
      );
    }
  }

  const totalHours = entries.reduce(
    (sum, entry) => sum + entryHours(entry.hours),
    0,
  );

  if (totalHours > 0) {
    lines.push(`Total: ${formatHoursCopy(totalHours)}`);
  }

  return lines.join('\n');
}

export function calculatePaymentTotal(
  entries: PaymentSummaryEntry[],
  rates: CaregiverRate[],
  defaultRate: number,
): {
  totalHours: number;
  hoursAmount: number;
  totalReimbursement: number;
  totalAmount: number;
} {
  let totalHours = 0;
  let hoursAmount = 0;
  let totalReimbursement = 0;

  for (const entry of entries) {
    const hours = entryHours(entry.hours);
    if (hours > 0) {
      totalHours += hours;
      hoursAmount +=
        hours * getEffectiveRate(rates, defaultRate, entry.work_date);
    }

    if (entry.expense_amount && entry.expense_amount > 0) {
      totalReimbursement += entry.expense_amount;
    }
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    hoursAmount: Math.round(hoursAmount * 100) / 100,
    totalReimbursement: Math.round(totalReimbursement * 100) / 100,
    totalAmount:
      Math.round((hoursAmount + totalReimbursement) * 100) / 100,
  };
}

/** @deprecated Use formatHoursReadable for display; kept for compact numeric labels. */
export { formatHours };
