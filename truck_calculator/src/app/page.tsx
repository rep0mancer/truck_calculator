"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { CONTAINER_SLOT_DEFINITIONS } from './containerSlots';


// Constants for truck types, including single-layer capacities
const TRUCK_TYPES = {
  roadTrain: {
    name: 'Hängerzug (2x 7,2m)',
    units: [
      { id: 'unit1', length: 720, width: 245, occupiedRects: [] },
      { id: 'unit2', length: 720, width: 245, occupiedRects: [] },
    ],
    totalLength: 1440,
    usableLength: 1440,
    maxWidth: 245,
    singleLayerEUPCapacityLongPerUnit: 18,
    singleLayerEUPCapacityBroadPerUnit: 18, // Assuming 2x9 broad fit
    singleLayerDINCapacityPerUnit: 14, // Assuming 2x7 fit
  },
  curtainSider: {
    name: 'Curtain-Sider Semi-trailer (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    trueLength: 1360, // Actual physical length for visual reference
    maxWidth: 245,
    singleLayerEUPCapacityLong: 33, // 11 rows * 3
    singleLayerEUPCapacityBroad: 32, // 16 rows * 2 (approx, 16*80 = 1280)
    singleLayerDINCapacity: 26, // 13 rows * 2
  },
  smallTruck: {
    name: 'Small Truck (7.2m)',
    units: [{ id: 'main', length: 720, width: 245, occupiedRects: [] }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    singleLayerEUPCapacityLong: 18, // 6 rows * 3
    singleLayerEUPCapacityBroad: 18, // 9 rows * 2
    singleLayerDINCapacity: 14, // 7 rows * 2
  },
};

// Constants for pallet types
const PALLET_TYPES = {
  euro: { name: 'Euro Pallet (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700', label: 'E' },
  industrial: { name: 'Industrial Pallet (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700', label: 'I' },
};

// Maximum gross weight for the truck (payload capacity)
const MAX_GROSS_WEIGHT_KG = 24000; // Example: 24 tonnes payload

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState('auto');
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);

  const [eupWeightPerPallet, setEupWeightPerPallet] = useState('');
  const [dinWeightPerPallet, setDinWeightPerPallet] = useState('');

  // State for calculation results
  const [loadedEuroPalletsBase, setLoadedEuroPalletsBase] = useState(0);
  const [loadedIndustrialPalletsBase, setLoadedIndustrialPalletsBase] = useState(0);
  const [totalEuroPalletsVisual, setTotalEuroPalletsVisual] = useState(0);
  const [totalDinPalletsVisual, setTotalDinPalletsVisual] = useState(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [palletArrangement, setPalletArrangement] = useState([]); // Initialized as empty array
  const [totalWeightKg, setTotalWeightKg] = useState(0);

  const currentTruckDef = TRUCK_TYPES[selectedTruck];

  // Effect for auto-checking stackable (can be disabled if preferred)
  useEffect(() => {
    const currentTruck = TRUCK_TYPES[selectedTruck];
    let singleLayerEUPCapacity = 0;
    let singleLayerDINCapacity = 0;

    if (currentTruck.units.length > 1) {
        singleLayerEUPCapacity = (currentTruck.singleLayerEUPCapacityLongPerUnit || currentTruck.singleLayerEUPCapacityLong || 0) * currentTruck.units.length;
        singleLayerDINCapacity = (currentTruck.singleLayerDINCapacityPerUnit || currentTruck.singleLayerDINCapacity || 0) * currentTruck.units.length;
    } else {
        singleLayerEUPCapacity = currentTruck.singleLayerEUPCapacityLong || 0;
        singleLayerDINCapacity = currentTruck.singleLayerDINCapacity || 0;
    }
    // Optional: Auto-enable stacking if quantity exceeds single layer.
    // Consider user experience implications.
    // if (eupQuantity > 0 && singleLayerEUPCapacity > 0 && eupQuantity > singleLayerEUPCapacity && !isEUPStackable) {
    //   setIsEUPStackable(true);
    // }
    // if (dinQuantity > 0 && singleLayerDINCapacity > 0 && dinQuantity > singleLayerDINCapacity && !isDINStackable) {
    //   setIsDINStackable(true);
    // }
  }, [eupQuantity, dinQuantity, selectedTruck, isEUPStackable, isDINStackable]);


  // Main calculation logic wrapped in useCallback
  const calculateLoading = useCallback(() => {
    // --- Initialization ---
    const initialTruckConfigMaster = JSON.parse(JSON.stringify(TRUCK_TYPES[selectedTruck]));
    let tempWarnings = [];
    let finalTotalEuroVisual = 0;
    let finalTotalDinVisual = 0;
    let finalActualEUPBase = 0;
    let finalActualDINBase = 0;
    let finalTotalAreaBase = 0;
    let currentTotalWeight = 0;
    // *** Initialize finalPalletArrangement here to ensure it's always defined ***
    let finalPalletArrangement = [];

    // Safely parse weights
    const eupWeight = parseFloat(eupWeightPerPallet);
    const dinWeight = parseFloat(dinWeightPerPallet);
    const safeEupWeight = !isNaN(eupWeight) && eupWeight > 0 ? eupWeight : 0;
    const safeDinWeight = !isNaN(dinWeight) && dinWeight > 0 ? dinWeight : 0;

    // Initialize state for each truck unit
    let unitsState = initialTruckConfigMaster.units.map(u => ({
        ...u,
        occupiedRects: [],
        currentX: 0,
        currentY: 0,
        palletsVisual: [],
        dinEndX: 0,
        dinEndY: 0,
        dinLastRowIncomplete: false,
        eupStartX: 0,
    }));

    // --- DIN Pallet Placement ---
    let dinPlacedCountTotal = 0;
    if (dinQuantity > 0) {
        for (const unit of unitsState) {
            if (dinPlacedCountTotal >= dinQuantity) break;
            while (unit.currentX < unit.length) {
                if (dinPlacedCountTotal >= dinQuantity) break;
                let rowPalletsPlaced = 0;
                const dinDef = PALLET_TYPES.industrial;
                const dinLength = dinDef.width;
                const dinWidth = dinDef.length;
                let rowHeight = 0;
                unit.currentY = 0;

                for (let i = 0; i < 2; i++) { // Try placing two DINs across
                    if (dinPlacedCountTotal >= dinQuantity) break;
                    if (safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG) {
                        if (!tempWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
                            tempWarnings.push(`Weight limit reached for DIN pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                        }
                        unit.currentX = unit.length; break;
                    }
                    if (unit.currentX + dinLength <= unit.length && unit.currentY + dinWidth <= unit.width) {
                        const baseKey = `din_base_${unit.id}_${finalActualDINBase}_${i}`;
                        unit.palletsVisual.push({
                            x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth,
                            type: 'industrial', isStacked: false, key: baseKey, unitId: unit.id,
                        });
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth });
                        finalTotalAreaBase += dinDef.area;
                        finalActualDINBase++;
                        finalTotalDinVisual++;
                        currentTotalWeight += safeDinWeight;
                        dinPlacedCountTotal++;
                        rowPalletsPlaced++;
                        rowHeight = Math.max(rowHeight, dinLength);

                        // Stacking DIN
                        if (isDINStackable && dinPlacedCountTotal < dinQuantity) {
                            if (!(safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG)) {
                                unit.palletsVisual.push({
                                    x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth,
                                    type: 'industrial', isStacked: true, key: `din_stack_${unit.id}_${finalActualDINBase -1}_${i}`, unitId: unit.id,
                                });
                                finalTotalDinVisual++;
                                currentTotalWeight += safeDinWeight;
                                dinPlacedCountTotal++;
                            } else { if (!tempWarnings.some(w => w.includes("Weight limit stacking DIN"))) tempWarnings.push(`Weight limit reached. Cannot stack more DIN pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`); }
                        }
                        unit.currentY += dinWidth;
                    } else { break; }
                }
                if (unit.currentX >= unit.length) break;
                if (rowPalletsPlaced > 0) {
                    unit.currentX += rowHeight;
                    unit.dinEndX = unit.currentX;
                    unit.dinEndY = unit.currentY;
                    unit.dinLastRowIncomplete = (rowPalletsPlaced === 1);
                } else { unit.currentX = unit.length; }
            }
            unit.eupStartX = unit.dinEndX; // Set initial EUP start X for this unit
        }
    }

    if (finalTotalDinVisual < dinQuantity && !tempWarnings.some(w => w.includes("Weight limit"))) {
        tempWarnings.push(`Could not fit all ${dinQuantity} Industrial pallets due to space. Only ${finalTotalDinVisual} (visual) placed.`);
    }

    const initialUnitsStateAfterDIN = JSON.parse(JSON.stringify(unitsState));
    const weightAfterDINs = currentTotalWeight;

    // --- EUP PALLET PLACEMENT ---
    let bestEUPResult = {
        unitsConfiguration: JSON.parse(JSON.stringify(initialUnitsStateAfterDIN)),
        totalVisualEUPs: 0, baseEUPs: 0, areaEUPs: 0, tempWarnings: [],
        currentWeightAfterEUPs: weightAfterDINs,
        chosenPattern: eupLoadingPattern === 'auto' ? 'none' : eupLoadingPattern,
    };

    if (eupQuantity > 0) {
        const patternsToTry = eupLoadingPattern === 'auto' ? ['long', 'broad'] : [eupLoadingPattern];
        for (const pattern of patternsToTry) {
            let currentUnits = JSON.parse(JSON.stringify(initialUnitsStateAfterDIN));
            let patternVisualEUP = 0, patternBaseEUP = 0, patternAreaEUP = 0;
            let patternWeight = weightAfterDINs;
            let patternWarn = [];
            let patternRemainingEupNeeded = eupQuantity;

            // GAP FILLING
            for (const unit of currentUnits) {
                if (patternRemainingEupNeeded <= 0) break;
                if (unit.dinLastRowIncomplete) {
                    const gapX = unit.dinEndX - PALLET_TYPES.industrial.width;
                    const gapY = PALLET_TYPES.industrial.length;
                    const gapWidth = unit.width - gapY;
                    const gapLength = unit.length - gapX;
                    const dinLengthInRow = PALLET_TYPES.industrial.width;
                    const eupDef = PALLET_TYPES.euro;
                    let placedInGap = false, eupLengthPlacedInGap = 0;
                    let palletVisualGap = null;
                    const tryBroadFirst = (pattern === 'broad' || pattern === 'auto');
                    const tryLongFirst = (pattern === 'long' || pattern === 'auto');

                    // Try Broad in Gap
                    if (tryBroadFirst && gapWidth >= eupDef.length && gapLength >= eupDef.width && patternRemainingEupNeeded > 0) {
                        if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                            palletVisualGap = { x: gapX, y: gapY, width: eupDef.width, height: eupDef.length, type: 'euro', isStacked: false, key: `eup_gap_${unit.id}_${pattern}_broad`, unitId: unit.id };
                            placedInGap = true; eupLengthPlacedInGap = eupDef.width;
                        } else { if (!patternWarn.some(w=>w.includes("EUP gap"))) patternWarn.push("Weight limit for EUP gap"); }
                    }
                    // Try Long in Gap
                    if (!placedInGap && tryLongFirst && gapWidth >= eupDef.width && gapLength >= eupDef.length && patternRemainingEupNeeded > 0) {
                         if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                            palletVisualGap = { x: gapX, y: gapY, width: eupDef.length, height: eupDef.width, type: 'euro', isStacked: false, key: `eup_gap_${unit.id}_${pattern}_long`, unitId: unit.id };
                            placedInGap = true; eupLengthPlacedInGap = eupDef.length;
                         } else { if (!patternWarn.some(w=>w.includes("EUP gap"))) patternWarn.push("Weight limit for EUP gap"); }
                    }

                    if (placedInGap && palletVisualGap) {
                        unit.palletsVisual.push(palletVisualGap);
                        unit.occupiedRects.push({ x: palletVisualGap.x, y: palletVisualGap.y, width: palletVisualGap.width, height: palletVisualGap.height });
                        patternAreaEUP += eupDef.area; patternBaseEUP++; patternVisualEUP++;
                        patternWeight += safeEupWeight; patternRemainingEupNeeded--;
                        // Stacking in Gap
                        if (isEUPStackable && patternRemainingEupNeeded > 0) {
                            if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                                unit.palletsVisual.push({ ...palletVisualGap, isStacked: true, key: palletVisualGap.key.replace('_gap_', '_gap_stack_') });
                                patternVisualEUP++; patternWeight += safeEupWeight; patternRemainingEupNeeded--;
                            } else { if (!patternWarn.some(w=>w.includes("stacking EUP gap"))) patternWarn.push("Weight limit stacking EUP gap"); }
                        }
                        unit.eupStartX = gapX + Math.max(dinLengthInRow, eupLengthPlacedInGap); // Adjust start for next row
                    }
                }
            }

            // MAIN EUP PLACEMENT
            for (const unit of currentUnits) {
                if (patternRemainingEupNeeded <= 0) break;
                unit.currentX = unit.eupStartX; unit.currentY = 0;
                while (unit.currentX < unit.length) {
                    if (patternRemainingEupNeeded <= 0) break;
                    let rowPalletsPlaced = 0;
                    const eupDef = PALLET_TYPES.euro;
                    const palletsPerRow = pattern === 'long' ? 3 : 2;
                    const eupLength = pattern === 'long' ? eupDef.length : eupDef.width;
                    const eupWidth = pattern === 'long' ? eupDef.width : eupDef.length;
                    let rowHeight = 0; unit.currentY = 0;

                    for (let i = 0; i < palletsPerRow; i++) {
                        if (patternRemainingEupNeeded <= 0) break;
                        if (safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG) {
                            if (!patternWarn.some(w => w.includes("Weight limit reached for EUP"))) patternWarn.push(`Weight limit reached for EUP pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                            unit.currentX = unit.length; break;
                        }
                        if (unit.currentX + eupLength <= unit.length && unit.currentY + eupWidth <= unit.width) {
                            const baseKey = `eup_base_${unit.id}_${patternBaseEUP}_${pattern}_${i}`;
                            unit.palletsVisual.push({ x: unit.currentX, y: unit.currentY, width: eupLength, height: eupWidth, type: 'euro', isStacked: false, key: baseKey, unitId: unit.id });
                            unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: eupLength, height: eupWidth });
                            patternAreaEUP += eupDef.area; patternBaseEUP++; patternVisualEUP++;
                            patternWeight += safeEupWeight; patternRemainingEupNeeded--;
                            rowPalletsPlaced++; rowHeight = Math.max(rowHeight, eupLength);
                            // Stacking EUP
                            if (isEUPStackable && patternRemainingEupNeeded > 0) {
                                if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                                     unit.palletsVisual.push({ x: unit.currentX, y: unit.currentY, width: eupLength, height: eupWidth, type: 'euro', isStacked: true, key: `eup_stack_${unit.id}_${patternBaseEUP - 1}_${pattern}_${i}`, unitId: unit.id });
                                    patternVisualEUP++; patternWeight += safeEupWeight; patternRemainingEupNeeded--;
                                } else { if (!patternWarn.some(w=>w.includes("stacking EUP"))) patternWarn.push("Weight limit stacking EUP"); }
                            }
                             unit.currentY += eupWidth;
                        } else { break; }
                    }
                    if (unit.currentX >= unit.length) break;
                    if (rowPalletsPlaced > 0) { unit.currentX += rowHeight; }
                    else { unit.currentX = unit.length; }
                }
            }

            // Compare pattern results
            const currentBestVisuals = bestEUPResult.totalVisualEUPs;
            const isUserPreference = (eupLoadingPattern !== 'auto' && pattern === eupLoadingPattern);
            let better = false;
            if (patternVisualEUP > currentBestVisuals) { better = true; }
            else if (patternVisualEUP === currentBestVisuals) {
                 if (isUserPreference && bestEUPResult.chosenPattern !== pattern) { better = true; }
                 // else if (patternAreaEUP < bestEUPResult.areaEUPs) { better = true; } // Optional secondary criteria
            }
            if (better) {
                bestEUPResult = {
                    unitsConfiguration: JSON.parse(JSON.stringify(currentUnits)),
                    totalVisualEUPs: patternVisualEUP, baseEUPs: patternBaseEUP, areaEUPs: patternAreaEUP,
                    tempWarnings: patternWarn, currentWeightAfterEUPs: patternWeight, chosenPattern: pattern
                };
            } else if (patternVisualEUP === currentBestVisuals && bestEUPResult.chosenPattern === 'none' && eupLoadingPattern === 'auto') {
                 bestEUPResult.chosenPattern = pattern; // Default to first tried if tied in auto mode
            }
        } // End patternsToTry loop

        // Finalize EUP based on best result
        // *** Add defensive check before mapping ***
        finalPalletArrangement = Array.isArray(bestEUPResult?.unitsConfiguration)
            ? bestEUPResult.unitsConfiguration.map(unit => ({
                unitId: unit.id, unitLength: unit.length, unitWidth: unit.width,
                // *** Add defensive check for palletsVisual ***
                pallets: Array.isArray(unit.palletsVisual) ? unit.palletsVisual : []
            }))
            : []; // Default to empty array if source is invalid

        finalActualEUPBase = bestEUPResult.baseEUPs;
        finalTotalEuroVisual = bestEUPResult.totalVisualEUPs;
        finalTotalAreaBase += bestEUPResult.areaEUPs;
        currentTotalWeight = bestEUPResult.currentWeightAfterEUPs;
        tempWarnings.push(...bestEUPResult.tempWarnings.filter(w => !tempWarnings.some(existing => existing === w)));

        if (finalTotalEuroVisual < eupQuantity && !tempWarnings.some(w => w.includes("Weight limit"))) {
            tempWarnings.push(`Could not fit all ${eupQuantity} Euro pallets due to space. Only ${finalTotalEuroVisual} (visual) placed.`);
        }

    } else { // No EUPs requested
        // *** Add defensive check before mapping ***
        finalPalletArrangement = Array.isArray(initialUnitsStateAfterDIN)
            ? initialUnitsStateAfterDIN.map(unit => ({
                unitId: unit.id, unitLength: unit.length, unitWidth: unit.width,
                 // *** Add defensive check for palletsVisual ***
                pallets: Array.isArray(unit.palletsVisual) ? unit.palletsVisual : []
            }))
            : []; // Default to empty array if source is invalid

        finalActualEUPBase = 0;
        finalTotalEuroVisual = 0;
        currentTotalWeight = weightAfterDINs;
    }

    // --- Set Final State ---
    // *** Ensure finalPalletArrangement is an array before setting state ***
    setPalletArrangement(Array.isArray(finalPalletArrangement) ? finalPalletArrangement : []);
    setLoadedEuroPalletsBase(finalActualEUPBase);
    setLoadedIndustrialPalletsBase(finalActualDINBase);
    setTotalEuroPalletsVisual(finalTotalEuroVisual);
    setTotalDinPalletsVisual(finalTotalDinVisual);
    setTotalWeightKg(currentTotalWeight);

    // Utilization
    const totalTruckArea = initialTruckConfigMaster.units.reduce((sum, u) => sum + (u.length * u.width), 0);
    let newUtilization = totalTruckArea > 0 ? (finalTotalAreaBase / totalTruckArea) * 100 : 0;
    setUtilizationPercentage(parseFloat(newUtilization.toFixed(1)));

    // Final Warnings
    const totalActualLoadedBase = finalActualEUPBase + finalActualDINBase;
    if (safeEupWeight > 0 || safeDinWeight > 0) {
        if (currentTotalWeight > MAX_GROSS_WEIGHT_KG && !tempWarnings.some(w => w.includes("Gross vehicle weight"))) {
            tempWarnings.push(`Potential gross vehicle weight overload (${(currentTotalWeight / 1000).toFixed(1)}t > ${(MAX_GROSS_WEIGHT_KG / 1000)}t).`);
        }
        if (totalActualLoadedBase > 0 && currentTotalWeight > 0 && (currentTotalWeight / totalActualLoadedBase) > 1500) {
             if (!tempWarnings.some(w => w.includes("axle load"))) {
                tempWarnings.push('High average weight per pallet footprint. Check axle load distribution.');
             }
        }
    }

    const allEUPRequestedPlaced = finalTotalEuroVisual >= eupQuantity;
    const allDINRequestedPlaced = finalTotalDinVisual >= dinQuantity;
    if (tempWarnings.length === 0 && (eupQuantity > 0 || dinQuantity > 0) && allEUPRequestedPlaced && allDINRequestedPlaced) {
      tempWarnings.push('All requested pallets placed successfully.');
    } else if (tempWarnings.length === 0 && eupQuantity === 0 && dinQuantity === 0) {
      tempWarnings.push('No pallets requested.');
    }
    setWarnings(Array.from(new Set(tempWarnings)));

  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern]);

  useEffect(() => {
    // Initial calculation on mount and when dependencies change
    try {
        calculateLoading();
    } catch (error) {
        console.error("Error during calculateLoading execution:", error);
        // Optionally set a generic error state to display to the user
        setWarnings(prev => [...prev, "An unexpected error occurred during calculation."]);
    }
  }, [calculateLoading]); // Dependency array includes calculateLoading

  // --- Event Handlers ---
  const handleQuantityChange = (type, amount) => {
    if (type === 'eup') {
      setEupQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    } else if (type === 'din') {
      setDinQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    }
  };

   // --- Rendering Functions ---
   const renderPallet = (pallet, displayScale = 0.3) => {
     if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) {
        console.error("Invalid pallet data passed to renderPallet:", pallet);
        return null; // Don't render if pallet data is invalid
     }
     const palletDetails = PALLET_TYPES[pallet.type];
     const displayWidth = pallet.height * displayScale;
     const displayHeight = pallet.width * displayScale;
     const displayX = pallet.y * displayScale;
     const displayY = pallet.x * displayScale;

     return (
       <div
         key={pallet.key}
         className={`absolute ${palletDetails.color} ${palletDetails.borderColor} border flex items-center justify-center rounded-sm shadow-sm`}
         style={{
           left: `${displayX}px`, top: `${displayY}px`,
           width: `${displayWidth}px`, height: `${displayHeight}px`,
           opacity: pallet.isStacked ? 0.7 : 1,
           zIndex: pallet.isStacked ? 10 : 5, fontSize: '10px',
         }}
         title={`${palletDetails.name}${pallet.isStacked ? ' (Stacked)' : ''}`}
       >
         <span className="text-black font-semibold select-none">{palletDetails.label}</span>
         {pallet.isStacked && (
           <div className="absolute top-0 left-0 w-full h-full border-t-2 border-black opacity-30 pointer-events-none"></div>
         )}
       </div>
     );
   };

  const truckVisualizationScale = 0.3;

  // --- JSX Return ---
  return (
    <div className="container mx-auto p-4 font-sans bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-t-lg shadow-lg mb-6">
        <h1 className="text-3xl font-bold text-center tracking-tight">Truck Loading Space Calculator</h1>
        <p className="text-center text-sm opacity-90">Visualize Pallet Placement (European Standards)</p>
      </header>

      {/* Main Content Area */}
      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Input Column */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            {/* Truck Selection */}
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">Truck Type:</label>
              <select id="truckType" name="truckType" value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {Object.keys(TRUCK_TYPES).map(key => (
                  <option key={key} value={key}>{TRUCK_TYPES[key].name}</option>
                ))}
              </select>
            </div>

            {/* DIN Pallets */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industrial Pallets (DIN - 1.2m x 1.0m)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('din', -1)} className="px-3 py-1 bg-red-600 text-white rounded-l-md hover:bg-red-700 transition duration-150 ease-in-out">-</button>
                <input type="number" min="0" id="dinQuantity" name="dinQuantity" value={dinQuantity} onChange={(e) => setDinQuantity(Math.max(0, parseInt(e.target.value,10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('din', 1)} className="px-3 py-1 bg-green-600 text-white rounded-r-md hover:bg-green-700 transition duration-150 ease-in-out">+</button>
              </div>
              <div className="mt-2">
                <label htmlFor="dinWeightPerPallet" className="text-xs font-medium text-gray-600">Weight/DIN (kg):</label>
                <input type="number" min="0" id="dinWeightPerPallet" name="dinWeightPerPallet" value={dinWeightPerPallet} onChange={(e) => setDinWeightPerPallet(e.target.value)} placeholder="e.g. 500" className="mt-1 block w-full py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input id="dinStackable" name="dinStackable" type="checkbox" checked={isDINStackable} onChange={(e) => setIsDINStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="dinStackable" className="ml-2 block text-sm text-gray-900">Stackable (2 high)</label>
              </div>
            </div>

            {/* Euro Pallets */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Euro Pallets (EUP - 1.2m x 0.8m)</label>
              <div className="flex items-center mt-1">
                 <button onClick={() => handleQuantityChange('eup', -1)} className="px-3 py-1 bg-red-600 text-white rounded-l-md hover:bg-red-700 transition duration-150 ease-in-out">-</button>
                <input type="number" min="0" id="eupQuantity" name="eupQuantity" value={eupQuantity} onChange={(e) => setEupQuantity(Math.max(0, parseInt(e.target.value,10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                 <button onClick={() => handleQuantityChange('eup', 1)} className="px-3 py-1 bg-green-600 text-white rounded-r-md hover:bg-green-700 transition duration-150 ease-in-out">+</button>
              </div>
               <div className="mt-2">
                <label htmlFor="eupWeightPerPallet" className="text-xs font-medium text-gray-600">Weight/EUP (kg):</label>
                <input type="number" min="0" id="eupWeightPerPallet" name="eupWeightPerPallet" value={eupWeightPerPallet} onChange={(e) => setEupWeightPerPallet(e.target.value)} placeholder="e.g. 400" className="mt-1 block w-full py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input id="eupStackable" name="eupStackable" type="checkbox" checked={isEUPStackable} onChange={(e) => setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="eupStackable" className="ml-2 block text-sm text-gray-900">Stackable (2 high)</label>
              </div>
            </div>

            {/* EUP Loading Pattern */}
            {eupQuantity > 0 && (
              <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">EUP Loading Pattern:</label>
                  <div className="flex flex-col space-y-1">
                      <div className="flex items-center">
                          <input type="radio" id="eupAuto" name="eupLoadingPatternOption" value="auto" checked={eupLoadingPattern === 'auto'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                          <label htmlFor="eupAuto" className="ml-2 text-sm text-gray-700">Auto-Optimize (Best Fit)</label>
                      </div>
                      <div className="flex items-center">
                          <input type="radio" id="eupLong" name="eupLoadingPatternOption" value="long" checked={eupLoadingPattern === 'long'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                          <label htmlFor="eupLong" className="ml-2 text-sm text-gray-700">Lengthwise (3 across, 0.8m wide each)</label>
                      </div>
                      <div className="flex items-center">
                          <input type="radio" id="eupBroad" name="eupLoadingPatternOption" value="broad" checked={eupLoadingPattern === 'broad'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                          <label htmlFor="eupBroad" className="ml-2 text-sm text-gray-700">Widthwise (2 across, 1.2m wide each)</label>
                      </div>
                  </div>
              </div>
            )}
          </div>

          {/* Visualization Column */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm min-h-[450px] flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Truck Loading Area Visualization</p>
            {/* Defensive check for palletArrangement before mapping */}
            {Array.isArray(palletArrangement) && currentTruckDef.units.map((unit, index) => (
              <div key={unit.id} className="mb-4 last:mb-0 w-full flex flex-col items-center">
                {currentTruckDef.units.length > 1 && <p className="text-sm text-center font-medium text-gray-700 mb-1">Unit {index + 1} ({unit.length/100}m x {unit.width/100}m)</p>}
                <div
                  id={`truckVisualization-${unit.id}`}
                  className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner"
                  style={{
                    width: `${unit.width * truckVisualizationScale}px`,
                    height: `${unit.length * truckVisualizationScale}px`,
                  }}
                >
                  {/* Render unusable space */}
                  {selectedTruck === 'curtainSider' && currentTruckDef.trueLength && currentTruckDef.usableLength < currentTruckDef.trueLength && (
                    <>
                       <div className="absolute top-0 left-0 w-full bg-red-300 opacity-30 pointer-events-none"
                            style={{ height: `${((currentTruckDef.trueLength - currentTruckDef.usableLength)) * truckVisualizationScale}px` }}
                            title={`Unusable Space: ${(currentTruckDef.trueLength - currentTruckDef.usableLength)/100}m`}
                       />
                       <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[8px] text-red-800 bg-white px-1 py-0.5 rounded opacity-80 pointer-events-none whitespace-nowrap">
                           Usable: {currentTruckDef.usableLength/100}m
                       </div>
                    </>
                  )}
                  {/* Render Pallets - Find the correct unit's data */}
                  {palletArrangement.find(pa => pa && pa.unitId === unit.id)?.pallets?.map(p => renderPallet(p, truckVisualizationScale))}
                </div>
              </div>
            ))}
             {selectedTruck === 'curtainSider' && currentTruckDef.trueLength && currentTruckDef.usableLength < currentTruckDef.trueLength && <p className="text-xs text-gray-500 mt-2 text-center">Note: Shaded area indicates unusable space on a 13.6m trailer (~13.2m effective).</p>}
          </div>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           {/* Loaded Pallets */}
           <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
             <h3 className="text-md font-semibold text-blue-800 mb-2">Loaded Pallets (Visual)</h3>
             <p className="text-sm">Industrial (DIN): <span id="loadedIndustrial" className="font-bold text-lg">{totalDinPalletsVisual}</span></p>
             <p className="text-sm">Euro (EUP): <span id="loadedEuro" className="font-bold text-lg">{totalEuroPalletsVisual}</span></p>
             <p className="text-xs mt-1">(Base: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)</p>
           </div>
           {/* Utilization */}
           <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
             <h3 className="text-md font-semibold text-green-800 mb-2">Area Utilization</h3>
             <p><span id="utilizationPercentage" className="font-bold text-3xl text-green-700">{utilizationPercentage}</span>%</p>
              <p className="text-xs mt-1">(Based on base pallet footprints)</p>
           </div>
           {/* Total Weight */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
             <h3 className="text-md font-semibold text-yellow-800 mb-2">Estimated Weight</h3>
             <p><span id="totalWeight" className="font-bold text-2xl text-yellow-700">{(totalWeightKg / 1000).toFixed(1)}</span> t</p>
              <p className="text-xs mt-1">(Max Payload: {MAX_GROSS_WEIGHT_KG/1000}t)</p>
           </div>
           {/* Warnings */}
           <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
             <h3 className="text-md font-semibold text-red-800 mb-2">Notifications</h3>
             <ul id="warningsList" className="list-disc list-inside text-sm space-y-1 text-red-700">
               {warnings.length > 0 ? warnings.map((warning, index) => <li key={index}>{warning}</li>) : <li className="text-gray-500">No issues detected.</li>}
             </ul>
           </div>
        </div>

        {/* Side View Visualization */}
        {((isEUPStackable && totalEuroPalletsVisual > loadedEuroPalletsBase) || (isDINStackable && totalDinPalletsVisual > loadedIndustrialPalletsBase)) && (loadedIndustrialPalletsBase > 0 || loadedEuroPalletsBase > 0) && (
          <div className="mb-8 bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-center items-center">
              <p className="text-gray-600 text-md mb-3 font-semibold">Side View (Conceptual)</p>
              <div id="sideViewVisualization" className="w-full h-auto bg-gray-200 rounded flex justify-center items-end p-4 min-h-[100px] space-x-2">
                  {/* DIN Stacks */}
                  {Array.from({ length: loadedIndustrialPalletsBase }).slice(0, 3).map((_, idx) => {
                      const palletDetails = PALLET_TYPES.industrial;
                      const showStacked = isDINStackable && totalDinPalletsVisual > loadedIndustrialPalletsBase;
                      return (
                          <div key={`sideview-din-${idx}`} className="flex flex-col items-center" title="Industrial Pallet (Side View)">
                              {showStacked && <div className={`w-10 h-8 ${palletDetails.color} border ${palletDetails.borderColor} opacity-60 flex justify-center items-center text-xs font-bold rounded-t-sm`}>{palletDetails.label}</div>}
                              <div className={`w-10 h-8 ${palletDetails.color} border ${palletDetails.borderColor} ${showStacked ? 'border-t-0 rounded-b-sm' : 'rounded-sm'} flex justify-center items-center text-xs font-bold`}>{palletDetails.label}</div>
                          </div>
                      );
                  })}
                  {/* EUP Stacks */}
                   {Array.from({ length: loadedEuroPalletsBase }).slice(0, 3).map((_, idx) => {
                      const palletDetails = PALLET_TYPES.euro;
                      const showStacked = isEUPStackable && totalEuroPalletsVisual > loadedEuroPalletsBase;
                      return (
                          <div key={`sideview-eup-${idx}`} className="flex flex-col items-center" title="Euro Pallet (Side View)">
                               {showStacked && <div className={`w-8 h-8 ${palletDetails.color} border ${palletDetails.borderColor} opacity-60 flex justify-center items-center text-xs font-bold rounded-t-sm`}>{palletDetails.label}</div>}
                              <div className={`w-8 h-8 ${palletDetails.color} border ${palletDetails.borderColor} ${showStacked ? 'border-t-0 rounded-b-sm' : 'rounded-sm'} flex justify-center items-center text-xs font-bold`}>{palletDetails.label}</div>
                          </div>
                      );
                  })}
                  {(loadedIndustrialPalletsBase + loadedEuroPalletsBase) === 0 && <p className="text-gray-400">[Load pallets to see side view]</p>}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">Shows conceptual side view of first few base pallets. Stacked layer shown if enabled and applicable.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 mt-8 text-sm text-gray-500 border-t border-gray-200">
        <p>Loading Space Calculator &copy; {new Date().getFullYear()}</p>
         <p>Original concept by Andreas Steiner</p>
      </footer>
    </div>
  );
}
