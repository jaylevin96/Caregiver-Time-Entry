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
  const isLarge = size === 'large';
  const expandPills = Boolean(hasPills && dayPills.length <= (isLarge ? 4 : 2));

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-label={`${date}, ${statusAriaLabel(status, entry, readOnly)}`}
      style={isToday ? todayRingStyle : undefined}
      className={[
        'relative flex touch-manipulation flex-col overflow-hidden rounded-lg transition-transform active:scale-95',
        isLarge ? 'min-h-[8rem] aspect-auto p-1.5' : 'aspect-square p-1',
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

      <span className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {hasPills ? (
          <span
            className={[
              'flex w-full max-h-full flex-col items-stretch overflow-hidden',
              isLarge ? 'gap-1' : 'gap-0.5',
              expandPills ? 'h-full' : 'justify-center',
            ].join(' ')}
          >
            {dayPills.map((pill) => (
              <span
                key={pill.key}
                title={pill.title}
                className={[
                  'flex items-center justify-center truncate rounded-full text-center font-bold tabular-nums',
                  isLarge
                    ? [
                        expandPills ? 'min-h-8 flex-1 px-1.5 leading-none' : 'px-1.5 py-1 leading-none',
                        dayPills.length === 1 ? 'text-lg' : 'text-sm',
                      ].join(' ')
                    : expandPills
                      ? 'min-h-5 flex-1 px-1 text-xs leading-none'
                      : 'px-1 py-0.5 text-[11px] leading-tight',
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
          <span
            className={[
              accentColor ? '' : 'text-accent',
              'font-bold tabular-nums leading-none',
              isLarge ? 'text-lg' : 'text-sm',
            ].join(' ')}
            style={accentStyle}
          >
            {formatHours(hours)}
          </span>
        ) : hasExpense ? (
          <span
            className={[
              accentColor ? '' : 'text-accent',
              'font-bold tabular-nums leading-none',
              isLarge ? 'text-base' : 'text-xs',
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
  const byCaregiver = new Map<
    string,
    { hours: number; expense: number; color: string; displayName: string }
  >();

  for (const entry of entries) {
    const caregiver = caregiversById.get(entry.caregiver_id);
    const hours = getDisplayHours(entry);
    const expense = getExpenseReimbursement(entry.expenses);
    const existing = byCaregiver.get(entry.caregiver_id);

    if (existing) {
      existing.hours += hours;
      existing.expense += expense;
      continue;
    }

    byCaregiver.set(entry.caregiver_id, {
      hours,
      expense,
      color: caregiver?.calendar_color ?? '#2563eb',
      displayName: caregiver?.display_name ?? 'Unknown',
    });
  }

  const pills: CaregiverDayPill[] = [];

  for (const [caregiverId, totals] of byCaregiver) {
    if (totals.hours <= 0 && totals.expense <= 0) continue;

    const titleParts = [`${totals.displayName}: ${formatHoursReadable(totals.hours)}`];
    if (totals.expense > 0) {
      titleParts.push(`${formatCompactExpense(totals.expense)} reimbursement`);
    }

    pills.push({
      key: caregiverId,
      caregiverId,
      label:
        totals.hours > 0
          ? formatHours(totals.hours)
          : formatCompactExpense(totals.expense),
      color: totals.color,
      displayName: totals.displayName,
      title: titleParts.join(', '),
    });
  }

  return pills.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Colored hours pills for each caregiver who logged that day. */
export function dayPillsForCalendar(
  entries: CalendarEntry[] | undefined,
  caregiversById: Map<string, { display_name: string; calendar_color: string }>,
): CaregiverDayPill[] | undefined {
  if (!entries?.length) return undefined;
  const pills = buildDayPills(entries, caregiversById);
  return pills.length > 0 ? pills : undefined;
}
