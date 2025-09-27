import React from 'react';

const STATUS_STYLES: Record<'neutral' | 'warn' | 'error' | 'ok', string> = {
  neutral: 'border-[var(--border)]',
  warn: 'border-[var(--warning)]',
  error: 'border-[var(--danger)]',
  ok: 'border-[var(--success)]',
};

interface KPIStatProps {
  label: string;
  value: string;
  status?: 'neutral' | 'warn' | 'error' | 'ok';
  helper?: string;
}

export function KPIStat({ label, value, status = 'neutral', helper }: KPIStatProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-sm transition ${STATUS_STYLES[status]} bg-[var(--surface)]`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="text-xl font-semibold text-[var(--text)]">{value}</p>
      {helper ? <p className="text-xs text-[var(--text-muted)]">{helper}</p> : null}
    </div>
  );
}
