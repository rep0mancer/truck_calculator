import * as React from 'react';

interface PageShellProps {
  header?: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}

export function PageShell({ header, sidebar, toolbar, children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
        {header && <header className="flex flex-col gap-2 text-[var(--text)]">{header}</header>}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[384px_1fr]">
          <aside className="flex flex-col gap-6">{sidebar}</aside>
          <div className="flex flex-col gap-6">
            {toolbar && <div className="flex flex-wrap items-center justify-between gap-3">{toolbar}</div>}
            <main className="flex flex-col gap-6">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
