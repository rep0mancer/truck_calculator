"use client";

import * as React from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function CanvasToolbar({ onZoomIn, onZoomOut, onReset }: CanvasToolbarProps) {
  const buttonClasses = "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

  return (
    <div className="flex items-center gap-2 rounded-full bg-[var(--surface)]/80 px-2 py-1 shadow-lg backdrop-blur">
      <button type="button" onClick={onZoomOut} aria-label="Zoom out" className={buttonClasses}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" onClick={onZoomIn} aria-label="Zoom in" className={buttonClasses}>
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" onClick={onReset} aria-label="Ansicht zurücksetzen" className={buttonClasses}>
        <RotateCcw className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
