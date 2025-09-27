import React from 'react';

interface LegendProps {
  isNearLimit: boolean;
  isOverLimit: boolean;
}

export function Legend({ isNearLimit, isOverLimit }: LegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-muted)] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="legend-swatch" aria-hidden />
        <span>Einfach</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="legend-swatch legend-swatch--stacked" aria-hidden />
        <span>Gestapelt</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`legend-swatch legend-swatch--near ${isNearLimit ? '' : 'opacity-40'}`} aria-hidden />
        <span>Nahe Grenze</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`legend-swatch legend-swatch--over ${isOverLimit ? '' : 'opacity-40'}`} aria-hidden />
        <span>Über Grenze</span>
      </div>
    </div>
  );
}
