"use client";

import * as React from "react";

interface SegmentedOption {
  label: string;
  value: string;
}

interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export function Segmented({ options, value, onChange, ariaLabel }: SegmentedProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!containerRef.current) return;
    const { key } = event;
    if (key === "ArrowRight" || key === "ArrowLeft") {
      event.preventDefault();
      const dir = key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + dir + options.length) % options.length;
      const nextOption = options[nextIndex];
      onChange(nextOption.value);
      const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>("button[role='tab']");
      buttons[nextIndex]?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className="flex rounded-xl bg-[var(--surface-muted)] p-1 text-sm"
    >
      {options.map((option, index) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
              isActive
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
