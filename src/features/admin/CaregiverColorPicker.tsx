import {
  CALENDAR_COLOR_PRESETS,
  isValidCalendarColor,
  textColorForBackground,
} from '@/lib/utils/calendar-colors';
import type { Profile } from '@/types/database';

interface CaregiverColorPickerProps {
  user: Profile;
  disabled?: boolean;
  onChange: (userId: string, color: string) => void;
}

export function CaregiverColorPicker({
  user,
  disabled = false,
  onChange,
}: CaregiverColorPickerProps) {
  return (
    <div className="mt-4">
      <p className="text-text-muted mb-2 text-xs font-medium">Calendar color</p>
      <div className="flex flex-wrap items-center gap-2">
        {CALENDAR_COLOR_PRESETS.map((color) => {
          const selected = user.calendar_color.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              aria-label={`Set color ${color}`}
              disabled={disabled}
              onClick={() => onChange(user.id, color)}
              className={[
                'h-10 w-10 rounded-full transition-transform active:scale-95 disabled:opacity-50',
                selected ? 'ring-accent ring-2 ring-offset-2' : '',
              ].join(' ')}
              style={{ backgroundColor: color }}
            />
          );
        })}
        <label
          className={[
            'border-border relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border',
            disabled ? 'pointer-events-none opacity-50' : '',
          ].join(' ')}
          title="Custom color"
        >
          <span className="text-text-muted text-[10px] font-semibold">+</span>
          <input
            type="color"
            value={user.calendar_color}
            disabled={disabled}
            onChange={(event) => onChange(user.id, event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

export { isValidCalendarColor, textColorForBackground };
