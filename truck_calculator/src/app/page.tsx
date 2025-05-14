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
    Waggon2: {
    name: 'Waggon KRM ',
    units: [{ id: 'main', length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    singleLayerEUPCapacityLong: 38,
    singleLayerEUPCapacityBroad: 40,
    singleLayerDINCapacity: 28,
    maxDinPallets: 28,
  },
};

// Constants for pallet types
const PALLET_TYPES = {
  euro: { name: 'Euro Pallet (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700' },
  industrial: { name: 'Industrial Pallet (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700' },
};

// Maximum gross weight for the truck (payload capacity)
const MAX_GROSS_WEIGHT_KG = 24000;
const MAX_PALLET_SIMULATION_QUANTITY = 300; // Used for simulation purposes

// *** NEU: Reine Berechnungslogik ***
// Diese Funktion enthält die Kernlogik von calculateLoading, gibt aber nur Daten zurück und setzt keinen State.
const calculateLoadingLogic = (
  truckKey,
  currentEupQuantity,
  currentDinQuantity,
  currentIsEUPStackable,
  currentIsDINStackable,
  eupWeightStr,
  dinWeightStr,
  currentEupLoadingPattern
) => {
  const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  let tempWarnings = [];
  let finalTotalEuroVisual = 0;
  let finalTotalDinVisual = 0;
  let finalActualEUPBase = 0;
  let finalActualDINBase = 0;
  let finalTotalAreaBase = 0;
  let currentTotalWeight = 0;
  // let finalPalletArrangement = []; // Wird innerhalb der Funktion aufgebaut

  let dinLabelGlobalCounter = 0;
  let eupLabelGlobalCounter = 0;

  const eupWeight = parseFloat(eupWeightStr);
  const dinWeight = parseFloat(dinWeightStr);
  const safeEupWeight = !isNaN(eupWeight) && eupWeight > 0 ? eupWeight : 0;
  const safeDinWeight = !isNaN(dinWeight) && dinWeight > 0 ? dinWeight : 0;

  let unitsState = truckConfig.units.map(u => ({
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

  let dinQuantityToPlace = currentDinQuantity;
  if (truckKey === 'Waggon' && truckConfig.maxDinPallets !== undefined) {
    if (currentDinQuantity > truckConfig.maxDinPallets) {
      tempWarnings.push(`Waggon DIN capacity is ${truckConfig.maxDinPallets}. Requested ${currentDinQuantity}, placing ${truckConfig.maxDinPallets}.`);
      dinQuantityToPlace = truckConfig.maxDinPallets;
    }
  }
  let eupQuantityToPlace = currentEupQuantity;

  // --- DIN Pallet Placement ---
  let dinPlacedCountTotal = 0;
  if (dinQuantityToPlace > 0) {
    for (const unit of unitsState) {
      if (dinPlacedCountTotal >= dinQuantityToPlace) break;
      while (unit.currentX < unit.length) {
        if (dinPlacedCountTotal >= dinQuantityToPlace) break;
        let rowPalletsPlaced = 0;
        const dinDef = PALLET_TYPES.industrial;
        const dinLength = dinDef.width; // DIN wird gedreht geladen (1.0m in Ladebreite, 1.2m in Ladetiefe)
        const dinWidth = dinDef.length;
        let rowHeight = 0;
        unit.currentY = 0;

        for (let i = 0; i < 2; i++) { // Max 2 DIN nebeneinander
          if (dinPlacedCountTotal >= dinQuantityToPlace) break;
          if (safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG) {
            if (!tempWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
              tempWarnings.push(`Weight limit reached for DIN pallets. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
            }
            unit.currentX = unit.length; // Stop placing in this unit
            break;
          }
          if (unit.currentX + dinLength <= unit.length && unit.currentY + dinWidth <= unit.width) {
            const baseDinLabelId = ++dinLabelGlobalCounter;
            let stackedDinLabelId = null;

            const baseDinPallet = {
              x: unit.currentX,
              y: unit.currentY,
              width: dinLength,
              height: dinWidth,
              type: 'industrial',
              isStackedTier: null,
              key: `din_base_${unit.id}_${finalActualDINBase}_${i}`,
              unitId: unit.id,
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

            if (currentIsDINStackable && dinPlacedCountTotal < dinQuantityToPlace) {
              if (!(safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG)) {
                stackedDinLabelId = ++dinLabelGlobalCounter;
                baseDinPallet.showAsFraction = true;
                baseDinPallet.displayStackedLabelId = stackedDinLabelId;
                baseDinPallet.isStackedTier = 'base';

                unit.palletsVisual.push({
                  x: unit.currentX,
                  y: unit.currentY,
                  width: dinLength,
                  height: dinWidth,
                  type: 'industrial',
                  isStackedTier: 'top',
                  key: `din_stack_${unit.id}_${finalActualDINBase - 1}_${i}`,
                  unitId: unit.id,
                  labelId: stackedDinLabelId,
                  displayBaseLabelId: baseDinLabelId,
                  displayStackedLabelId: stackedDinLabelId,
                  showAsFraction: true,
                });
                finalTotalDinVisual++;
                currentTotalWeight += safeDinWeight;
                dinPlacedCountTotal++;
              } else {
                 if (!tempWarnings.some(w => w.includes("Weight limit stacking DIN")))
                  tempWarnings.push(`Weight limit reached. Cannot stack more DIN pallets. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
              }
            }
            unit.currentY += dinWidth;
          } else {
            break; // No more space in this row for DIN
          }
        }
        if (unit.currentX >= unit.length) break; // Unit full
        if (rowPalletsPlaced > 0) {
          unit.currentX += rowHeight;
          unit.dinEndX = unit.currentX;
          unit.dinEndY = unit.currentY; // Y position after last DIN row
          unit.dinLastRowIncomplete = (rowPalletsPlaced === 1); // If only one DIN pallet fit in the last row (width-wise)
        } else {
          // No DIN pallets could be placed in this new column, so unit is full for DINs
          unit.currentX = unit.length;
        }
      }
      unit.eupStartX = unit.dinEndX; // EUPs start where DINs ended in length
    }
  }
  if (dinPlacedCountTotal < currentDinQuantity && !tempWarnings.some(w => w.includes("Weight limit") || w.includes("Waggon DIN capacity"))) {
    tempWarnings.push(`Could not fit all ${currentDinQuantity} Industrial pallets due to space. Only ${dinPlacedCountTotal} placed.`);
  }

    

  const initialUnitsAfterDIN = JSON.parse(JSON.stringify(unitsState));
  const weightAfterDINs = currentTotalWeight;

  // --- EUP Pallet Placement ---
  let bestEUPResult = {
    unitsConfiguration: initialUnitsAfterDIN, // Start with DINs placed
    totalVisualEUPs: 0,
    baseEUPs: 0,
    areaEUPs: 0,
    tempWarnings: [],
    currentWeightAfterEUPs: weightAfterDINs,
    chosenPattern: (currentEupLoadingPattern !== 'auto' ? currentEupLoadingPattern : 'none'), // Default to none if auto and no EUPs placed
    finalEupLabelCounter: eupLabelGlobalCounter,
  };

  if (eupQuantityToPlace > 0) {
    const patternsToTry = currentEupLoadingPattern === 'auto' ? ['long', 'broad'] : [currentEupLoadingPattern];
    let aPatternHasBeenSetAsBest = (currentEupLoadingPattern !== 'auto'); // If a specific pattern is chosen, it's initially the "best"

    for (const pattern of patternsToTry) {
      let currentUnits = JSON.parse(JSON.stringify(initialUnitsAfterDIN)); // Reset units for each pattern attempt
      let patternVisualEUP = 0, patternBaseEUP = 0, patternAreaEUP = 0;
      let patternWeight = weightAfterDINs;
      let patternWarn = [];
      let patternRemainingEup = eupQuantityToPlace;
      let currentPatternEupCounter = eupLabelGlobalCounter; // Start EUP counter after DINs for this pattern

      // Attempt to fill gaps left by incomplete DIN rows first
      for (const unit of currentUnits) {
        if (patternRemainingEup <= 0) break;
        if (unit.dinLastRowIncomplete) { // If the last DIN row had only one pallet
          const gapX = unit.dinEndX - PALLET_TYPES.industrial.width; // X where the single DIN pallet ended
          const gapY = PALLET_TYPES.industrial.length; // Y position next to the single DIN pallet
          const gapWidth = unit.width - gapY; // Remaining width in the truck
          const dinLenInRow = PALLET_TYPES.industrial.width; // Length of the DIN pallet in that row
          const eupDef = PALLET_TYPES.euro;
          let placedInGap = false, eupLenPlaced = 0, gapConfig = null;

          // Determine which EUP orientation to try first in the gap
          const tryBroadFirst = (pattern === 'broad'); // Default or if broad is chosen
          const tryLongFirst = (pattern === 'long');   // If long is chosen

          // Try placing EUP broad (0.8m width, 1.2m length)
          if (tryBroadFirst && gapWidth >= eupDef.length && dinLenInRow >= eupDef.width && patternRemainingEup > 0) {
             if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                gapConfig = { x: gapX, y: gapY, width: eupDef.width, height: eupDef.length, type: 'euro', keySuffix: `_gap_broad` };
                placedInGap = true; eupLenPlaced = eupDef.width;
             } else if (!patternWarn.some(w => w.includes('EUP gap'))) patternWarn.push('Weight limit for EUP gap');
          }
          // Try placing EUP long (1.2m width, 0.8m length) if broad didn't fit or wasn't tried first
          if (!placedInGap && tryLongFirst && gapWidth >= eupDef.width && dinLenInRow >= eupDef.length && patternRemainingEup > 0) {
             if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                gapConfig = { x: gapX, y: gapY, width: eupDef.length, height: eupDef.width, type: 'euro', keySuffix: `_gap_long` };
                placedInGap = true; eupLenPlaced = eupDef.length;
             } else if (!patternWarn.some(w => w.includes('EUP gap'))) patternWarn.push('Weight limit for EUP gap');
          }
           // Fallback if specific pattern didn't fit, try the other for auto
          if (!placedInGap && currentEupLoadingPattern === 'auto') {
            if (!tryBroadFirst && gapWidth >= eupDef.length && dinLenInRow >= eupDef.width && patternRemainingEup > 0) { // try broad if long was first
                 if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                    gapConfig = { x: gapX, y: gapY, width: eupDef.width, height: eupDef.length, type: 'euro', keySuffix: `_gap_broad_fallback` };
                    placedInGap = true; eupLenPlaced = eupDef.width;
                 } else if (!patternWarn.some(w => w.includes('EUP gap'))) patternWarn.push('Weight limit for EUP gap');
            } else if (!tryLongFirst && gapWidth >= eupDef.width && dinLenInRow >= eupDef.length && patternRemainingEup > 0) { // try long if broad was first
                 if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                    gapConfig = { x: gapX, y: gapY, width: eupDef.length, height: eupDef.width, type: 'euro', keySuffix: `_gap_long_fallback` };
                    placedInGap = true; eupLenPlaced = eupDef.length;
                 } else if (!patternWarn.some(w => w.includes('EUP gap'))) patternWarn.push('Weight limit for EUP gap');
            }
          }


          if (placedInGap && gapConfig) {
            const baseEupLabelId = ++currentPatternEupCounter;
            let stackedEupLabelId = null;
            const baseGapPallet = {
              ...gapConfig,
              isStackedTier: null,
              key: `eup_gap_base_${patternBaseEUP}${gapConfig.keySuffix}`,
              unitId: unit.id,
              labelId: baseEupLabelId,
              displayBaseLabelId: baseEupLabelId,
              displayStackedLabelId: null,
              showAsFraction: false,
            };
            unit.palletsVisual.push(baseGapPallet);
            unit.occupiedRects.push({ x: gapConfig.x, y: gapConfig.y, width: gapConfig.width, height: gapConfig.height });
            patternAreaEUP += eupDef.area;
            patternBaseEUP++;
            patternVisualEUP++;
            patternWeight += safeEupWeight;
            patternRemainingEup--;

            if (currentIsEUPStackable && patternRemainingEup > 0) {
              if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                stackedEupLabelId = ++currentPatternEupCounter;
                baseGapPallet.showAsFraction = true;
                baseGapPallet.displayStackedLabelId = stackedEupLabelId;
                baseGapPallet.isStackedTier = 'base';
                unit.palletsVisual.push({
                  ...baseGapPallet, // spread the original gap pallet properties
                  isStackedTier: 'top',
                  key: `eup_gap_stack_${patternBaseEUP - 1}${gapConfig.keySuffix}`,
                  labelId: stackedEupLabelId, // Unique ID for the stacked pallet
                  displayBaseLabelId: baseEupLabelId, // Reference to base
                  displayStackedLabelId: stackedEupLabelId, // Self-reference for top
                  showAsFraction: true,
                });
                patternVisualEUP++;
                patternWeight += safeEupWeight;
                patternRemainingEup--;
              } else if (!patternWarn.some(w => w.includes('stacking EUP gap'))) patternWarn.push('Weight limit stacking EUP gap');
            }
            // Adjust eupStartX for this unit if a gap pallet was placed.
            // It should be the end of the DIN row (dinEndX) or the end of the gap pallet, whichever is greater.
            unit.eupStartX = unit.dinEndX; //Math.max(unit.dinEndX, gapX + eupLenPlaced); // This was causing issues, EUPs should start after the full DIN row.
          }
        }
      }

      // Fill remaining area with EUPs
      for (const unit of currentUnits) {
        if (patternRemainingEup <= 0) break;
        unit.currentX = unit.eupStartX; // Start EUPs after DINs (or after gap fill if it extended further)
        unit.currentY = 0;
        const effectiveLength = unit.length;

        while (unit.currentX < effectiveLength) {
          if (patternRemainingEup <= 0) break;
          let rowCount = 0; // Pallets placed in this column
          const eupDef = PALLET_TYPES.euro;
          // Pallet dimensions based on loading pattern
          const palletsPerRow = (pattern === 'long' ? 3 : 2); // How many fit width-wise
          const eupLen = pattern === 'long' ? eupDef.length : eupDef.width; // Dimension along truck length
          const eupWid = pattern === 'long' ? eupDef.width : eupDef.length; // Dimension along truck width
          let rowHeight = 0; // Actual length consumed by this row of EUPs
          unit.currentY = 0; // Reset Y for each new column of EUPs

          for (let i = 0; i < palletsPerRow; i++) {
            if (patternRemainingEup <= 0) break;
            if (safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG) {
              if (!patternWarn.some(w => w.includes('Weight limit reached for EUP'))) patternWarn.push(`Weight limit reached for EUP pallets. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
              unit.currentX = effectiveLength; break; // Stop placing in this unit
            }

            if (unit.currentX + eupLen <= effectiveLength && unit.currentY + eupWid <= unit.width) {
              const baseEupLabelId = ++currentPatternEupCounter;
              let stackedEupLabelId = null;

              const baseEupPallet = {
                x: unit.currentX,
                y: unit.currentY,
                width: eupLen,
                height: eupWid,
                type: 'euro',
                isStackedTier: null,
                key: `eup_base_${unit.id}_${patternBaseEUP}_${pattern}_${i}`,
                unitId: unit.id,
                labelId: baseEupLabelId,
                displayBaseLabelId: baseEupLabelId,
                displayStackedLabelId: null,
                showAsFraction: false,
              };
              unit.palletsVisual.push(baseEupPallet);
              unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid });
              patternAreaEUP += eupDef.area;
              patternBaseEUP++;
              patternVisualEUP++;
              patternWeight += safeEupWeight;
              patternRemainingEup--;
              rowCount++;
              rowHeight = Math.max(rowHeight, eupLen); // All pallets in a column take same length

              if (currentIsEUPStackable && patternRemainingEup > 0) {
                if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                  stackedEupLabelId = ++currentPatternEupCounter;
                  baseEupPallet.showAsFraction = true;
                  baseEupPallet.displayStackedLabelId = stackedEupLabelId;
                  baseEupPallet.isStackedTier = 'base';

                  unit.palletsVisual.push({
                    x: unit.currentX,
                    y: unit.currentY,
                    width: eupLen,
                    height: eupWid,
                    type: 'euro',
                    isStackedTier: 'top',
                    key: `eup_stack_${unit.id}_${patternBaseEUP - 1}_${pattern}_${i}`,
                    unitId: unit.id,
                    labelId: stackedEupLabelId,
                    displayBaseLabelId: baseEupLabelId,
                    displayStackedLabelId: stackedEupLabelId,
                    showAsFraction: true,
                  });
                  patternVisualEUP++;
                  patternWeight += safeEupWeight;
                  patternRemainingEup--;
                } else if (!patternWarn.some(w => w.includes('stacking EUP'))) patternWarn.push('Weight limit stacking EUP');
              }
              unit.currentY += eupWid;
            } else {
              break; // No more space in this row for EUP
            }
          }
          if (unit.currentX >= effectiveLength) break; // Unit full
          if (rowCount > 0) {
            unit.currentX += rowHeight; // Advance by the length of the EUPs placed
          } else {
            // No EUPs could be placed in this new column, so unit is full for EUPs
            unit.currentX = effectiveLength;
          }
        }
      }

      // Compare this pattern's result with the best so far (only if auto-optimizing)
      let updateBestResult = false;
      if (currentEupLoadingPattern === 'auto') {
        if (!aPatternHasBeenSetAsBest) { // First pattern tried in auto mode is initially best
          updateBestResult = true;
          aPatternHasBeenSetAsBest = true;
        } else if (patternVisualEUP > bestEUPResult.totalVisualEUPs) {
          updateBestResult = true;
        } else if (patternVisualEUP === bestEUPResult.totalVisualEUPs) {
          // Prefer 'broad' if counts are equal, as it often leaves more contiguous space
          // This is a heuristic and can be adjusted.
          // Or, if the current best is 'long' and this is 'broad' with same count, prefer 'broad'.
          if (pattern === 'broad' && bestEUPResult.chosenPattern === 'long') {
             updateBestResult = true;
          }
        }
      } else { // If a specific pattern was chosen, that's the only one we evaluate
        updateBestResult = true; // So it will become the bestEUPResult
      }


      if (updateBestResult) {
        bestEUPResult = {
          unitsConfiguration: JSON.parse(JSON.stringify(currentUnits)),
          totalVisualEUPs: patternVisualEUP,
          baseEUPs: patternBaseEUP,
          areaEUPs: patternAreaEUP,
          tempWarnings: patternWarn, // Capture warnings specific to this pattern
          currentWeightAfterEUPs: patternWeight,
          chosenPattern: pattern, // Store which pattern was chosen as best
          finalEupLabelCounter: currentPatternEupCounter,
        };
      }
    } // End of patternsToTry loop

    // Apply the best EUP result found
    unitsState = bestEUPResult.unitsConfiguration;
    finalActualEUPBase = bestEUPResult.baseEUPs;
    finalTotalEuroVisual = bestEUPResult.totalVisualEUPs;
    finalTotalAreaBase += bestEUPResult.areaEUPs; // Add EUP area to total
    currentTotalWeight = bestEUPResult.currentWeightAfterEUPs;
    tempWarnings.push(...bestEUPResult.tempWarnings.filter(w => !tempWarnings.includes(w))); // Add unique warnings from EUP placement
    eupLabelGlobalCounter = bestEUPResult.finalEupLabelCounter; // Update global counter

    if (finalTotalEuroVisual < currentEupQuantity && !tempWarnings.some(w => w.includes('Weight limit'))) {
      tempWarnings.push(`Could not fit all ${currentEupQuantity} Euro pallets. Only ${finalTotalEuroVisual} (visual) placed with pattern '${bestEUPResult.chosenPattern}'.`);
    }
  } // End if eupQuantityToPlace > 0


  const finalPalletArrangement = unitsState.map(u => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: u.palletsVisual
  }));

  const totalArea = truckConfig.units.reduce((sum, u) => sum + u.length * u.width, 0);
  const util = totalArea > 0 ? (finalTotalAreaBase / totalArea) * 100 : 0;
  const utilizationPercentage = parseFloat(util.toFixed(1));

  if (tempWarnings.length === 0 && (eupQuantityToPlace > 0 || dinQuantityToPlace > 0)) {
    tempWarnings.push('Alle Paletten erfolgreich platziert.');
  } else if (tempWarnings.length === 0 && eupQuantityToPlace === 0 && dinQuantityToPlace === 0) {
    tempWarnings.push('Es liegen keine Fehlermeldungen vor.');
  }
  
  const uniqueWarnings = Array.from(new Set(tempWarnings));

  return {
    palletArrangement: finalPalletArrangement,
    loadedIndustrialPalletsBase: finalActualDINBase,
    loadedEuroPalletsBase: finalActualEUPBase,
    totalDinPalletsVisual: finalTotalDinVisual,
    totalEuroPalletsVisual: finalTotalEuroVisual,
    utilizationPercentage: utilizationPercentage,
    warnings: uniqueWarnings,
    totalWeightKg: currentTotalWeight,
    eupLoadingPatternUsed: bestEUPResult.chosenPattern // Return the pattern used if EUPs were placed
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


  const calculateAndSetState = useCallback(() => {
    const results = calculateLoadingLogic(
      selectedTruck,
      eupQuantity,
      dinQuantity,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern
    );

    setPalletArrangement(results.palletArrangement);
    setLoadedIndustrialPalletsBase(results.loadedIndustrialPalletsBase);
    setLoadedEuroPalletsBase(results.loadedEuroPalletsBase);
    setTotalDinPalletsVisual(results.totalDinPalletsVisual);
    setTotalEuroPalletsVisual(results.totalEuroPalletsVisual);
    setUtilizationPercentage(results.utilizationPercentage);
    setWarnings(results.warnings);
    setTotalWeightKg(results.totalWeightKg);
    if (eupQuantity > 0 && results.eupLoadingPatternUsed) {
        setActualEupLoadingPattern(results.eupLoadingPatternUsed);
    } else if (eupQuantity === 0) {
        setActualEupLoadingPattern(eupLoadingPattern); // Reset or keep user choice if no EUPs
    }

  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern]);

  useEffect(() => {
    calculateAndSetState();
  }, [calculateAndSetState]);

  const handleQuantityChange = (type, amount) => {
    if (type === 'eup') setEupQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    else if (type === 'din') setDinQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
  };

  const handleClearAllPallets = () => {
    setEupQuantity(0);
    setDinQuantity(0);
    setEupWeightPerPallet('');
    setDinWeightPerPallet('');
    setIsEUPStackable(false);
    setIsDINStackable(false);
    setEupLoadingPattern('auto');
    setActualEupLoadingPattern('auto');
  };

  const handleMaximizePallets = (palletTypeToMax) => {
    const truckConfig = TRUCK_TYPES[selectedTruck];
    const unitsCount = truckConfig.units.length;

    // Temporarily set the other pallet type to 0 for this calculation
    // to get the absolute maximum for an empty truck.
    let tempEupQty = 0;
    let tempDinQty = 0;
    let tempEupStack = false;
    let tempDinStack = false;
    let tempEupPattern = eupLoadingPattern; // Use current pattern or auto

    if (palletTypeToMax === 'industrial') {
      tempDinQty = MAX_PALLET_SIMULATION_QUANTITY; // Simulate with many
      tempDinStack = false; // Single layer for this button
      tempEupStack = false;
    } else if (palletTypeToMax === 'euro') {
      tempEupQty = MAX_PALLET_SIMULATION_QUANTITY; // Simulate with many
      tempEupStack = false; // Single layer
      tempDinStack = false;
    }
    
    // Perform a simulation to find out how many actually fit
    const simResults = calculateLoadingLogic(
        selectedTruck,
        tempEupQty,
        tempDinQty,
        tempEupStack, // EUP stack false
        tempDinStack, // DIN stack false
        eupWeightPerPallet, // Keep weights for potential warnings
        dinWeightPerPallet,
        tempEupPattern
    );

    if (palletTypeToMax === 'industrial') {
        setDinQuantity(simResults.loadedIndustrialPalletsBase);
        setEupQuantity(0); // Clear other pallet type
        setIsDINStackable(false);
        setIsEUPStackable(false); // Also set other to false
    } else if (palletTypeToMax === 'euro') {
        setEupQuantity(simResults.loadedEuroPalletsBase);
        setDinQuantity(0); // Clear other pallet type
        setIsEUPStackable(false);
        setIsDINStackable(false); // Also set other to false
         if (simResults.eupLoadingPatternUsed) {
            setActualEupLoadingPattern(simResults.eupLoadingPatternUsed);
            // If user had 'auto', update the radio button to show what was chosen
            if (eupLoadingPattern === 'auto') {
                setEupLoadingPattern(simResults.eupLoadingPatternUsed);
            }
        }
    }
  };

  // *** NEUE FUNKTIONEN für Restplatzberechnung ***
  const handleFillRemainingWithEUP = () => {
    setIsEUPStackable(false); // Per Anforderung: ohne Doppelstock
    setIsDINStackable(false); // Auch DINs für diese Berechnung ohne Doppelstock
    
    const currentDinQty = dinQuantity; // Behalte aktuelle DIN Anzahl

    // Simuliere, wie viele EUPs zusätzlich zu den aktuellen DINs passen
    const simResults = calculateLoadingLogic(
      selectedTruck,
      MAX_PALLET_SIMULATION_QUANTITY, // Versuche viele EUPs zu laden
      currentDinQty,
      false, // isEUPStackable = false
      false, // isDINStackable = false
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern // Beachte aktuelles EUP Lade-Pattern
    );
    setEupQuantity(simResults.loadedEuroPalletsBase); // Setze EUP Anzahl auf das Ergebnis
    if (simResults.loadedEuroPalletsBase > 0 && simResults.eupLoadingPatternUsed) {
        setActualEupLoadingPattern(simResults.eupLoadingPatternUsed);
         if (eupLoadingPattern === 'auto') { // If user had 'auto', update radio to chosen one
            setEupLoadingPattern(simResults.eupLoadingPatternUsed);
        }
    }
  };

  const handleFillRemainingWithDIN = () => {
    setIsDINStackable(false); // Per Anforderung: ohne Doppelstock
    setIsEUPStackable(false); // Auch EUPs für diese Berechnung ohne Doppelstock

    const currentEupQty = eupQuantity; // Behalte aktuelle EUP Anzahl

    // Simuliere, wie viele DINs zusätzlich zu den aktuellen EUPs passen
    const simResults = calculateLoadingLogic(
      selectedTruck,
      currentEupQty,
      MAX_PALLET_SIMULATION_QUANTITY, // Versuche viele DINs zu laden
      false, // isEUPStackable = false
      false, // isDINStackable = false
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern // EUP Pattern ist hier weniger relevant, aber für Konsistenz
    );
    setDinQuantity(simResults.loadedIndustrialPalletsBase); // Setze DIN Anzahl auf das Ergebnis
  };


  const renderPallet = (pallet, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) return null;
    const d = PALLET_TYPES[pallet.type];
    const w = pallet.height * displayScale; // Höhe der Palette in der Visualisierung ist Breite auf dem LKW
    const h = pallet.width * displayScale;  // Breite der Palette in der Visualisierung ist Länge auf dem LKW
    const x = pallet.y * displayScale;      // Y-Position der Palette ist X auf dem LKW
    const y = pallet.x * displayScale;      // X-Position der Palette ist Y auf dem LKW
    
    let txt = pallet.showAsFraction && pallet.displayStackedLabelId ? `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}` : `${pallet.labelId}`;
    if (pallet.labelId === 0) txt = "?"; // Fallback für nicht nummerierte

    let title = `${d.name} #${pallet.labelId}`;
    if (pallet.showAsFraction) title = `${d.name} (Stack: ${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId})`;
    if (pallet.isStackedTier === 'top') title += ' - Top';
    if (pallet.isStackedTier === 'base') title += ' - Base of Stack';
    
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
              
              {/* NEUER BUTTON für DIN */}
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
             
              {/* NEUER BUTTON für EUP */}
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

            {(eupQuantity > 0 || actualEupLoadingPattern !== 'auto' || eupLoadingPattern !== 'auto') && ( // Zeige Pattern Auswahl wenn EUPs > 0 ODER ein Pattern manuell gewählt wurde
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">EUP Lade-Pattern: <span className="text-xs text-gray-500">(Gewählt: {actualEupLoadingPattern})</span></label>
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
            <ul className="list-disc list-inside text-sm space-y-1 text-red-700">
              {warnings.length>0?warnings.map((w,i)=><li key={i}>{w}</li>):<li className="text-gray-500">Keine Probleme erkannt.</li>}
            </ul>
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
