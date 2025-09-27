"use client";

import * as React from "react";

export function Legend() {
  const items = [
    {
      label: "Einzeln",
      className: "bg-[var(--surface-muted)] border border-[var(--border)]",
    },
    {
      label: "Gestapelt",
      className:
        "bg-[var(--surface-muted)] border border-[var(--border)] [background-image:repeating-linear-gradient(90deg,rgba(15,23,42,0.08)_0_2px,transparent_2px_6px)]",
    },
    {
      label: "Nahe Grenze",
      className: "bg-[var(--surface-muted)] border-2 border-[var(--warning)]",
    },
    {
      label: "Über Grenze",
      className:
        "relative border-2 border-[var(--danger)] bg-[var(--surface-muted)] after:absolute after:right-1 after:top-1 after:h-2 after:w-2 after:rounded-full after:bg-[var(--danger)]",
    },
  ];

  return (
    <div className="flex flex-wrap gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 px-4 py-3 text-xs text-[var(--text)] shadow-sm backdrop-blur">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`h-4 w-4 shrink-0 rounded-sm ${item.className}`} aria-hidden />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
