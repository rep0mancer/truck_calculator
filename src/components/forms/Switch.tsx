"use client";

import * as React from "react";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  label?: string;
  ariaDescribedBy?: string;
}

export function Switch({ checked, onChange, id, disabled, label, ariaDescribedBy }: SwitchProps) {
  return (
    <label className="inline-flex items-center gap-3">
      <span className="relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary)]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="sr-only"
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
        />
        <span
          aria-hidden="true"
          className={`ml-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px] bg-[var(--primary)]" : "translate-x-0 bg-white"
          } ${disabled ? "opacity-60" : ""}`}
        />
      </span>
      {label ? (
        <span className={`text-sm ${disabled ? "text-[var(--text-muted)] opacity-70" : "text-[var(--text)]"}`}>{label}</span>
      ) : null}
    </label>
  );
}
