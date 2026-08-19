import { describe, expect, it } from 'vitest';
import {
  CALENDAR_COLOR_PRESETS,
  DEFAULT_CALENDAR_COLOR,
  isValidCalendarColor,
  profileForCaregiverSelfView,
  textColorForBackground,
} from '@/lib/utils/calendar-colors';

describe('calendar colors', () => {
  it('exposes preset hex colors', () => {
    expect(CALENDAR_COLOR_PRESETS.length).toBeGreaterThan(0);
    for (const color of CALENDAR_COLOR_PRESETS) {
      expect(isValidCalendarColor(color)).toBe(true);
    }
  });

  it('validates 6-digit hex colors only', () => {
    expect(isValidCalendarColor('#2563eb')).toBe(true);
    expect(isValidCalendarColor('#FFF')).toBe(false);
    expect(isValidCalendarColor('2563eb')).toBe(false);
    expect(isValidCalendarColor('#gggggg')).toBe(false);
  });

  it('picks contrasting text for light and dark backgrounds', () => {
    expect(textColorForBackground('#ffffff')).toBe('#1a1a1a');
    expect(textColorForBackground('#000000')).toBe('#ffffff');
    expect(textColorForBackground('#2563eb')).toBe('#ffffff');
  });

  it('uses default blue for a caregiver looking at their own calendar', () => {
    expect(DEFAULT_CALENDAR_COLOR).toBe('#2563eb');

    const assigned = profileForCaregiverSelfView({
      id: 'c1',
      calendar_color: '#16a34a',
    });

    expect(assigned.calendar_color).toBe(DEFAULT_CALENDAR_COLOR);
    expect(assigned.id).toBe('c1');
  });
});
