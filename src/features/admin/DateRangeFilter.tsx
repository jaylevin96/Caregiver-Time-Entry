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
      <div className="space-y-1.5">
        <p className="text-text-muted px-0.5 text-xs font-medium">Filter by</p>
        <div
          role="group"
          aria-label="Filter by"
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
      </div>

      <div className="grid grid-cols-2 gap-2">
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
        'min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
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
    <label className="border-border bg-surface-raised focus-within:border-accent focus-within:ring-accent/20 relative flex min-h-[4.25rem] cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 shadow-sm focus-within:ring-2 active:bg-surface">
      <span className="text-text-muted pointer-events-none block truncate text-xs font-medium">
        {label}
      </span>
      <span className="pointer-events-none mt-0.5 flex min-h-11 items-center justify-between gap-2">
        <span className="text-text min-w-0 truncate text-base font-medium">
          {formatFieldDate(value)}
        </span>
        <CalendarGlyph />
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="date-input-button"
      />
    </label>
  );
}

function formatFieldDate(dateStr: string): string {
  if (!dateStr) return 'Choose date';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return 'Choose date';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="text-text-muted pointer-events-none h-5 w-5 shrink-0"
    >
      <path
        fill="currentColor"
        d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm11 7H3v7h14V9ZM6 7h8V6H6v1Z"
      />
    </svg>
  );
}
