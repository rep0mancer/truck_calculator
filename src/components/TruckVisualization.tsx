"use client";

import React from 'react';
import { PALLET_TYPES, TRUCK_TYPES } from '@/lib/loading/logic';

export type PalletVisualization = {
  key: string | number;
  type: keyof typeof PALLET_TYPES;
  height: number;
  width: number;
  x: number;
  y: number;
  labelId: number;
  showAsFraction?: boolean;
  displayStackedLabelId?: number;
  displayBaseLabelId?: number;
  isStackedTier?: 'top' | 'base' | null;
};

export type PalletUnitArrangement = {
  unitId: string;
  unitLength: number;
  unitWidth: number;
  pallets: PalletVisualization[];
};

type TruckVisualizationProps = {
  palletArrangement: PalletUnitArrangement[];
  selectedTruck: keyof typeof TRUCK_TYPES;
  truckConfig: (typeof TRUCK_TYPES)[keyof typeof TRUCK_TYPES];
};

const palletVisualPalette: Record<string, {
  background: string;
  borderColor: string;
  textColor: string;
  highlightBorder: string;
  shadow: string;
}> = {
  euro: {
    background: 'linear-gradient(135deg, hsla(217, 100%, 68%, 0.92), hsla(217, 98%, 56%, 0.98))',
    borderColor: 'hsla(218, 96%, 52%, 0.9)',
    textColor: 'rgba(15, 23, 42, 0.95)',
    highlightBorder: 'hsla(217, 96%, 80%, 0.65)',
    shadow: '0 16px 32px -22px rgba(37, 99, 235, 0.85)'
  },
  industrial: {
    background: 'linear-gradient(135deg, hsla(142, 82%, 64%, 0.88), hsla(142, 84%, 48%, 0.95))',
    borderColor: 'hsla(142, 78%, 42%, 0.88)',
    textColor: 'rgba(15, 23, 42, 0.9)',
    highlightBorder: 'hsla(142, 80%, 76%, 0.55)',
    shadow: '0 16px 32px -24px rgba(22, 163, 74, 0.75)'
  }
};

const truckVisualizationScale = 0.35;

const renderPallet = (pallet: PalletVisualization, displayScale = truckVisualizationScale) => {
  if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) return null;
  const palette = palletVisualPalette[pallet.type] ?? palletVisualPalette.euro;
  const d = PALLET_TYPES[pallet.type];
  const w = pallet.height * displayScale; const h = pallet.width * displayScale;
  const x = pallet.y * displayScale; const y = pallet.x * displayScale;
  let txt = pallet.showAsFraction && pallet.displayStackedLabelId ? `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}` : `${pallet.labelId}`;
  if (pallet.labelId === 0) txt = "?";
  let title = `${d.name} #${pallet.labelId}`;
  if (pallet.showAsFraction) title = `${d.name} (Stapel: ${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId})`;
  if (pallet.isStackedTier === 'top') title += ' - Oben';
  if (pallet.isStackedTier === 'base') title += ' - Basis des Stapels';
  return (
    <div
      key={pallet.key}
      title={title}
      className="absolute border flex items-center justify-center rounded-sm"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
        opacity: pallet.isStackedTier === 'top' ? 0.72 : 1,
        zIndex: pallet.isStackedTier === 'top' ? 10 : 5,
        fontSize: '10px',
        background: palette.background,
        borderColor: palette.borderColor,
        boxShadow: palette.shadow,
        color: palette.textColor,
        filter: 'saturate(1.3)'
      }}
    >
      <span
        className="font-semibold select-none"
        style={{
          color: palette.textColor,
          textShadow: '0 1px 3px rgba(15, 23, 42, 0.45)'
        }}
      >
        {txt}
      </span>
      {pallet.isStackedTier === 'top' && (
        <div
          className="absolute inset-0 pointer-events-none rounded-sm"
          style={{
            borderTop: `1.5px solid ${palette.highlightBorder}`,
            borderLeft: `1.5px solid ${palette.highlightBorder}`,
            borderRadius: '0.2rem'
          }}
        />
      )}
    </div>
  );
};

export default function TruckVisualization({ palletArrangement, selectedTruck, truckConfig }: TruckVisualizationProps) {
  return (
    <div
      className="lg:col-span-2 bg-gray-100 p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center"
      data-selected-truck={selectedTruck}
    >
      <p className="text-slate-100 text-lg mb-4 font-semibold drop-shadow">Ladefläche Visualisierung</p>
      {palletArrangement.map((unit, index) => (
        <div key={unit.unitId} className="mb-6 w-full flex flex-col items-center">
          {truckConfig.units.length > 1 && (
            <p className="text-sm text-slate-200 mb-2 drop-shadow-sm">Einheit {index + 1} ({unit.unitLength / 100}m x {unit.unitWidth / 100}m)</p>
          )}
          {index === 0 && (
            <svg
              aria-hidden
              role="presentation"
              className="block"
              width={unit.unitWidth * truckVisualizationScale}
              height={24}
              viewBox={`0 0 ${unit.unitWidth * truckVisualizationScale} 24`}
            >
              {/* Cab base */}
              <rect
                x="0"
                y="6"
                width={unit.unitWidth * truckVisualizationScale}
                height="16"
                rx="6"
                fill="rgba(59,130,246,0.4)"
                stroke="rgba(96,165,250,0.65)"
              />
              {/* Nose to indicate forward direction */}
              <path
                d={`M ${(unit.unitWidth * truckVisualizationScale) / 2 - 12} 6 L ${(unit.unitWidth * truckVisualizationScale) / 2} 0 L ${(unit.unitWidth * truckVisualizationScale) / 2 + 12} 6 Z`}
                fill="rgba(59,130,246,0.55)"
              />
              {/* Label */}
              <text x={(unit.unitWidth * truckVisualizationScale) / 2} y={20} textAnchor="middle" fontSize="10" fontWeight={700} fill="rgba(15,23,42,0.85)">Front</text>
            </svg>
          )}
          <div
            className="relative overflow-hidden rounded-2xl border border-white/40 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]"
            style={{
              width: `${unit.unitWidth * truckVisualizationScale}px`,
              height: `${unit.unitLength * truckVisualizationScale}px`,
              background: 'linear-gradient(160deg, rgba(148, 163, 184, 0.25), rgba(226, 232, 240, 0.18))',
              backdropFilter: 'blur(26px)',
              WebkitBackdropFilter: 'blur(26px)'
            }}
          >
            {unit.pallets.map((pallet) => renderPallet(pallet, truckVisualizationScale))}
          </div>
        </div>
      ))}
      {palletArrangement.length === 0 && <p className="text-slate-200/80">Keine Paletten zum Anzeigen.</p>}
    </div>
  );
}
