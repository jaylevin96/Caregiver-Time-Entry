export const APP_TIMEZONE = 'America/Chicago';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(dateStr: string): { y: number; m: number; d: number } {
  if (!DATE_ONLY.test(dateStr)) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

export function formatDateOnly(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseDateOnly(dateStr);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return formatDateOnly(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

/** Monday of the payroll week containing `dateStr` (matches Postgres date_trunc('week', …)). */
export function startOfPayrollWeek(dateStr: string): string {
  const { y, m, d } = parseDateOnly(dateStr);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateStr, diff);
}

/** Sunday starting the calendar week containing `dateStr`. */
export function startOfCalendarWeek(dateStr: string): string {
  const { y, m, d } = parseDateOnly(dateStr);
  const date = new Date(Date.UTC(y, m - 1, d));
  return addDays(dateStr, -date.getUTCDay());
}

/** Wednesday when the payroll week containing `workDate` locks (Chicago midnight). */
export function payrollLockDate(workDate: string): string {
  // Mon–Sun week locks on the Wednesday of the following week (week start + 9 days).
  return addDays(startOfPayrollWeek(workDate), 9);
}

export function getChicagoDateString(asOf = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(asOf);
}

export function isPayrollWeekLocked(workDate: string, asOf = new Date()): boolean {
  const lockDate = payrollLockDate(workDate);
  const chicagoToday = getChicagoDateString(asOf);
  return chicagoToday >= lockDate;
}

/** Sunday ending the payroll week containing `dateStr`. */
export function endOfPayrollWeek(dateStr: string): string {
  return addDays(startOfPayrollWeek(dateStr), 6);
}

/** True when `workDate` is after the Sunday of the week containing `asOf` (Chicago). */
export function isBeyondCurrentWeek(
  workDate: string,
  asOf = new Date(),
): boolean {
  const today = getChicagoDateString(asOf);
  return workDate > endOfPayrollWeek(today);
}

export function formatWeekEndLabel(dateStr: string): string {
  const { y, m, d } = parseDateOnly(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  }).format(new Date(y, m - 1, d));
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function getMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1));
}

export function startOfMonth(dateStr: string): string {
  const { y, m } = parseDateOnly(dateStr);
  return formatDateOnly(y, m, 1);
}

export function endOfMonth(dateStr: string): string {
  const { y, m } = parseDateOnly(dateStr);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return formatDateOnly(y, m, lastDay);
}

/** Inclusive calendar grid range (Sun–Sat weeks) for a month view. */
export function getMonthGridRange(year: number, month: number): {
  start: string;
  end: string;
  weeks: string[][];
} {
  const firstOfMonth = formatDateOnly(year, month + 1, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const lastOfMonth = formatDateOnly(year, month + 1, lastDay);

  const gridStart = startOfCalendarWeek(firstOfMonth);
  const gridEnd = addDays(startOfCalendarWeek(lastOfMonth), 6);

  const weeks: string[][] = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  return { start: gridStart, end: gridEnd, weeks };
}

export function isSameMonth(dateStr: string, year: number, month: number): boolean {
  const { y, m } = parseDateOnly(dateStr);
  return y === year && m === month + 1;
}

export function formatDisplayDate(dateStr: string): string {
  const { y, m, d } = parseDateOnly(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

export function formatHours(hours: number): string {
  if (Number.isInteger(hours)) return String(hours);
  return hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Compact duration for lists (e.g. "1 hr 15 min"). Prefer formatHoursReadable for aria/pills. */
export function formatHoursAsDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) return `${minutes} min`;
  if (minutes === 0) return wholeHours === 1 ? '1 hour' : `${wholeHours} hours`;
  const hourPart = wholeHours === 1 ? '1 hr' : `${wholeHours} hr`;
  return `${hourPart} ${minutes} min`;
}

/** Full duration for calendar pills and aria labels, e.g. "4 hours 15 minutes". */
export function formatHoursReadable(hours: number): string {
  if (hours <= 0) return '0 hours';

  const wholeHours = Math.floor(hours + 0.0001);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (minutes === 0) {
    return wholeHours === 1 ? '1 hour' : `${wholeHours} hours`;
  }

  const hourPart =
    wholeHours === 0
      ? ''
      : wholeHours === 1
        ? '1 hour '
        : `${wholeHours} hours `;
  const minutePart = minutes === 1 ? '1 minute' : `${minutes} minutes`;

  return `${hourPart}${minutePart}`.trim();
}

export function isValidQuarterHours(hours: number): boolean {
  return hours > 0 && hours <= 24 && Math.abs(hours * 4 - Math.round(hours * 4)) < 0.001;
}

export function roundToQuarterHours(hours: number): number {
  return Math.round(hours * 4) / 4;
}

export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function formatWeekRangeLabel(weekStart: string): string {
  const weekEnd = addDays(weekStart, 6);
  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(weekEnd);

  const startFmt = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
  }).format(new Date(start.y, start.m - 1, start.d));

  if (start.m === end.m && start.y === end.y) {
    return `${startFmt} – ${end.d}, ${end.y}`;
  }

  const endFmt = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(end.y, end.m - 1, end.d));

  return `${startFmt} – ${endFmt}`;
}

export function formatDayListLabel(dateStr: string): string {
  const { y, m, d } = parseDateOnly(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  }).format(new Date(y, m - 1, d));
}

export function formatDayListHeading(dateStr: string): string {
  const { y, m, d } = parseDateOnly(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

export function getDateParts(dateStr: string): { year: number; month: number } {
  const { y, m } = parseDateOnly(dateStr);
  return { year: y, month: m - 1 };
}

