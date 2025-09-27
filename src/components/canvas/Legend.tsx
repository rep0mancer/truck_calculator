'use client';

import React from 'react';

interface LegendProps {
  showNearLimit: boolean;
  showOverLimit: boolean;
  hasStacked: boolean;
}

export function Legend({ showNearLimit, showOverLimit, hasStacked }: LegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] shadow-sm">
      <LegendItem swatchClass="pallet-swatch" label="Einfach" />
      <LegendItem
        swatchClass="pallet-swatch pallet-swatch--stacked"
        label="Gestapelt"
        data-testid="legend-stacked"
      />
      <LegendItem
        swatchClass={`pallet-swatch ${showNearLimit ? 'pallet-swatch--near' : ''}`}
        label="Nahe Limit"
        muted={!showNearLimit}
      />
      <LegendItem
        swatchClass={`pallet-swatch ${showOverLimit ? 'pallet-swatch--over' : ''}`}
        label="Über Limit"
        muted={!showOverLimit}
      />
      {!hasStacked ? <span className="text-[var(--text-muted)]">Keine Stapel aktiv</span> : null}
    </div>
  );
}

function LegendItem({
  swatchClass,
  label,
  muted,
  'data-testid': dataTestId,
}: {
  swatchClass: string;
  label: string;
  muted?: boolean;
  'data-testid'?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${muted ? 'opacity-50' : ''}`} data-testid={dataTestId}>
      <span className={swatchClass} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
