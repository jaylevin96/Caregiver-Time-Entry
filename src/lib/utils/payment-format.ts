import type { CaregiverRate, TimeEntry, TimeEntryExpense } from '@/types/database';
import { getEffectiveRate } from '@/features/admin/CaregiverFilter';
import { getBillableHours } from '@/lib/utils/expenses';
import { formatHours, parseDateOnly } from '@/lib/utils/dates';

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

export function formatEntryHoursLine(
  entry: TimeEntry,
  expenses: TimeEntryExpense[] = [],
): string {
  const billableHours = getBillableHours(entry, expenses);
  const expenseHours = billableHours - entry.hours;

  if (expenseHours > 0) {
    return `${formatShortDate(entry.work_date)} · ${formatHours(entry.hours)} h worked + ${formatHours(expenseHours)} h expenses`;
  }

  return `${formatShortDate(entry.work_date)} · ${formatHours(entry.hours)} h`;
}

export function buildPaymentSummaryText(
  entries: TimeEntry[],
  totalHours: number,
  expensesByEntryId: Record<string, TimeEntryExpense[]> = {},
): string {
  const lines = entries.map((entry) =>
    formatEntryHoursLine(entry, expensesByEntryId[entry.id] ?? []),
  );
  lines.push(`${formatHours(totalHours)} hours`);
  return lines.join('\n');
}

export function buildReimbursementSummaryText(
  expensesByEntryId: Record<string, TimeEntryExpense[]>,
  totalReimbursement: number,
): string {
  if (totalReimbursement <= 0) return '';

  const lines = ['Reimbursement'];
  for (const expenses of Object.values(expensesByEntryId)) {
    for (const expense of expenses) {
      lines.push(`${expense.note}: ${formatCurrency(expense.amount)}`);
    }
  }
  lines.push(formatCurrency(totalReimbursement));
  return lines.join('\n');
}

export function calculatePaymentTotal(
  entries: TimeEntry[],
  rates: CaregiverRate[],
  defaultRate: number,
  expensesByEntryId: Record<string, TimeEntryExpense[]> = {},
): {
  totalHours: number;
  totalAmount: number;
  totalReimbursement: number;
} {
  let totalHours = 0;
  let totalAmount = 0;
  let totalReimbursement = 0;

  for (const entry of entries) {
    const entryExpenses = expensesByEntryId[entry.id] ?? [];
    const billableHours = getBillableHours(entry, entryExpenses);

    totalHours += billableHours;
    totalAmount +=
      billableHours * getEffectiveRate(rates, defaultRate, entry.work_date);

    for (const expense of entryExpenses) {
      totalReimbursement += expense.amount;
    }
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalReimbursement: Math.round(totalReimbursement * 100) / 100,
  };
}
