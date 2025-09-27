import React from 'react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  rail: React.ReactNode;
  canvas: React.ReactNode;
  footer: React.ReactNode;
}

export function PageShell({ title, subtitle, headerActions, rail, canvas, footer }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-[22px] font-semibold leading-tight text-[var(--text)]">{title}</h1>
            {subtitle ? (
              <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">{headerActions}</div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[384px_1fr] lg:px-6">
        <aside className="flex flex-col gap-4">{rail}</aside>
        <section className="flex flex-col gap-4">{canvas}</section>
      </main>
      <footer className="border-t border-[var(--border)] bg-[var(--surface)]/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4">{footer}</div>
      </footer>
    </div>
  );
}
