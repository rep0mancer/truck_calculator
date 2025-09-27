'use client';

import React, { useCallback } from 'react';

interface SegmentedOption {
  label: string;
  value: string;
}

interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  ['data-testid']?: string;
}

export function Segmented({ options, value, onChange, id, 'data-testid': dataTestId }: SegmentedProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const currentIndex = options.findIndex(option => option.value === value);
      if (currentIndex === -1) return;
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + options.length) % options.length;
      onChange(options[nextIndex].value);
    },
    [options, value, onChange],
  );

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className="flex rounded-2xl bg-[var(--surface-muted)] p-1"
      id={id}
      onKeyDown={handleKeyDown}
      data-testid={dataTestId}
    >
      {options.map(option => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`segmented-option flex-1 rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${
              isActive
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
