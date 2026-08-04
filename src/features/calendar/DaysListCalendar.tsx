import { useEffect, useMemo, useRef } from 'react';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import {
  buildDayPills,
  type CaregiverDayPill,
} from '@/features/calendar/CalendarDayCell';
import {
  addDays,
  endOfPayrollWeek,
  formatDayListHeading,
  formatDayListLabel,
  formatHoursReadable,
  generateDateRange,
  getChicagoDateString,
} from '@/lib/utils/dates';
import {
  formatCompactExpense,
  getDisplayHours,
  getExpenseReimbursement,
} from '@/lib/utils/expenses';
import { formatCurrency } from '@/lib/utils/payment-format';
import { textColorForBackground } from '@/lib/utils/calendar-colors';
import {
  getDayEntryStatus,
  getStatusLabel,
  showsPaymentIndicator,
  type CalendarEntry,
} from '@/lib/utils/entry-status';

interface DaysListCalendarProps {
  entriesByDate: Record<string, CalendarEntry>;
  multiEntriesByDate?: Record<string, CalendarEntry[]>;
  caregiversById?: Map<
    string,
    { display_name: string; calendar_color: string }
  >;
  loading: boolean;
  error: string | null;
  readOnly?: boolean;
  accentColor?: string;
  hideStatus?: boolean;
  onSelectDate: (date: string) => void;
}

export function DaysListCalendar({
  entriesByDate,
  multiEntriesByDate,
  caregiversById,
  loading,
  error,
  readOnly = false,
  accentColor,
  hideStatus = false,
  onSelectDate,
}: DaysListCalendarProps) {
  const today = getChicagoDateString();
  const scrolledRef = useRef(false);
  const listStart = addDays(today, -60);
  const listEnd = endOfPayrollWeek(today);
  const dates = useMemo(
    () => generateDateRange(listStart, listEnd).reverse(),
    [listStart, listEnd],
  );

  const grouped = useMemo(() => {
    const groups: { key: string; heading: string; dates: string[] }[] = [];

    for (const date of dates) {
      const key = date.slice(0, 7);
      const last = groups[groups.length - 1];

      if (last && last.key === key) {
        last.dates.push(date);
      } else {
        groups.push({
          key,
          heading: formatDayListHeading(date),
          dates: [date],
        });
      }
    }

    return groups;
  }, [dates]);

  useEffect(() => {
    if (loading || scrolledRef.current) return;
    const el = document.getElementById('calendar-today-row');
    el?.scrollIntoView({ block: 'center' });
    scrolledRef.current = true;
  }, [loading]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <InlineSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4">
        <ErrorBanner message={error} />
      </div>
    );
  }

  return (
    <div className="px-3 pb-4 sm:px-4">
      <p className="text-text-muted mb-3 text-center text-[11px]">
        {readOnly
          ? 'Scroll to browse days · tap to view details'
          : 'Scroll to browse days · tap to log hours'}
      </p>

      <div className="max-h-[calc(100dvh-14rem)] space-y-4 overflow-y-auto overscroll-contain">
        {grouped.map((group) => (
          <section key={group.key}>
            <h3 className="text-text-muted mb-2 px-1 text-xs font-semibold tracking-wide uppercase">
              {group.heading}
            </h3>
            <ul className="space-y-2">
              {group.dates.map((date) => {
                const dayPills =
                  multiEntriesByDate && caregiversById
                    ? buildDayPills(
                        multiEntriesByDate[date] ?? [],
                        caregiversById,
                      )
                    : undefined;

                return (
                  <DayListRow
                    key={date}
                    date={date}
                    entry={entriesByDate[date]}
                    dayPills={dayPills}
                    isToday={date === today}
                    readOnly={readOnly}
                    accentColor={accentColor}
                    hideStatus={hideStatus}
                    onSelect={onSelectDate}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

interface DayListRowProps {
  date: string;
  entry: CalendarEntry | undefined;
  dayPills?: CaregiverDayPill[];
  isToday: boolean;
  readOnly?: boolean;
  accentColor?: string;
  hideStatus?: boolean;
  onSelect: (date: string) => void;
}

function DayListRow({
  date,
  entry,
  dayPills,
  isToday,
  readOnly = false,
  accentColor,
  hideStatus = false,
  onSelect,
}: DayListRowProps) {
  const status = getDayEntryStatus(date, entry);
  const badge =
    hideStatus || !showsPaymentIndicator(status)
      ? null
      : getStatusLabel(status);
  const hours = entry ? getDisplayHours(entry) : 0;
  const expense = entry ? getExpenseReimbursement(entry.expenses) : 0;
  const hasPills = dayPills && dayPills.length > 0;

  return (
    <li>
      <button
        id={isToday ? 'calendar-today-row' : undefined}
        type="button"
        onClick={() => onSelect(date)}
        className={[
          'border-border flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left active:scale-[0.99]',
          status === 'paid'
            ? 'bg-success/5'
            : status === 'partial'
              ? 'bg-success/[0.03]'
              : status === 'locked'
              ? 'bg-surface opacity-60'
              : 'bg-surface-raised',
          isToday
            ? accentColor
              ? 'ring-2 ring-inset'
              : 'ring-accent ring-2 ring-inset'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={
          isToday && accentColor
            ? ({ '--tw-ring-color': accentColor } as React.CSSProperties)
            : undefined
        }
      >
        <div className="min-w-0">
          <p
            className={[
              'font-medium',
              status === 'locked' ? 'text-text-muted' : '',
            ].join(' ')}
          >
            {formatDayListLabel(date)}
            {isToday ? (
              <span
                className={
                  accentColor
                    ? 'ml-2 text-xs font-semibold'
                    : 'text-accent ml-2 text-xs font-semibold'
                }
                style={accentColor ? { color: accentColor } : undefined}
              >
                Today
              </span>
            ) : null}
          </p>
          {entry?.notes ? (
            <p className="text-text-muted mt-0.5 truncate text-sm">
              {entry.notes}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasPills ? (
            <span className="flex flex-wrap justify-end gap-1">
              {dayPills.map((pill) => (
                <span
                  key={pill.key}
                  title={pill.title}
                  className={[
                    'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
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
          ) : hours > 0 || expense > 0 ? (
            <span
              className={[
                'flex flex-col items-end',
                status === 'locked' || accentColor ? '' : 'text-accent',
                status === 'locked' ? 'text-text-muted' : '',
                'text-sm font-bold tabular-nums',
              ].join(' ')}
              style={
                accentColor && status !== 'locked'
                  ? { color: accentColor }
                  : undefined
              }
            >
              {hours > 0 ? <span>{formatHoursReadable(hours)}</span> : null}
              {expense > 0 ? (
                <span className="text-xs font-semibold">
                  {hours > 0
                    ? formatCompactExpense(expense)
                    : formatCurrency(expense)}
                </span>
              ) : null}
            </span>
          ) : readOnly || status !== 'empty' ? null : (
            <span className="text-text-muted text-sm">Add</span>
          )}
          {badge ? (
            <span
              className={[
                'h-2 w-2 rounded-full',
                status === 'paid' ? 'bg-success' : 'ring-success bg-transparent ring-2',
              ].join(' ')}
              aria-label={badge}
            />
          ) : null}
        </div>
      </button>
    </li>
  );
}
