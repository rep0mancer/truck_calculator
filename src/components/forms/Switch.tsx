'use client';

import React from 'react';

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  helperText?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, helperText, className, disabled, ...props },
  ref,
) {
  const helperId = helperText ? `${props.id || props.name}-helper` : undefined;
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-60' : ''} ${className ?? ''}`}>
      <span className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center">
        <input
          {...props}
          ref={ref}
          type="checkbox"
          className="peer sr-only"
          disabled={disabled}
          aria-describedby={helperId}
        />
        <span className="absolute inset-0 rounded-full bg-[var(--surface-muted)] transition peer-checked:bg-[var(--primary)]" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-[var(--surface)] shadow transition peer-checked:translate-x-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-[var(--text)]">{label}</span>
        {helperText ? (
          <span id={helperId} className="text-xs text-[var(--text-muted)]">
            {helperText}
          </span>
        ) : null}
      </span>
    </label>
  );
});
