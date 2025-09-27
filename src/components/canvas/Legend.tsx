import * as React from 'react';

const legendItems: Array<{
  label: string;
  description: string;
  className: string;
  props?: React.HTMLAttributes<HTMLSpanElement>;
}> = [
  {
    label: 'DIN',
    description: 'DIN Palette (Industrie)',
    className: 'pallet h-4 w-4 rounded-sm border',
    props: { 'data-type': 'DIN', 'data-stacked': '0' } as React.HTMLAttributes<HTMLSpanElement>,
  },
  {
    label: 'EUP',
    description: 'EUP Palette (Euro)',
    className: 'pallet h-4 w-4 rounded-sm border',
    props: { 'data-type': 'EUP', 'data-stacked': '0' } as React.HTMLAttributes<HTMLSpanElement>,
  },
  {
    label: 'Nahe Limit',
    description: 'Nahe am Gewichtslimit',
    className: 'pallet h-4 w-4 rounded-sm border near-limit',
    props: { 'data-type': 'DIN', 'data-stacked': '0' } as React.HTMLAttributes<HTMLSpanElement>,
  },
  {
    label: 'Über Limit',
    description: 'Über dem Gewichtslimit',
    className: 'pallet h-4 w-4 rounded-sm border over-limit',
    props: { 'data-type': 'EUP', 'data-stacked': '0' } as React.HTMLAttributes<HTMLSpanElement>,
  },
];

export function Legend() {
  return (
    <div className="flex flex-wrap gap-4" role="list" aria-label="Legende der Palettentypen">
      {legendItems.map(item => (
        <div key={item.label} role="listitem" className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span
            aria-hidden
            className={item.className}
            style={{ width: 16, height: 16, borderColor: 'var(--border)' }}
            {...item.props}
          />
          <span aria-label={item.description}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
