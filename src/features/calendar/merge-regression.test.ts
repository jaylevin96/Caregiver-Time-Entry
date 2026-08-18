import { describe, expect, it } from 'vitest';
import { buildDayPills } from '@/features/calendar/CalendarDayCell';
import {
  aggregateEntriesByDate,
  groupEntriesByDate,
  toCalendarEntry,
  type EntryWithExpenses,
} from '@/features/calendar/entry-aggregates';
import { getDisplayHours, getExpenseReimbursement } from '@/lib/utils/expenses';
import { getDayEntryStatus } from '@/lib/utils/entry-status';
import { calculatePaymentTotal } from '@/lib/utils/payment-format';
import type { CaregiverRate, TimeEntry, TimeEntryExpense } from '@/types/database';

function makeExpense(
  overrides: Partial<TimeEntryExpense> &
    Pick<TimeEntryExpense, 'id' | 'time_entry_id' | 'amount'>,
): TimeEntryExpense {
  return {
    hours: 0,
    note: 'Expense',
    payment_id: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function makeEntry(
  overrides: Partial<EntryWithExpenses> &
    Pick<TimeEntry, 'id' | 'caregiver_id' | 'work_date' | 'hours'>,
): EntryWithExpenses {
  return {
    notes: null,
    payment_id: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    created_by: overrides.caregiver_id,
    updated_by: overrides.caregiver_id,
    ...overrides,
  };
}

describe('merge b762032: expense normalize', () => {
  it('prefers nested time_entry_expenses over expenses alias', () => {
    const entry = toCalendarEntry(
      makeEntry({
        id: 'e1',
        caregiver_id: 'c1',
        work_date: '2026-08-04',
        hours: 3,
        time_entry_expenses: [
          makeExpense({ id: 'x1', time_entry_id: 'e1', hours: 1, amount: 40 }),
        ],
        expenses: [makeExpense({ id: 'old', time_entry_id: 'e1', hours: 9, amount: 99 })],
      }),
    );

    expect(entry.expenses).toHaveLength(1);
    expect(entry.expenses?.[0]?.id).toBe('x1');
    expect(getDisplayHours(entry)).toBe(4);
    expect(getExpenseReimbursement(entry.expenses)).toBe(40);
  });

  it('falls back to expenses alias when nested join key is absent', () => {
    const entry = toCalendarEntry(
      makeEntry({
        id: 'e1',
        caregiver_id: 'c1',
        work_date: '2026-08-04',
        hours: 2,
        expenses: [
          makeExpense({ id: 'x2', time_entry_id: 'e1', hours: 0.5, amount: 12 }),
        ],
      }),
    );

    expect(getDisplayHours(entry)).toBe(2.5);
    expect(getExpenseReimbursement(entry.expenses)).toBe(12);
  });
});

describe('merge b762032: aggregate path does not double-count hours', () => {
  it('stores billable hours on aggregate and keeps expense amounts for $ totals', () => {
    const rows = [
      makeEntry({
        id: 'e1',
        caregiver_id: 'alice',
        work_date: '2026-08-04',
        hours: 3,
        time_entry_expenses: [
          makeExpense({ id: 'x1', time_entry_id: 'e1', hours: 1, amount: 40 }),
        ],
      }),
      makeEntry({
        id: 'e2',
        caregiver_id: 'bob',
        work_date: '2026-08-04',
        hours: 2,
        time_entry_expenses: [
          makeExpense({ id: 'x2', time_entry_id: 'e2', hours: 0, amount: 10 }),
        ],
      }),
    ];

    const aggregated = aggregateEntriesByDate(rows)['2026-08-04'];
    expect(aggregated).toBeDefined();
    // 3+1 + 2+0 = 6 billable already stored on hours
    expect(aggregated!.hours).toBe(6);
    expect(getDisplayHours(aggregated!)).toBe(6);
    expect(getExpenseReimbursement(aggregated!.expenses)).toBe(50);
    expect(aggregated!._aggregate).toEqual({ entryCount: 2, paidCount: 0 });
  });

  it('marks aggregate partial when only some entries are paid', () => {
    const rows = [
      makeEntry({
        id: 'e1',
        caregiver_id: 'alice',
        work_date: '2026-08-04',
        hours: 4,
        payment_id: 'pay-1',
      }),
      makeEntry({
        id: 'e2',
        caregiver_id: 'bob',
        work_date: '2026-08-04',
        hours: 3,
        payment_id: null,
      }),
    ];

    const aggregated = aggregateEntriesByDate(rows)['2026-08-04']!;
    expect(aggregated._aggregate).toEqual({ entryCount: 2, paidCount: 1 });
    expect(getDayEntryStatus('2026-08-04', aggregated)).toBe('partial');

    const multi = groupEntriesByDate(rows)['2026-08-04']!;
    expect(multi).toHaveLength(2);
  });

  it('marks aggregate paid only when every entry is paid', () => {
    const rows = [
      makeEntry({
        id: 'e1',
        caregiver_id: 'alice',
        work_date: '2026-08-04',
        hours: 4,
        payment_id: 'pay-1',
      }),
      makeEntry({
        id: 'e2',
        caregiver_id: 'bob',
        work_date: '2026-08-04',
        hours: 3,
        payment_id: 'pay-2',
      }),
    ];

    const aggregated = aggregateEntriesByDate(rows)['2026-08-04']!;
    expect(getDayEntryStatus('2026-08-04', aggregated)).toBe('paid');
    expect(aggregated.payment_id).toBe('pay-1');
  });
});

describe('merge b762032: buildDayPills (line items + main pills UI)', () => {
  const caregiversById = new Map([
    ['alice', { display_name: 'Alice', calendar_color: '#dc2626' }],
    ['bob', { display_name: 'Bob', calendar_color: '#2563eb' }],
  ]);

  it('shows billable hours and separate $ reimbursement pill (not worked-only)', () => {
    const entry = toCalendarEntry(
      makeEntry({
        id: 'e1',
        caregiver_id: 'alice',
        work_date: '2026-08-04',
        hours: 3,
        time_entry_expenses: [
          makeExpense({ id: 'x1', time_entry_id: 'e1', hours: 1, amount: 40 }),
        ],
      }),
    );

    const pills = buildDayPills([entry], caregiversById);
    expect(pills).toHaveLength(2);

    const hoursPill = pills.find((pill) => !pill.isExpense);
    const expensePill = pills.find((pill) => pill.isExpense);

    expect(hoursPill?.label).toBe('4');
    expect(hoursPill?.color).toBe('#dc2626');
    expect(expensePill?.label).toBe('$40');
    expect(expensePill?.isExpense).toBe(true);
  });

  it('renders multi-caregiver pills with colors and sorts hours before expense', () => {
    const entries = [
      toCalendarEntry(
        makeEntry({
          id: 'e-bob',
          caregiver_id: 'bob',
          work_date: '2026-08-04',
          hours: 2,
        }),
      ),
      toCalendarEntry(
        makeEntry({
          id: 'e-alice',
          caregiver_id: 'alice',
          work_date: '2026-08-04',
          hours: 3,
          time_entry_expenses: [
            makeExpense({ id: 'x1', time_entry_id: 'e-alice', amount: 25 }),
          ],
        }),
      ),
    ];

    const pills = buildDayPills(entries, caregiversById);
    // Alice hours, Alice $, Bob hours — sorted by display name then hours before expense
    expect(pills.map((pill) => pill.key)).toEqual([
      'e-alice-hours',
      'e-alice-expense',
      'e-bob-hours',
    ]);
    expect(pills[0]?.color).toBe('#dc2626');
    expect(pills[2]?.color).toBe('#2563eb');
  });
});

describe('merge b762032: pay totals vs main combined total_amount model', () => {
  it('keeps totalAmount as hours pay only (local RPC semantics)', () => {
    const entries: TimeEntry[] = [
      makeEntry({
        id: 'e1',
        caregiver_id: 'c1',
        work_date: '2026-08-01',
        hours: 3,
      }),
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
      e1: [makeExpense({ id: 'x1', time_entry_id: 'e1', hours: 1, amount: 40 })],
    };

    const total = calculatePaymentTotal(entries, rates, 15, expensesByEntryId);

    expect(total.totalHours).toBe(4);
    expect(total.totalAmount).toBe(80); // 4h * $20 — not 80 + 40
    expect(total.totalReimbursement).toBe(40);
  });
});

describe('merge b762032: no leftover main expense_amount model in helpers', () => {
  it('calendar entries expose expenses arrays, not expense_amount', () => {
    const entry = toCalendarEntry(
      makeEntry({
        id: 'e1',
        caregiver_id: 'c1',
        work_date: '2026-08-04',
        hours: 1,
        time_entry_expenses: [
          makeExpense({ id: 'x1', time_entry_id: 'e1', amount: 5 }),
        ],
      }),
    );

    expect('expense_amount' in entry).toBe(false);
    expect(Array.isArray(entry.expenses)).toBe(true);
  });
});
