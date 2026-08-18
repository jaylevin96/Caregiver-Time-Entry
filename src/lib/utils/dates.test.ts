import { describe, expect, it } from 'vitest';
import {
  addDays,
  endOfPayrollWeek,
  formatHours,
  formatHoursAsDuration,
  formatHoursReadable,
  getChicagoDateString,
  endOfMonth,
  getMonthGridRange,
  isBeyondCurrentWeek,
  startOfMonth,
  isPayrollWeekLocked,
  isValidQuarterHours,
  payrollLockDate,
  roundToQuarterHours,
  startOfCalendarWeek,
  startOfPayrollWeek,
} from '@/lib/utils/dates';

describe('payroll week helpers', () => {
  it('starts payroll week on Monday (Postgres date_trunc week)', () => {
    expect(startOfPayrollWeek('2026-08-04')).toBe('2026-08-03'); // Tue → Mon
    expect(startOfPayrollWeek('2026-08-09')).toBe('2026-08-03'); // Sun → Mon
    expect(startOfPayrollWeek('2026-08-03')).toBe('2026-08-03'); // Mon
  });

  it('starts calendar week on Sunday', () => {
    expect(startOfCalendarWeek('2026-08-04')).toBe('2026-08-02');
    expect(startOfCalendarWeek('2026-08-02')).toBe('2026-08-02');
  });

  it('locks on Wednesday of the following week (start + 9 days)', () => {
    // Week Mon 2026-08-03 – Sun 2026-08-09 locks Wed 2026-08-12
    expect(payrollLockDate('2026-08-03')).toBe('2026-08-12');
    expect(payrollLockDate('2026-08-09')).toBe('2026-08-12');
  });

  it('detects locked payroll weeks using Chicago calendar date', () => {
    const beforeLock = new Date('2026-08-11T17:00:00Z'); // still Aug 11 Chicago
    const onLock = new Date('2026-08-12T12:00:00Z'); // Aug 12 Chicago

    expect(isPayrollWeekLocked('2026-08-05', beforeLock)).toBe(false);
    expect(isPayrollWeekLocked('2026-08-05', onLock)).toBe(true);
  });

  it('blocks entry beyond the current payroll week Sunday', () => {
    const asOf = new Date('2026-08-04T17:00:00Z'); // Tue Aug 4 Chicago
    const weekEnd = endOfPayrollWeek(getChicagoDateString(asOf));
    expect(weekEnd).toBe('2026-08-09');
    expect(isBeyondCurrentWeek('2026-08-09', asOf)).toBe(false);
    expect(isBeyondCurrentWeek('2026-08-10', asOf)).toBe(true);
  });
});

describe('date grid and arithmetic', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('resolves first and last day of the month', () => {
    expect(startOfMonth('2026-08-18')).toBe('2026-08-01');
    expect(endOfMonth('2026-08-18')).toBe('2026-08-31');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
  });

  it('builds a Sun–Sat month grid covering the full month', () => {
    const { start, end, weeks } = getMonthGridRange(2026, 7); // August
    expect(start).toBe('2026-07-26');
    expect(end).toBe('2026-09-05');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat()).toContain('2026-08-01');
    expect(weeks.flat()).toContain('2026-08-31');
  });
});

describe('hours formatting and validation', () => {
  it('formats hours without trailing zeros', () => {
    expect(formatHours(4)).toBe('4');
    expect(formatHours(4.25)).toBe('4.25');
    expect(formatHours(4.5)).toBe('4.5');
  });

  it('formats compact duration vs readable duration', () => {
    expect(formatHoursAsDuration(0.25)).toBe('15 min');
    expect(formatHoursAsDuration(1)).toBe('1 hour');
    expect(formatHoursAsDuration(1.25)).toBe('1 hr 15 min');

    expect(formatHoursReadable(0)).toBe('0 hours');
    expect(formatHoursReadable(1)).toBe('1 hour');
    expect(formatHoursReadable(4.25)).toBe('4 hours 15 minutes');
    expect(formatHoursReadable(0.25)).toBe('15 minutes');
  });

  it('validates quarter-hour increments between 0 exclusive and 24 inclusive', () => {
    expect(isValidQuarterHours(0)).toBe(false);
    expect(isValidQuarterHours(0.25)).toBe(true);
    expect(isValidQuarterHours(8)).toBe(true);
    expect(isValidQuarterHours(8.1)).toBe(false);
    expect(isValidQuarterHours(24)).toBe(true);
    expect(isValidQuarterHours(24.25)).toBe(false);
  });

  it('rounds to nearest quarter hour', () => {
    expect(roundToQuarterHours(8.1)).toBe(8);
    expect(roundToQuarterHours(8.2)).toBe(8.25);
  });
});
