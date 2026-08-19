export const CALENDAR_COLOR_PRESETS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#ca8a04',
] as const;

/** Default blue used for new caregivers and for a caregiver's own calendar. */
export const DEFAULT_CALENDAR_COLOR = CALENDAR_COLOR_PRESETS[0];

/** Assigned colors are for admin views; caregivers always see default blue. */
export function profileForCaregiverSelfView<T extends { calendar_color: string }>(
  profile: T,
): T {
  return { ...profile, calendar_color: DEFAULT_CALENDAR_COLOR };
}

export function isValidCalendarColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function textColorForBackground(hex: string): '#ffffff' | '#1a1a1a' {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff';
}
