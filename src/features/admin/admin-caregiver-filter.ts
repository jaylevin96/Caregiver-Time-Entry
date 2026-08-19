import { ALL_CAREGIVERS_ID } from '@/features/admin/CaregiverFilter';

export function isAllCaregiversFilter(id: string | null | undefined): boolean {
  return !id || id === ALL_CAREGIVERS_ID;
}

function isSpecificCaregiverId(
  id: string | null | undefined,
): id is string {
  return Boolean(id) && id !== ALL_CAREGIVERS_ID;
}

/** Calendar can show All, or a specific caregiver still in the filter list. */
export function resolveCalendarCaregiverId(
  selectedId: string | null | undefined,
  caregiverIds: readonly string[],
): string {
  if (!isSpecificCaregiverId(selectedId)) return ALL_CAREGIVERS_ID;
  if (caregiverIds.includes(selectedId)) return selectedId;
  return ALL_CAREGIVERS_ID;
}

/**
 * Pay has no All option. Keep a specific calendar selection when that
 * caregiver is still available; otherwise fall back to the first person.
 */
export function resolvePayCaregiverId(
  selectedId: string | null | undefined,
  caregiverIds: readonly string[],
): string | undefined {
  if (isSpecificCaregiverId(selectedId) && caregiverIds.includes(selectedId)) {
    return selectedId;
  }
  return caregiverIds[0];
}
