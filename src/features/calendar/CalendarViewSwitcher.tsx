import {
  CALENDAR_VIEWS,
  type CalendarViewMode,
  storeCalendarView,
} from '@/features/calendar/calendar-view-mode';

interface CalendarViewSwitcherProps {
  value: CalendarViewMode;
  onChange: (view: CalendarViewMode) => void;
}

export function CalendarViewSwitcher({
  value,
  onChange,
}: CalendarViewSwitcherProps) {
  function handleChange(view: CalendarViewMode) {
    storeCalendarView(view);
    onChange(view);
  }

  return (
    <div
      className="bg-surface/95 supports-[backdrop-filter]:bg-surface/80 sticky top-[var(--app-header-height,calc(env(safe-area-inset-top)+4.5rem))] z-[9] px-3 pt-3 pb-1 backdrop-blur sm:px-4"
    >
      <div
        className="bg-surface border-border flex rounded-xl border p-1"
        role="tablist"
        aria-label="Calendar view"
      >
        {CALENDAR_VIEWS.map((view) => {
          const selected = value === view.id;
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => handleChange(view.id)}
              className={[
                'min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors',
                selected
                  ? 'bg-surface-raised text-text shadow-sm'
                  : 'text-text-muted',
              ].join(' ')}
            >
              {view.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
