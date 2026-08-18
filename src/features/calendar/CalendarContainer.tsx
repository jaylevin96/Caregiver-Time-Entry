import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ALL_CAREGIVERS_ID } from '@/features/admin/CaregiverFilter';
import { CalendarSummaryBar } from '@/features/calendar/CalendarSummaryBar';
import {
  dayPillsForCalendar,
  type CaregiverDayPill,
} from '@/features/calendar/CalendarDayCell';
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
import type { Profile, TimeEntry } from '@/types/database';

interface CalendarContainerProps {
  caregiverId: string | undefined;
  onSelectDate: (date: string, entry: TimeEntry | undefined) => void;
  refreshSignal?: number;
  readOnly?: boolean;
  accentColor?: string;
  hideStatus?: boolean;
  stickyHeader?: ReactNode;
  caregivers?: Profile[];
}

export function CalendarContainer({
  caregiverId,
  onSelectDate,
  refreshSignal = 0,
  readOnly = false,
  accentColor,
  hideStatus = false,
  stickyHeader,
  caregivers = [],
}: CalendarContainerProps) {
  const today = getChicagoDateString();
  const [todayY, todayM] = today.split('-').map(Number);

  const [view, setView] = useState<CalendarViewMode>(getStoredCalendarView);
  const [year, setYear] = useState(todayY);
  const [month, setMonth] = useState(todayM - 1);
  const [weekStart, setWeekStart] = useState(() => startOfCalendarWeek(today));

  const showMultiPills =
    caregiverId === ALL_CAREGIVERS_ID && caregivers.length > 0;

  const caregiversById = useMemo(
    () =>
      new Map(
        caregivers.map((caregiver) => [
          caregiver.id,
          {
            display_name: caregiver.display_name,
            calendar_color: caregiver.calendar_color,
          },
        ]),
      ),
    [caregivers],
  );

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
        return generateDateRange(addDays(today, -60), endOfPayrollWeek(today));
    }
  }, [view, year, month, weekStart, today]);

  const summaryLabel =
    view === 'month'
      ? 'This month'
      : view === 'week'
        ? 'This week'
        : 'Last 60 days';

  const { entriesByDate, multiEntriesByDate, loading, error, refresh } =
    useDateRangeEntries({
      caregiverId,
      start: fetchRange.start,
      end: fetchRange.end,
    });

  useEffect(() => {
    refresh();
  }, [refreshSignal, refresh]);

  function getDayPills(date: string): CaregiverDayPill[] | undefined {
    if (!showMultiPills) return undefined;
    return dayPillsForCalendar(multiEntriesByDate[date], caregiversById);
  }

  function handleSelectDate(date: string) {
    onSelectDate(date, entriesByDate[date]);
  }

  function handleMonthChange(nextYear: number, nextMonth: number) {
    setYear(nextYear);
    setMonth(nextMonth);
  }

  return (
    <div className="pb-3">
      <div className="bg-surface/95 supports-[backdrop-filter]:bg-surface/80 sticky top-[var(--app-header-height,calc(env(safe-area-inset-top)+4.5rem))] z-[9] backdrop-blur">
        {stickyHeader}
        <CalendarViewSwitcher value={view} onChange={setView} embedded />
      </div>

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
          getDayPills={showMultiPills ? getDayPills : undefined}
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
          getDayPills={showMultiPills ? getDayPills : undefined}
          onWeekChange={setWeekStart}
          onSelectDate={handleSelectDate}
        />
      ) : null}

      {view === 'days' ? (
        <DaysListCalendar
          entriesByDate={entriesByDate}
          multiEntriesByDate={showMultiPills ? multiEntriesByDate : undefined}
          caregiversById={showMultiPills ? caregiversById : undefined}
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
