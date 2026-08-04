import { describe, expect, it } from 'vitest';
import {
  canEditEntry,
  getDayEntryStatus,
  getStatusLabel,
  showsPaymentIndicator,
  type CalendarEntry,
} from '@/lib/utils/entry-status';

const baseEntry: CalendarEntry = {
  id: 'e1',
  caregiver_id: 'c1',
  work_date: '2026-08-04',
  hours: 4,
  notes: null,
  payment_id: null,
  created_at: '2026-08-04T00:00:00Z',
  updated_at: '2026-08-04T00:00:00Z',
  created_by: 'c1',
  updated_by: 'c1',
};

describe('getDayEntryStatus', () => {
  it('returns paid when payment_id is set', () => {
    expect(
      getDayEntryStatus('2026-08-04', {
        ...baseEntry,
        payment_id: 'pay-1',
      }),
    ).toBe('paid');
  });

  it('returns aggregate paid / partial from paidCount', () => {
    expect(
      getDayEntryStatus('2026-08-04', {
        ...baseEntry,
        _aggregate: { entryCount: 2, paidCount: 2 },
      }),
    ).toBe('paid');

    expect(
      getDayEntryStatus('2026-08-04', {
        ...baseEntry,
        _aggregate: { entryCount: 2, paidCount: 1 },
      }),
    ).toBe('partial');
  });

  it('returns future for dates after the current payroll week', () => {
    const asOf = new Date('2026-08-04T17:00:00Z');
    expect(getDayEntryStatus('2026-08-10', undefined, asOf)).toBe('future');
  });

  it('returns locked for unpaid entries in a locked payroll week', () => {
    const asOf = new Date('2026-08-12T17:00:00Z'); // lock day for week of Aug 3
    expect(getDayEntryStatus('2026-08-05', baseEntry, asOf)).toBe('locked');
    expect(getDayEntryStatus('2026-08-05', undefined, asOf)).toBe('locked');
  });

  it('returns editable or empty for open weeks', () => {
    const asOf = new Date('2026-08-04T17:00:00Z');
    expect(getDayEntryStatus('2026-08-04', baseEntry, asOf)).toBe('editable');
    expect(getDayEntryStatus('2026-08-04', undefined, asOf)).toBe('empty');
  });
});

describe('canEditEntry and labels', () => {
  it('allows edit only for empty or editable statuses', () => {
    const asOf = new Date('2026-08-04T17:00:00Z');
    expect(canEditEntry('2026-08-04', undefined, asOf)).toBe(true);
    expect(canEditEntry('2026-08-04', baseEntry, asOf)).toBe(true);
    expect(
      canEditEntry(
        '2026-08-04',
        { ...baseEntry, payment_id: 'p1' },
        asOf,
      ),
    ).toBe(false);
    expect(canEditEntry('2026-08-10', undefined, asOf)).toBe(false);
  });

  it('exposes payment indicator labels', () => {
    expect(getStatusLabel('paid')).toBe('Paid');
    expect(getStatusLabel('partial')).toBe('Partially paid');
    expect(getStatusLabel('locked')).toBe('Locked');
    expect(getStatusLabel('editable')).toBeNull();
    expect(showsPaymentIndicator('paid')).toBe(true);
    expect(showsPaymentIndicator('partial')).toBe(true);
    expect(showsPaymentIndicator('locked')).toBe(false);
  });
});
