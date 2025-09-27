"use client";

import * as React from "react";

interface CardProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  stickyFooter?: boolean;
  className?: string;
}

export function Card({ title, actions, children, footer, stickyFooter, className }: CardProps) {
  return (
    <section
      className={`bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden ${className ?? ""}`}
    >
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[var(--text)] text-base font-semibold">{title}</h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className="border-t border-[var(--border)]" />
      <div className="p-4 text-[var(--text)] text-sm leading-5">{children}</div>
      {footer ? (
        <div className={stickyFooter ? "mt-auto border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3" : "border-t border-[var(--border)] px-4 py-3"}>
          {footer}
        </div>
      ) : null}
    </section>
  );
}
