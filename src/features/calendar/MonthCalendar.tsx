import { CalendarDayCell, type CaregiverDayPill } from '@/features/calendar/CalendarDayCell';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import {
  getChicagoDateString,
  getMonthGridRange,
  getMonthLabel,
} from '@/lib/utils/dates';
import { Button } from '@/components/ui/Button';
import type { TimeEntry } from '@/types/database';

const WEEKDAYS = [
  { key: 'sun', label: 'S', full: 'Sunday' },
  { key: 'mon', label: 'M', full: 'Monday' },
  { key: 'tue', label: 'T', full: 'Tuesday' },
  { key: 'wed', label: 'W', full: 'Wednesday' },
  { key: 'thu', label: 'T', full: 'Thursday' },
  { key: 'fri', label: 'F', full: 'Friday' },
  { key: 'sat', label: 'S', full: 'Saturday' },
];

interface MonthCalendarProps {
  year: number;
  month: number;
  entriesByDate: Record<string, TimeEntry>;
  loading: boolean;
  error: string | null;
  readOnly?: boolean;
  accentColor?: string;
  hideStatus?: boolean;
  getDayPills?: (date: string) => CaregiverDayPill[] | undefined;
  onMonthChange: (year: number, month: number) => void;
  onSelectDate: (date: string) => void;
}

export function MonthCalendar({
  year,
  month,
  entriesByDate,
  loading,
  error,
  readOnly = false,
  accentColor,
  hideStatus = false,
  getDayPills,
  onMonthChange,
  onSelectDate,
}: MonthCalendarProps) {
  const today = getChicagoDateString();
  const [todayY, todayM] = today.split('-').map(Number);
  const todayMonth = todayM - 1;

  const { weeks } = getMonthGridRange(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  function goToPrevMonth() {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  }

  function goToNextMonth() {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  }

  function goToToday() {
    onMonthChange(todayY, todayMonth);
  }

  const swipeHandlers = useSwipeNavigation({
    onSwipeLeft: goToNextMonth,
    onSwipeRight: goToPrevMonth,
  });

  const isCurrentMonth = year === todayY && month === todayMonth;

  return (
    <div className="px-2 py-3 sm:px-4 sm:py-4">
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="secondary"
          className="min-h-11 min-w-11 shrink-0 px-0 text-xl"
          onClick={goToPrevMonth}
          aria-label="Previous month"
        >
          ‹
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {getMonthLabel(year, month)}
          </h2>
          {!isCurrentMonth ? (
            <button
              type="button"
              onClick={goToToday}
              className="text-accent mt-0.5 text-xs font-medium"
            >
              Jump to today
            </button>
          ) : null}
        </div>

        <Button
          variant="secondary"
          className="min-h-11 min-w-11 shrink-0 px-0 text-xl"
          onClick={goToNextMonth}
          aria-label="Next month"
        >
          ›
        </Button>
      </div>

      <div className="touch-pan-y select-none" {...swipeHandlers}>        <div className="mb-1 grid grid-cols-7 gap-0.5 sm:gap-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day.key}
              aria-label={day.full}
              className="text-text-muted py-1 text-center text-[11px] font-semibold sm:text-xs"
            >
              {day.label}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <InlineSpinner />
          </div>
        ) : error ? (
          <ErrorBanner message={error} />
        ) : (
          <div className="space-y-0.5 sm:space-y-1">
            {weeks.map((week) => (
              <div key={week[0]} className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {week.map((date) => (
                  <CalendarDayCell
                    key={date}
                    date={date}
                    inMonth={date.startsWith(monthPrefix)}
                    isToday={date === today}
                    entry={entriesByDate[date]}
                    dayPills={getDayPills?.(date)}
                    onSelect={onSelectDate}
                    readOnly={readOnly}
                    accentColor={accentColor}
                    hideStatus={hideStatus}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
