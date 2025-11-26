"use client";

import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { WeightInputs } from '@/components/WeightInputs';
import TruckVisualization from '@/components/TruckVisualization';
import { usePlannerStore } from '@/store';
import {
  TRUCK_TYPES,
  MAX_GROSS_WEIGHT_KG,
  KILOGRAM_FORMATTER,
} from '@/lib/loading/logic';

export default function HomePage() {
  const {
    selectedTruck,
    setSelectedTruck,
    eupWeights,
    setEupWeights,
    dinWeights,
    setDinWeights,
    eupLoadingPattern,
    setEupLoadingPattern,
    isEUPStackable,
    setIsEUPStackable,
    isDINStackable,
    setIsDINStackable,
    stackingStrategy,
    setStackingStrategy,
    loadedEuroPalletsBase,
    loadedIndustrialPalletsBase,
    totalEuroPalletsVisual,
    totalDinPalletsVisual,
    warnings,
    palletArrangement,
    totalWeightKg,
    actualEupLoadingPattern,
    remainingCapacity,
    lastEdited,
    setLastEdited,
    clearAllPallets,
    maximizePallets,
    fillRemaining,
    recalculate,
  } = usePlannerStore();
  const { toast } = useToast();
  const isWaggonSelected = ['Waggon', 'Waggon2'].includes(selectedTruck);
  const selectedTruckConfig = TRUCK_TYPES[selectedTruck as keyof typeof TRUCK_TYPES];
  const maxGrossWeightKg = selectedTruckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;
  useEffect(() => {
    recalculate();
  }, [
    selectedTruck,
    eupWeights,
    dinWeights,
    isEUPStackable,
    isDINStackable,
    eupLoadingPattern,
    stackingStrategy,
    recalculate,
  ]);
 
  const CAPACITY_ACCENT_STYLES: Record<'DIN' | 'EUP', { color: string; textShadow: string }> = {
    DIN: { color: 'hsl(142, 78%, 38%)', textShadow: '0 1px 3px rgba(15, 23, 42, 0.4)' },
    EUP: { color: 'hsl(217, 96%, 52%)', textShadow: '0 1px 3px rgba(15, 23, 42, 0.35)' }
  };

  const warningsWithoutInfo = warnings.filter(w => !w.toLowerCase().includes('platz') && !w.toLowerCase().includes('benötigt'));
  let meldungenStyle = {
    bg: 'bg-gray-50', border: 'border-gray-200',
    header: 'text-gray-800', list: 'text-gray-700'
  };

  if (warningsWithoutInfo.length === 0 && (totalDinPalletsVisual > 0 || totalEuroPalletsVisual > 0)) {
    meldungenStyle = { bg: 'bg-green-50', border: 'border-green-200', header: 'text-green-800', list: 'text-green-700' };
  } else if (warningsWithoutInfo.some(w => w.toLowerCase().includes('konnte nicht'))) {
    meldungenStyle = { bg: 'bg-red-50', border: 'border-red-200', header: 'text-red-800', list: 'text-red-700' };
  } else if (warningsWithoutInfo.length > 0) {
    meldungenStyle = { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'text-yellow-800', list: 'text-yellow-700' };
  }

  return (
    <div className="container mx-auto p-4 font-sans space-y-6">
      <header className="relative bg-gradient-to-r from-blue-700 to-blue-900 p-5 rounded-t-lg shadow-lg mb-6 text-slate-100">
        <div className="absolute top-2 right-4 text-right text-xs text-slate-100/80 drop-shadow">
          <p>Laderaumrechner © {new Date().getFullYear()}</p>
          <p>by Andreas Steiner</p>
        </div>
        <h1 className="text-3xl font-bold text-center tracking-tight drop-shadow-sm">Laderaumrechner</h1>
        <p className="text-center text-sm text-slate-100/90 drop-shadow">Visualisierung der Palettenplatzierung (Europäische Standards)</p>
      </header>
      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-semibold text-slate-800 mb-1 drop-shadow-sm">LKW-Typ:</label>
              <select
                id="truckType"
                value={selectedTruck}
                onChange={e => {
                  const newTruck = e.target.value as keyof typeof TRUCK_TYPES;
                  setSelectedTruck(newTruck);
                }}
                className="mt-1 block w-full py-2 px-3 text-sm font-medium focus:outline-none focus:ring-0 focus-visible:ring-0"
              >
                {Object.keys(TRUCK_TYPES).map(key=><option key={key} value={key}>{TRUCK_TYPES[key as keyof typeof TRUCK_TYPES].name}</option>)}
              </select>
            </div>
            <div className="pt-4">
              <button
                onClick={clearAllPallets}
                className="w-full py-2.5 px-4 font-semibold tracking-wide text-emerald-950/90 rounded-2xl"
              >
                Alles zurücksetzen
              </button>
            </div>
           
            <div className="border-t pt-4">
                <label className="block text-sm font-semibold text-slate-800 mb-2 drop-shadow-sm">Industriepaletten (DIN)</label>
                <WeightInputs
                  entries={dinWeights}
                  onChange={(entries)=>{ setLastEdited('din'); setDinWeights(entries); }}
                  palletType="DIN"
                  stackableEnabled={isDINStackable}
                />
                <button onClick={() => maximizePallets('industrial')} className="mt-2 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">Max. DIN</button>
                <button
                  onClick={() => {
                    fillRemaining('industrial');
                    toast({ title: 'LKW aufgefüllt', description: 'Freier Platz wurde mit INDUSTRIAL Paletten gefüllt.' });
                  }}
                  className="mt-1 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl"
                >
                  Rest mit max. DIN füllen
                </button>
                <div className="flex items-center mt-2">
                    <input type="checkbox" id="dinStackable" checked={isDINStackable} onChange={e=>setIsDINStackable(e.target.checked)} disabled={isWaggonSelected} className="h-5 w-5 disabled:cursor-not-allowed"/>
                    <label htmlFor="dinStackable" className={`ml-2 text-sm text-slate-800 ${isWaggonSelected ? 'text-slate-400' : ''}`}>Stapelbar (2-fach)</label>
                </div>
            </div>

            <div className="border-t pt-4">
                <label className="block text-sm font-semibold text-slate-800 mb-2 drop-shadow-sm">Europaletten (EUP)</label>
                <WeightInputs
                  entries={eupWeights}
                  onChange={(entries)=>{ setLastEdited('eup'); setEupWeights(entries); }}
                  palletType="EUP"
                  stackableEnabled={isEUPStackable}
                />
                <button onClick={() => maximizePallets('euro')} className="mt-2 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">Max. EUP</button>
                <button
                  onClick={() => {
                    fillRemaining('euro');
                    toast({ title: 'LKW aufgefüllt', description: 'Freier Platz wurde mit EURO Paletten gefüllt.' });
                  }}
                  className="mt-1 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl"
                >
                  Rest mit max. EUP füllen
                </button>
                <div className="flex items-center mt-2">
                    <input type="checkbox" id="eupStackable" checked={isEUPStackable} onChange={e=>setIsEUPStackable(e.target.checked)} disabled={isWaggonSelected} className="h-5 w-5 disabled:cursor-not-allowed"/>
                    <label htmlFor="eupStackable" className={`ml-2 text-sm text-slate-800 ${isWaggonSelected ? 'text-slate-400' : ''}`}>Stapelbar (2-fach)</label>
                </div>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                EUP Lade-Pattern:
                <span className="text-xs text-slate-600"> (Gewählt: {actualEupLoadingPattern === 'none' ? 'Keines' : actualEupLoadingPattern})</span>
              </label>
              <div className="flex flex-col space-y-1">
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="auto" checked={eupLoadingPattern==='auto'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-5 w-5"/><span className="ml-2 text-sm text-slate-800">Auto-Optimieren</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="long" checked={eupLoadingPattern==='long'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-5 w-5"/><span className="ml-2 text-sm text-slate-800">Längs (3 nebeneinander)</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="broad" checked={eupLoadingPattern==='broad'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-5 w-5"/><span className="ml-2 text-sm text-slate-800">Quer (2 nebeneinander)</span></label>
              </div>
            </div>
          </div>

          <TruckVisualization
            palletArrangement={palletArrangement}
            selectedTruck={selectedTruck as keyof typeof TRUCK_TYPES}
            truckConfig={selectedTruckConfig}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
            <h3 className="font-semibold text-slate-900 mb-2 drop-shadow-sm">Geladene Paletten (Visuell)</h3>
            <p className="text-slate-900/85">Industrie (DIN): <span className="font-bold text-lg text-slate-900">{totalDinPalletsVisual}</span></p>
            <p className="text-slate-900/85">Euro (EUP): <span className="font-bold text-lg text-slate-900">{totalEuroPalletsVisual}</span></p>
            <p className="text-xs mt-1 text-slate-900/70">(Basis: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
            <h3 className="font-semibold text-slate-900 mb-2 drop-shadow-sm">Verbleibende Kapazität</h3>
            {(() => {
                const firstType: 'DIN' | 'EUP' = lastEdited === 'din' ? 'DIN' : 'EUP';
                const secondType: 'DIN' | 'EUP' = lastEdited === 'din' ? 'EUP' : 'DIN';
                const firstValue = lastEdited === 'din' ? remainingCapacity.din : remainingCapacity.eup;
                const secondValue = lastEdited === 'din' ? remainingCapacity.eup : remainingCapacity.din;
                const firstAccent = CAPACITY_ACCENT_STYLES[firstType];
                const secondAccent = CAPACITY_ACCENT_STYLES[secondType];
                return (
                  <>
                    <p className="font-bold text-2xl text-slate-900/90 drop-shadow-sm">Platz für:</p>
                    <p className="font-bold text-2xl text-slate-900/90 space-x-1">
                      <span style={firstAccent}>{firstValue}</span>
                      <span className="text-slate-900/80">weitere</span>
                      <span style={firstAccent}>{firstType}</span>
                      <span className="text-slate-900/80">{firstValue === 1 ? 'Palette' : 'Paletten'}</span>
                    </p>
                    <p className="text-slate-900/80">oder</p>
                    <p className="font-bold text-xl text-slate-900/85 space-x-1">
                      <span style={secondAccent}>{secondValue}</span>
                      <span className="text-slate-900/70">weitere</span>
                      <span style={secondAccent}>{secondType}</span>
                      <span className="text-slate-900/70">{secondValue === 1 ? 'Palette' : 'Paletten'}</span>
                    </p>
                  </>
                );
            })()}
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="font-semibold text-slate-900 mb-2 drop-shadow-sm">Geschätztes Gewicht</h3>
            <p className="font-bold text-2xl text-slate-900/90">
              {KILOGRAM_FORMATTER.format(totalWeightKg)} kg
            </p>
            <p className="text-xs mt-1 text-slate-900/70">
              (Max: {KILOGRAM_FORMATTER.format(maxGrossWeightKg)} kg)
            </p>
          </div>
          <div className={`${meldungenStyle.bg} p-4 rounded-lg border ${meldungenStyle.border} shadow-sm`}>
            <h3 className={`font-semibold mb-2 ${meldungenStyle.header} drop-shadow-sm`}>Meldungen</h3>
            {warnings.length > 0 ? (
                <ul className={`list-disc list-inside text-sm space-y-1 ${meldungenStyle.list}`}>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
            ) : (
                <p className={`text-sm ${meldungenStyle.list}`}>Keine Probleme erkannt.</p>
            )}
          </div>
        </div>
      </main>
      <footer className="text-center py-4 mt-8 text-sm text-slate-100/80 border-t border-gray-200">
        <p className="drop-shadow">Laderaumrechner © {new Date().getFullYear()} by Andreas Steiner</p>
      </footer>
      <Toaster />
    </div>
  );
}
