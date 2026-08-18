import { describe, expect, it } from 'vitest';
import {
  getActiveCaregivers,
  getPayCaregivers,
  isActiveCaregiver,
} from '@/lib/utils/caregivers';
import type { Profile } from '@/types/database';

function profile(overrides: Partial<Profile> & Pick<Profile, 'id' | 'display_name'>): Profile {
  return {
    email: `${overrides.id}@example.com`,
    role: 'caregiver',
    calendar_color: '#2563eb',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('caregiver lists after deactivate / role change', () => {
  const alice = profile({ id: 'alice', display_name: 'Alice' });
  const bobInactive = profile({
    id: 'bob',
    display_name: 'Bob',
    is_active: false,
  });
  const admin = profile({
    id: 'admin',
    display_name: 'Jay',
    role: 'admin',
  });
  const formerCaregiverAdmin = profile({
    id: 'promoted',
    display_name: 'Pat',
    role: 'admin',
  });

  it('treats only active caregiver roles as filter caregivers', () => {
    expect(isActiveCaregiver(alice)).toBe(true);
    expect(isActiveCaregiver(bobInactive)).toBe(false);
    expect(isActiveCaregiver(admin)).toBe(false);
    expect(getActiveCaregivers([admin, bobInactive, alice]).map((p) => p.id)).toEqual([
      'alice',
    ]);
  });

  it('keeps deactivated caregivers on the Pay list so remaining hours can be paid', () => {
    expect(getPayCaregivers([alice, bobInactive, admin]).map((p) => p.id)).toEqual([
      'alice',
      'bob',
    ]);
  });

  it('includes promoted admins who still have unpaid entries', () => {
    expect(
      getPayCaregivers([alice, formerCaregiverAdmin, admin], ['promoted']).map(
        (p) => p.id,
      ),
    ).toEqual(['alice', 'promoted']);
  });
});
