import type { Profile } from '@/types/database';

export function isActiveCaregiver(profile: Profile): boolean {
  return profile.role === 'caregiver' && profile.is_active;
}

/** Active caregivers for calendar/user filters. */
export function getActiveCaregivers(profiles: Profile[]): Profile[] {
  return profiles
    .filter(isActiveCaregiver)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

/**
 * People the Pay tab must still be able to select: current caregivers
 * (including deactivated) and anyone with unpaid time entries.
 * Unpaid caregivers are listed first.
 */
export function getPayCaregivers(
  profiles: Profile[],
  unpaidCaregiverIds: Iterable<string> = [],
): Profile[] {
  const unpaid = new Set(unpaidCaregiverIds);

  return profiles
    .filter((profile) => profile.role === 'caregiver' || unpaid.has(profile.id))
    .sort((a, b) => {
      const unpaidDelta = Number(unpaid.has(b.id)) - Number(unpaid.has(a.id));
      if (unpaidDelta !== 0) return unpaidDelta;
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return a.display_name.localeCompare(b.display_name);
    });
}
