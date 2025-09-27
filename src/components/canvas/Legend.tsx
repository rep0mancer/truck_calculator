import * as React from 'react';

interface LegendItemProps {
  label: string;
  className?: string;
  description: string;
  swatch?: React.ReactNode;
}

function LegendItem({ label, className, description, swatch }: LegendItemProps) {
  return (
    <div
      className={['flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-[var(--text)]', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={description}
    >
      {swatch}
      <span>{label}</span>
    </div>
  );
}

export function Legend() {
  const badgeClass = 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]';
  return (
    <nav className="flex flex-wrap items-center gap-3" aria-label="Legende">
      <LegendItem
        label="DIN"
        description="DIN Paletten mit Streifen"
        className={badgeClass}
        swatch={
          <span
            aria-hidden
            className="h-4 w-4 rounded-sm pallet"
            data-type="DIN"
            data-stacked="0"
          />
        }
      />
      <LegendItem
        label="EUP"
        description="EUP Paletten mit Punkten"
        className={badgeClass}
        swatch={
          <span
            aria-hidden
            className="h-4 w-4 rounded-sm pallet"
            data-type="EUP"
            data-stacked="0"
          />
        }
      />
      <LegendItem
        label="Nahe Limit"
        description="Paletten nahe der Kapazitätsgrenze"
        className={badgeClass}
        swatch={<span aria-hidden className="h-4 w-4 rounded-sm pallet near-limit" />}
      />
      <LegendItem
        label="Über Limit"
        description="Paletten über dem Limit"
        className={badgeClass}
        swatch={<span aria-hidden className="h-4 w-4 rounded-sm pallet over-limit" />}
      />
    </nav>
  );
}
