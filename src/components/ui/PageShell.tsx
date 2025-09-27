'use client';

import React from 'react';
import { CircleHelp, RotateCcw } from 'lucide-react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  onHelp?: () => void;
  onReset?: () => void;
  rail: React.ReactNode;
  canvas: React.ReactNode;
  footer: React.ReactNode;
}

export function PageShell({
  title,
  subtitle,
  onHelp,
  onReset,
  rail,
  canvas,
  footer,
}: PageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="flex flex-col gap-1 border-b border-[var(--border)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Truck Calculator</p>
          <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onHelp?.()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            aria-label="Hilfe"
          >
            <CircleHelp className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onReset?.()}
            className="flex h-10 items-center gap-2 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:bg-[var(--primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            <span>Zurücksetzen</span>
          </button>
        </div>
      </header>
      <main className="grid gap-6 p-6 xl:grid-cols-[384px_1fr]">
        <aside className="relative flex flex-col gap-4">{rail}</aside>
        <section className="flex flex-col gap-6">{canvas}</section>
      </main>
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">{footer}</footer>
    </div>
  );
}
