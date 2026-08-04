import {
  formatHours,
  formatHoursReadable,
} from '@/lib/utils/dates';
import {
  formatCompactExpense,
  getDisplayHours,
  getExpenseReimbursement,
} from '@/lib/utils/expenses';
import {
  getDayEntryStatus,
  getStatusLabel,
  showsPaymentIndicator,
  type CalendarEntry,
  type DayEntryStatus,
} from '@/lib/utils/entry-status';
import { textColorForBackground } from '@/lib/utils/calendar-colors';

export interface CaregiverDayPill {
  key: string;
  caregiverId: string;
  label: string;
  color: string;
  displayName: string;
  title: string;
  isExpense?: boolean;
}

interface CalendarDayCellProps {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  entry: CalendarEntry | undefined;
  onSelect: (date: string) => void;
  size?: 'default' | 'large';
  readOnly?: boolean;
  accentColor?: string;
  hideStatus?: boolean;
  dayPills?: CaregiverDayPill[];
}

function statusAriaLabel(
  status: DayEntryStatus,
  entry?: CalendarEntry,
  readOnly = false,
): string {
  if (!entry) {
    return readOnly ? 'no entry' : 'no entry, tap to add';
  }

  const parts: string[] = [];
  const hours = getDisplayHours(entry);
  const expense = getExpenseReimbursement(entry.expenses);

  if (hours > 0) parts.push(`${formatHoursReadable(hours)}`);
  if (expense > 0) parts.push(`${formatCompactExpense(expense)} reimbursement`);

  const summary = parts.length > 0 ? parts.join(', ') : 'entry';

  switch (status) {
    case 'paid':
      return `${summary}, paid`;
    case 'partial':
      return `${summary}, partially paid`;
    case 'locked':
      return `${summary}, locked`;
    case 'editable':
      return `${summary}, editable`;
    case 'future':
      return 'future week, not yet available';
    default:
      return readOnly ? summary : `${summary}, tap to view`;
  }
}

