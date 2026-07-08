export type CalendarViewMode = 'month' | 'week' | 'days';

const STORAGE_KEY = 'care-hours-calendar-view';

export function getStoredCalendarView(): CalendarViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'month' || stored === 'week' || stored === 'days') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'month';
}

export function storeCalendarView(view: CalendarViewMode) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // ignore
  }
}

export const CALENDAR_VIEWS: { id: CalendarViewMode; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'days', label: 'Days' },
];
