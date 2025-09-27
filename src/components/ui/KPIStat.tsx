import React from 'react';

const STATUS_RING: Record<'neutral' | 'warn' | 'error' | 'ok', string> = {
  neutral: 'border-transparent',
  warn: 'border-[var(--warning)]',
  error: 'border-[var(--danger)]',
  ok: 'border-[var(--success)]',
};

const STATUS_TEXT: Record<'neutral' | 'warn' | 'error' | 'ok', string> = {
  neutral: 'text-[var(--text-muted)]',
  warn: 'text-[var(--warning)]',
  error: 'text-[var(--danger)]',
  ok: 'text-[var(--success)]',
};

interface KPIStatProps {
  label: string;
  value: string;
  status?: 'neutral' | 'warn' | 'error' | 'ok';
  helper?: string;
  ['data-testid']?: string;
}

export function KPIStat({ label, value, status = 'neutral', helper, 'data-testid': dataTestId }: KPIStatProps) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border bg-[var(--surface)] px-4 py-3 shadow-sm ${STATUS_RING[status]}`}
      data-testid={dataTestId}
    >
      <span className={`text-xs font-medium uppercase tracking-wide ${STATUS_TEXT[status]}`}>{label}</span>
      <span className="text-lg font-semibold text-[var(--text)]">{value}</span>
      {helper ? <span className="text-xs text-[var(--text-muted)]">{helper}</span> : null}
    </div>
  );
}
