import { isValidQuarterHours } from '@/lib/utils/dates';
import type { TimeEntryExpense } from '@/types/database';

export interface ExpenseDraft {
  id?: string;
  hours: number;
  note: string;
  amount: string;
}

export function createEmptyExpenseDraft(): ExpenseDraft {
  return { id: crypto.randomUUID(), hours: 0, note: '', amount: '' };
}

export function expenseDraftsToRows(
  timeEntryId: string,
  drafts: ExpenseDraft[],
): Array<{
  id: string;
  time_entry_id: string;
  hours: number;
  note: string;
  amount: number;
}> {
  return drafts.map((draft) => ({
    id: draft.id ?? crypto.randomUUID(),
    time_entry_id: timeEntryId,
    hours: draft.hours,
    note: draft.note.trim(),
    amount: parseExpenseAmount(draft.amount) ?? 0,
  }));
}

export function groupExpensesByEntryId(
  expenses: TimeEntryExpense[],
): Record<string, TimeEntryExpense[]> {
  const map: Record<string, TimeEntryExpense[]> = {};

  for (const expense of expenses) {
    const entryExpenses = map[expense.time_entry_id] ?? [];
    entryExpenses.push(expense);
    map[expense.time_entry_id] = entryExpenses;
  }

  return map;
}

export function expenseToDraft(expense: TimeEntryExpense): ExpenseDraft {
  return {
    id: expense.id,
    hours: expense.hours,
    note: expense.note,
    amount: String(expense.amount),
  };
}

export function getExpenseHours(expenses: { hours: number }[] | null | undefined): number {
  return expenses?.reduce((sum, expense) => sum + Number(expense.hours), 0) ?? 0;
}

export function getExpenseReimbursement(
  expenses: { amount: number }[] | null | undefined,
): number {
  return expenses?.reduce((sum, expense) => sum + Number(expense.amount), 0) ?? 0;
}

/** Compact expense label for calendar cells, e.g. "$25.00". */
export function formatCompactExpense(amount: number): string {
  return `$${Number(amount).toFixed(2)}`;
}

export function getBillableHours(
  entry: { hours: number },
  expenses?: { hours: number }[] | null,
): number {
  return Number(entry.hours) + getExpenseHours(expenses);
}

export function getDisplayHours(entry: {
  hours: number;
  expenses?: { hours: number }[] | null;
  _aggregate?: unknown;
}): number {
  if (entry._aggregate) return Number(entry.hours);
  return getBillableHours(entry, entry.expenses);
}

export function parseExpenseAmount(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, '');
  if (!trimmed) return null;
  const amount = Number.parseFloat(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function validateExpenseDrafts(
  drafts: ExpenseDraft[],
  workedHours: number,
): string | null {
  let expenseHours = 0;

  for (const draft of drafts) {
    const note = draft.note.trim();
    const amount = parseExpenseAmount(draft.amount);

    if (!note) {
      return 'Each expense needs a note.';
    }
    if (amount === null) {
      return 'Each expense needs an amount greater than zero.';
    }
    if (draft.hours > 0 && !isValidQuarterHours(draft.hours)) {
      return 'Expense hours must be in 0.25 increments.';
    }

    expenseHours += draft.hours;
  }

  if (workedHours + expenseHours > 24) {
    return 'Total billable hours for the day cannot exceed 24.';
  }

  return null;
}
