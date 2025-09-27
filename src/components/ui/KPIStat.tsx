import * as React from 'react';

interface BreakdownItem {
  label: string;
  color: string;
  value: React.ReactNode;
}

interface KPIStatProps {
  title: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  breakdown?: BreakdownItem[];
}

export function KPIStat({ title, value, caption, breakdown }: KPIStatProps) {
  return (
    <section
      className="rounded-2xl border bg-[var(--surface)] p-4 shadow-sm"
      style={{ borderColor: 'var(--border)' }}
    >
      <h3 className="text-sm font-medium text-[var(--text-muted)]">{title}</h3>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</div>
      {caption && <p className="mt-2 text-xs text-[var(--text-muted)]">{caption}</p>}
      {breakdown && breakdown.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-[var(--text)]">
          {breakdown.map(item => (
            <li key={item.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-medium">{item.label}:</span>
              <span>{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
