"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import {
  TRUCK_TYPES,
  PALLET_TYPES,
  MAX_PALLET_SIMULATION_QUANTITY,
  MAX_GROSS_WEIGHT_KG,
  calculateLoadingLogic,
} from '@/lib/loading/logic';

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState('auto');
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);

  const [eupStackLimit, setEupStackLimit] = useState(0);
  const [dinStackLimit, setDinStackLimit] = useState(0);

  const [eupWeightPerPallet, setEupWeightPerPallet] = useState('');
  const [dinWeightPerPallet, setDinWeightPerPallet] = useState('');

  const [loadedEuroPalletsBase, setLoadedEuroPalletsBase] = useState(0);
  const [loadedIndustrialPalletsBase, setLoadedIndustrialPalletsBase] = useState(0);
  const [totalEuroPalletsVisual, setTotalEuroPalletsVisual] = useState(0);
  const [totalDinPalletsVisual, setTotalDinPalletsVisual] = useState(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [palletArrangement, setPalletArrangement] = useState([]);
  const [totalWeightKg, setTotalWeightKg] = useState(0);
  const [actualEupLoadingPattern, setActualEupLoadingPattern] = useState('auto');

  const { toast } = useToast();


  const calculateAndSetState = useCallback((order = 'DIN_FIRST', currentEup = eupQuantity, currentDin = dinQuantity) => {
    // Primary calculation based on current inputs or function call parameters
    const primaryResults = calculateLoadingLogic(
      selectedTruck,
      currentEup, // Use current EUP quantity for this calculation
      currentDin, // Use current DIN quantity for this calculation
      isEUPStackable, isDINStackable,
      eupWeightPerPallet, dinWeightPerPallet,
      eupLoadingPattern,
      order,
      eupStackLimit,
      dinStackLimit
    );

    // --- Calculate remaining EUP capacity ---
    // Simulate filling the rest of the truck (already containing primaryResults.totalDinPalletsVisual) with EUPs
    const eupCapacityCheckResults = calculateLoadingLogic(
        selectedTruck,
        MAX_PALLET_SIMULATION_QUANTITY,     // Try to fill with as many EUPs as possible
        primaryResults.totalDinPalletsVisual, // Given the DINs already effectively placed
        isEUPStackable, isDINStackable,
        eupWeightPerPallet, dinWeightPerPallet,
        eupLoadingPattern,
        'DIN_FIRST', // Place existing DINs first, then fill with EUPs
        eupStackLimit,
        dinStackLimit
    );
    // Calculate how many *more* EUPs fit compared to what's already there from the primary calculation
    const additionalEupPossible = Math.max(0, eupCapacityCheckResults.totalEuroPalletsVisual - primaryResults.totalEuroPalletsVisual);


    // --- Calculate remaining DIN capacity ---
    // Simulate filling the rest of the truck (already containing primaryResults.totalEuroPalletsVisual) with DINs
    const dinCapacityCheckResults = calculateLoadingLogic(
        selectedTruck,
        primaryResults.totalEuroPalletsVisual, // Given the EUPs already effectively placed
        MAX_PALLET_SIMULATION_QUANTITY,      // Try to fill with as many DINs as possible
        isEUPStackable, isDINStackable,
        eupWeightPerPallet, dinWeightPerPallet,
        eupLoadingPattern,
        'EUP_FIRST', // Place existing EUPs first, then fill with DINs
        eupStackLimit,
        dinStackLimit
    );
    // Calculate how many *more* DINs fit
    const additionalDinPossible = Math.max(0, dinCapacityCheckResults.totalDinPalletsVisual - primaryResults.totalDinPalletsVisual);

    let finalWarnings = [...primaryResults.warnings];
    if (additionalEupPossible > 0 && additionalDinPossible > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${additionalEupPossible} EUP oder ${additionalDinPossible} DIN Paletten.`);
    } else if (additionalEupPossible > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${additionalEupPossible} EUP.`);
    } else if (additionalDinPossible > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${additionalDinPossible} DIN Paletten.`);
    }

    const truckCapEuro = calculateLoadingLogic(
        selectedTruck,
        MAX_PALLET_SIMULATION_QUANTITY,
        0,
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        eupLoadingPattern,
        'DIN_FIRST',
        eupStackLimit,
        dinStackLimit
    ).totalEuroPalletsVisual;
    const truckCapDin = calculateLoadingLogic(
        selectedTruck,
        0,
        MAX_PALLET_SIMULATION_QUANTITY,
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        eupLoadingPattern,
        'DIN_FIRST',
        eupStackLimit,
        dinStackLimit
    ).totalDinPalletsVisual;

    if (eupQuantity > truckCapEuro && truckCapEuro > 0 && dinQuantity === 0) {
        const fullTrucks = Math.floor(eupQuantity / truckCapEuro);
        const rest = eupQuantity % truckCapEuro;
        if (rest > 0) {
            finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt und ${rest} Paletten bleiben rest am ${fullTrucks + 1}. LKW`);
        } else {
            finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt`);
        }
    } else if (dinQuantity > truckCapDin && truckCapDin > 0 && eupQuantity === 0) {
        const fullTrucks = Math.floor(dinQuantity / truckCapDin);
        const rest = dinQuantity % truckCapDin;
        if (rest > 0) {
            finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt und ${rest} Paletten bleiben rest am ${fullTrucks + 1}. LKW`);
        } else {
            finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt`);
        }
    }

    const noWeightWarning = !finalWarnings.some(w => w.toLowerCase().includes('gewichtslimit'));
    const isFull = additionalEupPossible === 0 && additionalDinPossible === 0 &&
                   (primaryResults.totalEuroPalletsVisual + primaryResults.totalDinPalletsVisual > 0) &&
                   noWeightWarning;
    const finalUtilization = isFull ? 100 : primaryResults.utilizationPercentage;
    
    setPalletArrangement(primaryResults.palletArrangement);
    setLoadedIndustrialPalletsBase(primaryResults.loadedIndustrialPalletsBase);
    setLoadedEuroPalletsBase(primaryResults.loadedEuroPalletsBase);
    setTotalDinPalletsVisual(primaryResults.totalDinPalletsVisual);
    setTotalEuroPalletsVisual(primaryResults.totalEuroPalletsVisual);
    setUtilizationPercentage(finalUtilization);
    setWarnings(finalWarnings); // Set the combined warnings
    setTotalWeightKg(primaryResults.totalWeightKg);
    setActualEupLoadingPattern(primaryResults.eupLoadingPatternUsed);
    
  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern, eupStackLimit, dinStackLimit]);

  useEffect(() => {
    // Recalculate whenever quantities or stack limits change so the visualization stays in sync
    calculateAndSetState('DIN_FIRST', eupQuantity, dinQuantity);
  }, [calculateAndSetState, eupQuantity, dinQuantity, eupStackLimit, dinStackLimit]);


  const handleQuantityChange = (type, amount) => {
    if (type === 'eup') setEupQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    else if (type === 'din') setDinQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
  };

  const handleClearAllPallets = () => {
    setEupQuantity(0); setDinQuantity(0);
    setEupWeightPerPallet(''); setDinWeightPerPallet('');
    setIsEUPStackable(false); setIsDINStackable(false);
    setEupStackLimit(0); setDinStackLimit(0);
    setEupLoadingPattern('auto');
    // No need to explicitly call calculateAndSetState here, useEffect will trigger
  };

  const handleMaximizePallets = (palletTypeToMax) => {
    let targetEupQty = 0; 
    let targetDinQty = 0;
    let order = 'DIN_FIRST'; 
    let eupStackForCalc = isEUPStackable; // Respect current user choice for stacking
    let dinStackForCalc = isDINStackable; // Respect current user choice for stacking

    if (palletTypeToMax === 'industrial') {
      targetDinQty = MAX_PALLET_SIMULATION_QUANTITY; 
      targetEupQty = 0; // When maximizing one type, zero out the other for the simulation
      order = 'DIN_FIRST'; 
    } else if (palletTypeToMax === 'euro') {
      targetEupQty = MAX_PALLET_SIMULATION_QUANTITY; 
      targetDinQty = 0; // When maximizing one type, zero out the other for the simulation
      order = 'EUP_FIRST'; 
    }

    // Perform the calculation for maximizing
    const simResults = calculateLoadingLogic(
        selectedTruck, targetEupQty, targetDinQty,
        eupStackForCalc, dinStackForCalc,
        eupWeightPerPallet, dinWeightPerPallet,
        eupLoadingPattern,
        order,
        eupStackLimit,
        dinStackLimit
    );

    // Update states based on the maximization result
    if (palletTypeToMax === 'industrial') {
        setDinQuantity(simResults.totalDinPalletsVisual); 
        setEupQuantity(0); // Explicitly set EUP to 0
    } else if (palletTypeToMax === 'euro') {
        setEupQuantity(simResults.totalEuroPalletsVisual);
        setDinQuantity(0); // Explicitly set DIN to 0
    }
    
    // The calculateAndSetState in useEffect will run with these new quantities
    // and perform the primary calculation + remaining capacity checks.
    // No need to duplicate all state settings here.

    if (eupLoadingPattern === 'auto' && simResults.eupLoadingPatternUsed !== 'auto' && simResults.eupLoadingPatternUsed !== 'none' && palletTypeToMax === 'euro') {
        setEupLoadingPattern(simResults.eupLoadingPatternUsed); 
    }
  };

  const handleFillRemainingWithEUP = () => {
    // Keep current DINs and fill the rest with EUPs using the best pattern.

    // The calculateAndSetState in useEffect will handle the detailed simulation.
    // We just need to set the intention for eupQuantity to be "max" and keep
    // dinQuantity as is. The primary calculation in calculateAndSetState will use
    // MAX_PALLET_SIMULATION_QUANTITY for EUPs.
    
    // Trigger a recalculation with current DIN quantity and a signal to maximize EUPs.
    // The `calculateAndSetState` will be called by useEffect due to state changes.
    // To make this explicit and ensure the correct parameters are used for the *primary* calculation before remaining capacity:
    // We need to calculate what the primary load would be.
    const fillResults = calculateLoadingLogic(
      selectedTruck,
      MAX_PALLET_SIMULATION_QUANTITY, // Attempt to fill with EUPs
      dinQuantity,                  // Keep current DINs
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet, dinWeightPerPallet,
      'auto',
      'DIN_FIRST', // Place DINs first, then fill EUPs
      eupStackLimit,
      dinStackLimit
    );

    setEupQuantity(fillResults.totalEuroPalletsVisual);
    // dinQuantity remains the same, or if limited by fillResults, update it.
    setDinQuantity(fillResults.totalDinPalletsVisual); 

    // useEffect will then run calculateAndSetState with these updated quantities.
  };

  const handleFillRemainingWithDIN = () => {
    // Keep current EUPs and fill the rest with DIN pallets using the best pattern.

    const currentEupQty = eupQuantity;
    let bestSimResults = null;

    const currentTruckInfo = TRUCK_TYPES[selectedTruck];
    let truckTheoreticalMaxDin = currentTruckInfo.singleLayerDINCapacity || 
                                (currentTruckInfo.singleLayerDINCapacityPerUnit && currentTruckInfo.units.length > 0 ? 
                                 currentTruckInfo.singleLayerDINCapacityPerUnit * currentTruckInfo.units.length : 
                                 (currentTruckInfo.units.length > 0 ? Math.floor(currentTruckInfo.units[0].length / PALLET_TYPES.industrial.width) * 2 * currentTruckInfo.units.length : 30));
    
    const iterationMaxDin = truckTheoreticalMaxDin * (isDINStackable ? 2 : 1);

    for (let d = iterationMaxDin; d >= 0; d--) {
        const simResults = calculateLoadingLogic(
            selectedTruck, currentEupQty, d,
            isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet,
            'auto', 'DIN_FIRST',
            eupStackLimit,
            dinStackLimit
        );

        if (simResults.totalEuroPalletsVisual >= currentEupQty && simResults.totalDinPalletsVisual === d) {
            bestSimResults = simResults;
            break; 
        }
    }

    if (bestSimResults) {
        setDinQuantity(bestSimResults.totalDinPalletsVisual); 
        setEupQuantity(currentEupQty); // Preserve the EUP quantity

    } else {
        const eupFirstSimResults = calculateLoadingLogic(
          selectedTruck, currentEupQty, MAX_PALLET_SIMULATION_QUANTITY,
          isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet,
          'auto', 'EUP_FIRST',
          eupStackLimit,
          dinStackLimit
        );
        setDinQuantity(eupFirstSimResults.totalDinPalletsVisual);
        setEupQuantity(eupFirstSimResults.totalEuroPalletsVisual); 

    }
    // useEffect will run calculateAndSetState with these updated quantities.
  };

  const suggestFeasibleLoad = () => {
    let bestEup = 0;
    let bestDin = 0;
    let bestResult = null as any;

    for (let d = dinQuantity; d >= 0; d--) {
      for (let e = eupQuantity; e >= 0; e--) {
        const res = calculateLoadingLogic(
          selectedTruck,
          e,
          d,
          isEUPStackable,
          isDINStackable,
          eupWeightPerPallet,
          dinWeightPerPallet,
          eupLoadingPattern,
          'DIN_FIRST',
          eupStackLimit,
          dinStackLimit
        );
        const badWarning = res.warnings.some((w) =>
          w.toLowerCase().includes('gewichtslimit') ||
          w.toLowerCase().includes('konnte nicht')
        );
        if (!badWarning && res.totalEuroPalletsVisual === e && res.totalDinPalletsVisual === d) {
          if (e + d > bestEup + bestDin) {
            bestEup = e;
            bestDin = d;
            bestResult = res;
          }
        }
      }
    }

    setEupQuantity(bestEup);
    setDinQuantity(bestDin);
    if (
      bestResult &&
      eupLoadingPattern === 'auto' &&
      bestResult.eupLoadingPatternUsed !== 'auto' &&
      bestResult.eupLoadingPatternUsed !== 'none'
    ) {
      setEupLoadingPattern(bestResult.eupLoadingPatternUsed);
    }
    toast({ title: 'Vorschlag übernommen', description: `${bestDin} DIN / ${bestEup} EUP geladen` });
  };

  const renderPallet = (pallet, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) return null;
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
      <div key={pallet.key} title={title}
        className={`absolute ${d.color} ${d.borderColor} border flex items-center justify-center rounded-sm shadow-sm`}
        style={{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, opacity: pallet.isStackedTier==='top'?0.7:1, zIndex: pallet.isStackedTier==='top'?10:5,fontSize:'10px' }}>
        <span className="text-black font-semibold select-none">{txt}</span>
        {pallet.isStackedTier==='top'&&<div className="absolute top-0 left-0 w-full h-full border-t-2 border-l-2 border-black opacity-30 pointer-events-none rounded-sm"/>}
      </div>
    );
  };

  const truckVisualizationScale = 0.3;

  const warningsWithoutInfo = warnings.filter(w => !w.toLowerCase().includes('platz'));
  let meldungenStyle = {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    header: 'text-gray-800',
    list: 'text-gray-700'
  };

  if (eupQuantity === 0 && dinQuantity === 0 && totalEuroPalletsVisual === 0 && totalDinPalletsVisual === 0) {
    meldungenStyle = { bg: 'bg-gray-50', border: 'border-gray-200', header: 'text-gray-800', list: 'text-gray-700' };
  } else if (warningsWithoutInfo.length === 0) {
    meldungenStyle = { bg: 'bg-green-50', border: 'border-green-200', header: 'text-green-800', list: 'text-green-700' };
  } else if (warningsWithoutInfo.every(w => w.toLowerCase().includes('achslast'))) {
    meldungenStyle = { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'text-yellow-800', list: 'text-yellow-700' };
  } else {
    meldungenStyle = { bg: 'bg-red-50', border: 'border-red-200', header: 'text-red-800', list: 'text-red-700' };
  }

  return (
    <div className="container mx-auto p-4 font-sans bg-gray-50">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-t-lg shadow-lg mb-6">
        <h1 className="text-3xl font-bold text-center tracking-tight">Laderaumrechner</h1>
        <p className="text-center text-sm opacity-90">Visualisierung der Palettenplatzierung (Europäische Standards)</p>
      </header>
      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Input Column */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">LKW-Typ:</label>
              <select id="truckType" value={selectedTruck} onChange={e=>{setSelectedTruck(e.target.value);}} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {Object.keys(TRUCK_TYPES).map(key=><option key={key} value={key}>{TRUCK_TYPES[key].name}</option>)}
              </select>
            </div>
            <div className="pt-4">
              <button onClick={handleClearAllPallets} className="w-full py-2 px-4 bg-[#00906c] text-white font-semibold rounded-md shadow-sm hover:bg-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50 transition duration-150 ease-in-out">Alles zurücksetzen</button>
            </div>
            <div>
              <button onClick={suggestFeasibleLoad} className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 transition duration-150 ease-in-out">Automatisch anpassen</button>
            </div>

            {/* DIN Paletten Sektion */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industriepaletten (DIN)</label>
              <div className="flex items-center mt-1">
                <button onClick={()=>handleQuantityChange('din',-1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input type="number" min="0" value={dinQuantity} onChange={e=>setDinQuantity(Math.max(0, parseInt(e.target.value,10)||0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                <button onClick={()=>handleQuantityChange('din',1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => handleMaximizePallets('industrial')} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50">Max. DIN</button>
              <button onClick={handleFillRemainingWithDIN} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50">Rest mit max. DIN füllen</button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/DIN (kg):</label>
                <input type="number" min="0" value={dinWeightPerPallet} onChange={e=>setDinWeightPerPallet(e.target.value)} placeholder="z.B. 500" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"/>
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="dinStackable" checked={isDINStackable} onChange={e=>setIsDINStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                <label htmlFor="dinStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {isDINStackable && (
                <input
                  type="number"
                  min="0"
                  value={dinStackLimit}
                  onChange={e=>setDinStackLimit(Math.max(0, parseInt(e.target.value,10)||0))}
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                  placeholder="Stapelbare Paletten (0 = alle)"
                />
              )}
            </div>

            {/* EUP Paletten Sektion */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Europaletten (EUP)</label>
              <div className="flex items-center mt-1">
                <button onClick={()=>handleQuantityChange('eup',-1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input type="number" min="0" value={eupQuantity} onChange={e=>setEupQuantity(Math.max(0, parseInt(e.target.value,10)||0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                <button onClick={()=>handleQuantityChange('eup',1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => handleMaximizePallets('euro')} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50">Max. EUP</button>
              <button onClick={handleFillRemainingWithEUP} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50">Rest mit max. EUP füllen</button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/EUP (kg):</label>
                <input type="number" min="0" value={eupWeightPerPallet} onChange={e=>setEupWeightPerPallet(e.target.value)} placeholder="z.B. 400" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"/>
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="eupStackable" checked={isEUPStackable} onChange={e=>setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                <label htmlFor="eupStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {isEUPStackable && (
                <input
                  type="number"
                  min="0"
                  value={eupStackLimit}
                  onChange={e=>setEupStackLimit(Math.max(0, parseInt(e.target.value,10)||0))}
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                  placeholder="Stapelbare Paletten (0 = alle)"
                />
              )}
            </div>

            {(eupQuantity > 0 || totalEuroPalletsVisual > 0 || actualEupLoadingPattern !== 'auto' || eupLoadingPattern !== 'auto' || (TRUCK_TYPES[selectedTruck].singleLayerEUPCapacityLong || 0) > 0 ) && ( 
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">EUP Lade-Pattern:
                <span className="text-xs text-gray-500"> (Gewählt: {actualEupLoadingPattern === 'none' ? 'Keines' : actualEupLoadingPattern})</span>
              </label>
              <div className="flex flex-col space-y-1">
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="auto" checked={eupLoadingPattern==='auto'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/><span className="ml-2 text-sm text-gray-700">Auto-Optimieren</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="long" checked={eupLoadingPattern==='long'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/><span className="ml-2 text-sm text-gray-700">Längs (3 nebeneinander)</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="broad" checked={eupLoadingPattern==='broad'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/><span className="ml-2 text-sm text-gray-700">Quer (2 nebeneinander)</span></label>
              </div>
            </div>)}
          </div>

          {/* Visualization Column */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Ladefläche Visualisierung</p>
            {palletArrangement.map((unit,index)=>(
              <div key={unit.unitId} className="mb-4 w-full flex flex-col items-center">
                {TRUCK_TYPES[selectedTruck].units.length>1&&<p className="text-sm text-gray-700 mb-1">Einheit {index+1} ({unit.unitLength/100}m x {unit.unitWidth/100}m)</p>}
                <div className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner" style={{width:`${unit.unitWidth*truckVisualizationScale}px`,height:`${unit.unitLength*truckVisualizationScale}px`}}>
                  {unit.pallets.map(p=>renderPallet(p,truckVisualizationScale))}
                </div>
              </div>
            ))}
             {palletArrangement.length === 0 && <p className="text-gray-500">Keine Paletten zum Anzeigen.</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
            <h3 className="font-semibold text-blue-800 mb-2">Geladene Paletten (Visuell)</h3>
            <p>Industrie (DIN): <span className="font-bold text-lg">{totalDinPalletsVisual}</span></p>
            <p>Euro (EUP): <span className="font-bold text-lg">{totalEuroPalletsVisual}</span></p>
            <p className="text-xs mt-1">(Basis: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
            <h3 className="font-semibold text-green-800 mb-2">Flächenausnutzung</h3>
            <p className="font-bold text-3xl text-green-700">{utilizationPercentage}%</p>
            <p className="text-xs mt-1">(Grundfläche)</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="font-semibold text-yellow-800 mb-2">Geschätztes Gewicht</h3>
            <p className="font-bold text-2xl text-yellow-700">{(totalWeightKg/1000).toFixed(1)} t</p>
            <p className="text-xs mt-1">(Max: {(TRUCK_TYPES[selectedTruck].maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG)/1000}t)</p>
          </div>
          <div className={`${meldungenStyle.bg} p-4 rounded-lg border ${meldungenStyle.border} shadow-sm`}>
            <h3 className={`font-semibold mb-2 ${meldungenStyle.header}`}>Meldungen</h3>
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
      <footer className="text-center py-4 mt-8 text-sm text-gray-500 border-t border-gray-200">
        <p>Laderaumrechner © {new Date().getFullYear()}</p>
         <p>by Andreas Steiner </p>
      </footer>
      <Toaster />
    </div>
  );
}
