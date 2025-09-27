import React from 'react';

interface CardProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function Card({ title, actions, children }: CardProps) {
  return (
    <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[var(--text)] text-base font-semibold">{title}</h2>
        {actions}
      </header>
      <div className="border-t border-[var(--border)]" />
      <div className="p-4">{children}</div>
    </section>
  );
}
