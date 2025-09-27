import * as React from 'react';

interface KPIStatProps {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  breakdown?: Array<{ label: string; value: React.ReactNode; color: string }>;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

const toneMap: Record<NonNullable<KPIStatProps['tone']>, string> = {
  neutral: 'border-[var(--border)]',
  success: 'border-[color-mix(in oklab,var(--success) 25%,transparent)]',
  warning: 'border-[color-mix(in oklab,var(--warning) 25%,transparent)]',
  danger: 'border-[color-mix(in oklab,var(--danger) 25%,transparent)]',
};

export function KPIStat({ title, value, subtitle, breakdown, tone = 'neutral' }: KPIStatProps) {
  const toneClass = toneMap[tone];

  return (
    <section
      className={`rounded-2xl border bg-[var(--surface)] px-4 py-5 shadow-sm transition-colors ${toneClass}`}
    >
      <div className="flex flex-col gap-2">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h3>
        </header>
        <div className="text-3xl font-semibold text-[var(--text)]">{value}</div>
        {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
        {breakdown && breakdown.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
            {breakdown.map(item => (
              <li key={item.label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                <span className="font-medium text-[var(--text)]">{item.label}:</span>
                <span className="tabular-nums">{item.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
