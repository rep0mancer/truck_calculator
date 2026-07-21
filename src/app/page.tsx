"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { WeightInputs } from '@/components/WeightInputs';
import { translateWarning, translations, type Locale } from '@/i18n';

import { calculateLoadingLogic, KILOGRAM_FORMATTER, MAX_GROSS_WEIGHT_KG, MAX_PALLET_SIMULATION_QUANTITY, PALLET_TYPES, TRUCK_TYPES, type WeightEntry } from '@/lib/loadingCalculator';

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>('de');
  const t = translations[locale];
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupWeights, setEupWeights] = useState<WeightEntry[]>([{ id: 1, weight: '', quantity: 0 }]);
  const [dinWeights, setDinWeights] = useState<WeightEntry[]>([{ id: 2, weight: '', quantity: 0 }]);
  const [eupLoadingPattern, setEupLoadingPattern] = useState('auto');
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);
  const [eupStackLimit, setEupStackLimit] = useState(0);
  const [dinStackLimit, setDinStackLimit] = useState(0);
  const [loadedEuroPalletsBase, setLoadedEuroPalletsBase] = useState(0);
  const [loadedIndustrialPalletsBase, setLoadedIndustrialPalletsBase] = useState(0);
  const [totalEuroPalletsVisual, setTotalEuroPalletsVisual] = useState(0);
  const [totalDinPalletsVisual, setTotalDinPalletsVisual] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [palletArrangement, setPalletArrangement] = useState<any[]>([]);
  const [totalWeightKg, setTotalWeightKg] = useState(0);
  const [actualEupLoadingPattern, setActualEupLoadingPattern] = useState('auto');
  const [remainingCapacity, setRemainingCapacity] = useState<{ eup: number, din: number }>({ eup: 0, din: 0 });
  const [lastEdited, setLastEdited] = useState<'eup' | 'din'>('eup');
  const { toast } = useToast();
  const isWaggonSelected = ['Waggon', 'Waggon2'].includes(selectedTruck);
  const selectedTruckConfig = TRUCK_TYPES[selectedTruck as keyof typeof TRUCK_TYPES];
  const maxGrossWeightKg = selectedTruckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;

  const calculateAndSetState = useCallback(() => {
    const eupQuantity = eupWeights.reduce((sum, entry) => sum + entry.quantity, 0);
    const dinQuantity = dinWeights.reduce((sum, entry) => sum + entry.quantity, 0);

    const primaryResults = calculateLoadingLogic(
      selectedTruck as keyof typeof TRUCK_TYPES,
      eupWeights,
      dinWeights,
      isEUPStackable, isDINStackable,
      eupLoadingPattern as 'auto' | 'long' | 'broad',
      'DIN_FIRST',
      eupStackLimit,
      dinStackLimit
    );
    
    const multiTruckWarnings: string[] = [];
    
    if (dinQuantity > 0 && eupQuantity === 0) {
        const dinCapacityResult = calculateLoadingLogic(selectedTruck as keyof typeof TRUCK_TYPES, [], [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}], isEUPStackable, isDINStackable, eupLoadingPattern as 'auto' | 'long' | 'broad', 'DIN_FIRST', eupStackLimit, dinStackLimit);
        const maxDinCapacity = dinCapacityResult.totalDinPalletsVisual;

        if (maxDinCapacity > 0 && dinQuantity > maxDinCapacity) {
            const totalTrucks = Math.ceil(dinQuantity / maxDinCapacity);
            const fullTrucks = Math.floor(dinQuantity / maxDinCapacity);
            const remainingPallets = dinQuantity % maxDinCapacity;
            
            if (remainingPallets === 0) {
                multiTruckWarnings.push(`Für diesen Auftrag werden ${fullTrucks} volle LKWs benötigt.`);
            } else {
                multiTruckWarnings.push(`Benötigt ${totalTrucks} LKWs: ${fullTrucks} volle LKW(s) und 1 LKW mit ${remainingPallets} Paletten.`);
            }
        }
    } else if (eupQuantity > 0 && dinQuantity === 0) {
        const eupCapacityResult = calculateLoadingLogic(selectedTruck as keyof typeof TRUCK_TYPES, [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}], [], isEUPStackable, isDINStackable, eupLoadingPattern as 'auto' | 'long' | 'broad', 'EUP_FIRST', eupStackLimit, dinStackLimit);
        const maxEupCapacity = eupCapacityResult.totalEuroPalletsVisual;

        if (maxEupCapacity > 0 && eupQuantity > maxEupCapacity) {
            const totalTrucks = Math.ceil(eupQuantity / maxEupCapacity);
            const fullTrucks = Math.floor(eupQuantity / maxEupCapacity);
            const remainingPallets = eupQuantity % maxEupCapacity;
            
            if (remainingPallets === 0) {
                multiTruckWarnings.push(`Für diesen Auftrag werden ${fullTrucks} volle LKWs benötigt.`);
            } else {
                multiTruckWarnings.push(`Benötigt ${totalTrucks} LKWs: ${fullTrucks} volle LKW(s) und 1 LKW mit ${remainingPallets} Paletten.`);
            }
        }
    }
    
    setPalletArrangement(primaryResults.palletArrangement);
    setLoadedIndustrialPalletsBase(primaryResults.loadedIndustrialPalletsBase);
    setLoadedEuroPalletsBase(primaryResults.loadedEuroPalletsBase);
    setTotalDinPalletsVisual(primaryResults.totalDinPalletsVisual);
    setTotalEuroPalletsVisual(primaryResults.totalEuroPalletsVisual);
    setWarnings(Array.from(new Set([...primaryResults.warnings, ...multiTruckWarnings])));
    setTotalWeightKg(primaryResults.totalWeightKg);
    setActualEupLoadingPattern(primaryResults.eupLoadingPatternUsed);
    
    // Compute remaining capacity using simulation to account for repooling
    // For remaining EUP
    const weightToFillEup = eupWeights.length > 0 ? eupWeights[eupWeights.length - 1].weight || '0' : '0';
    const eupCapacityResult = calculateLoadingLogic(
      selectedTruck as keyof typeof TRUCK_TYPES,
      [{ id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFillEup }],
      dinWeights,
      isEUPStackable,
      isDINStackable,
      eupLoadingPattern as 'auto' | 'long' | 'broad',
      'DIN_FIRST',
      eupStackLimit,
      dinStackLimit
    );
    const maxEup = eupCapacityResult.totalEuroPalletsVisual;
    const remainingEup = Math.max(0, maxEup - eupQuantity);
    
    // For remaining DIN
    const weightToFillDin = dinWeights.length > 0 ? dinWeights[dinWeights.length - 1].weight || '0' : '0';
    const dinCapacityResult = calculateLoadingLogic(
      selectedTruck as keyof typeof TRUCK_TYPES,
      eupWeights,
      [{ id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFillDin }],
      isEUPStackable,
      isDINStackable,
      eupLoadingPattern as 'auto' | 'long' | 'broad',
      'EUP_FIRST',
      eupStackLimit,
      dinStackLimit
    );
    const maxDin = dinCapacityResult.totalDinPalletsVisual;
    const remainingDin = Math.max(0, maxDin - dinQuantity);
    
    setRemainingCapacity({ eup: remainingEup, din: remainingDin });
    
  }, [selectedTruck, eupWeights, dinWeights, isEUPStackable, isDINStackable, eupLoadingPattern, eupStackLimit, dinStackLimit]);

  useEffect(() => {
    calculateAndSetState();
  }, [calculateAndSetState]);

  useEffect(() => {
    const savedLocale = window.localStorage.getItem('truck-calculator-locale');
    if (savedLocale && savedLocale in translations) setLocale(savedLocale as Locale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem('truck-calculator-locale', locale);
  }, [locale]);

  const handleClearAllPallets = () => {
    setEupWeights([{ id: Date.now(), weight: '', quantity: 0 }]);
    setDinWeights([{ id: Date.now() + 1, weight: '', quantity: 0 }]);
    setIsEUPStackable(false);
    setIsDINStackable(false);
    setEupStackLimit(0);
    setDinStackLimit(0);
    setEupLoadingPattern('auto');
  };

  const handleMaximizePallets = (palletTypeToMax: 'euro' | 'industrial') => {
    const simResults = calculateLoadingLogic(
        selectedTruck as keyof typeof TRUCK_TYPES,
        palletTypeToMax === 'euro' ? [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}] : [],
        palletTypeToMax === 'industrial' ? [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}] : [],
        isEUPStackable, isDINStackable,
        'auto',
        palletTypeToMax === 'euro' ? 'EUP_FIRST' : 'DIN_FIRST',
        eupStackLimit, dinStackLimit
    );
    if (palletTypeToMax === 'industrial') {
        setDinWeights([{ id: Date.now(), weight: '', quantity: simResults.totalDinPalletsVisual }]);
        setEupWeights([{ id: Date.now() + 1, weight: '', quantity: 0 }]);
    } else if (palletTypeToMax === 'euro') {
        setEupWeights([{ id: Date.now(), weight: '', quantity: simResults.totalEuroPalletsVisual }]);
        setDinWeights([{ id: Date.now() + 1, weight: '', quantity: 0 }]);
    }
  };
 
  const handleFillRemaining = (typeToFill: 'euro' | 'industrial') => {
    const weightEntryToUse = typeToFill === 'euro' ? eupWeights[eupWeights.length - 1] : dinWeights[dinWeights.length - 1];
    const weightToFill = weightEntryToUse?.weight || '0';

    const eupSim = typeToFill === 'euro' 
        ? [...eupWeights, { id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFill }]
        : [...eupWeights];
    const dinSim = typeToFill === 'industrial'
        ? [...dinWeights, { id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFill }]
        : [...dinWeights];

    const order = typeToFill === 'euro' ? 'DIN_FIRST' : 'EUP_FIRST';

    const res = calculateLoadingLogic(
        selectedTruck as keyof typeof TRUCK_TYPES, eupSim, dinSim,
        isEUPStackable, isDINStackable, 'auto', order,
        eupStackLimit, dinStackLimit
    );

    const currentEups = eupWeights.reduce((s, e) => s + e.quantity, 0);
    const currentDins = dinWeights.reduce((s, e) => s + e.quantity, 0);

    const addedEups = res.totalEuroPalletsVisual - currentEups;
    const addedDins = res.totalDinPalletsVisual - currentDins;

    if (typeToFill === 'euro' && addedEups > 0) {
        setEupWeights(weights => {
            const newWeights = [...weights];
            const lastEntryIndex = newWeights.length - 1;
            // Create a new object for the last entry to avoid direct state mutation
            const updatedLastEntry = { 
                ...newWeights[lastEntryIndex], 
                quantity: newWeights[lastEntryIndex].quantity + addedEups 
            };
            newWeights[lastEntryIndex] = updatedLastEntry;
            return newWeights;
        });
    } else if (typeToFill === 'industrial' && addedDins > 0) {
        setDinWeights(weights => {
            const newWeights = [...weights];
            const lastEntryIndex = newWeights.length - 1;
            // Create a new object for the last entry to avoid direct state mutation
            const updatedLastEntry = { 
                ...newWeights[lastEntryIndex], 
                quantity: newWeights[lastEntryIndex].quantity + addedDins 
            };
            newWeights[lastEntryIndex] = updatedLastEntry;
            return newWeights;
        });
    }
    toast({ title: t.filledTitle, description: t.filledDescription.replace('{type}', typeToFill.toUpperCase()) });
  };
 
  // ... (renderPallet function and style calculations remain the same)
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

  const CAPACITY_ACCENT_STYLES: Record<'DIN' | 'EUP', { color: string; textShadow: string }> = {
    DIN: { color: 'hsl(142, 78%, 38%)', textShadow: '0 1px 3px rgba(15, 23, 42, 0.4)' },
    EUP: { color: 'hsl(217, 96%, 52%)', textShadow: '0 1px 3px rgba(15, 23, 42, 0.35)' }
  };

  const renderPallet = (pallet: any, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !(pallet.type in PALLET_TYPES)) return null;
    const palette = palletVisualPalette[pallet.type] ?? palletVisualPalette.euro;
    const d = PALLET_TYPES[pallet.type as keyof typeof PALLET_TYPES];
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

  const truckVisualizationScale = 0.35;

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
        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:absolute sm:right-4 sm:top-3 sm:mt-0 sm:max-w-[26rem] sm:justify-end" role="group" aria-label="Language / Sprache">
          {([{ code: 'de', flag: '🇩🇪', label: 'Deutsch' }, { code: 'en', flag: '🇬🇧', label: 'English' }, { code: 'it', flag: '🇮🇹', label: 'Italiano' }, { code: 'hr', flag: '🇭🇷', label: 'Hrvatski' }, { code: 'sk', flag: '🇸🇰', label: 'Slovenčina' }, { code: 'cs', flag: '🇨🇿', label: 'Čeština' }, { code: 'uk', flag: '🇺🇦', label: 'Українська' }] as const).map(language => (
            <button key={language.code} type="button" onClick={() => setLocale(language.code)} aria-label={language.label} aria-pressed={locale === language.code} title={language.label} className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 px-2 text-2xl leading-none shadow-sm transition duration-150 hover:-translate-y-0.5 hover:scale-105 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 active:translate-y-0 active:scale-95 ${locale === language.code ? 'border-white bg-white/30 shadow-lg' : 'border-white/40 bg-white/10 opacity-85 hover:opacity-100'}`}>{language.flag}</button>
          ))}
        </div>
        <h1 className="text-3xl font-bold text-center tracking-tight drop-shadow-sm sm:px-80">{t.title}</h1>
        <p className="text-center text-sm text-slate-100/90 drop-shadow">{t.subtitle}</p>
      </header>
      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-semibold text-slate-800 mb-1 drop-shadow-sm">{t.truckType}</label>
              <select
                id="truckType"
                value={selectedTruck} 
                onChange={e => {
                  const newTruck = e.target.value;
                  setSelectedTruck(newTruck);
                  if (['Waggon', 'Waggon2'].includes(newTruck)) {
                    setIsEUPStackable(false);
                    setIsDINStackable(false);
                  }
                }} 
                className="mt-1 block w-full py-2 px-3 text-sm font-medium focus:outline-none focus:ring-0 focus-visible:ring-0"
              >
                {Object.keys(TRUCK_TYPES).map(key=><option key={key} value={key}>{TRUCK_TYPES[key as keyof typeof TRUCK_TYPES].name}</option>)}
              </select>
            </div>
            <div className="pt-4">
              <button
                onClick={handleClearAllPallets}
                className="w-full py-2.5 px-4 font-semibold tracking-wide text-emerald-950/90 rounded-2xl"
              >
                {t.reset}
              </button>
            </div>
           
            <div className="border-t pt-4">
                <label className="block text-sm font-semibold text-slate-800 mb-2 drop-shadow-sm">{t.dinPallets}</label>
                <WeightInputs entries={dinWeights} onChange={(entries)=>{ setLastEdited('din'); setDinWeights(entries); }} palletType="DIN" locale={locale} />
                <button onClick={() => handleMaximizePallets('industrial')} className="mt-2 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">Max. DIN</button>
                <button onClick={() => handleFillRemaining('industrial')} className="mt-1 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">{t.fillDin}</button>
                <div className="flex items-center mt-2">
                    <input type="checkbox" id="dinStackable" checked={isDINStackable} onChange={e=>setIsDINStackable(e.target.checked)} disabled={isWaggonSelected} className="h-5 w-5 disabled:cursor-not-allowed"/>
                    <label htmlFor="dinStackable" className={`ml-2 text-sm text-slate-800 ${isWaggonSelected ? 'text-slate-400' : ''}`}>{t.stackable}</label>
                </div>
                {isDINStackable && !isWaggonSelected && (
                    <input type="number" min="0" value={dinStackLimit} onChange={e=>setDinStackLimit(Math.max(0, parseInt(e.target.value,10)||0))} className="mt-1 block w-full py-1 px-2 sm:text-xs" placeholder={t.stackLimit}/>
                )}
            </div>

            <div className="border-t pt-4">
                <label className="block text-sm font-semibold text-slate-800 mb-2 drop-shadow-sm">{t.euroPallets}</label>
                <WeightInputs entries={eupWeights} onChange={(entries)=>{ setLastEdited('eup'); setEupWeights(entries); }} palletType="EUP" locale={locale} />
                <button onClick={() => handleMaximizePallets('euro')} className="mt-2 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">Max. EUP</button>
                <button onClick={() => handleFillRemaining('euro')} className="mt-1 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">{t.fillEup}</button>
                <div className="flex items-center mt-2">
                    <input type="checkbox" id="eupStackable" checked={isEUPStackable} onChange={e=>setIsEUPStackable(e.target.checked)} disabled={isWaggonSelected} className="h-5 w-5 disabled:cursor-not-allowed"/>
                    <label htmlFor="eupStackable" className={`ml-2 text-sm text-slate-800 ${isWaggonSelected ? 'text-slate-400' : ''}`}>{t.stackable}</label>
                </div>
                {isEUPStackable && !isWaggonSelected && (
                    <input type="number" min="0" value={eupStackLimit} onChange={e=>setEupStackLimit(Math.max(0, parseInt(e.target.value,10)||0))} className="mt-1 block w-full py-1 px-2 sm:text-xs" placeholder={t.stackLimit}/>
                )}
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                {t.loadingPattern}
                <span className="text-xs text-slate-600"> ({t.selected}: {actualEupLoadingPattern === 'none' ? t.none : t[actualEupLoadingPattern as 'auto' | 'long' | 'broad']})</span>
              </label>
              <div className="flex flex-col space-y-1">
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="auto" checked={eupLoadingPattern==='auto'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-5 w-5"/><span className="ml-2 text-sm text-slate-800">{t.auto}</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="long" checked={eupLoadingPattern==='long'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-5 w-5"/><span className="ml-2 text-sm text-slate-800">{t.long}</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="broad" checked={eupLoadingPattern==='broad'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-5 w-5"/><span className="ml-2 text-sm text-slate-800">{t.broad}</span></label>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gray-100 p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center">
            <p className="text-slate-100 text-lg mb-4 font-semibold drop-shadow">{t.visualization}</p>
            {palletArrangement.map((unit: any,index: number)=>(
              <div key={unit.unitId} className="mb-6 w-full flex flex-col items-center">
                {TRUCK_TYPES[selectedTruck as keyof typeof TRUCK_TYPES].units.length>1&&<p className="text-sm text-slate-200 mb-2 drop-shadow-sm">{t.unit} {index+1} ({unit.unitLength/100}m x {unit.unitWidth/100}m)</p>}
                {index === 0 && (
                  <svg
                    aria-hidden
                    role="presentation"
                    className="block"
                    width={unit.unitWidth*truckVisualizationScale}
                    height={24}
                    viewBox={`0 0 ${unit.unitWidth*truckVisualizationScale} 24`}
                  >
                    {/* Cab base */}
                    <rect
                      x="0"
                      y="6"
                      width={unit.unitWidth*truckVisualizationScale}
                      height="16"
                      rx="6"
                      fill="rgba(59,130,246,0.4)"
                      stroke="rgba(96,165,250,0.65)"
                    />
                    {/* Nose to indicate forward direction */}
                    <path
                      d={`M ${(unit.unitWidth*truckVisualizationScale)/2 - 12} 6 L ${(unit.unitWidth*truckVisualizationScale)/2} 0 L ${(unit.unitWidth*truckVisualizationScale)/2 + 12} 6 Z`}
                      fill="rgba(59,130,246,0.55)"
                    />
                    {/* Label */}
                    <text x={(unit.unitWidth*truckVisualizationScale)/2} y={20} textAnchor="middle" fontSize="10" fontWeight={700} fill="rgba(15,23,42,0.85)">{t.front}</text>
                  </svg>
                )}
                <div
                  className="relative overflow-hidden rounded-2xl border border-white/40 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]"
                  style={{
                    width:`${unit.unitWidth*truckVisualizationScale}px`,
                    height:`${unit.unitLength*truckVisualizationScale}px`,
                    background:'linear-gradient(160deg, rgba(148, 163, 184, 0.25), rgba(226, 232, 240, 0.18))',
                    backdropFilter:'blur(26px)',
                    WebkitBackdropFilter:'blur(26px)'
                  }}
                >
                  {unit.pallets.map((p: any)=>renderPallet(p,truckVisualizationScale))}
                </div>
              </div>
            ))}
             {palletArrangement.length === 0 && <p className="text-slate-200/80">{t.empty}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
            <h3 className="font-semibold text-slate-900 mb-2 drop-shadow-sm">{t.loaded}</h3>
            <p className="text-slate-900/85">{t.industrial}: <span className="font-bold text-lg text-slate-900">{totalDinPalletsVisual}</span></p>
            <p className="text-slate-900/85">{t.euro}: <span className="font-bold text-lg text-slate-900">{totalEuroPalletsVisual}</span></p>
            <p className="text-xs mt-1 text-slate-900/70">({t.base}: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
            <h3 className="font-semibold text-slate-900 mb-2 drop-shadow-sm">{t.remaining}</h3>
            {(() => {
                const firstType: 'DIN' | 'EUP' = lastEdited === 'din' ? 'DIN' : 'EUP';
                const secondType: 'DIN' | 'EUP' = lastEdited === 'din' ? 'EUP' : 'DIN';
                const firstValue = lastEdited === 'din' ? remainingCapacity.din : remainingCapacity.eup;
                const secondValue = lastEdited === 'din' ? remainingCapacity.eup : remainingCapacity.din;
                const firstAccent = CAPACITY_ACCENT_STYLES[firstType];
                const secondAccent = CAPACITY_ACCENT_STYLES[secondType];
                return (
                  <>
                    <p className="font-bold text-2xl text-slate-900/90 drop-shadow-sm">{t.roomFor}</p>
                    <p className="font-bold text-2xl text-slate-900/90 space-x-1">
                      <span style={firstAccent}>{firstValue}</span>
                      <span className="text-slate-900/80">{t.more}</span>
                      <span style={firstAccent}>{firstType}</span>
                      <span className="text-slate-900/80">{firstValue === 1 ? t.pallet : t.pallets}</span>
                    </p>
                    <p className="text-slate-900/80">{t.or}</p>
                    <p className="font-bold text-xl text-slate-900/85 space-x-1">
                      <span style={secondAccent}>{secondValue}</span>
                      <span className="text-slate-900/70">{t.more}</span>
                      <span style={secondAccent}>{secondType}</span>
                      <span className="text-slate-900/70">{secondValue === 1 ? t.pallet : t.pallets}</span>
                    </p>
                  </>
                );
            })()}
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="font-semibold text-slate-900 mb-2 drop-shadow-sm">{t.weight}</h3>
            <p className="font-bold text-2xl text-slate-900/90">
              {KILOGRAM_FORMATTER.format(totalWeightKg)} kg
            </p>
            <p className="text-xs mt-1 text-slate-900/70">
              ({t.max}: {KILOGRAM_FORMATTER.format(maxGrossWeightKg)} kg)
            </p>
          </div>
          <div className={`${meldungenStyle.bg} p-4 rounded-lg border ${meldungenStyle.border} shadow-sm`}>
            <h3 className={`font-semibold mb-2 ${meldungenStyle.header} drop-shadow-sm`}>{t.messages}</h3>
            {warnings.length > 0 ? (
                <ul className={`list-disc list-inside text-sm space-y-1 ${meldungenStyle.list}`}>
                {warnings.map((w, i) => <li key={i}>{translateWarning(w, locale)}</li>)}
                </ul>
            ) : (
                <p className={`text-sm ${meldungenStyle.list}`}>{t.noProblems}</p>
            )}
          </div>
        </div>
      </main>
      <footer className="text-center py-4 mt-8 text-sm text-slate-100/80 border-t border-gray-200">
        <p className="drop-shadow">{t.title} © {new Date().getFullYear()} by Andreas Steiner</p>
      </footer>
      <Toaster />
    </div>
  );
}
