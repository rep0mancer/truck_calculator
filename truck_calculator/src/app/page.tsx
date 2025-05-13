"use client";

import React, { useState, useEffect, useCallback } from 'react';

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
    singleLayerEUPCapacityBroadPerUnit: 18,
    singleLayerDINCapacityPerUnit: 14,
  },
  curtainSider: {
    name: 'Planensattel Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    trueLength: 1360, 
    maxWidth: 245,
    singleLayerEUPCapacityLong: 33,
    singleLayerEUPCapacityBroad: 32,
    singleLayerDINCapacity: 26,
  },
  smallTruck: {
    name: 'Motorwagen (7.2m)',
    units: [{ id: 'main', length: 720, width: 245, occupiedRects: [] }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    singleLayerEUPCapacityLong: 18,
    singleLayerEUPCapacityBroad: 18,
    singleLayerDINCapacity: 14,
  },
  Waggon: {
    name: 'Waggon Hbbils (15,2m)',
    units: [{ id: 'main', length: 1520, width: 290, occupiedRects: [] }], 
    totalLength: 1520, 
    usableLength: 1520, 
    maxWidth: 290,
    singleLayerEUPCapacityLong: 38, 
    singleLayerEUPCapacityBroad: 38, 
    singleLayerDINCapacity: 26,   
    maxDinPallets: 26, 
  },
};

// Constants for pallet types
const PALLET_TYPES = {
  euro: { name: 'Euro Pallet (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700' },
  industrial: { name: 'Industrial Pallet (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700' },
};

