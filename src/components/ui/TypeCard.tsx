import * as React from 'react';

export function TypeCard({
  type,
  title,
  children,
  actions,
}: {
  type: 'DIN' | 'EUP';
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const accent = type === 'DIN' ? 'var(--accent-din)' : 'var(--accent-eup)';
  return (
    <section
      className="overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-sm"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex">
        <div className="w-1" style={{ backgroundColor: accent }} />
        <header className="flex flex-1 items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold"
              style={{
                color: accent,
                backgroundColor: 'color-mix(in oklab, currentColor 15%, transparent)',
              }}
            >
              {type}
            </span>
            <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
          </div>
          {actions}
        </header>
      </div>
      <div className="border-t" style={{ borderColor: 'var(--border)' }} />
      <div className="p-4">{children}</div>
    </section>
  );
}
