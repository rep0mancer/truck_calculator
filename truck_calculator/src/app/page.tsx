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
    singleLayerDINCapacity: 26, // Indikativer Wert
    maxDinPallets: 26, // Harte Grenze für DIN-Paletten
  },
  Waggon2: {
    name: 'Waggon KRM',
    units: [{ id: 'main', length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    singleLayerEUPCapacityLong: 38,
    singleLayerEUPCapacityBroad: 40,
    singleLayerDINCapacity: 28, // Indikativer Wert
    maxDinPallets: 28, 
  },
};

const PALLET_TYPES = {
  euro: { name: 'Euro Palette (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700' },
  industrial: { name: 'Industrial Palette (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700' },
};

const MAX_GROSS_WEIGHT_KG = 24000;
const MAX_PALLET_SIMULATION_QUANTITY = 300;

// Core calculation logic
const calculateLoadingLogic = (
  truckKey,
  requestedEupQuantity, // The number of EUPs the user wants in total or to fill with
  requestedDinQuantity, // The number of DINs the user wants in total or to fill with
  currentIsEUPStackable,
  currentIsDINStackable,
  eupWeightStr,
  dinWeightStr,
  currentEupLoadingPattern,
  placementOrder = 'DIN_FIRST' // 'DIN_FIRST' or 'EUP_FIRST'
) => {
  const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  let tempWarnings = [];
  let finalTotalEuroVisual = 0;
  let finalTotalDinVisual = 0;
  let finalActualEUPBase = 0;
  let finalActualDINBase = 0;
  let finalTotalAreaBase = 0;
  let currentTotalWeight = 0;
  let dinLabelGlobalCounter = 0;
  let eupLabelGlobalCounter = 0;

  const eupWeight = parseFloat(eupWeightStr) || 0;
  const dinWeight = parseFloat(dinWeightStr) || 0;
  const safeEupWeight = eupWeight > 0 ? eupWeight : 0;
  const safeDinWeight = dinWeight > 0 ? dinWeight : 0;

  // Initialize units state for this calculation run
  let unitsState = truckConfig.units.map(u => ({
    ...u,
    occupiedRects: [],
    currentX: 0,
    currentY: 0,
    palletsVisual: [],
    dinEndX: 0, // End X position of DIN pallets in this unit
    dinEndY: 0, // End Y position of DIN pallets in this unit
    dinLastRowIncomplete: false, // Was the last row of DINs incomplete?
    eupStartX: 0, // Where EUPs should start after DINs (if DINs are first)
    // Fields for EUP_FIRST scenario
    eupEndX: 0, // End X position of EUP pallets in this unit (if EUPs are first)
    eupEndY: 0, // End Y position of EUP pallets in this unit
    eupLastRowIncomplete: false, // Was the last row of EUPs incomplete?
    dinStartX: 0, // Where DINs should start after EUPs (if EUPs are first)
  }));

  let dinQuantityToPlace = requestedDinQuantity;
  let eupQuantityToPlace = requestedEupQuantity;

  // Apply truck-specific hard cap for DIN pallets
  if (truckConfig.maxDinPallets !== undefined && dinQuantityToPlace > truckConfig.maxDinPallets) {
    // Only issue a warning if the initial request (not an intermediate simulation value) exceeds the cap.
    if (requestedDinQuantity > truckConfig.maxDinPallets) {
        tempWarnings.push(
            `${truckConfig.name.trim()} maximale DIN-Kapazität ist ${truckConfig.maxDinPallets}. ` +
            `Angeforderte Menge ${requestedDinQuantity}, es werden ${truckConfig.maxDinPallets} platziert.`
        );
    }
    dinQuantityToPlace = truckConfig.maxDinPallets;
  }
  
  // --- Pallet Placement ---
  if (placementOrder === 'EUP_FIRST') {
    // --- 1. EUP Pallet Placement (Primary) ---
    let eupPlacedCountTotal = 0;
    // The EUP placement logic (bestEUPResult loop) needs to operate on a fresh state
    // and not assume pre-existing DINs for gap filling if EUPs are primary.
    let initialUnitsForEUP = JSON.parse(JSON.stringify(unitsState)); // Fresh units
    let weightBeforeEUPs = currentTotalWeight; // Should be 0 if EUPs are truly first

    let bestEUPResultConfig = {
        unitsConfiguration: initialUnitsForEUP,
        totalVisualEUPs: 0, baseEUPs: 0, areaEUPs: 0, tempWarnings: [],
        currentWeightAfterEUPs: weightBeforeEUPs,
        chosenPattern: (currentEupLoadingPattern !== 'auto' ? currentEupLoadingPattern : 'none'),
        finalEupLabelCounter: eupLabelGlobalCounter,
    };

    if (eupQuantityToPlace > 0) {
        const patternsToTry = currentEupLoadingPattern === 'auto' ? ['long', 'broad'] : [currentEupLoadingPattern];
        let aPatternHasBeenSetAsBest = (currentEupLoadingPattern !== 'auto');

        for (const pattern of patternsToTry) {
            let currentUnitsAttempt = JSON.parse(JSON.stringify(initialUnitsForEUP));
            let patternVisualEUP = 0, patternBaseEUP = 0, patternAreaEUP = 0;
            let patternWeight = weightBeforeEUPs;
            let patternWarnLocal = [];
            let patternRemainingEup = eupQuantityToPlace;
            let currentPatternEupCounter = eupLabelGlobalCounter;

            for (const unit of currentUnitsAttempt) {
                if (patternRemainingEup <= 0) break;
                unit.currentX = 0; // EUPs start at the beginning of the unit
                unit.currentY = 0;
                const effectiveLength = unit.length;

                // ** NO DIN GAP FILLING if EUPs are primary **
                // The original EUP gap filling logic for DINs is omitted here.

                while (unit.currentX < effectiveLength) {
                    if (patternRemainingEup <= 0) break;
                    let rowCount = 0;
                    const eupDef = PALLET_TYPES.euro;
                    const palletsPerRow = (pattern === 'long' ? 3 : 2);
                    const eupLen = pattern === 'long' ? eupDef.length : eupDef.width;
                    const eupWid = pattern === 'long' ? eupDef.width : eupDef.length;
                    let rowHeight = 0;
                    unit.currentY = 0;

                    for (let i = 0; i < palletsPerRow; i++) {
                        if (patternRemainingEup <= 0) break;
                        if (safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG) {
                            if (!patternWarnLocal.some(w => w.includes('Gewichtslimit für EUP'))) patternWarnLocal.push(`Gewichtslimit für EUP-Paletten erreicht. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
                            unit.currentX = effectiveLength; break;
                        }
                        if (unit.currentX + eupLen <= effectiveLength && unit.currentY + eupWid <= unit.width) {
                            const baseEupLabelId = ++currentPatternEupCounter;
                            let stackedEupLabelId = null;
                            const baseEupPallet = {
                                x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid, type: 'euro',
                                isStackedTier: null, key: `eup_base_${unit.id}_${patternBaseEUP}_${pattern}_${i}`, unitId: unit.id,
                                labelId: baseEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: null, showAsFraction: false,
                            };
                            unit.palletsVisual.push(baseEupPallet);
                            unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid });
                            patternAreaEUP += eupDef.area; patternBaseEUP++; patternVisualEUP++;
                            patternWeight += safeEupWeight; patternRemainingEup--; rowCount++;
                            rowHeight = Math.max(rowHeight, eupLen);

                            if (currentIsEUPStackable && patternRemainingEup > 0) {
                                if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                                    stackedEupLabelId = ++currentPatternEupCounter;
                                    baseEupPallet.showAsFraction = true; baseEupPallet.displayStackedLabelId = stackedEupLabelId; baseEupPallet.isStackedTier = 'base';
                                    unit.palletsVisual.push({
                                        ...baseEupPallet, isStackedTier: 'top', key: `eup_stack_${unit.id}_${patternBaseEUP - 1}_${pattern}_${i}`,
                                        labelId: stackedEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: stackedEupLabelId, showAsFraction: true,
                                    });
                                    patternVisualEUP++; patternWeight += safeEupWeight; patternRemainingEup--;
                                } else if (!patternWarnLocal.some(w => w.includes('Stapeln von EUP'))) patternWarnLocal.push('Gewichtslimit beim Stapeln von EUP.');
                            }
                            unit.currentY += eupWid;
                        } else break;
                    }
                    if (unit.currentX >= effectiveLength) break;
                    if (rowCount > 0) unit.currentX += rowHeight; else unit.currentX = effectiveLength;
                }
                unit.eupEndX = unit.currentX; // Store where EUPs ended in this unit
                unit.eupEndY = unit.currentY;
                // unit.eupLastRowIncomplete can be set here if needed
            } // End unit loop for EUP

            let updateBestResult = false;
            if (currentEupLoadingPattern === 'auto') {
                if (!aPatternHasBeenSetAsBest || patternVisualEUP > bestEUPResultConfig.totalVisualEUPs || (patternVisualEUP === bestEUPResultConfig.totalVisualEUPs && pattern === 'broad' && bestEUPResultConfig.chosenPattern === 'long')) {
                    updateBestResult = true;
                    if (!aPatternHasBeenSetAsBest) aPatternHasBeenSetAsBest = true;
                }
            } else updateBestResult = true;

            if (updateBestResult) {
                bestEUPResultConfig = {
                    unitsConfiguration: JSON.parse(JSON.stringify(currentUnitsAttempt)),
                    totalVisualEUPs: patternVisualEUP, baseEUPs: patternBaseEUP, areaEUPs: patternAreaEUP,
                    tempWarnings: patternWarnLocal, currentWeightAfterEUPs: patternWeight,
                    chosenPattern: pattern, finalEupLabelCounter: currentPatternEupCounter,
                };
            }
        } // End patternsToTry loop

        unitsState = bestEUPResultConfig.unitsConfiguration;
        finalActualEUPBase = bestEUPResultConfig.baseEUPs;
        finalTotalEuroVisual = bestEUPResultConfig.totalVisualEUPs;
        finalTotalAreaBase += bestEUPResultConfig.areaEUPs;
        currentTotalWeight = bestEUPResultConfig.currentWeightAfterEUPs;
        tempWarnings.push(...bestEUPResultConfig.tempWarnings.filter(w => !tempWarnings.includes(w)));
        eupLabelGlobalCounter = bestEUPResultConfig.finalEupLabelCounter;

        if (finalTotalEuroVisual < eupQuantityToPlace && !tempWarnings.some(w => w.includes('Gewichtslimit'))) {
            tempWarnings.push(`Konnte nicht alle ${eupQuantityToPlace} Europaletten laden. Nur ${finalTotalEuroVisual} (visuell) platziert mit Muster '${bestEUPResultConfig.chosenPattern}'.`);
        }
    }
    // After EUPs are placed, set dinStartX for each unit
    unitsState.forEach(unit => unit.dinStartX = unit.eupEndX);


    // --- 2. DIN Pallet Placement (Secondary) ---
    let dinPlacedCountTotal = 0;
    if (dinQuantityToPlace > 0) {
        for (const unit of unitsState) {
            if (dinPlacedCountTotal >= dinQuantityToPlace) break;
            unit.currentX = unit.dinStartX; // Start DINs where EUPs ended
            unit.currentY = 0; // Reset Y for DIN placement in this unit

            while (unit.currentX < unit.length) {
                if (dinPlacedCountTotal >= dinQuantityToPlace) break;
                let rowPalletsPlaced = 0;
                const dinDef = PALLET_TYPES.industrial;
                const dinLength = dinDef.width; const dinWidth = dinDef.length;
                let rowHeight = 0; unit.currentY = 0;

                for (let i = 0; i < 2; i++) {
                    if (dinPlacedCountTotal >= dinQuantityToPlace) break;
                    if (safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG) {
                        if (!tempWarnings.some(w => w.includes("Gewichtslimit für DIN"))) tempWarnings.push(`Gewichtslimit für DIN-Paletten erreicht. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
                        unit.currentX = unit.length; break;
                    }
                    if (unit.currentX + dinLength <= unit.length && unit.currentY + dinWidth <= unit.width) {
                        const baseDinLabelId = ++dinLabelGlobalCounter; let stackedDinLabelId = null;
                        const baseDinPallet = {
                            x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth, type: 'industrial',
                            isStackedTier: null, key: `din_base_${unit.id}_${finalActualDINBase}_${i}`, unitId: unit.id,
                            labelId: baseDinLabelId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: null, showAsFraction: false,
                        };
                        unit.palletsVisual.push(baseDinPallet);
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth });
                        finalTotalAreaBase += dinDef.area; finalActualDINBase++; finalTotalDinVisual++;
                        currentTotalWeight += safeDinWeight; dinPlacedCountTotal++; rowPalletsPlaced++;
                        rowHeight = Math.max(rowHeight, dinLength);

                        if (currentIsDINStackable && dinPlacedCountTotal < dinQuantityToPlace) {
                            if (!(safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG)) {
                                stackedDinLabelId = ++dinLabelGlobalCounter;
                                baseDinPallet.showAsFraction = true; baseDinPallet.displayStackedLabelId = stackedDinLabelId; baseDinPallet.isStackedTier = 'base';
                                unit.palletsVisual.push({
                                    ...baseDinPallet, isStackedTier: 'top', key: `din_stack_${unit.id}_${finalActualDINBase - 1}_${i}`,
                                    labelId: stackedDinLabelId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: stackedDinLabelId, showAsFraction: true,
                                });
                                finalTotalDinVisual++; currentTotalWeight += safeDinWeight; dinPlacedCountTotal++;
                            } else if (!tempWarnings.some(w => w.includes("Stapeln von DIN"))) tempWarnings.push('Gewichtslimit beim Stapeln von DIN.');
                        }
                        unit.currentY += dinWidth;
                    } else break;
                }
                if (unit.currentX >= unit.length) break;
                if (rowPalletsPlaced > 0) unit.currentX += rowHeight; else unit.currentX = unit.length;
            }
        }
    }
    if (dinPlacedCountTotal < dinQuantityToPlace && !tempWarnings.some(w => w.includes("Gewichtslimit") || w.includes("Kapazität ist"))) {
        tempWarnings.push(`Konnte nicht alle ${dinQuantityToPlace} Industriepaletten laden (nach EUPs). Nur ${dinPlacedCountTotal} platziert.`);
    }

  } else { // placementOrder === 'DIN_FIRST' (original logic structure)
    // --- 1. DIN Pallet Placement (Primary) ---
    let dinPlacedCountTotal = 0;
    if (dinQuantityToPlace > 0) {
        for (const unit of unitsState) {
            // ... (Standard DIN placement logic as in previous versions)
            if (dinPlacedCountTotal >= dinQuantityToPlace) break;
            while (unit.currentX < unit.length) {
                if (dinPlacedCountTotal >= dinQuantityToPlace) break;
                let rowPalletsPlaced = 0;
                const dinDef = PALLET_TYPES.industrial;
                const dinLength = dinDef.width; const dinWidth = dinDef.length;
                let rowHeight = 0; unit.currentY = 0;

                for (let i = 0; i < 2; i++) { 
                    if (dinPlacedCountTotal >= dinQuantityToPlace) break;
                    if (safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG) {
                        if (!tempWarnings.some(w => w.includes("Gewichtslimit für DIN"))) tempWarnings.push(`Gewichtslimit für DIN-Paletten erreicht. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
                        unit.currentX = unit.length; break;
                    }
                    if (unit.currentX + dinLength <= unit.length && unit.currentY + dinWidth <= unit.width) {
                        const baseDinLabelId = ++dinLabelGlobalCounter; let stackedDinLabelId = null;
                        const baseDinPallet = {
                            x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth, type: 'industrial',
                            isStackedTier: null, key: `din_base_${unit.id}_${finalActualDINBase}_${i}`, unitId: unit.id,
                            labelId: baseDinLabelId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: null, showAsFraction: false,
                        };
                        unit.palletsVisual.push(baseDinPallet);
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth });
                        finalTotalAreaBase += dinDef.area; finalActualDINBase++; finalTotalDinVisual++;
                        currentTotalWeight += safeDinWeight; dinPlacedCountTotal++; rowPalletsPlaced++;
                        rowHeight = Math.max(rowHeight, dinLength);

                        if (currentIsDINStackable && dinPlacedCountTotal < dinQuantityToPlace) {
                            if (!(safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG)) {
                                stackedDinLabelId = ++dinLabelGlobalCounter;
                                baseDinPallet.showAsFraction = true; baseDinPallet.displayStackedLabelId = stackedDinLabelId; baseDinPallet.isStackedTier = 'base';
                                unit.palletsVisual.push({
                                   ...baseDinPallet, isStackedTier: 'top', key: `din_stack_${unit.id}_${finalActualDINBase - 1}_${i}`,
                                    labelId: stackedDinLabelId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: stackedDinLabelId, showAsFraction: true,
                                });
                                finalTotalDinVisual++; currentTotalWeight += safeDinWeight; dinPlacedCountTotal++;
                            } else if (!tempWarnings.some(w => w.includes("Stapeln von DIN"))) tempWarnings.push('Gewichtslimit beim Stapeln von DIN.');
                        }
                        unit.currentY += dinWidth;
                    } else break;
                }
                if (unit.currentX >= unit.length) break;
                if (rowPalletsPlaced > 0) {
                    unit.currentX += rowHeight;
                    unit.dinEndX = unit.currentX; unit.dinEndY = unit.currentY;
                    unit.dinLastRowIncomplete = (rowPalletsPlaced === 1 && unit.width / PALLET_TYPES.industrial.length >= 2);
                } else unit.currentX = unit.length;
            }
            unit.eupStartX = unit.dinEndX; // EUPs start where DINs ended
        }
    }
    if (dinPlacedCountTotal < dinQuantityToPlace && !tempWarnings.some(w => w.includes("Gewichtslimit") || w.includes("Kapazität ist"))) {
        tempWarnings.push(`Konnte nicht alle ${dinQuantityToPlace} Industriepaletten laden. Nur ${dinPlacedCountTotal} platziert.`);
    }
    
    const initialUnitsAfterDIN = JSON.parse(JSON.stringify(unitsState));
    const weightAfterDINs = currentTotalWeight;

    // --- 2. EUP Pallet Placement (Secondary) ---
    let bestEUPResultConfig_DIN_FIRST = {
        unitsConfiguration: initialUnitsAfterDIN, totalVisualEUPs: 0, baseEUPs: 0, areaEUPs: 0, tempWarnings: [],
        currentWeightAfterEUPs: weightAfterDINs,
        chosenPattern: (currentEupLoadingPattern !== 'auto' ? currentEupLoadingPattern : 'none'),
        finalEupLabelCounter: eupLabelGlobalCounter,
    };

    if (eupQuantityToPlace > 0) {
        // ... (Standard EUP placement logic as in previous versions, using initialUnitsAfterDIN, weightAfterDINs)
        // This includes DIN gap filling.
        const patternsToTry = currentEupLoadingPattern === 'auto' ? ['long', 'broad'] : [currentEupLoadingPattern];
        let aPatternHasBeenSetAsBest = (currentEupLoadingPattern !== 'auto');

        for (const pattern of patternsToTry) {
            let currentUnitsAttempt = JSON.parse(JSON.stringify(initialUnitsAfterDIN));
            let patternVisualEUP = 0, patternBaseEUP = 0, patternAreaEUP = 0;
            let patternWeight = weightAfterDINs;
            let patternWarnLocal = [];
            let patternRemainingEup = eupQuantityToPlace;
            let currentPatternEupCounter = eupLabelGlobalCounter;

            // Attempt to fill gaps left by incomplete DIN rows first
            for (const unit of currentUnitsAttempt) {
                if (patternRemainingEup <= 0) break;
                if (unit.dinLastRowIncomplete) {
                    const gapX = unit.dinEndX - PALLET_TYPES.industrial.width; 
                    const gapY = PALLET_TYPES.industrial.length; 
                    const gapWidth = unit.width - gapY; 
                    const dinLenInRow = PALLET_TYPES.industrial.width;
                    const eupDef = PALLET_TYPES.euro;
                    let placedInGap = false, gapConfig = null;

                    const tryBroadFirst = (pattern === 'broad'); const tryLongFirst = (pattern === 'long');
                    if (tryBroadFirst && gapWidth >= eupDef.length && dinLenInRow >= eupDef.width && patternRemainingEup > 0) {
                        if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                            gapConfig = { x: gapX, y: gapY, width: eupDef.width, height: eupDef.length, type: 'euro', keySuffix: `_gap_broad` };
                            placedInGap = true;
                        } else if (!patternWarnLocal.some(w => w.includes('EUP Lücke'))) patternWarnLocal.push('Gewichtslimit für EUP in Lücke.');
                    }
                    if (!placedInGap && tryLongFirst && gapWidth >= eupDef.width && dinLenInRow >= eupDef.length && patternRemainingEup > 0) {
                         if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                            gapConfig = { x: gapX, y: gapY, width: eupDef.length, height: eupDef.width, type: 'euro', keySuffix: `_gap_long` };
                            placedInGap = true;
                         } else if (!patternWarnLocal.some(w => w.includes('EUP Lücke'))) patternWarnLocal.push('Gewichtslimit für EUP in Lücke.');
                    }
                    if (!placedInGap && currentEupLoadingPattern === 'auto') { // Fallback for auto
                        if (!tryBroadFirst && gapWidth >= eupDef.length && dinLenInRow >= eupDef.width && patternRemainingEup > 0) { // try broad if long was first
                            if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                                gapConfig = { x: gapX, y: gapY, width: eupDef.width, height: eupDef.length, type: 'euro', keySuffix: `_gap_broad_fallback` };
                                placedInGap = true;
                            } else if (!patternWarnLocal.some(w => w.includes('EUP Lücke'))) patternWarnLocal.push('Gewichtslimit für EUP in Lücke.');
                        } else if (!tryLongFirst && gapWidth >= eupDef.width && dinLenInRow >= eupDef.length && patternRemainingEup > 0) { // try long if broad was first
                            if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                                gapConfig = { x: gapX, y: gapY, width: eupDef.length, height: eupDef.width, type: 'euro', keySuffix: `_gap_long_fallback` };
                                placedInGap = true;
                            } else if (!patternWarnLocal.some(w => w.includes('EUP Lücke'))) patternWarnLocal.push('Gewichtslimit für EUP in Lücke.');
                        }
                    }

                    if (placedInGap && gapConfig) {
                        const baseEupLabelId = ++currentPatternEupCounter; let stackedEupLabelId = null;
                        const baseGapPallet = {
                            ...gapConfig, isStackedTier: null, key: `eup_gap_base_${patternBaseEUP}${gapConfig.keySuffix}`, unitId: unit.id,
                            labelId: baseEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: null, showAsFraction: false,
                        };
                        unit.palletsVisual.push(baseGapPallet);
                        unit.occupiedRects.push({ x: gapConfig.x, y: gapConfig.y, width: gapConfig.width, height: gapConfig.height });
                        patternAreaEUP += eupDef.area; patternBaseEUP++; patternVisualEUP++;
                        patternWeight += safeEupWeight; patternRemainingEup--;
                        if (currentIsEUPStackable && patternRemainingEup > 0) {
                            if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                                stackedEupLabelId = ++currentPatternEupCounter;
                                baseGapPallet.showAsFraction = true; baseGapPallet.displayStackedLabelId = stackedEupLabelId; baseGapPallet.isStackedTier = 'base';
                                unit.palletsVisual.push({
                                   ...baseGapPallet, isStackedTier: 'top', key: `eup_gap_stack_${patternBaseEUP - 1}${gapConfig.keySuffix}`,
                                    labelId: stackedEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: stackedEupLabelId, showAsFraction: true,
                                });
                                patternVisualEUP++; patternWeight += safeEupWeight; patternRemainingEup--;
                            } else if (!patternWarnLocal.some(w => w.includes('Stapeln EUP Lücke'))) patternWarnLocal.push('Gewichtslimit Stapeln EUP Lücke.');
                        }
                        unit.eupStartX = unit.dinEndX; 
                    }
                }
            } // End gap filling loop

            // Fill remaining area with EUPs
            for (const unit of currentUnitsAttempt) {
                if (patternRemainingEup <= 0) break;
                unit.currentX = unit.eupStartX; 
                unit.currentY = 0;
                const effectiveLength = unit.length;

                while (unit.currentX < effectiveLength) {
                    // ... (Standard EUP row placement as in previous versions)
                    if (patternRemainingEup <= 0) break;
                    let rowCount = 0;
                    const eupDef = PALLET_TYPES.euro;
                    const palletsPerRow = (pattern === 'long' ? 3 : 2);
                    const eupLen = pattern === 'long' ? eupDef.length : eupDef.width;
                    const eupWid = pattern === 'long' ? eupDef.width : eupDef.length;
                    let rowHeight = 0; unit.currentY = 0;

                    for (let i = 0; i < palletsPerRow; i++) {
                        if (patternRemainingEup <= 0) break;
                        if (safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG) {
                            if (!patternWarnLocal.some(w => w.includes('Gewichtslimit für EUP'))) patternWarnLocal.push(`Gewichtslimit für EUP-Paletten erreicht. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
                            unit.currentX = effectiveLength; break;
                        }
                        if (unit.currentX + eupLen <= effectiveLength && unit.currentY + eupWid <= unit.width) {
                            const baseEupLabelId = ++currentPatternEupCounter; let stackedEupLabelId = null;
                            const baseEupPallet = {
                                x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid, type: 'euro',
                                isStackedTier: null, key: `eup_base_${unit.id}_${patternBaseEUP}_${pattern}_${i}`, unitId: unit.id,
                                labelId: baseEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: null, showAsFraction: false,
                            };
                            unit.palletsVisual.push(baseEupPallet);
                            unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid });
                            patternAreaEUP += eupDef.area; patternBaseEUP++; patternVisualEUP++;
                            patternWeight += safeEupWeight; patternRemainingEup--; rowCount++;
                            rowHeight = Math.max(rowHeight, eupLen);

                            if (currentIsEUPStackable && patternRemainingEup > 0) {
                                if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                                    stackedEupLabelId = ++currentPatternEupCounter;
                                    baseEupPallet.showAsFraction = true; baseEupPallet.displayStackedLabelId = stackedEupLabelId; baseEupPallet.isStackedTier = 'base';
                                    unit.palletsVisual.push({
                                       ...baseEupPallet, isStackedTier: 'top', key: `eup_stack_${unit.id}_${patternBaseEUP - 1}_${pattern}_${i}`,
                                        labelId: stackedEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: stackedEupLabelId, showAsFraction: true,
                                    });
                                    patternVisualEUP++; patternWeight += safeEupWeight; patternRemainingEup--;
                                } else if (!patternWarnLocal.some(w => w.includes('Stapeln von EUP'))) patternWarnLocal.push('Gewichtslimit Stapeln von EUP.');
                            }
                            unit.currentY += eupWid;
                        } else break;
                    }
                    if (unit.currentX >= effectiveLength) break;
                    if (rowCount > 0) unit.currentX += rowHeight; else unit.currentX = effectiveLength;
                }
            } // End unit loop for EUP (main placement)
            
            let updateBestResult = false;
            if (currentEupLoadingPattern === 'auto') {
                 if (!aPatternHasBeenSetAsBest || patternVisualEUP > bestEUPResultConfig_DIN_FIRST.totalVisualEUPs || (patternVisualEUP === bestEUPResultConfig_DIN_FIRST.totalVisualEUPs && pattern === 'broad' && bestEUPResultConfig_DIN_FIRST.chosenPattern === 'long')) {
                    updateBestResult = true;
                    if(!aPatternHasBeenSetAsBest) aPatternHasBeenSetAsBest = true;
                }
            } else updateBestResult = true;
            
            if (updateBestResult) {
                 bestEUPResultConfig_DIN_FIRST = {
                    unitsConfiguration: JSON.parse(JSON.stringify(currentUnitsAttempt)),
                    totalVisualEUPs: patternVisualEUP, baseEUPs: patternBaseEUP, areaEUPs: patternAreaEUP,
                    tempWarnings: patternWarnLocal, currentWeightAfterEUPs: patternWeight,
                    chosenPattern: pattern, finalEupLabelCounter: currentPatternEupCounter,
                };
            }
        } // End patternsToTry loop for EUPs (after DINs)

        unitsState = bestEUPResultConfig_DIN_FIRST.unitsConfiguration;
        finalActualEUPBase = bestEUPResultConfig_DIN_FIRST.baseEUPs;
        finalTotalEuroVisual = bestEUPResultConfig_DIN_FIRST.totalVisualEUPs;
        finalTotalAreaBase += bestEUPResultConfig_DIN_FIRST.areaEUPs; // Add EUP area
        currentTotalWeight = bestEUPResultConfig_DIN_FIRST.currentWeightAfterEUPs;
        tempWarnings.push(...bestEUPResultConfig_DIN_FIRST.tempWarnings.filter(w => !tempWarnings.includes(w)));
        eupLabelGlobalCounter = bestEUPResultConfig_DIN_FIRST.finalEupLabelCounter;

        if (finalTotalEuroVisual < eupQuantityToPlace && !tempWarnings.some(w => w.includes('Gewichtslimit'))) {
            tempWarnings.push(`Konnte nicht alle ${eupQuantityToPlace} Europaletten laden (nach DINs). Nur ${finalTotalEuroVisual} (visuell) platziert mit Muster '${bestEUPResultConfig_DIN_FIRST.chosenPattern}'.`);
        }
    }
  } // End DIN_FIRST placement order

  const finalPalletArrangement = unitsState.map(u => ({
    unitId: u.id, unitLength: u.length, unitWidth: u.width, pallets: u.palletsVisual
  }));
  const totalArea = truckConfig.units.reduce((sum, u) => sum + u.length * u.width, 0);
  const util = totalArea > 0 ? (finalTotalAreaBase / totalArea) * 100 : 0;
  const utilizationPercentage = parseFloat(util.toFixed(1));

  if (tempWarnings.length === 0 && (requestedEupQuantity > 0 || requestedDinQuantity > 0)) {
    if ( (placementOrder === 'DIN_FIRST' && finalActualDINBase >= dinQuantityToPlace && finalActualEUPBase >= eupQuantityToPlace) ||
         (placementOrder === 'EUP_FIRST' && finalActualEUPBase >= eupQuantityToPlace && finalActualDINBase >= dinQuantityToPlace) ) {
       // Only add success if all *requested and placeable* items were placed.
       // This needs refinement as MAX_SIM_QUANTITY is used for filling.
    }
    // A general success message might be too broad. Warnings cover issues.
  }
  
  const uniqueWarnings = Array.from(new Set(tempWarnings));
  let chosenEupPattern = 'none';
  if (placementOrder === 'EUP_FIRST' && finalTotalEuroVisual > 0) {
      chosenEupPattern = unitsState[0]?.palletsVisual.find(p => p.type === 'euro')?.key.split('_')[3] || 'auto'; // Heuristic
      // This needs to get from bestEUPResultConfig.chosenPattern if EUPs were placed
  } else if (placementOrder === 'DIN_FIRST' && finalTotalEuroVisual > 0) {
      chosenEupPattern = TRUCK_TYPES[truckKey].units.length > 0 && unitsState[0].palletsVisual.find(p => p.type === 'euro') ? 
                         (unitsState[0].palletsVisual.find(p => p.type === 'euro').key.includes('_long_') ? 'long' : 
                          unitsState[0].palletsVisual.find(p => p.type === 'euro').key.includes('_broad_') ? 'broad' : 'auto') 
                         : 'auto'; // More robust way to get pattern from bestEUPResultConfig_DIN_FIRST
       if (placementOrder === 'DIN_FIRST' && typeof bestEUPResultConfig_DIN_FIRST !== 'undefined') {
            chosenEupPattern = bestEUPResultConfig_DIN_FIRST.chosenPattern;
       } else if (placementOrder === 'EUP_FIRST' && typeof bestEUPResultConfig !== 'undefined') {
            chosenEupPattern = bestEUPResultConfig.chosenPattern;
       }
  }


  return {
    palletArrangement: finalPalletArrangement,
    loadedIndustrialPalletsBase: finalActualDINBase,
    loadedEuroPalletsBase: finalActualEUPBase,
    totalDinPalletsVisual: finalTotalDinVisual,
    totalEuroPalletsVisual: finalTotalEuroVisual,
    utilizationPercentage: utilizationPercentage,
    warnings: uniqueWarnings,
    totalWeightKg: currentTotalWeight,
    eupLoadingPatternUsed: chosenEupPattern,
  };
};


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
  const [actualEupLoadingPattern, setActualEupLoadingPattern] = useState('auto');


  const calculateAndSetState = useCallback((order = 'DIN_FIRST') => { // Default order for general calculations
    const results = calculateLoadingLogic(
      selectedTruck,
      eupQuantity,
      dinQuantity,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      order // Pass the order
    );

    setPalletArrangement(results.palletArrangement);
    setLoadedIndustrialPalletsBase(results.loadedIndustrialPalletsBase);
    setLoadedEuroPalletsBase(results.loadedEuroPalletsBase);
    setTotalDinPalletsVisual(results.totalDinPalletsVisual);
    setTotalEuroPalletsVisual(results.totalEuroPalletsVisual);
    setUtilizationPercentage(results.utilizationPercentage);
    setWarnings(results.warnings);
    setTotalWeightKg(results.totalWeightKg);

    if (results.eupLoadingPatternUsed && results.eupLoadingPatternUsed !== 'none') {
        setActualEupLoadingPattern(results.eupLoadingPatternUsed);
    } else if (eupQuantity === 0) {
        setActualEupLoadingPattern(eupLoadingPattern); 
    }
  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern]);

  useEffect(() => {
    calculateAndSetState(); // Uses default 'DIN_FIRST'
  }, [calculateAndSetState]);

  const handleQuantityChange = (type, amount) => {
    if (type === 'eup') setEupQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    else if (type === 'din') setDinQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    // calculateAndSetState will be triggered by useEffect due to quantity change
  };

  const handleClearAllPallets = () => {
    setEupQuantity(0);
    setDinQuantity(0);
    setEupWeightPerPallet('');
    setDinWeightPerPallet('');
    setIsEUPStackable(false);
    setIsDINStackable(false);
    setEupLoadingPattern('auto');
    // calculateAndSetState will be triggered by useEffect
  };

  // This function MAXIMIZES one pallet type, clearing others.
  const handleMaximizePallets = (palletTypeToMax) => {
    let targetEupQty = 0;
    let targetDinQty = 0;
    let order = 'DIN_FIRST';

    if (palletTypeToMax === 'industrial') {
      targetDinQty = MAX_PALLET_SIMULATION_QUANTITY;
      // Order DIN_FIRST is fine, EUPs are 0.
    } else if (palletTypeToMax === 'euro') {
      targetEupQty = MAX_PALLET_SIMULATION_QUANTITY;
      order = 'EUP_FIRST'; // Place EUPs first as they are the target, DINs are 0.
    }
    
    const simResults = calculateLoadingLogic(
        selectedTruck, targetEupQty, targetDinQty,
        false, false, // Not stackable for maximize base
        eupWeightPerPallet, dinWeightPerPallet,
        eupLoadingPattern, // Use current pattern choice for EUPs if maximizing EUPs
        order
    );

    // Set states directly from simResults to reflect the maximization
    setPalletArrangement(simResults.palletArrangement);
    setWarnings(simResults.warnings);
    setTotalWeightKg(simResults.totalWeightKg);
    setUtilizationPercentage(simResults.utilizationPercentage);
    setTotalDinPalletsVisual(simResults.totalDinPalletsVisual);
    setTotalEuroPalletsVisual(simResults.totalEuroPalletsVisual);

    if (palletTypeToMax === 'industrial') {
        setDinQuantity(simResults.loadedIndustrialPalletsBase);
        setEupQuantity(0); // Clear other pallet type
        setLoadedIndustrialPalletsBase(simResults.loadedIndustrialPalletsBase);
        setLoadedEuroPalletsBase(0);

    } else if (palletTypeToMax === 'euro') {
        setEupQuantity(simResults.loadedEuroPalletsBase);
        setDinQuantity(0); // Clear other pallet type
        setLoadedEuroPalletsBase(simResults.loadedEuroPalletsBase);
        setLoadedIndustrialPalletsBase(0);
    }
    setIsDINStackable(false); 
    setIsEUPStackable(false);
    if (simResults.eupLoadingPatternUsed && simResults.eupLoadingPatternUsed !== 'none') {
        setActualEupLoadingPattern(simResults.eupLoadingPatternUsed);
        if (eupLoadingPattern === 'auto' && palletTypeToMax === 'euro') {
            setEupLoadingPattern(simResults.eupLoadingPatternUsed);
        }
    }
  };

  // This function FILLS REMAINING space with EUPs, preserving existing DINs.
  const handleFillRemainingWithEUP = () => {
    const currentDinQty = dinQuantity; // Preserve existing DINs

    const simResults = calculateLoadingLogic(
      selectedTruck,
      MAX_PALLET_SIMULATION_QUANTITY, // Try to fill with EUPs
      currentDinQty, // Existing DINs
      false, false, // Not stackable for this fill operation
      eupWeightPerPallet, dinWeightPerPallet,
      eupLoadingPattern,
      'DIN_FIRST' // Place existing DINs first, then fill with EUPs
    );
    
    // Update all states based on this specific simulation
    setPalletArrangement(simResults.palletArrangement);
    setLoadedIndustrialPalletsBase(simResults.loadedIndustrialPalletsBase); // Should reflect currentDinQty if they fit
    setLoadedEuroPalletsBase(simResults.loadedEuroPalletsBase);
    setTotalDinPalletsVisual(simResults.totalDinPalletsVisual);
    setTotalEuroPalletsVisual(simResults.totalEuroPalletsVisual);
    setUtilizationPercentage(simResults.utilizationPercentage);
    setWarnings(simResults.warnings);
    setTotalWeightKg(simResults.totalWeightKg);
    
    setEupQuantity(simResults.loadedEuroPalletsBase); // Set EUP quantity to what actually fit
    // dinQuantity remains as it was (currentDinQty)
    setIsEUPStackable(false); 
    setIsDINStackable(false); // Keep DIN stack state or reset? For "fill 1-lagig", reset.

    if (simResults.eupLoadingPatternUsed && simResults.eupLoadingPatternUsed !== 'none') {
        setActualEupLoadingPattern(simResults.eupLoadingPatternUsed);
         if (eupLoadingPattern === 'auto') { 
            setEupLoadingPattern(simResults.eupLoadingPatternUsed);
        }
    }
  };

  // This function FILLS REMAINING space with DINs, preserving existing EUPs.
  const handleFillRemainingWithDIN = () => {
    const currentEupQty = eupQuantity; // Preserve existing EUPs

    const simResults = calculateLoadingLogic(
      selectedTruck,
      currentEupQty, // Existing EUPs
      MAX_PALLET_SIMULATION_QUANTITY, // Try to fill with DINs
      false, false, // Not stackable for this fill operation
      eupWeightPerPallet, dinWeightPerPallet,
      eupLoadingPattern, // EUP pattern is for the existing EUPs
      'EUP_FIRST' // Place existing EUPs first, then fill with DINs
    );

    setPalletArrangement(simResults.palletArrangement);
    setLoadedIndustrialPalletsBase(simResults.loadedIndustrialPalletsBase);
    setLoadedEuroPalletsBase(simResults.loadedEuroPalletsBase); // Should reflect currentEupQty if they fit
    setTotalDinPalletsVisual(simResults.totalDinPalletsVisual);
    setTotalEuroPalletsVisual(simResults.totalEuroPalletsVisual);
    setUtilizationPercentage(simResults.utilizationPercentage);
    setWarnings(simResults.warnings);
    setTotalWeightKg(simResults.totalWeightKg);

    setDinQuantity(simResults.loadedIndustrialPalletsBase); // Set DIN quantity to what actually fit
    // eupQuantity remains as it was (currentEupQty)
    setIsDINStackable(false);
    setIsEUPStackable(false); // Keep EUP stack state or reset? For "fill 1-lagig", reset.

    // If existing EUPs had a pattern, it should ideally be preserved.
    // The actualEupLoadingPattern might change if the EUPs themselves were re-evaluated.
    if (simResults.eupLoadingPatternUsed && simResults.eupLoadingPatternUsed !== 'none' && currentEupQty > 0) {
        setActualEupLoadingPattern(simResults.eupLoadingPatternUsed);
    }
  };

  const renderPallet = (pallet, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) return null;
    const d = PALLET_TYPES[pallet.type];
    const w = pallet.height * displayScale; 
    const h = pallet.width * displayScale;  
    const x = pallet.y * displayScale;      
    const y = pallet.x * displayScale;      
    
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

  return (
    <div className="container mx-auto p-4 font-sans bg-gray-50 min-h-screen">
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
              <select id="truckType" value={selectedTruck} onChange={e=>{setSelectedTruck(e.target.value); handleClearAllPallets();}} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {Object.keys(TRUCK_TYPES).map(key=><option key={key} value={key}>{TRUCK_TYPES[key].name}</option>)}
              </select>
            </div>
            <div className="pt-4">
              <button onClick={handleClearAllPallets} className="w-full py-2 px-4 bg-red-500 text-white font-semibold rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-150 ease-in-out">Alles zurücksetzen</button>
            </div>

            {/* DIN Paletten Sektion */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industriepaletten (DIN)</label>
              <div className="flex items-center mt-1">
                <button onClick={()=>handleQuantityChange('din',-1)} className="px-3 py-1 bg-red-600 text-white rounded-l-md hover:bg-red-700">-</button>
                <input type="number" min="0" value={dinQuantity} onChange={e=>setDinQuantity(Math.max(0, parseInt(e.target.value,10)||0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                <button onClick={()=>handleQuantityChange('din',1)} className="px-3 py-1 bg-green-600 text-white rounded-r-md hover:bg-green-700">+</button>
              </div>
              <button onClick={() => handleMaximizePallets('industrial')} className="mt-2 w-full py-1.5 px-3 bg-orange-500 text-white text-xs font-medium rounded-md shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50">Max. DIN (1-lagig)</button>
              <button onClick={handleFillRemainingWithDIN} className="mt-1 w-full py-1.5 px-3 bg-purple-500 text-white text-xs font-medium rounded-md shadow-sm hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50">Rest mit max. DIN füllen (1-lagig)</button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/DIN (kg):</label>
                <input type="number" min="0" value={dinWeightPerPallet} onChange={e=>setDinWeightPerPallet(e.target.value)} placeholder="z.B. 500" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"/>
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="dinStackable" checked={isDINStackable} onChange={e=>setIsDINStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                <label htmlFor="dinStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
            </div>

            {/* EUP Paletten Sektion */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Europaletten (EUP)</label>
              <div className="flex items-center mt-1">
                <button onClick={()=>handleQuantityChange('eup',-1)} className="px-3 py-1 bg-red-600 text-white rounded-l-md hover:bg-red-700">-</button>
                <input type="number" min="0" value={eupQuantity} onChange={e=>setEupQuantity(Math.max(0, parseInt(e.target.value,10)||0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                <button onClick={()=>handleQuantityChange('eup',1)} className="px-3 py-1 bg-green-600 text-white rounded-r-md hover:bg-green-700">+</button>
              </div>
              <button onClick={() => handleMaximizePallets('euro')} className="mt-2 w-full py-1.5 px-3 bg-sky-500 text-white text-xs font-medium rounded-md shadow-sm hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50">Max. EUP (1-lagig)</button>
              <button onClick={handleFillRemainingWithEUP} className="mt-1 w-full py-1.5 px-3 bg-teal-500 text-white text-xs font-medium rounded-md shadow-sm hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50">Rest mit max. EUP füllen (1-lagig)</button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/EUP (kg):</label>
                <input type="number" min="0" value={eupWeightPerPallet} onChange={e=>setEupWeightPerPallet(e.target.value)} placeholder="z.B. 400" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"/>
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="eupStackable" checked={isEUPStackable} onChange={e=>setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                <label htmlFor="eupStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
            </div>

            {(eupQuantity > 0 || actualEupLoadingPattern !== 'auto' || eupLoadingPattern !== 'auto') && ( 
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">EUP Lade-Pattern: 
                <span className="text-xs text-gray-500"> (Gewählt: {actualEupLoadingPattern === 'none' && eupQuantity > 0 ? 'Kein passendes Muster gefunden' : actualEupLoadingPattern})</span>
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
            <p className="text-xs mt-1">(Max: {MAX_GROSS_WEIGHT_KG/1000}t)</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
            <h3 className="font-semibold text-red-800 mb-2">Meldungen</h3>
            {warnings.length > 0 ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-red-700">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
            ) : (
                <p className="text-sm text-gray-500">Keine Probleme erkannt.</p>
            )}
          </div>
        </div>
      </main>
      <footer className="text-center py-4 mt-8 text-sm text-gray-500 border-t border-gray-200">
        <p>Laderaumrechner © {new Date().getFullYear()}</p>
         <p>by Andreas Steiner </p>
      </footer>
    </div>
  );
}
