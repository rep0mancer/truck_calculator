import React from 'react';
import { Minus, RefreshCw, ZoomIn } from 'lucide-react';

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function CanvasToolbar({ onZoomIn, onZoomOut, onReset }: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-sm">
      <button
        type="button"
        onClick={onZoomOut}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        aria-label="Ansicht verkleinern"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        aria-label="Ansicht vergrößern"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onReset}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text)] transition hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        aria-label="Ansicht zurücksetzen"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
    </div>
  );
}
