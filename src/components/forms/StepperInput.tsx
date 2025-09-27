import React, { useCallback } from 'react';

interface StepperInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
}

type NativeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>;

export function StepperInput({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  suffix,
  disabled,
  id,
  ...rest
}: StepperInputProps & NativeInputProps) {
  const clamp = useCallback(
    (next: number) => {
      if (Number.isNaN(next)) return min;
      return Math.min(Math.max(next, min), max);
    },
    [min, max]
  );

  const handleStep = useCallback(
    (delta: number) => {
      if (disabled) return;
      const next = clamp(value + delta * step);
      onChange(next);
    },
    [clamp, onChange, step, value, disabled]
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    onChange(clamp(parsed));
  };

  return (
    <div className={`relative flex h-10 w-full items-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] ${disabled ? 'opacity-60' : ''}`}>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={handleChange}
        disabled={disabled}
        className="h-full w-full bg-transparent px-3 pr-16 text-right text-sm font-semibold text-[var(--text)] outline-none"
        inputMode="numeric"
        {...rest}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-14 text-xs font-medium text-[var(--text-muted)]">{suffix}</span>
      ) : null}
      <div className="absolute right-0 flex h-full">
        <button
          type="button"
          onClick={() => handleStep(-1)}
          disabled={disabled}
          className="flex h-full w-8 items-center justify-center border-l border-[var(--border)] text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          aria-label="Wert verringern"
        >
          –
        </button>
        <button
          type="button"
          onClick={() => handleStep(1)}
          disabled={disabled}
          className="flex h-full w-8 items-center justify-center border-l border-[var(--border)] text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          aria-label="Wert erhöhen"
        >
          +
        </button>
      </div>
    </div>
  );
}
