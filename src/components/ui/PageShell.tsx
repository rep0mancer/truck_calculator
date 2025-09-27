"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  leftRail: React.ReactNode;
  rightColumn: React.ReactNode;
  footer: React.ReactNode;
}

export function PageShell({ title, subtitle, actions, leftRail, rightColumn, footer }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-[var(--text)]">{actions}</div>
      </header>
      <main className="grid gap-6 p-6 lg:grid-cols-[384px_1fr]">
        <aside className="flex flex-col gap-4 w-full lg:w-[384px]">
          {leftRail}
        </aside>
        <section className={cn("flex flex-col gap-4")}>{rightColumn}</section>
      </main>
      <footer className="px-6 pb-6">{footer}</footer>
    </div>
  );
}
