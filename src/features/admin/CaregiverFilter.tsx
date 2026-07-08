import type { CaregiverRate, Profile } from '@/types/database';
import { textColorForBackground } from '@/lib/utils/calendar-colors';

export const ALL_CAREGIVERS_ID = 'all';

interface CaregiverFilterProps {
  caregivers: Profile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showAllOption?: boolean;
}

export function CaregiverFilter({
  caregivers,
  selectedId,
  onSelect,
  showAllOption = false,
}: CaregiverFilterProps) {
  if (caregivers.length === 0) {
    return (
      <p className="text-text-muted px-4 py-3 text-sm">
        No caregivers yet. They can sign up from the login page.
      </p>
    );
  }

  return (
    <div className="border-border border-b px-4 py-3">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showAllOption ? (
          <FilterPill
            label="All"
            selected={selectedId === ALL_CAREGIVERS_ID}
            onClick={() => onSelect(ALL_CAREGIVERS_ID)}
          />
        ) : null}
        {caregivers.map((caregiver) => {
          const selected = caregiver.id === selectedId;
          const color = caregiver.calendar_color;
          const textColor = selected ? textColorForBackground(color) : undefined;

          return (
            <button
              key={caregiver.id}
              type="button"
              onClick={() => onSelect(caregiver.id)}
              className={[
                'min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
                selected
                  ? ''
                  : 'bg-surface text-text-muted border-border border',
              ].join(' ')}
              style={
                selected
                  ? { backgroundColor: color, color: textColor }
                  : undefined
              }
            >
              {!selected ? (
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
              ) : null}
              {caregiver.display_name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
        selected
          ? 'bg-accent text-white'
          : 'bg-surface text-text-muted border-border border',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export function getEffectiveRate(
  rates: CaregiverRate[],
  defaultRate: number,
  workDate: string,
): number {
  const match = rates
    .filter((rate) => rate.effective_from <= workDate)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];

  return match?.hourly_rate ?? defaultRate;
}
