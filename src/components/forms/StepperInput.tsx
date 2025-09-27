"use client";

import * as React from "react";

interface StepperInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  id?: string;
  disabled?: boolean;
}

export function StepperInput({ value, onChange, min, max, step = 1, suffix, id, disabled }: StepperInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const clamp = React.useCallback(
    (val: number) => {
      let next = val;
      if (typeof min === "number") next = Math.max(min, next);
      if (typeof max === "number") next = Math.min(max, next);
      return next;
    },
    [min, max]
  );

  const emitChange = React.useCallback(
    (next: number) => {
      const clamped = clamp(Number.isNaN(next) ? value : next);
      if (clamped !== value) {
        onChange(clamped);
      } else if (Number.isNaN(next)) {
        onChange(clamp(0));
      }
    },
    [clamp, onChange, value]
  );

  const handleStep = (direction: 1 | -1) => {
    const next = (Number(value) || 0) + direction * step;
    emitChange(next);
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex h-10 items-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]">
      <input
        id={id}
        ref={inputRef}
        type="number"
        inputMode="numeric"
        className="h-full w-full bg-transparent pr-16 pl-3 text-right text-sm font-medium text-[var(--text)] outline-none"
        value={Number.isNaN(value) ? 0 : value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isNaN(nextValue)) {
            onChange(clamp(0));
          } else {
            onChange(clamp(nextValue));
          }
        }}
        disabled={disabled}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-14 text-xs font-medium text-[var(--text-muted)]">{suffix}</span>
      ) : null}
      <div className="absolute inset-y-0 right-0 flex divide-x divide-[var(--border)]">
        <button
          type="button"
          className="h-full w-8 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
          aria-label="Wert verringern"
          onClick={() => handleStep(-1)}
          disabled={disabled}
        >
          −
        </button>
        <button
          type="button"
          className="h-full w-8 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
          aria-label="Wert erhöhen"
          onClick={() => handleStep(1)}
          disabled={disabled}
        >
          +
        </button>
      </div>
    </div>
  );
}
