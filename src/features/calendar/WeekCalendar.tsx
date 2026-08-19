import { CalendarDayCell, type CaregiverDayPill } from '@/features/calendar/CalendarDayCell';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { InlineSpinner } from '@/components/ui/InlineSpinner';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import {
  addDays,
  formatWeekRangeLabel,
  getChicagoDateString,
  getWeekDates,
  startOfCalendarWeek,
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

interface WeekCalendarProps {
  weekStart: string;
  entriesByDate: Record<string, TimeEntry>;
  loading: boolean;
  error: string | null;
  readOnly?: boolean;
  accentColor?: string;
  hideStatus?: boolean;
  getDayPills?: (date: string) => CaregiverDayPill[] | undefined;
  onWeekChange: (weekStart: string) => void;
  onSelectDate: (date: string) => void;
}

export function WeekCalendar({
  weekStart,
  entriesByDate,
  loading,
  error,
  readOnly = false,
  accentColor,
  hideStatus = false,
  getDayPills,
  onWeekChange,
  onSelectDate,
}: WeekCalendarProps) {
  const today = getChicagoDateString();
  const weekDates = getWeekDates(weekStart);
  const currentWeekStart = startOfCalendarWeek(today);
  const isCurrentWeek = weekStart === currentWeekStart;

  function goToPrevWeek() {
    onWeekChange(addDays(weekStart, -7));
  }

  function goToNextWeek() {
    onWeekChange(addDays(weekStart, 7));
  }

  function goToToday() {
    onWeekChange(currentWeekStart);
  }

  const swipeHandlers = useSwipeNavigation({
    onSwipeLeft: goToNextWeek,
    onSwipeRight: goToPrevWeek,
  });

  return (
    <div className="px-2 pb-3 sm:px-4">
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="secondary"
          className="min-h-11 min-w-11 shrink-0 px-0 text-xl"
          onClick={goToPrevWeek}
          aria-label="Previous week"
        >
          ‹
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {formatWeekRangeLabel(weekStart)}
          </h2>
          {!isCurrentWeek ? (
            <button
              type="button"
              onClick={goToToday}
              className="text-accent mt-0.5 text-xs font-medium"
            >
              Jump to this week
            </button>
          ) : null}
        </div>

        <Button
          variant="secondary"
          className="min-h-11 min-w-11 shrink-0 px-0 text-xl"
          onClick={goToNextWeek}
          aria-label="Next week"
        >
          ›
        </Button>
      </div>

      <div className="touch-pan-y select-none" {...swipeHandlers}>
        <div className="mb-1 grid grid-cols-7 gap-0.5 sm:gap-1">
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
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {weekDates.map((date) => (
              <CalendarDayCell
                key={date}
                date={date}
                inMonth
                isToday={date === today}
                entry={entriesByDate[date]}
                dayPills={getDayPills?.(date)}
                onSelect={onSelectDate}
                size="large"
                readOnly={readOnly}
                accentColor={accentColor}
                hideStatus={hideStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
