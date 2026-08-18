import {
  addDays,
  endOfMonth,
  endOfPayrollWeek,
  getChicagoDateString,
  startOfMonth,
  startOfPayrollWeek,
} from '@/lib/utils/dates';

interface DateRangeFilterProps {
  startLabel?: string;
  endLabel?: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function DateRangeFilter({
  startLabel = 'Start',
  endLabel = 'End',
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: DateRangeFilterProps) {
  const today = getChicagoDateString();
  const weekStart = startOfPayrollWeek(today);
  const weekEnd = endOfPayrollWeek(today);
  const lastWeekStart = addDays(weekStart, -7);
  const lastWeekEnd = addDays(weekEnd, -7);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const isThisWeek = startValue === weekStart && endValue === weekEnd;
  const isLastWeek = startValue === lastWeekStart && endValue === lastWeekEnd;
  const isThisMonth = startValue === monthStart && endValue === monthEnd;

  function applyRange(start: string, end: string) {
    onStartChange(start);
    onEndChange(end);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PresetPill
          label="This week"
          selected={isThisWeek}
          onClick={() => applyRange(weekStart, weekEnd)}
        />
        <PresetPill
          label="Last week"
          selected={isLastWeek}
          onClick={() => applyRange(lastWeekStart, lastWeekEnd)}
        />
        <PresetPill
          label="This month"
          selected={isThisMonth}
          onClick={() => applyRange(monthStart, monthEnd)}
        />
      </div>

      <div className="border-border bg-surface grid grid-cols-2 divide-x rounded-xl border">
        <DateField
          label={startLabel}
          value={startValue}
          onChange={onStartChange}
        />
        <DateField label={endLabel} value={endValue} onChange={onEndChange} />
      </div>
    </div>
  );
}

function PresetPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
        selected
          ? 'bg-accent text-white'
          : 'bg-surface text-text-muted border-border border',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 overflow-hidden px-2 py-2">
      <span className="text-text-muted mb-0.5 block truncate text-xs font-medium">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="date-input-compact"
      />
    </label>
  );
}
