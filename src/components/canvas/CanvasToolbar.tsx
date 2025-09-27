'use client';

import React from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function CanvasToolbar({ onZoomIn, onZoomOut, onReset }: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 shadow-sm">
      <button
        type="button"
        onClick={onZoomOut}
        className="segmented-option flex h-8 w-8 items-center justify-center rounded-full text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        aria-label="Herauszoomen"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        className="segmented-option flex h-8 w-8 items-center justify-center rounded-full text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        aria-label="Hereinzoomen"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onReset}
        className="segmented-option flex h-8 w-8 items-center justify-center rounded-full text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        aria-label="Ansicht zurücksetzen"
      >
        <Maximize2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
