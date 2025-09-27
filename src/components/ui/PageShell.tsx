import * as React from 'react';

interface PageShellProps {
  header?: React.ReactNode;
  leftRail: React.ReactNode;
  children: React.ReactNode;
}

export function PageShell({ header, leftRail, children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {header && <header className="flex flex-col gap-2">{header}</header>}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[384px_1fr] lg:items-start">
          <aside className="space-y-6">{leftRail}</aside>
          <main className="space-y-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
