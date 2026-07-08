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
  return (
    <div className="border-border bg-surface grid grid-cols-2 divide-x rounded-xl border">
      <DateField
        label={startLabel}
        value={startValue}
        onChange={onStartChange}
      />
      <DateField label={endLabel} value={endValue} onChange={onEndChange} />
    </div>
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
