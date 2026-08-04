import { describe, expect, it } from 'vitest';
import {
  buildPaymentSummaryText,
  buildReimbursementSummaryText,
  calculatePaymentTotal,
  formatCurrency,
  formatEntryHoursLine,
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

  it('formats currency without forcing cents for whole dollars', () => {
    expect(formatCurrency(100)).toBe('$100');
    expect(formatCurrency(12.5)).toBe('$12.5');
  });
});

describe('payment copy and totals (local expense line-item model)', () => {
  it('shows worked + expense hours on entry lines', () => {
    const line = formatEntryHoursLine(entry({ id: 'e1', work_date: '2026-07-01', hours: 3 }), [
      expense({ time_entry_id: 'e1', hours: 1, amount: 40 }),
    ]);
    expect(line).toContain('3 h worked + 1 h expenses');
  });

  it('builds hours and reimbursement copy separately', () => {
    const entries = [entry({ id: 'e1', work_date: '2026-07-01', hours: 3 })];
    const expensesByEntryId = {
      e1: [expense({ time_entry_id: 'e1', hours: 1, amount: 40, note: 'Parking' })],
    };

    const hoursText = buildPaymentSummaryText(entries, 4, expensesByEntryId);
    expect(hoursText).toContain('4 hours');
    expect(hoursText).toContain('worked + 1 h expenses');

    const reimbursementText = buildReimbursementSummaryText(expensesByEntryId, 40);
    expect(reimbursementText).toContain('Reimbursement');
    expect(reimbursementText).toContain('Parking:');
    expect(reimbursementText.trim().endsWith('$40')).toBe(true);
    expect(buildReimbursementSummaryText({}, 0)).toBe('');
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
