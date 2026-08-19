import { describe, expect, it } from 'vitest';
import { ALL_CAREGIVERS_ID } from '@/features/admin/CaregiverFilter';
import {
  isAllCaregiversFilter,
  resolveCalendarCaregiverId,
  resolvePayCaregiverId,
} from '@/features/admin/admin-caregiver-filter';

describe('admin caregiver filter', () => {
  const ids = ['riley', 'jay'];

  it('treats empty and All as the combined calendar filter', () => {
    expect(isAllCaregiversFilter(null)).toBe(true);
    expect(isAllCaregiversFilter(undefined)).toBe(true);
    expect(isAllCaregiversFilter(ALL_CAREGIVERS_ID)).toBe(true);
    expect(isAllCaregiversFilter('riley')).toBe(false);
  });

  it('keeps a specific calendar selection on the calendar', () => {
    expect(resolveCalendarCaregiverId('riley', ids)).toBe('riley');
  });

  it('falls back to All when the calendar selection is missing', () => {
    expect(resolveCalendarCaregiverId(null, ids)).toBe(ALL_CAREGIVERS_ID);
    expect(resolveCalendarCaregiverId('gone', ids)).toBe(ALL_CAREGIVERS_ID);
  });

  it('carries a calendar caregiver onto the Pay tab', () => {
    expect(resolvePayCaregiverId('riley', ids)).toBe('riley');
  });

  it('uses the first Pay caregiver when calendar is on All', () => {
    expect(resolvePayCaregiverId(ALL_CAREGIVERS_ID, ids)).toBe('riley');
    expect(resolvePayCaregiverId(null, ids)).toBe('riley');
  });

  it('ignores a stored id that is no longer in the Pay list', () => {
    expect(resolvePayCaregiverId('gone', ids)).toBe('riley');
    expect(resolvePayCaregiverId('riley', [])).toBeUndefined();
  });
});
