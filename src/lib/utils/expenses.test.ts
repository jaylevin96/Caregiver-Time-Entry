import { describe, expect, it } from 'vitest';
import {
  createEmptyExpenseDraft,
  expenseToDraft,
  formatCompactExpense,
  getBillableHours,
  getDisplayHours,
  getExpenseHours,
  getExpenseReimbursement,
  groupExpensesByEntryId,
  parseExpenseAmount,
  validateExpenseDrafts,
} from '@/lib/utils/expenses';
import type { TimeEntryExpense } from '@/types/database';

function expense(
  overrides: Partial<TimeEntryExpense> & Pick<TimeEntryExpense, 'time_entry_id'>,
): TimeEntryExpense {
  return {
    id: overrides.id ?? 'exp-1',
    time_entry_id: overrides.time_entry_id,
    hours: overrides.hours ?? 0,
    note: overrides.note ?? 'Parking',
    amount: overrides.amount ?? 10,
    payment_id: overrides.payment_id ?? null,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
    updated_at: overrides.updated_at ?? '2026-01-01T00:00:00Z',
  };
}

describe('expense totals', () => {
  it('sums expense hours and reimbursement amounts', () => {
    const items = [
      { hours: 1, amount: 12.5 },
      { hours: 0.5, amount: 7.5 },
    ];
    expect(getExpenseHours(items)).toBe(1.5);
    expect(getExpenseReimbursement(items)).toBe(20);
    expect(getExpenseHours(null)).toBe(0);
    expect(getExpenseReimbursement(undefined)).toBe(0);
  });

  it('computes billable hours as worked + expense hours', () => {
    expect(getBillableHours({ hours: 3 }, [{ hours: 1 }])).toBe(4);
    expect(getBillableHours({ hours: 3 }, [])).toBe(3);
  });

  it('does not double-count expenses on aggregate entries', () => {
    const aggregate = {
      hours: 8,
      expenses: [{ hours: 2 }],
      _aggregate: { entryCount: 2, paidCount: 0 },
    };
    expect(getDisplayHours(aggregate)).toBe(8);
    expect(getDisplayHours({ hours: 3, expenses: [{ hours: 1 }] })).toBe(4);
  });

  it('formats compact expense labels', () => {
    expect(formatCompactExpense(25)).toBe('$25');
    expect(formatCompactExpense(12.5)).toBe('$12.50');
  });
});

describe('draft mapping and grouping', () => {
  it('groups expenses by time entry id', () => {
    const grouped = groupExpensesByEntryId([
      expense({ id: 'a', time_entry_id: 'e1', amount: 5 }),
      expense({ id: 'b', time_entry_id: 'e2', amount: 8 }),
      expense({ id: 'c', time_entry_id: 'e1', amount: 2 }),
    ]);
    expect(grouped.e1).toHaveLength(2);
    expect(grouped.e2).toHaveLength(1);
  });

  it('maps rows to drafts and creates empty drafts', () => {
    expect(createEmptyExpenseDraft()).toEqual({
      hours: 0,
      note: '',
      amount: '',
    });
    expect(
      expenseToDraft(expense({ id: 'x', time_entry_id: 'e1', hours: 0.5, amount: 9 })),
    ).toEqual({
      id: 'x',
      hours: 0.5,
      note: 'Parking',
      amount: '9',
    });
  });
});

describe('parseExpenseAmount', () => {
  it('parses dollars and rejects non-positive values', () => {
    expect(parseExpenseAmount('$12.345')).toBe(12.35);
    expect(parseExpenseAmount(' 7 ')).toBe(7);
    expect(parseExpenseAmount('')).toBeNull();
    expect(parseExpenseAmount('$0')).toBeNull();
    expect(parseExpenseAmount('-3')).toBeNull();
    expect(parseExpenseAmount('abc')).toBeNull();
  });
});

describe('validateExpenseDrafts', () => {
  it('requires a note and amount > 0', () => {
    expect(
      validateExpenseDrafts([{ hours: 0, note: '', amount: '5' }], 4),
    ).toBe('Each expense needs a note.');
    expect(
      validateExpenseDrafts([{ hours: 0, note: 'Gas', amount: '' }], 4),
    ).toBe('Each expense needs an amount greater than zero.');
  });

  it('allows zero expense hours and validates quarters when hours > 0', () => {
    expect(
      validateExpenseDrafts([{ hours: 0, note: 'Gas', amount: '5' }], 4),
    ).toBeNull();
    expect(
      validateExpenseDrafts([{ hours: 0.1, note: 'Gas', amount: '5' }], 4),
    ).toBe('Expense hours must be in 0.25 increments.');
  });

  it('rejects worked + expense hours over 24', () => {
    expect(
      validateExpenseDrafts([{ hours: 2, note: 'OT', amount: '1' }], 23),
    ).toBe('Total billable hours for the day cannot exceed 24.');
    expect(
      validateExpenseDrafts([{ hours: 1, note: 'OT', amount: '1' }], 23),
    ).toBeNull();
  });
});
