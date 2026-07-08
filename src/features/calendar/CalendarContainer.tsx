import { useEffect, useMemo, useState } from 'react';
import { CalendarSummaryBar } from '@/features/calendar/CalendarSummaryBar';
import { CalendarViewSwitcher } from '@/features/calendar/CalendarViewSwitcher';
import { DaysListCalendar } from '@/features/calendar/DaysListCalendar';
import { MonthCalendar } from '@/features/calendar/MonthCalendar';
import { WeekCalendar } from '@/features/calendar/WeekCalendar';
import {
  getStoredCalendarView,
  type CalendarViewMode,
} from '@/features/calendar/calendar-view-mode';
import { useDateRangeEntries } from '@/features/calendar/useDateRangeEntries';
import {
  addDays,
  endOfPayrollWeek,
  generateDateRange,
  getChicagoDateString,
  getMonthGridRange,
  getWeekDates,
  startOfCalendarWeek,
} from '@/lib/utils/dates';
import type { TimeEntry } from '@/types/database';

interface CalendarContainerProps {
  caregiverId: string | undefined;
  onSelectDate: (date: string, entry: TimeEntry | undefined) => void;
  refreshSignal?: number;
  readOnly?: boolean;
  accentColor?: string;
  hideStatus?: boolean;
}

export function CalendarContainer({
  caregiverId,
  onSelectDate,
  refreshSignal = 0,
  readOnly = false,
  accentColor,
  hideStatus = false,
}: CalendarContainerProps) {
  const today = getChicagoDateString();
  const [todayY, todayM] = today.split('-').map(Number);

  const [view, setView] = useState<CalendarViewMode>(getStoredCalendarView);
  const [year, setYear] = useState(todayY);
  const [month, setMonth] = useState(todayM - 1);
  const [weekStart, setWeekStart] = useState(() => startOfCalendarWeek(today));

  const fetchRange = useMemo(() => {
    switch (view) {
      case 'month':
        return getMonthGridRange(year, month);
      case 'week':
        return {
          start: addDays(weekStart, -7),
          end: addDays(weekStart, 13),
        };
      case 'days':
        return {
          start: addDays(today, -60),
          end: endOfPayrollWeek(today),
        };
    }
  }, [view, year, month, weekStart, today]);

  const summaryDates = useMemo(() => {
    switch (view) {
      case 'month':
        return generateDatesInMonth(year, month);
      case 'week':
        return getWeekDates(weekStart);
      case 'days':
        return generateDateRange(addDays(today, -60), today);
    }
  }, [view, year, month, weekStart, today]);

  const summaryLabel =
    view === 'month'
      ? 'This month'
      : view === 'week'
        ? 'This week'
        : 'Last 60 days';

  const { entriesByDate, loading, error, refresh } = useDateRangeEntries({
    caregiverId,
    start: fetchRange.start,
    end: fetchRange.end,
  });

  useEffect(() => {
    refresh();
  }, [refreshSignal, refresh]);

  function handleSelectDate(date: string) {
    onSelectDate(date, entriesByDate[date]);
  }

  function handleMonthChange(nextYear: number, nextMonth: number) {
    setYear(nextYear);
    setMonth(nextMonth);
  }

  return (
    <div className="pb-3">
      <CalendarViewSwitcher value={view} onChange={setView} />

      {!loading && !error ? (
        <CalendarSummaryBar
          label={summaryLabel}
          entriesByDate={entriesByDate}
          dates={summaryDates}
        />
      ) : null}

      {view === 'month' ? (
        <MonthCalendar
          year={year}
          month={month}
          entriesByDate={entriesByDate}
          loading={loading}
          error={error}
          readOnly={readOnly}
          accentColor={accentColor}
          hideStatus={hideStatus}
          onMonthChange={handleMonthChange}
          onSelectDate={handleSelectDate}
        />
      ) : null}

      {view === 'week' ? (
        <WeekCalendar
          weekStart={weekStart}
          entriesByDate={entriesByDate}
          loading={loading}
          error={error}
          readOnly={readOnly}
          accentColor={accentColor}
          hideStatus={hideStatus}
          onWeekChange={setWeekStart}
          onSelectDate={handleSelectDate}
        />
      ) : null}

      {view === 'days' ? (
        <DaysListCalendar
          entriesByDate={entriesByDate}
          loading={loading}
          error={error}
          readOnly={readOnly}
          accentColor={accentColor}
          hideStatus={hideStatus}
          onSelectDate={handleSelectDate}
        />
      ) : null}
    </div>
  );
}

function generateDatesInMonth(year: number, month: number): string[] {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });
}