export function CalendarDayCell({
  date,
  inMonth,
  isToday,
  entry,
  onSelect,
  size = 'default',
  readOnly = false,
  accentColor,
  hideStatus = false,
  dayPills,
}: CalendarDayCellProps) {
  const dayNum = Number(date.slice(-2));
  const status = getDayEntryStatus(date, entry);
  const badge =
    hideStatus || !showsPaymentIndicator(status)
      ? null
      : getStatusLabel(status);
  const accentStyle = accentColor ? { color: accentColor } : undefined;
  const todayRingStyle = accentColor
    ? ({ '--tw-ring-color': accentColor } as React.CSSProperties)
    : undefined;
  const hasPills = dayPills && dayPills.length > 0;
  const hours = entry ? getDisplayHours(entry) : 0;
  const expense = entry ? getExpenseReimbursement(entry.expenses) : 0;
  const hasHours = hours > 0;
  const hasExpense = expense > 0;
  const hasEntry = hasPills || hasHours || hasExpense;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-label={`${date}, ${statusAriaLabel(status, entry, readOnly)}`}
      style={isToday ? todayRingStyle : undefined}
      className={[
        'relative flex touch-manipulation flex-col rounded-lg p-1 transition-transform active:scale-95',
        size === 'large' ? 'min-h-[5.5rem] aspect-auto' : 'aspect-square',
        hasPills && size === 'default' ? 'min-h-[4.5rem]' : '',
        inMonth ? '' : 'opacity-35',
        status === 'paid'
          ? 'bg-success/10'
          : status === 'partial'
            ? 'bg-success/5'
            : status === 'locked'
            ? 'bg-surface opacity-60'
            : status === 'future'
              ? 'bg-surface opacity-60'
              : inMonth
                ? 'bg-surface-raised'
                : 'bg-transparent',
        isToday
          ? accentColor
            ? 'shadow-sm ring-2 ring-inset'
            : 'ring-accent shadow-sm ring-2 ring-inset'
          : '',
        !readOnly &&
        !hasEntry &&
        inMonth &&
        status === 'empty'
          ? 'border-border/70 border border-dashed'
          : inMonth && hasEntry
            ? 'border-border/50 border'
            : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold leading-none',
          isToday && !accentColor ? 'bg-accent text-white' : 'text-text',
        ].join(' ')}
        style={
          isToday && accentColor
            ? { backgroundColor: accentColor, color: '#ffffff' }
            : undefined
        }
      >
        {dayNum}
      </span>

      <span className="flex flex-1 items-center justify-center overflow-hidden">
        {hasPills ? (
          <span className="flex w-full flex-col items-stretch gap-0.5 px-0.5">
            {dayPills.map((pill) => (
              <span
                key={pill.key}
                title={pill.title}
                className={[
                  'truncate rounded-full px-1 py-px text-center text-[10px] font-bold leading-tight tabular-nums',
                  pill.isExpense ? 'ring-1 ring-inset ring-black/15' : '',
                ].join(' ')}
                style={{
                  backgroundColor: pill.color,
                  color: textColorForBackground(pill.color),
                }}
              >
                {pill.label}
              </span>
            ))}
          </span>
        ) : hasHours ? (
          <span className="flex flex-col items-center leading-none">
            <span
              className={[
                accentColor ? '' : 'text-accent',
                'font-bold tabular-nums',
                size === 'large' ? 'text-base' : 'text-sm',
              ].join(' ')}
              style={accentStyle}
            >
              {formatHours(hours)}
            </span>
            {hasExpense ? (
              <span
                className={[
                  'mt-0.5 text-[10px] font-semibold tabular-nums',
                  accentColor ? '' : 'text-text-muted',
                ].join(' ')}
                style={accentStyle}
              >
                {formatCompactExpense(expense)}
              </span>
            ) : null}
          </span>
        ) : hasExpense ? (
          <span
            className={[
              accentColor ? '' : 'text-accent',
              'font-bold tabular-nums leading-none',
              size === 'large' ? 'text-sm' : 'text-xs',
            ].join(' ')}
            style={accentStyle}
          >
            {formatCompactExpense(expense)}
          </span>
        ) : !readOnly && inMonth && status === 'empty' ? (
          <span className="text-border text-lg leading-none" aria-hidden="true">
            +
          </span>
        ) : null}
      </span>

      {badge ? (
        <span
          className={[
            'absolute right-1 bottom-1 h-2 w-2 rounded-full',
            status === 'paid' ? 'bg-success' : 'ring-success bg-transparent ring-2',
          ].join(' ')}
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}

export function buildDayPills(
  entries: CalendarEntry[],
  caregiversById: Map<string, { display_name: string; calendar_color: string }>,
): CaregiverDayPill[] {
  const pills: CaregiverDayPill[] = [];

  for (const entry of entries) {
    const caregiver = caregiversById.get(entry.caregiver_id);
    const color = caregiver?.calendar_color ?? '#2563eb';
    const displayName = caregiver?.display_name ?? 'Unknown';
    const hours = getDisplayHours(entry);
    const expense = getExpenseReimbursement(entry.expenses);

    if (hours > 0) {
      pills.push({
        key: `${entry.id}-hours`,
        caregiverId: entry.caregiver_id,
        label: formatHours(hours),
        color,
        displayName,
        title: `${displayName}: ${formatHoursReadable(hours)}`,
      });
    }

    if (expense > 0) {
      pills.push({
        key: `${entry.id}-expense`,
        caregiverId: entry.caregiver_id,
        label: formatCompactExpense(expense),
        color,
        displayName,
        title: `${displayName}: ${formatCompactExpense(expense)} reimbursement`,
        isExpense: true,
      });
    }
  }

  return pills.sort((a, b) => {
    const nameCompare = a.displayName.localeCompare(b.displayName);
    if (nameCompare !== 0) return nameCompare;
    return Number(Boolean(a.isExpense)) - Number(Boolean(b.isExpense));
  });
}
