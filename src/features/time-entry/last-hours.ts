import { isValidQuarterHours } from '@/lib/utils/dates';

const LAST_HOURS_KEY = 'time-entry-last-hours';
const DEFAULT_HOURS = 4;

export function getLastHours(): number {
  try {
    const stored = localStorage.getItem(LAST_HOURS_KEY);
    if (stored) {
      const value = Number(stored);
      if (isValidQuarterHours(value)) return value;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_HOURS;
}

export function saveLastHours(hours: number): void {
  if (!isValidQuarterHours(hours)) return;
  try {
    localStorage.setItem(LAST_HOURS_KEY, String(hours));
  } catch {
    // ignore storage errors
  }
}
