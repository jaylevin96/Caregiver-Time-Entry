import type { CaregiverRate, TimeEntry, TimeEntryExpense } from '@/types/database';
import { getEffectiveRate } from '@/features/admin/CaregiverFilter';
import {
  getBillableHours,
  getExpenseReimbursement,
} from '@/lib/utils/expenses';
import { parseDateOnly } from '@/lib/utils/dates';

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

function dayOrdinal(day: number): string {
  const teen = day % 100;
  if (teen >= 11 && teen <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Compact date for entry lines within a pay period, e.g. "July 1". */
export function formatShortDate(dateStr: string): string {
  const { y, m, d } = parseDateOnly(dateStr);
  return formatMonthDay(y, m, d);
}

/** Pay copy date, e.g. "August 17th". */
export function formatPayDate(dateStr: string): string {
  const { y, m, d } = parseDateOnly(dateStr);
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
    new Date(y, m - 1, d),
  );
  return `${month} ${dayOrdinal(d)}`;
}

/** Pay copy duration, e.g. "6 hours 30 min". */
export function formatPayHours(hours: number): string {
  const totalMinutes = Math.round(Number(hours) * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) return `${minutes} min`;
  const hourPart = wholeHours === 1 ? '1 hour' : `${wholeHours} hours`;
  if (minutes === 0) return hourPart;
  return `${hourPart} ${minutes} min`;
}

function formatReimbursementAmount(amount: number): string {
  return (Math.round(Number(amount) * 100) / 100).toFixed(2);
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatEntryHoursLine(
  entry: TimeEntry,
  expenses: TimeEntryExpense[] = [],
): string {
  const billableHours = getBillableHours(entry, expenses);
  return `${formatPayDate(entry.work_date)}: ${formatPayHours(billableHours)}`;
}

export function buildPaymentSummaryText(
  entries: TimeEntry[],
  expensesByEntryId: Record<string, TimeEntryExpense[]> = {},
): string {
  return entries
    .map((entry) =>
      formatEntryHoursLine(entry, expensesByEntryId[entry.id] ?? []),
    )
    .join('\n');
}

export function buildReimbursementSummaryText(
  entries: TimeEntry[],
  expensesByEntryId: Record<string, TimeEntryExpense[]>,
): string {
  const lines = ['Reimbursement'];

  for (const entry of entries) {
    const amount = getExpenseReimbursement(expensesByEntryId[entry.id]);
    if (amount <= 0) continue;
    lines.push(
      `${formatPayDate(entry.work_date)}: ${formatReimbursementAmount(amount)}`,
    );
  }

  if (lines.length === 1) return '';
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
