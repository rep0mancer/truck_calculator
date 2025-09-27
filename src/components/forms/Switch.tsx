import React from 'react';

interface SwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  helperText?: string;
}

export function Switch({ id, checked, onChange, disabled, label, helperText }: SwitchProps) {
  const helperId = helperText ? `${id}-helper` : undefined;
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        id={id}
        aria-describedby={helperId}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onChange(!checked);
          }
        }}
        className={`relative flex h-6 w-11 shrink-0 items-center rounded-full border border-[var(--border)] transition ${
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--surface-muted)]'
        } ${disabled ? 'opacity-60' : 'hover:ring-2 hover:ring-[var(--primary)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]'}`}
        disabled={disabled}
      >
        <span
          className={`absolute left-1 inline-block h-4 w-4 rounded-full bg-[var(--surface)] shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
        <span className="sr-only">{label}</span>
      </button>
      <div>
        <label htmlFor={id} className={`text-sm font-medium ${disabled ? 'text-[var(--text-muted)]/70' : 'text-[var(--text)]'}`}>
          {label}
        </label>
        {helperText ? (
          <p id={helperId} className="text-xs text-[var(--text-muted)]">
            {helperText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
