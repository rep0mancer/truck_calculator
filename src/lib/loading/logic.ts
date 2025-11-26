"use client";

import React from 'react';
import { PALLET_TYPES, TRUCK_TYPES } from '@/lib/loading/logic';

export type PalletVisualization = {
  key: string | number;
  type: keyof typeof PALLET_TYPES;
  height: number; // Visual Height (Truck Length)
  width: number;  // Visual Width (Truck Width)
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
    shadow: '0 2px 4px rgba(37, 99, 235, 0.4)'
  },
  industrial: {
    background: 'linear-gradient(135deg, hsla(142, 82%, 64%, 0.88), hsla(142, 84%, 48%, 0.95))',
    borderColor: 'hsla(142, 78%, 42%, 0.88)',
    textColor: 'rgba(15, 23, 42, 0.9)',
    highlightBorder: 'hsla(142, 80%, 76%, 0.55)',
    shadow: '0 2px 4px rgba(22, 163, 74, 0.4)'
  }
};

// Adjusted scale to fit screen better without distortions
const VISUAL_SCALE = 0.35;

const renderPallet = (pallet: PalletVisualization) => {
  if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) return null;
  
  const palette = palletVisualPalette[pallet.type] ?? palletVisualPalette.euro;
  
  // Logic coordinates are in cm. Scale to pixels.
  const w = pallet.width * VISUAL_SCALE;  // Horizontal dimension
  const h = pallet.height * VISUAL_SCALE; // Vertical dimension
  const x = pallet.y * VISUAL_SCALE;      // Left position
  const y = pallet.x * VISUAL_SCALE;      // Top position (distance from front)

  let txt = `${pallet.labelId}`;
  if (pallet.showAsFraction && pallet.displayStackedLabelId) {
     txt = `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}`;
  }

  let title = `${PALLET_TYPES[pallet.type].name} #${pallet.labelId}`;
  if (pallet.isStackedTier === 'top') title += ' (Oben)';
  
  // Font size scaling for small pallets
  const fontSize = w < 35 ? '9px' : '10px';

  return (
    <div
      key={pallet.key}
      title={title}
      className="absolute border flex items-center justify-center rounded-sm transition-all"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
        zIndex: pallet.isStackedTier === 'top' ? 10 : 5,
        fontSize: fontSize,
        background: palette.background,
        borderColor: palette.borderColor,
        boxShadow: palette.shadow,
        color: palette.textColor,
        // Subtle visual cue for stacks
        transform: pallet.isStackedTier === 'top' ? 'scale(0.95)' : 'none'
      }}
    >
      <span className="font-bold select-none drop-shadow-sm">
        {txt}
      </span>
    </div>
  );
};

export default function TruckVisualization({ palletArrangement, selectedTruck, truckConfig }: TruckVisualizationProps) {
  return (
    <div
      className="lg:col-span-2 bg-slate-50 p-6 rounded-lg border border-slate-200 shadow-inner flex flex-col items-center overflow-y-auto min-h-[600px]"
      data-selected-truck={selectedTruck}
    >
      <div className="flex items-center gap-2 mb-6">
         <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Ladefläche</p>
      </div>
      
      {palletArrangement.map((unit, index) => {
        // Calculate visual dimensions exactly based on logic config
        const containerWidth = unit.unitWidth * VISUAL_SCALE;
        const containerHeight = unit.unitLength * VISUAL_SCALE;

        return (
          <div key={unit.unitId} className="mb-8 flex flex-col items-center relative">
            {truckConfig.units.length > 1 && (
              <p className="text-xs text-slate-400 mb-1">Einheit {index + 1}</p>
            )}
            
            {/* Cab Indicator (only for first unit) */}
            {index === 0 && (
              <div 
                className="w-full flex justify-center mb-1 opacity-30"
                style={{ width: containerWidth }}
              >
                 <div className="h-4 w-3/4 bg-slate-300 rounded-t-lg"></div>
              </div>
            )}

            {/* The Truck Bed Container */}
            <div
              className="relative rounded bg-white border-2 border-slate-300 shadow-sm"
              style={{
                width: `${containerWidth}px`,
                height: `${containerHeight}px`,
                // Subtle grid pattern to show scale
                backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
                backgroundSize: `${100 * VISUAL_SCALE}px ${100 * VISUAL_SCALE}px` 
              }}
            >
              {/* Front Label inside container */}
              <div className="absolute top-1 left-0 w-full text-center text-[9px] text-slate-300 font-bold uppercase pointer-events-none">
                Front
              </div>

              {/* Render Pallets */}
              {unit.pallets.map((pallet) => renderPallet(pallet))}
              
              {/* Rear Indicator */}
              <div className="absolute bottom-0 w-full border-b-4 border-red-200/50"></div>
            </div>
            
            <div className="mt-2 text-xs text-slate-400">
                Heck
            </div>
          </div>
        );
      })}
      
      {palletArrangement.length === 0 && <p className="text-slate-400 mt-10">Keine Ladung konfiguriert.</p>}
    </div>
  );
}