// Maximum gross weight for the truck (payload capacity)
const MAX_GROSS_WEIGHT_KG = 24000; 
const MAX_PALLET_SIMULATION_QUANTITY = 300; // A high number for max calculation

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState('auto');
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);

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
  
  const [maximizationAction, setMaximizationAction] = useState(null); 
  
  const calculateLoading = useCallback(() => {
    // console.log("calculateLoading triggered. Action:", maximizationAction, "EUP Q:", eupQuantity, "DIN Q:", dinQuantity);
    const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[selectedTruck]));
    let tempWarnings = [];
    let finalTotalEuroVisual = 0;
    let finalTotalDinVisual = 0;
    let finalActualEUPBase = 0;
    let finalActualDINBase = 0;
    let finalTotalAreaBase = 0;
    let currentTotalWeight = 0;
    let finalPalletArrangement = [];

    let dinLabelGlobalCounter = 0; 
    let eupLabelGlobalCounter = 0; 

    const eupWeight = parseFloat(eupWeightPerPallet);
    const dinWeight = parseFloat(dinWeightPerPallet);
    const safeEupWeight = !isNaN(eupWeight) && eupWeight > 0 ? eupWeight : 0;
    const safeDinWeight = !isNaN(dinWeight) && dinWeight > 0 ? dinWeight : 0;

    let unitsState = truckConfig.units.map(u => ({
      ...u,
      occupiedRects: [], currentX: 0, currentY: 0, palletsVisual: [],
      dinEndX: 0, dinEndY: 0, dinLastRowIncomplete: false, eupStartX: 0,
    }));

    let currentRunIsEUPStackable = isEUPStackable;
    let currentRunIsDINStackable = isDINStackable;
    let dinQuantityToPlace = dinQuantity;
    let eupQuantityToPlace = eupQuantity;

    if (maximizationAction) {
      if (maximizationAction.type === 'euro') {
        eupQuantityToPlace = MAX_PALLET_SIMULATION_QUANTITY;
        dinQuantityToPlace = 0; // For "Max EUP", simulate with no DINs
        currentRunIsEUPStackable = false; // Maximize single layer
        currentRunIsDINStackable = isDINStackable; // Original stackability for the (zero) DINs
      } else if (maximizationAction.type === 'industrial') {
        dinQuantityToPlace = MAX_PALLET_SIMULATION_QUANTITY;
        eupQuantityToPlace = 0; // For "Max DIN", simulate with no EUPs
        currentRunIsDINStackable = false; // Maximize single layer
        currentRunIsEUPStackable = isEUPStackable; // Original stackability for the (zero) EUPs

        // Special handling for Waggon's fixed DIN capacity during maximization
        if (selectedTruck === 'Waggon' && truckConfig.maxDinPallets !== undefined) {
            dinQuantityToPlace = Math.min(dinQuantityToPlace, truckConfig.maxDinPallets);
        }
      }
    } else {
        // Normal run or Pass 2 of maximization: Apply Waggon's DIN limit if applicable
        if (selectedTruck === 'Waggon' && truckConfig.maxDinPallets !== undefined) {
            if (dinQuantity > truckConfig.maxDinPallets) {
                tempWarnings.push(`Waggon DIN capacity is ${truckConfig.maxDinPallets}. Requested ${dinQuantity}, placing ${truckConfig.maxDinPallets}.`);
                dinQuantityToPlace = truckConfig.maxDinPallets;
            }
        }
    }
    
    // --- DIN Pallet Placement ---
    let dinPlacedCountTotal = 0;
    if (dinQuantityToPlace > 0) {
      for (const unit of unitsState) {
        if (dinPlacedCountTotal >= dinQuantityToPlace) break;
        // ... (rest of DIN placement logic as before, using dinQuantityToPlace and currentRunIsDINStackable)
        while (unit.currentX < unit.length) {
          if (dinPlacedCountTotal >= dinQuantityToPlace) break;
          let rowPalletsPlaced = 0;
          const dinDef = PALLET_TYPES.industrial;
          const dinLength = dinDef.width; 
          const dinWidth = dinDef.length; 
          let rowHeight = 0;
          unit.currentY = 0;

          for (let i = 0; i < 2; i++) { 
            if (dinPlacedCountTotal >= dinQuantityToPlace) break;
            if (safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG) {
              if (!tempWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
                tempWarnings.push(`Weight limit reached for DIN pallets. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
              }
              unit.currentX = unit.length; break;
            }
            if (unit.currentX + dinLength <= unit.length && unit.currentY + dinWidth <= unit.width) {
              const baseDinLabelId = ++dinLabelGlobalCounter;
              let stackedDinLabelId = null;

              const baseDinPallet = {
                x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth,
                type: 'industrial', 
                isStackedTier: null, 
                key: `din_base_${unit.id}_${finalActualDINBase}_${i}`, unitId: unit.id,
                labelId: baseDinLabelId, 
                displayBaseLabelId: baseDinLabelId, 
                displayStackedLabelId: null,
                showAsFraction: false,
              };
              unit.palletsVisual.push(baseDinPallet);
              unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth });
              finalTotalAreaBase += dinDef.area;
              finalActualDINBase++;
              finalTotalDinVisual++;
              currentTotalWeight += safeDinWeight;
              dinPlacedCountTotal++;
              rowPalletsPlaced++;
              rowHeight = Math.max(rowHeight, dinLength);

              if (currentRunIsDINStackable && dinPlacedCountTotal < dinQuantityToPlace) {
                if (!(safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG)) {
                  stackedDinLabelId = ++dinLabelGlobalCounter;
                  baseDinPallet.showAsFraction = true;
                  baseDinPallet.displayStackedLabelId = stackedDinLabelId;
                  baseDinPallet.isStackedTier = 'base';

                  unit.palletsVisual.push({
                    x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth,
                    type: 'industrial', 
                    isStackedTier: 'top', 
                    key: `din_stack_${unit.id}_${finalActualDINBase - 1}_${i}`, unitId: unit.id,
                    labelId: stackedDinLabelId, 
                    displayBaseLabelId: baseDinLabelId,
                    displayStackedLabelId: stackedDinLabelId,
                    showAsFraction: true,
                  });
                  finalTotalDinVisual++;
                  currentTotalWeight += safeDinWeight;
                  dinPlacedCountTotal++;
                } else { if (!tempWarnings.some(w => w.includes("Weight limit stacking DIN"))) tempWarnings.push(`Weight limit reached. Cannot stack more DIN pallets. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`); }
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
        unit.eupStartX = unit.dinEndX;
      }
    }
    // Warning for not fitting all DINs (only if not maximizing and if requested quantity was non-zero)
    if (!maximizationAction && dinQuantity > 0 && dinPlacedCountTotal < dinQuantityToPlace && !tempWarnings.some(w => w.includes("Weight limit") || w.includes("Waggon DIN capacity"))) {
        tempWarnings.push(`Could not fit all ${dinQuantityToPlace} Industrial pallets due to space. Only ${dinPlacedCountTotal} (visual) placed.`);
    }


    const initialUnitsStateAfterDIN = JSON.parse(JSON.stringify(unitsState));
    const weightAfterDINs = currentTotalWeight;
    
    let bestEUPResult = {
        unitsConfiguration: JSON.parse(JSON.stringify(initialUnitsStateAfterDIN)),
        totalVisualEUPs: 0, baseEUPs: 0, areaEUPs: 0, tempWarnings: [],
        currentWeightAfterEUPs: weightAfterDINs,
        chosenPattern: (eupLoadingPattern !== 'auto' ? eupLoadingPattern : 'none'), 
        finalEupLabelCounter: eupLabelGlobalCounter
    };

    if (eupQuantityToPlace > 0) {
      // ... (rest of EUP placement logic as before, using eupQuantityToPlace and currentRunIsEUPStackable)
        const patternsToTry = eupLoadingPattern === 'auto' ? ['long', 'broad'] : [eupLoadingPattern];
        let aPatternHasBeenSetAsBest = (eupLoadingPattern !== 'auto');

        for (const pattern of patternsToTry) {
            let currentUnits = JSON.parse(JSON.stringify(initialUnitsStateAfterDIN));
            let patternVisualEUP = 0, patternBaseEUP = 0, patternAreaEUP = 0;
            let patternWeight = weightAfterDINs;
            let patternWarn = [];
            let patternRemainingEupNeeded = eupQuantityToPlace;
            let currentPatternEupLabelCounter = eupLabelGlobalCounter; 

            for (const unit of currentUnits) {
              if (patternRemainingEupNeeded <= 0) break;
              if (unit.dinLastRowIncomplete) {
                const gapX = unit.dinEndX - PALLET_TYPES.industrial.width;
                const gapY = PALLET_TYPES.industrial.length;
                const gapWidth = unit.width - gapY;
                const dinLengthInRow = PALLET_TYPES.industrial.width;
                const eupDef = PALLET_TYPES.euro;
                let placedInGap = false, eupLengthPlacedInGap = 0;
                let palletVisualGapBase = null;
                const tryBroadFirst = (pattern === 'broad' || pattern === 'auto');
                const tryLongFirst = (pattern === 'long' || pattern === 'auto');
                let gapPalletConfig = null;

                if (tryBroadFirst && gapWidth >= eupDef.length && dinLengthInRow >= eupDef.width && patternRemainingEupNeeded > 0) {
                    if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                      gapPalletConfig = { x: gapX, y: gapY, width: eupDef.width, height: eupDef.length, type: 'euro', keySuffix: `_gap_${unit.id}_${pattern}_broad`};
                      placedInGap = true; eupLengthPlacedInGap = eupDef.width;
                    } else { if (!patternWarn.some(w=>w.includes("EUP gap"))) patternWarn.push("Weight limit for EUP gap"); }
                }
                if (!placedInGap && tryLongFirst && gapWidth >= eupDef.width && dinLengthInRow >= eupDef.length && patternRemainingEupNeeded > 0) {
                    if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                      gapPalletConfig = { x: gapX, y: gapY, width: eupDef.length, height: eupDef.width, type: 'euro', keySuffix: `_gap_${unit.id}_${pattern}_long`};
                      placedInGap = true; eupLengthPlacedInGap = eupDef.length;
                    } else { if (!patternWarn.some(w=>w.includes("EUP gap"))) patternWarn.push("Weight limit for EUP gap"); }
                }

                if (placedInGap && gapPalletConfig) {
                  const baseEupLabelId = ++currentPatternEupLabelCounter;
                  let stackedEupLabelId = null;
                  palletVisualGapBase = {
                    ...gapPalletConfig,
                    isStackedTier: null,
                    key: `eup${gapPalletConfig.keySuffix}_base_${patternBaseEUP}`, unitId: unit.id,
                    labelId: baseEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: null, showAsFraction: false,
                  };
                  unit.palletsVisual.push(palletVisualGapBase);
                  unit.occupiedRects.push({ x: palletVisualGapBase.x, y: palletVisualGapBase.y, width: palletVisualGapBase.width, height: palletVisualGapBase.height });
                  patternAreaEUP += eupDef.area; patternBaseEUP++; patternVisualEUP++;
                  patternWeight += safeEupWeight; patternRemainingEupNeeded--;

                  if (currentRunIsEUPStackable && patternRemainingEupNeeded > 0) {
                    if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                      stackedEupLabelId = ++currentPatternEupLabelCounter;
                      palletVisualGapBase.showAsFraction = true; palletVisualGapBase.displayStackedLabelId = stackedEupLabelId; palletVisualGapBase.isStackedTier = 'base';
                      unit.palletsVisual.push({ 
                        ...palletVisualGapBase, isStackedTier: 'top', key: `eup${gapPalletConfig.keySuffix}_stack_${patternBaseEUP -1}`,
                        labelId: stackedEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: stackedEupLabelId, showAsFraction: true, 
                      });
                      patternVisualEUP++; patternWeight += safeEupWeight; patternRemainingEupNeeded--;
                    } else { if (!patternWarn.some(w=>w.includes("stacking EUP gap"))) patternWarn.push("Weight limit stacking EUP gap"); }
                  }
                  unit.eupStartX = gapX + Math.max(dinLengthInRow, eupLengthPlacedInGap);
                }
              }
            }

            for (const unit of currentUnits) {
              if (patternRemainingEupNeeded <= 0) break;
              unit.currentX = unit.eupStartX; unit.currentY = 0;
              const currentUnitEffectiveLength = (selectedTruck === 'Waggon' && truckConfig.units.find(u => u.id === unit.id)) 
                                              ? truckConfig.units.find(u => u.id === unit.id).length : unit.length;
              while (unit.currentX < currentUnitEffectiveLength) {
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
                    if (!patternWarn.some(w => w.includes("Weight limit reached for EUP"))) patternWarn.push(`Weight limit reached for EUP pallets. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
                    unit.currentX = currentUnitEffectiveLength; break;
                  }
                  if (unit.currentX + eupLength <= currentUnitEffectiveLength && unit.currentY + eupWidth <= unit.width) {
                    const baseEupLabelId = ++currentPatternEupLabelCounter;
                    let stackedEupLabelId = null;
                    const baseEupPallet = {
                      x: unit.currentX, y: unit.currentY, width: eupLength, height: eupWidth, type: 'euro',
                      isStackedTier: null, key: `eup_base_${unit.id}_${patternBaseEUP}_${pattern}_${i}`, unitId: unit.id,
                      labelId: baseEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: null, showAsFraction: false,
                    };
                    unit.palletsVisual.push(baseEupPallet);
                    unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: eupLength, height: eupWidth });
                    patternAreaEUP += eupDef.area; patternBaseEUP++; patternVisualEUP++;
                    patternWeight += safeEupWeight; patternRemainingEupNeeded--;
                    rowPalletsPlaced++; rowHeight = Math.max(rowHeight, eupLength);
                    
                    if (currentRunIsEUPStackable && patternRemainingEupNeeded > 0) {
                      if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                        stackedEupLabelId = ++currentPatternEupLabelCounter;
                        baseEupPallet.showAsFraction = true; baseEupPallet.displayStackedLabelId = stackedEupLabelId; baseEupPallet.isStackedTier = 'base';
                        unit.palletsVisual.push({
                          x: unit.currentX, y: unit.currentY, width: eupLength, height: eupWidth, type: 'euro',
                          isStackedTier: 'top', key: `eup_stack_${unit.id}_${patternBaseEUP - 1}_${pattern}_${i}`, unitId: unit.id,
                          labelId: stackedEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: stackedEupLabelId, showAsFraction: true,
                        });
                        patternVisualEUP++; patternWeight += safeEupWeight; patternRemainingEupNeeded--;
                      } else { if (!patternWarn.some(w=>w.includes("stacking EUP"))) patternWarn.push("Weight limit stacking EUP"); }
                    }
                    unit.currentY += eupWidth;
                  } else { break; }
                }
                if (unit.currentX >= currentUnitEffectiveLength) break;
                if (rowPalletsPlaced > 0) { unit.currentX += rowHeight; }
                else { unit.currentX = currentUnitEffectiveLength; }
              }
            }
            
            let updateThisIteration = false;
            if (!aPatternHasBeenSetAsBest) { 
                updateThisIteration = true;
            } else if (patternVisualEUP > bestEUPResult.totalVisualEUPs) { 
                updateThisIteration = true;
            } else if (patternVisualEUP === bestEUPResult.totalVisualEUPs) { 
                if (eupLoadingPattern === 'auto' && pattern === 'broad' && bestEUPResult.chosenPattern === 'long') {
                    updateThisIteration = true;
                }
            }

            if (updateThisIteration) {
                bestEUPResult = {
                    unitsConfiguration: JSON.parse(JSON.stringify(currentUnits)),
                    totalVisualEUPs: patternVisualEUP, baseEUPs: patternBaseEUP, areaEUPs: patternAreaEUP,
                    tempWarnings: patternWarn, currentWeightAfterEUPs: patternWeight, chosenPattern: pattern, 
                    finalEupLabelCounter: currentPatternEupLabelCounter
                };
                aPatternHasBeenSetAsBest = true; 
            }
        }
        eupLabelGlobalCounter = bestEUPResult.finalEupLabelCounter;
    }


    finalPalletArrangement = Array.isArray(bestEUPResult?.unitsConfiguration)
        ? bestEUPResult.unitsConfiguration.map(unit => ({
          unitId: unit.id, 
          unitLength: truckConfig.units.find(u => u.id === unit.id)?.length || unit.length, 
          unitWidth: truckConfig.units.find(u => u.id === unit.id)?.width || unit.width,
          pallets: Array.isArray(unit.palletsVisual) ? unit.palletsVisual : []
        }))
        : [];
    finalActualEUPBase = bestEUPResult.baseEUPs;
    finalTotalEuroVisual = bestEUPResult.totalVisualEUPs;
    finalTotalAreaBase += bestEUPResult.areaEUPs; 
    currentTotalWeight = bestEUPResult.currentWeightAfterEUPs; 
    tempWarnings.push(...bestEUPResult.tempWarnings.filter(w => !tempWarnings.some(existing => existing === w)));

    // Warning for not fitting all EUPs (only if not maximizing and if requested quantity was non-zero)
    if (!maximizationAction && eupQuantity > 0 && finalTotalEuroVisual < eupQuantityToPlace && !tempWarnings.some(w => w.includes("Weight limit"))) {
        tempWarnings.push(`Could not fit all ${eupQuantityToPlace} Euro pallets due to space. Only ${finalTotalEuroVisual} (visual) placed.`);
    }
    
    setPalletArrangement(Array.isArray(finalPalletArrangement) ? finalPalletArrangement : []);
    setLoadedEuroPalletsBase(finalActualEUPBase);
    setLoadedIndustrialPalletsBase(finalActualDINBase);
    setTotalEuroPalletsVisual(finalTotalEuroVisual);
    setTotalDinPalletsVisual(finalTotalDinVisual);
    setTotalWeightKg(currentTotalWeight);

    const totalTruckArea = truckConfig.units.reduce((sum, u) => sum + (u.length * u.width), 0);
    let newUtilization = totalTruckArea > 0 ? (finalTotalAreaBase / totalTruckArea) * 100 : 0;
    setUtilizationPercentage(parseFloat(newUtilization.toFixed(1)));

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
    if (!maximizationAction) { 
        // In normal run or Pass 2 of maximization, check if all *original user requested* pallets were placed.
        const allEUPRequestedPlaced = finalTotalEuroVisual >= eupQuantity; // Compare against original eupQuantity
        const originalDinQuantityForCheck = (selectedTruck === 'Waggon' && truckConfig.maxDinPallets !== undefined)
                                            ? Math.min(dinQuantity, truckConfig.maxDinPallets)
                                            : dinQuantity;
        const allDINRequestedPlaced = finalTotalDinVisual >= originalDinQuantityForCheck;


        if (tempWarnings.length === 0 && (eupQuantity > 0 || dinQuantity > 0) && allEUPRequestedPlaced && allDINRequestedPlaced) {
            tempWarnings.push('All requested pallets placed successfully.');
        } else if (tempWarnings.length === 0 && eupQuantity === 0 && dinQuantity === 0) {
            tempWarnings.push('No pallets requested.');
        }
    }
    setWarnings(Array.from(new Set(tempWarnings)));
    // console.log("calculateLoading finished. finalTotalEuroVisual:", finalTotalEuroVisual, "finalTotalDinVisual:", finalTotalDinVisual);

  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern, maximizationAction]);

  useEffect(() => {
    calculateLoading();
  }, [calculateLoading]); 

  // Effect to finalize EUP maximization
  useEffect(() => {
    // console.log("EUP Finalize Effect Check. Action:", maximizationAction, "TotalVisualEUP:", totalEuroPalletsVisual);
    if (maximizationAction && maximizationAction.type === 'euro') {
    //   console.log("EUP Finalizing: Setting eupQuantity to", totalEuroPalletsVisual, "Restoring stack to", maximizationAction.originalStackState);
      setEupQuantity(totalEuroPalletsVisual);
      if (isEUPStackable !== maximizationAction.originalStackState) {
        setIsEUPStackable(maximizationAction.originalStackState);
      }
      setMaximizationAction(null);
    }
  }, [maximizationAction, totalEuroPalletsVisual, isEUPStackable, setIsEUPStackable, setEupQuantity, setMaximizationAction]);

  // Effect to finalize DIN maximization
  useEffect(() => {
    // console.log("DIN Finalize Effect Check. Action:", maximizationAction, "TotalVisualDIN:", totalDinPalletsVisual);
    if (maximizationAction && maximizationAction.type === 'industrial') {
    //   console.log("DIN Finalizing: Setting dinQuantity to", totalDinPalletsVisual, "Restoring stack to", maximizationAction.originalStackState);
      setDinQuantity(totalDinPalletsVisual);
      if (isDINStackable !== maximizationAction.originalStackState) {
        setIsDINStackable(maximizationAction.originalStackState);
      }
      setMaximizationAction(null);
    }
  }, [maximizationAction, totalDinPalletsVisual, isDINStackable, setIsDINStackable, setDinQuantity, setMaximizationAction]);


  const handleQuantityChange = (type, amount) => {
    if (type === 'eup') {
      setEupQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    } else if (type === 'din') {
      setDinQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    }
  };

  const handleClearAllPallets = () => {
    setEupQuantity(0);
    setDinQuantity(0);
    setEupWeightPerPallet('');
    setDinWeightPerPallet('');
    setIsEUPStackable(false);
    setIsDINStackable(false);
    setEupLoadingPattern('auto');
    if (maximizationAction) setMaximizationAction(null); 
  };

  const handleMaximizePallets = (palletTypeToMax) => {
    // console.log("handleMaximizePallets called for:", palletTypeToMax);
    if (palletTypeToMax === 'euro') {
        setMaximizationAction({ type: 'euro', originalStackState: isEUPStackable });
    } else if (palletTypeToMax === 'industrial') {
        setMaximizationAction({ type: 'industrial', originalStackState: isDINStackable });
    }
  };

  // ... (renderPallet and JSX remain the same as your original)
  const renderPallet = (pallet, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) {
      console.error("Invalid pallet data passed to renderPallet:", pallet);
      return null;
    }
    const palletDetails = PALLET_TYPES[pallet.type];
    const displayWidth = pallet.height * displayScale; 
    const displayHeight = pallet.width * displayScale;  
    const displayX = pallet.y * displayScale;
    const displayY = pallet.x * displayScale;

    let displayText = `${pallet.displayBaseLabelId}`;
    if (pallet.showAsFraction && pallet.displayStackedLabelId) {
      displayText = `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}`;
    } else {
      displayText = `${pallet.labelId}`; 
    }
    
    let titleText = `${palletDetails.name} #${pallet.labelId}`;
    if (pallet.showAsFraction) {
        titleText = `${palletDetails.name} (Stack: ${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId})`;
    }
    if (pallet.isStackedTier === 'top') titleText += ' - Top';
    if (pallet.isStackedTier === 'base') titleText += ' - Base of Stack';

    return (
      <div
        key={pallet.key}
        className={`absolute ${palletDetails.color} ${palletDetails.borderColor} border flex items-center justify-center rounded-sm shadow-sm`}
        style={{
          left: `${displayX}px`, top: `${displayY}px`,
          width: `${displayWidth}px`, height: `${displayHeight}px`,
          opacity: pallet.isStackedTier === 'top' ? 0.7 : 1, 
          zIndex: pallet.isStackedTier === 'top' ? 10 : 5, fontSize: '10px',
        }}
        title={titleText}
      >
        <span className="text-black font-semibold select-none">{displayText}</span>
        {pallet.isStackedTier === 'top' && ( 
          <div className="absolute top-0 left-0 w-full h-full border-t-2 border-l-2 border-black opacity-30 pointer-events-none rounded-sm"></div>
        )}
      </div>
    );
  };

  const truckVisualizationScale = 0.3;
  // eslint-disable-next-line no-unused-vars
  const currentTruckDef = TRUCK_TYPES[selectedTruck]; 

  return (
    <div className="container mx-auto p-4 font-sans bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-t-lg shadow-lg mb-6">
        <h1 className="text-3xl font-bold text-center tracking-tight">Truck Loading Space Calculator</h1>
        <p className="text-center text-sm opacity-90">Visualize Pallet Placement (European Standards)</p>
      </header>

      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Input Column */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">Truck Type:</label>
              <select id="truckType" name="truckType" value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {Object.keys(TRUCK_TYPES).map(key => (
                  <option key={key} value={key}>{TRUCK_TYPES[key].name}</option>
                ))}
              </select>
            </div>
            {/* Clear All Button */}
            <div className="pt-4">
                <button 
                    onClick={handleClearAllPallets} 
                    className="w-full py-2 px-4 bg-red-500 text-white font-semibold rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
                >
                    Clear All Pallets & Settings
                </button>
            </div>


            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industrial Pallets (DIN - 1.2m x 1.0m)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('din', -1)} className="px-3 py-1 bg-red-600 text-white rounded-l-md hover:bg-red-700 transition duration-150 ease-in-out">-</button>
                <input type="number" min="0" id="dinQuantity" name="dinQuantity" value={dinQuantity} onChange={(e) => setDinQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('din', 1)} className="px-3 py-1 bg-green-600 text-white rounded-r-md hover:bg-green-700 transition duration-150 ease-in-out">+</button>
              </div>
              <button 
                onClick={() => handleMaximizePallets('industrial')}
                className="mt-2 w-full py-1.5 px-3 bg-indigo-500 text-white text-xs font-medium rounded-md shadow-sm hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
              >
                Max. DIN (Single Layer)
              </button>
              <div className="mt-2">
                <label htmlFor="dinWeightPerPallet" className="text-xs font-medium text-gray-600">Weight/DIN (kg):</label>
                <input type="number" min="0" id="dinWeightPerPallet" name="dinWeightPerPallet" value={dinWeightPerPallet} onChange={(e) => setDinWeightPerPallet(e.target.value)} placeholder="e.g. 500" className="mt-1 block w-full py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input id="dinStackable" name="dinStackable" type="checkbox" checked={isDINStackable} onChange={(e) => setIsDINStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="dinStackable" className="ml-2 block text-sm text-gray-900">Stackable (2 high)</label>
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Euro Pallets (EUP - 1.2m x 0.8m)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('eup', -1)} className="px-3 py-1 bg-red-600 text-white rounded-l-md hover:bg-red-700 transition duration-150 ease-in-out">-</button>
                <input type="number" min="0" id="eupQuantity" name="eupQuantity" value={eupQuantity} onChange={(e) => setEupQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('eup', 1)} className="px-3 py-1 bg-green-600 text-white rounded-r-md hover:bg-green-700 transition duration-150 ease-in-out">+</button>
              </div>
              <button 
                onClick={() => handleMaximizePallets('euro')}
                className="mt-2 w-full py-1.5 px-3 bg-indigo-500 text-white text-xs font-medium rounded-md shadow-sm hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
              >
                Max. EUP (Single Layer)
              </button>
              <div className="mt-2">
                <label htmlFor="eupWeightPerPallet" className="text-xs font-medium text-gray-600">Weight/EUP (kg):</label>
                <input type="number" min="0" id="eupWeightPerPallet" name="eupWeightPerPallet" value={eupWeightPerPallet} onChange={(e) => setEupWeightPerPallet(e.target.value)} placeholder="e.g. 400" className="mt-1 block w-full py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input id="eupStackable" name="eupStackable" type="checkbox" checked={isEUPStackable} onChange={(e) => setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="eupStackable" className="ml-2 block text-sm text-gray-900">Stackable (2 high)</label>
              </div>
            </div>

            {eupQuantity > 0 && (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">EUP Loading Pattern:</label>
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center">
                    <input type="radio" id="eupAuto" name="eupLoadingPatternOption" value="auto" checked={eupLoadingPattern === 'auto'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" />
                    <label htmlFor="eupAuto" className="ml-2 text-sm text-gray-700">Auto-Optimize (Best Fit)</label>
                  </div>
                  <div className="flex items-center">
                    <input type="radio" id="eupLong" name="eupLoadingPatternOption" value="long" checked={eupLoadingPattern === 'long'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" />
                    <label htmlFor="eupLong" className="ml-2 text-sm text-gray-700">Lengthwise (3 across, 0.8m wide each)</label>
                  </div>
                  <div className="flex items-center">
                    <input type="radio" id="eupBroad" name="eupLoadingPatternOption" value="broad" checked={eupLoadingPattern === 'broad'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" />
                    <label htmlFor="eupBroad" className="ml-2 text-sm text-gray-700">Widthwise (2 across, 1.2m wide each)</label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visualization Column */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm min-h-[450px] flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Truck Loading Area Visualization</p>
            {Array.isArray(palletArrangement) && palletArrangement.map((unitData, index) => (
              <div key={unitData.unitId} className="mb-4 last:mb-0 w-full flex flex-col items-center">
                {TRUCK_TYPES[selectedTruck].units.length > 1 && <p className="text-sm text-center font-medium text-gray-700 mb-1">Unit {index + 1} ({unitData.unitLength / 100}m x {unitData.unitWidth / 100}m)</p>}
                <div
                  id={`truckVisualization-${unitData.unitId}`}
                  className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner"
                  style={{
                    width: `${unitData.unitWidth * truckVisualizationScale}px`, 
                    height: `${unitData.unitLength * truckVisualizationScale}px`, 
                  }}
                >
                  {selectedTruck === 'curtainSider' && TRUCK_TYPES.curtainSider.trueLength && TRUCK_TYPES.curtainSider.usableLength < TRUCK_TYPES.curtainSider.trueLength && (
                    <>
                      <div className="absolute top-0 left-0 w-full bg-red-300 opacity-30 pointer-events-none"
                        style={{ height: `${((TRUCK_TYPES.curtainSider.trueLength - TRUCK_TYPES.curtainSider.usableLength)) * truckVisualizationScale}px` }}
                        title={`Unusable Space: ${(TRUCK_TYPES.curtainSider.trueLength - TRUCK_TYPES.curtainSider.usableLength) / 100}m`}
                      />
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[8px] text-red-800 bg-white px-1 py-0.5 rounded opacity-80 pointer-events-none whitespace-nowrap">
                        Usable: {TRUCK_TYPES.curtainSider.usableLength / 100}m
                      </div>
                    </>
                  )}
                  {unitData.pallets?.map(p => renderPallet(p, truckVisualizationScale))}
                </div>
              </div>
            ))}
            {selectedTruck === 'curtainSider' && TRUCK_TYPES.curtainSider.trueLength && TRUCK_TYPES.curtainSider.usableLength < TRUCK_TYPES.curtainSider.trueLength && <p className="text-xs text-gray-500 mt-2 text-center">Note: Shaded area indicates unusable space on a 13.6m trailer (~13.2m effective).</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
            <h3 className="text-md font-semibold text-blue-800 mb-2">Loaded Pallets (Visual)</h3>
            <p className="text-sm">Industrial (DIN): <span id="loadedIndustrial" className="font-bold text-lg">{totalDinPalletsVisual}</span></p>
            <p className="text-sm">Euro (EUP): <span id="loadedEuro" className="font-bold text-lg">{totalEuroPalletsVisual}</span></p>
            <p className="text-xs mt-1">(Base: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
            <h3 className="text-md font-semibold text-green-800 mb-2">Area Utilization</h3>
            <p><span id="utilizationPercentage" className="font-bold text-3xl text-green-700">{utilizationPercentage}</span>%</p>
            <p className="text-xs mt-1">(Based on base pallet footprints)</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="text-md font-semibold text-yellow-800 mb-2">Estimated Weight</h3>
            <p><span id="totalWeight" className="font-bold text-2xl text-yellow-700">{(totalWeightKg / 1000).toFixed(1)}</span> t</p>
            <p className="text-xs mt-1">(Max Payload: {MAX_GROSS_WEIGHT_KG / 1000}t)</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
            <h3 className="text-md font-semibold text-red-800 mb-2">Notifications</h3>
            <ul id="warningsList" className="list-disc list-inside text-sm space-y-1 text-red-700">
              {warnings.length > 0 ? warnings.map((warning, index) => <li key={index}>{warning}</li>) : <li className="text-gray-500">No issues detected.</li>}
            </ul>
          </div>
        </div>

        {((isEUPStackable && totalEuroPalletsVisual > loadedEuroPalletsBase) || (isDINStackable && totalDinPalletsVisual > loadedIndustrialPalletsBase)) && (loadedIndustrialPalletsBase > 0 || loadedEuroPalletsBase > 0) && (
          <div className="mb-8 bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-center items-center">
            <p className="text-gray-600 text-md mb-3 font-semibold">Side View (Conceptual)</p>
            <div id="sideViewVisualization" className="w-full h-auto bg-gray-200 rounded flex justify-center items-end p-4 min-h-[100px] space-x-2">
              {Array.from({ length: Math.min(3, loadedIndustrialPalletsBase) }).map((_, idx) => {
                const palletDetails = PALLET_TYPES.industrial;
                const showStackedDinConcept = isDINStackable && totalDinPalletsVisual > loadedIndustrialPalletsBase; 
                const baseDisplayId = idx * 2 + 1; 
                const stackedDisplayId = baseDisplayId + 1; 
                const labelText = showStackedDinConcept ? `${baseDisplayId}/${stackedDisplayId}` : `${baseDisplayId}`;
                return (
                  <div key={`sideview-din-${idx}`} className="flex flex-col items-center" title={`Industrial Pallet Stack ${baseDisplayId}${showStackedDinConcept ? ` & ${stackedDisplayId}`:''} (Side View)`}>
                    {showStackedDinConcept && <div className={`w-10 h-8 ${palletDetails.color} border ${palletDetails.borderColor} opacity-60 flex justify-center items-center text-xs font-bold rounded-t-sm`}>{labelText}</div>}
                    <div className={`w-10 h-8 ${palletDetails.color} border ${palletDetails.borderColor} ${showStackedDinConcept ? 'border-t-0 rounded-b-sm' : 'rounded-sm'} flex justify-center items-center text-xs font-bold`}>{labelText}</div>
                  </div>
                );
              })}
              {Array.from({ length: Math.min(3, loadedEuroPalletsBase) }).map((_, idx) => {
                const palletDetails = PALLET_TYPES.euro;
                const showStackedEupConcept = isEUPStackable && totalEuroPalletsVisual > loadedEuroPalletsBase;
                const baseDisplayId = idx * 2 + 1; 
                const stackedDisplayId = baseDisplayId + 1;
                const labelText = showStackedEupConcept ? `${baseDisplayId}/${stackedDisplayId}` : `${baseDisplayId}`;
                return (
                  <div key={`sideview-eup-${idx}`} className="flex flex-col items-center" title={`Euro Pallet Stack ${baseDisplayId}${showStackedEupConcept ? ` & ${stackedDisplayId}`:''} (Side View)`}>
                    {showStackedEupConcept && <div className={`w-8 h-8 ${palletDetails.color} border ${palletDetails.borderColor} opacity-60 flex justify-center items-center text-xs font-bold rounded-t-sm`}>{labelText}</div>}
                    <div className={`w-8 h-8 ${palletDetails.color} border ${palletDetails.borderColor} ${showStackedEupConcept ? 'border-t-0 rounded-b-sm' : 'rounded-sm'} flex justify-center items-center text-xs font-bold`}>{labelText}</div>
                  </div>
                );
              })}
              {(loadedIndustrialPalletsBase + loadedEuroPalletsBase) === 0 && <p className="text-gray-400">[Load pallets to see side view]</p>}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">Shows conceptual side view of first few base pallets. Stacked layer shown if enabled and applicable for that pallet type. Numbers are illustrative for stacks.</p>
          </div>
        )}
      </main>

      <footer className="text-center py-4 mt-8 text-sm text-gray-500 border-t border-gray-200">
        <p>Loading Space Calculator © {new Date().getFullYear()}</p>
        <p>Created by Andreas Steiner</p>
      </footer>
    </div>
  );
}
