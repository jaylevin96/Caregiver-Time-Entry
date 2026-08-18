import { describe, expect, it } from 'vitest';
import {
  buildPaymentSummaryText,
  buildReimbursementSummaryText,
  calculatePaymentTotal,
  formatCurrency,
  formatEntryHoursLine,
  formatPayDate,
  formatPayHours,
  formatPayPeriodRange,
  formatShortDate,
} from '@/lib/utils/payment-format';
import type { CaregiverRate, TimeEntry, TimeEntryExpense } from '@/types/database';

function entry(overrides: Partial<TimeEntry> & Pick<TimeEntry, 'id' | 'work_date' | 'hours'>): TimeEntry {
  return {
    caregiver_id: 'c1',
    notes: null,
    payment_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: 'c1',
    updated_by: 'c1',
    ...overrides,
  };
}

function expense(
  overrides: Partial<TimeEntryExpense> & Pick<TimeEntryExpense, 'time_entry_id' | 'amount'>,
): TimeEntryExpense {
  return {
    id: overrides.id ?? 'x1',
    time_entry_id: overrides.time_entry_id,
    hours: overrides.hours ?? 0,
    note: overrides.note ?? 'Supplies',
    amount: overrides.amount,
    payment_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('pay period formatting', () => {
  it('formats short dates and period ranges', () => {
    expect(formatShortDate('2026-07-01')).toMatch(/July 1/);
    expect(formatPayPeriodRange('2026-07-01', '2026-07-07')).toMatch(
      /July 1 – 7, 2026/,
    );
    expect(formatPayPeriodRange('2026-06-28', '2026-07-04')).toMatch(
      /June 28 – July 4, 2026/,
    );
  });

  it('formats pay dates with ordinals', () => {
    expect(formatPayDate('2026-08-01')).toBe('August 1st');
    expect(formatPayDate('2026-08-02')).toBe('August 2nd');
    expect(formatPayDate('2026-08-03')).toBe('August 3rd');
    expect(formatPayDate('2026-08-11')).toBe('August 11th');
    expect(formatPayDate('2026-08-17')).toBe('August 17th');
    expect(formatPayDate('2026-08-21')).toBe('August 21st');
    expect(formatPayDate('2026-08-22')).toBe('August 22nd');
    expect(formatPayDate('2026-08-23')).toBe('August 23rd');
  });

  it('formats combined pay hours as hours and min', () => {
    expect(formatPayHours(6.5)).toBe('6 hours 30 min');
    expect(formatPayHours(1)).toBe('1 hour');
    expect(formatPayHours(6)).toBe('6 hours');
    expect(formatPayHours(0.25)).toBe('15 min');
    expect(formatPayHours(1.25)).toBe('1 hour 15 min');
  });

  it('formats currency with cents', () => {
    expect(formatCurrency(100)).toBe('$100.00');
    expect(formatCurrency(12.5)).toBe('$12.50');
    expect(formatCurrency(22.4)).toBe('$22.40');
  });
});

describe('payment copy and totals (local expense line-item model)', () => {
  it('combines worked and expense hours on each day line', () => {
    const line = formatEntryHoursLine(entry({ id: 'e1', work_date: '2026-08-17', hours: 5.5 }), [
      expense({ time_entry_id: 'e1', hours: 1, amount: 250 }),
    ]);
    expect(line).toBe('August 17th: 6 hours 30 min');
  });

  it('builds hours and reimbursement copy separately', () => {
    const entries = [entry({ id: 'e1', work_date: '2026-08-17', hours: 5.5 })];
    const expensesByEntryId = {
      e1: [
        expense({ time_entry_id: 'e1', hours: 1, amount: 200, note: 'Parking' }),
        expense({ time_entry_id: 'e1', hours: 0, amount: 50, note: 'Groceries' }),
      ],
    };

    const hoursText = buildPaymentSummaryText(entries, expensesByEntryId);
    expect(hoursText).toBe('August 17th: 6 hours 30 min');

    const reimbursementText = buildReimbursementSummaryText(
      entries,
      expensesByEntryId,
    );
    expect(reimbursementText).toBe('Reimbursement\nAugust 17th: 250.00');
    expect(buildReimbursementSummaryText([], {})).toBe('');
  });

  it('calculates hours pay excluding reimbursement amounts', () => {
    const entries = [
      entry({ id: 'e1', work_date: '2026-07-01', hours: 3 }),
      entry({ id: 'e2', work_date: '2026-07-02', hours: 2 }),
    ];
    const rates: CaregiverRate[] = [
      {
        id: 'r1',
        caregiver_id: 'c1',
        hourly_rate: 20,
        effective_from: '2026-01-01',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    const expensesByEntryId = {
      e1: [expense({ time_entry_id: 'e1', hours: 1, amount: 40 })],
      e2: [expense({ time_entry_id: 'e2', hours: 0, amount: 10 })],
    };

    const total = calculatePaymentTotal(entries, rates, 15, expensesByEntryId);

    // Billable hours: (3+1) + (2+0) = 6
    expect(total.totalHours).toBe(6);
    // Hours pay only: 6 * 20 = 120 (reimbursement not included)
    expect(total.totalAmount).toBe(120);
    expect(total.totalReimbursement).toBe(50);
  });

  it('uses default rate when no caregiver rate matches', () => {
    const total = calculatePaymentTotal(
      [entry({ id: 'e1', work_date: '2026-07-01', hours: 2 })],
      [],
      18,
      {},
    );
    expect(total.totalAmount).toBe(36);
    expect(total.totalReimbursement).toBe(0);
  });

  it('applies rate effective_from by work date', () => {
    const rates: CaregiverRate[] = [
      {
        id: 'old',
        caregiver_id: 'c1',
        hourly_rate: 10,
        effective_from: '2026-01-01',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'new',
        caregiver_id: 'c1',
        hourly_rate: 25,
        effective_from: '2026-07-01',
        created_at: '2026-07-01T00:00:00Z',
      },
    ];

    const total = calculatePaymentTotal(
      [
        entry({ id: 'e1', work_date: '2026-06-30', hours: 2 }),
        entry({ id: 'e2', work_date: '2026-07-01', hours: 2 }),
      ],
      rates,
      15,
      {},
    );

    expect(total.totalAmount).toBe(2 * 10 + 2 * 25);
  });
});
