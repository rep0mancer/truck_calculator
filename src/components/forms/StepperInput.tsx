'use client';

import React, { useMemo } from 'react';

interface StepperInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  id?: string;
  ['data-testid']?: string;
}

export function StepperInput({
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  suffix,
  id,
  'data-testid': dataTestId,
}: StepperInputProps) {
  const safeValue = useMemo(() => (Number.isFinite(value) ? value : 0), [value]);

  const clamp = (val: number) => {
    if (Number.isFinite(max)) {
      val = Math.min(val, max);
    }
    if (Number.isFinite(min)) {
      val = Math.max(val, min);
    }
    return val;
  };

  const applyChange = (next: number) => {
    const clamped = clamp(next);
    if (!Number.isNaN(clamped)) {
      onChange(clamped);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (Number.isNaN(next)) {
      onChange(min > Number.NEGATIVE_INFINITY ? min : 0);
      return;
    }
    applyChange(next);
  };

  const increment = () => applyChange(safeValue + step);
  const decrement = () => applyChange(safeValue - step);

  return (
    <div
      className="relative flex h-10 w-full items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm"
      data-testid={dataTestId}
    >
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={safeValue}
        onChange={handleInputChange}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        step={step}
        className="h-full flex-1 rounded-xl bg-transparent px-3 text-right text-base focus-visible:outline-none"
        aria-live="polite"
      />
      {suffix ? <span className="pr-16 text-sm text-[var(--text-muted)]">{suffix}</span> : null}
      <div className="absolute inset-y-0 right-0 flex items-center divide-x divide-[var(--border)]">
        <button
          type="button"
          onClick={decrement}
          className="segmented-option flex h-full w-10 items-center justify-center text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          aria-label="Verringern"
        >
          −
        </button>
        <button
          type="button"
          onClick={increment}
          className="segmented-option flex h-full w-10 items-center justify-center text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          aria-label="Erhöhen"
        >
          +
        </button>
      </div>
    </div>
  );
}
