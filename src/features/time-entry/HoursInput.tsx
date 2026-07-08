import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  formatHours,
  isValidQuarterHours,
  roundToQuarterHours,
} from '@/lib/utils/dates';

const PRESETS = [2, 3, 4, 6, 8] as const;
const STEP = 0.25;
const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 80;

interface HoursInputProps {
  value: number;
  onChange: (hours: number) => void;
  disabled?: boolean;
}

function clampHours(hours: number): number {
  return roundToQuarterHours(Math.min(24, Math.max(0, hours)));
}

function useRepeatAction(action: () => void, disabled: boolean) {
  const actionRef = useRef(action);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(() => {
    if (disabled) return;

    actionRef.current();
    clearTimers();

    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        actionRef.current();
      }, REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  }, [clearTimers, disabled]);

  return { start, stop: clearTimers };
}

export function HoursInput({ value, onChange, disabled = false }: HoursInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const decrease = useCallback(() => {
    onChange(clampHours(value - STEP));
  }, [onChange, value]);

  const increase = useCallback(() => {
    onChange(clampHours(value + STEP));
  }, [onChange, value]);

  const decreaseRepeat = useRepeatAction(decrease, disabled || value <= 0);
  const increaseRepeat = useRepeatAction(increase, disabled || value >= 24);

  function beginEditing() {
    if (disabled) return;
    setDraft(formatHours(value || 0));
    setEditing(true);
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commitDraft() {
    const parsed = Number(draft.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setEditing(false);
      return;
    }

    const rounded = clampHours(parsed);
    onChange(rounded);
    setEditing(false);
  }

  function handleDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    }
    if (event.key === 'Escape') {
      setEditing(false);
    }
  }

  return (
    <div className="border-border bg-surface rounded-2xl border p-4">
      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="secondary"
          aria-label="Decrease hours by 15 minutes"
          className="min-h-14 min-w-14 touch-manipulation text-2xl select-none"
          onPointerDown={(event) => {
            event.preventDefault();
            decreaseRepeat.start();
          }}
          onPointerUp={decreaseRepeat.stop}
          onPointerLeave={decreaseRepeat.stop}
          onPointerCancel={decreaseRepeat.stop}
          disabled={disabled || value <= 0}
        >
          −
        </Button>

        <div className="flex min-w-[7rem] flex-col items-center">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              aria-label="Hours worked"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={handleDraftKeyDown}
              className="border-accent focus:ring-accent/20 w-full rounded-xl border bg-white px-2 py-1 text-center text-3xl font-semibold tabular-nums outline-none focus:ring-2"
            />
          ) : (
            <button
              type="button"
              onClick={beginEditing}
              disabled={disabled}
              aria-label={`${formatHours(value || 0)} hours. Tap to type a value.`}
              className="hover:bg-surface-raised focus-visible:ring-accent/30 rounded-xl px-3 py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed"
            >
              <span className="text-4xl font-semibold tabular-nums">
                {formatHours(value || 0)}
              </span>
              <span className="text-text-muted ml-0.5 text-2xl font-normal">h</span>
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          aria-label="Increase hours by 15 minutes"
          className="min-h-14 min-w-14 touch-manipulation text-2xl select-none"
          onPointerDown={(event) => {
            event.preventDefault();
            increaseRepeat.start();
          }}
          onPointerUp={increaseRepeat.stop}
          onPointerLeave={increaseRepeat.stop}
          onPointerCancel={increaseRepeat.stop}
          disabled={disabled || value >= 24}
        >
          +
        </Button>
      </div>

      <div className="mt-4">
        <p className="text-text-muted mb-2 text-center text-xs font-medium tracking-wide uppercase">
          Quick select
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {PRESETS.map((preset) => {
            const selected = value === preset;
            return (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                onClick={() => onChange(preset)}
                className={[
                  'min-h-11 min-w-[3.25rem] touch-manipulation rounded-full border px-4 text-sm font-semibold transition-colors',
                  selected
                    ? 'border-accent bg-accent text-white'
                    : 'border-border bg-surface-raised text-text hover:border-accent/40',
                ].join(' ')}
              >
                {preset}h
              </button>
            );
          })}
        </div>
      </div>

      {value > 0 && !isValidQuarterHours(value) ? (
        <p className="text-danger mt-3 text-center text-xs" role="alert">
          Use 0.25-hour steps (e.g. 4, 4.25, 4.5)
        </p>
      ) : null}
    </div>
  );
}
