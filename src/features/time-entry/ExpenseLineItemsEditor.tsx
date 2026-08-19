import { HoursInput } from '@/features/time-entry/HoursInput';
import { createEmptyExpenseDraft, type ExpenseDraft } from '@/lib/utils/expenses';
import { formatHours } from '@/lib/utils/dates';
import { formatCurrency } from '@/lib/utils/payment-format';

interface ExpenseLineItemsEditorProps {
  items: ExpenseDraft[];
  onChange: (items: ExpenseDraft[]) => void;
  disabled?: boolean;
}

export function ExpenseLineItemsEditor({
  items,
  onChange,
  disabled = false,
}: ExpenseLineItemsEditorProps) {
  function updateItem(index: number, patch: Partial<ExpenseDraft>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, createEmptyExpenseDraft()]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-text-muted text-sm font-medium">Expenses (optional)</p>
        <button
          type="button"
          disabled={disabled}
          onClick={addItem}
          className="text-accent inline-flex min-h-11 items-center text-sm font-medium disabled:opacity-50"
        >
          + Add expense
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-text-muted text-sm">
          Add reimbursements like groceries or supplies. Expense hours count toward
          your paid hours.
        </p>
      ) : null}

      {items.map((item, index) => (
        <div
          key={item.id ?? `draft-${index}`}
          className="border-border bg-surface space-y-3 rounded-xl border p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">Expense {index + 1}</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeItem(index)}
              className="text-danger inline-flex min-h-11 items-center text-sm disabled:opacity-50"
            >
              Remove
            </button>
          </div>

          <label className="block">
            <span className="text-text-muted mb-1.5 block text-sm font-medium">
              Note
            </span>
            <input
              type="text"
              value={item.note}
              onChange={(e) => updateItem(index, { note: e.target.value })}
              placeholder="e.g. Groceries"
              disabled={disabled}
              className="border-border bg-surface-raised focus:border-accent focus:ring-accent/20 w-full rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-text-muted mb-1.5 block text-sm font-medium">
              Amount
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={item.amount}
              onChange={(e) => updateItem(index, { amount: e.target.value })}
              placeholder="e.g. 100"
              disabled={disabled}
              className="border-border bg-surface-raised focus:border-accent focus:ring-accent/20 w-full rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 disabled:opacity-50"
            />
          </label>

          <div>
            <p className="text-text-muted mb-2 text-sm font-medium">
              Additional hours (optional)
            </p>
            <HoursInput
              value={item.hours}
              onChange={(hours) => updateItem(index, { hours })}
              disabled={disabled}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ExpenseLineItemsReadOnlyProps {
  items: { hours: number; note: string; amount: number }[];
}

export function ExpenseLineItemsReadOnly({ items }: ExpenseLineItemsReadOnlyProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-text-muted text-sm font-medium">Expenses</p>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li
            key={`${item.note}-${index}`}
            className="border-border bg-surface space-y-2 rounded-xl border p-3 text-sm"
          >
            <p className="font-medium">Expense {index + 1}</p>
            <div>
              <p className="text-text-muted text-xs font-medium">Note</p>
              <p className="mt-0.5">{item.note}</p>
            </div>
            <div>
              <p className="text-text-muted text-xs font-medium">Amount</p>
              <p className="mt-0.5 tabular-nums">{formatCurrency(item.amount)}</p>
            </div>
            {item.hours > 0 ? (
              <div>
                <p className="text-text-muted text-xs font-medium">
                  Additional hours
                </p>
                <p className="mt-0.5 tabular-nums">
                  {formatHours(item.hours)}h
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
