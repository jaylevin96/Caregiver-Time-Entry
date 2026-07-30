import { formatHours, entryHours } from '@/lib/utils/dates';
import {
  getDayEntryStatus,
  getStatusLabel,
  showsPaymentIndicator,
  type CalendarEntry,
  type DayEntryStatus,
} from '@/lib/utils/entry-status';
import { textColorForBackground } from '@/lib/utils/calendar-colors';
import type { TimeEntry } from '@/types/database';

export interface CaregiverDayPill {
  caregiverId: string;
  hours: number;
  color: string;
  displayName: string;
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
  const hours = entry ? `${formatHours(entryHours(entry.hours))} hours` : 'no hours';
  switch (status) {
    case 'paid':
      return `${hours}, paid`;
    case 'partial':
      return `${hours}, partially paid`;
    case 'locked':
      return entry ? `${hours}, locked` : 'locked, no entry';
    case 'editable':
      return `${hours}, editable`;
    case 'future':
      return 'future week, not yet available';
    default:
      return readOnly ? 'no entry' : 'no entry, tap to add hours';
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
  const hasHours = entry && entryHours(entry.hours) > 0;

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
        !entry &&
        inMonth &&
        status === 'empty'
          ? 'border-border/70 border border-dashed'
          : inMonth && (entry || hasPills)
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
                key={pill.caregiverId}
                title={`${pill.displayName}: ${formatHours(pill.hours)}h`}
                className="truncate rounded-full px-1 py-px text-center text-[10px] font-bold leading-tight tabular-nums"
                style={{
                  backgroundColor: pill.color,
                  color: textColorForBackground(pill.color),
                }}
              >
                {formatHours(pill.hours)}
              </span>
            ))}
          </span>
        ) : hasHours ? (
          <span
            className={[
              accentColor ? '' : 'text-accent',
              'font-bold tabular-nums leading-none',
              size === 'large' ? 'text-base' : 'text-sm',
            ].join(' ')}
            style={accentStyle}
          >
            {formatHours(entryHours(entry.hours))}
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
  entries: TimeEntry[],
  caregiversById: Map<string, { display_name: string; calendar_color: string }>,
): CaregiverDayPill[] {
  return entries
    .filter((entry) => entryHours(entry.hours) > 0)
    .map((entry) => {
      const caregiver = caregiversById.get(entry.caregiver_id);
      return {
        caregiverId: entry.caregiver_id,
        hours: entryHours(entry.hours),
        color: caregiver?.calendar_color ?? '#2563eb',
        displayName: caregiver?.display_name ?? 'Unknown',
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
