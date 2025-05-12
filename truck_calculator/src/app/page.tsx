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

  const [loadedEuroPalletsBase, setLoadedEuroPalletsBase] = useState(0); // Base footprints
  const [loadedIndustrialPalletsBase, setLoadedIndustrialPalletsBase] = useState(0); // Base footprints
  const [totalEuroPalletsVisual, setTotalEuroPalletsVisual] = useState(0); // Includes stacked
  const [totalDinPalletsVisual, setTotalDinPalletsVisual] = useState(0); // Includes stacked
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [palletArrangement, setPalletArrangement] = useState([]);
  const [totalWeightKg, setTotalWeightKg] = useState(0);

  const currentTruckDef = TRUCK_TYPES[selectedTruck];

  // Auto-check stackable if quantity exceeds single layer capacity
  useEffect(() => {
    const currentTruck = TRUCK_TYPES[selectedTruck];
    let singleLayerEUPCapacity = 0;
    let singleLayerDINCapacity = 0;

    if (currentTruck.units.length > 1) {
        // Use per-unit capacity for multi-unit trucks if defined, otherwise estimate based on total
        singleLayerEUPCapacity = (currentTruck.singleLayerEUPCapacityLongPerUnit || currentTruck.singleLayerEUPCapacityLong || 0) * currentTruck.units.length;
        singleLayerDINCapacity = (currentTruck.singleLayerDINCapacityPerUnit || currentTruck.singleLayerDINCapacity || 0) * currentTruck.units.length;
    } else {
        // Use total capacity for single-unit trucks
        singleLayerEUPCapacity = currentTruck.singleLayerEUPCapacityLong || 0; // Default to long for check
        singleLayerDINCapacity = currentTruck.singleLayerDINCapacity || 0;
    }

    if (eupQuantity > 0 && singleLayerEUPCapacity > 0 && eupQuantity > singleLayerEUPCapacity && !isEUPStackable) {
      // Automatically check stackable if quantity exceeds capacity
      // Note: This check is basic and uses 'long' capacity. 'Broad' might differ.
      // Consider removing auto-check or making it smarter if needed.
      // setIsEUPStackable(true); // Temporarily disable auto-check for clarity
    }
    if (dinQuantity > 0 && singleLayerDINCapacity > 0 && dinQuantity > singleLayerDINCapacity && !isDINStackable) {
      // setIsDINStackable(true); // Temporarily disable auto-check for clarity
    }
  }, [eupQuantity, dinQuantity, selectedTruck, isEUPStackable, isDINStackable]);


  const calculateLoading = useCallback(() => {
    const initialTruckConfigMaster = JSON.parse(JSON.stringify(TRUCK_TYPES[selectedTruck]));
    let tempWarnings = [];
    let finalTotalEuroVisualPalletsPlaced = 0;
    let finalTotalDinVisualPalletsPlaced = 0;
    let finalActualPlacedEUPBase = 0;
    let finalActualPlacedDINBase = 0;
    let finalTotalAreaUsedByBasePallets = 0;
    let currentTotalWeightKg = 0;

    const eupPalletWeight = parseFloat(eupWeightPerPallet) || 0;
    const dinPalletWeight = parseFloat(dinWeightPerPallet) || 0;

    // Initialize state for each truck unit for calculations
    let unitsState = initialTruckConfigMaster.units.map(u => ({
        ...u,
        occupiedRects: [], // Tracks placed pallet footprints
        currentX: 0,       // Current position along the truck length
        currentY: 0,       // Current position across the truck width
        palletsVisual: [], // Array to store visual representation of pallets
        dinEndX: 0,        // X position after last DIN pallet placed in this unit
        dinEndY: 0,        // Y position after last DIN pallet placed in this unit
        dinLastRowIncomplete: false // Flag if the last DIN row had only one pallet
    }));

    // --- DIN PALLET PLACEMENT ---
    let dinPlacedCount = 0;
    if (dinQuantity > 0) {
        for (const unit of unitsState) {
            if (dinPlacedCount >= dinQuantity) break;

            while (unit.currentX < unit.length) {
                if (dinPlacedCount >= dinQuantity) break;

                let rowPalletsPlacedThisAttempt = 0;
                const dinPalletDef = PALLET_TYPES.industrial;
                const dinLengthAlongTruck = dinPalletDef.width; // 100cm
                const dinWidthAcrossTruck = dinPalletDef.length; // 120cm
                let maxHeightInRow = 0;
                unit.currentY = 0; // Reset Y for each new row attempt

                // Try placing two DIN pallets across the width
                for (let i = 0; i < 2; i++) {
                    if (dinPlacedCount >= dinQuantity) break;

                    // Check weight limit before placing base pallet
                    if (dinPalletWeight > 0 && currentTotalWeightKg + dinPalletWeight > MAX_GROSS_WEIGHT_KG) {
                        if (!tempWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
                            tempWarnings.push(`Weight limit reached for DIN pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                        }
                        unit.currentX = unit.length; // Mark unit as full due to weight
                        break; // Stop placing DINs in this unit
                    }

                    // Check space for the pallet
                    if (unit.currentX + dinLengthAlongTruck <= unit.length && unit.currentY + dinWidthAcrossTruck <= unit.width) {
                        const palletKeyBase = `din_base_${unit.id}_${finalActualPlacedDINBase}_${i}`;
                        unit.palletsVisual.push({
                            x: unit.currentX, y: unit.currentY, width: dinLengthAlongTruck, height: dinWidthAcrossTruck,
                            type: 'industrial', isStacked: false, key: palletKeyBase, unitId: unit.id,
                        });
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinLengthAlongTruck, height: dinWidthAcrossTruck });
                        finalTotalAreaUsedByBasePallets += dinPalletDef.area;
                        finalActualPlacedDINBase++;
                        finalTotalDinVisualPalletsPlaced++;
                        currentTotalWeightKg += dinPalletWeight;
                        dinPlacedCount++;
                        rowPalletsPlacedThisAttempt++;
                        maxHeightInRow = Math.max(maxHeightInRow, dinLengthAlongTruck);

                        // Handle Stacking for DIN
                        if (isDINStackable && dinPlacedCount < dinQuantity) {
                            // Check weight limit for stacked pallet
                            if (dinPalletWeight > 0 && currentTotalWeightKg + dinPalletWeight > MAX_GROSS_WEIGHT_KG) {
                                if (!tempWarnings.some(w => w.includes("Weight limit reached stacking DIN"))) {
                                    tempWarnings.push(`Weight limit reached. Cannot stack more DIN pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                                }
                                // Don't mark unit full, just stop stacking more DINs
                                // Allow EUPs to potentially be placed later
                            } else {
                                unit.palletsVisual.push({
                                    x: unit.currentX, y: unit.currentY, width: dinLengthAlongTruck, height: dinWidthAcrossTruck,
                                    type: 'industrial', isStacked: true, key: `din_stack_${unit.id}_${finalActualPlacedDINBase -1}_${i}`, unitId: unit.id,
                                });
                                finalTotalDinVisualPalletsPlaced++;
                                currentTotalWeightKg += dinPalletWeight;
                                dinPlacedCount++;
                            }
                        }
                        unit.currentY += dinWidthAcrossTruck; // Move Y for the next pallet in the row
                    } else {
                        break; // Cannot fit this pallet in the current width position
                    }
                } // End loop for placing 2 DINs across

                if (unit.currentX >= unit.length) break; // Break if unit marked full by weight

                // Update unit state after attempting to fill the row
                if (rowPalletsPlacedThisAttempt > 0) {
                    unit.currentX += maxHeightInRow; // Advance X by the length of the row just placed
                    unit.dinEndX = unit.currentX;    // Record X position after this row
                    unit.dinEndY = unit.currentY;    // Record Y position (will be 240 if full row, 120 if single)
                    unit.dinLastRowIncomplete = (rowPalletsPlacedThisAttempt === 1); // Check if only one was placed
                } else {
                    // Could not place any DIN pallet at this currentX, stop placing DINs in this unit
                    unit.currentX = unit.length;
                }
            } // End while loop for unit (DINs)
            if (unit.currentX >= unit.length && dinPlacedCount < dinQuantity && !tempWarnings.some(w => w.includes("Weight limit reached"))) {
                 // If unit filled by space before all DINs placed
                 // This warning might be redundant if the later check catches it
            }
        } // End loop through units for DINs
    } // End if (dinQuantity > 0)

    if (finalTotalDinVisualPalletsPlaced < dinQuantity && !tempWarnings.some(w => w.includes("Weight limit reached"))) {
        tempWarnings.push(`Could not fit all ${dinQuantity} Industrial pallets due to space. Only ${finalTotalDinVisualPalletsPlaced} (visual) placed.`);
    }

    // Store the state after DIN placement to reset for EUP pattern testing
    const initialUnitsStateAfterDIN = JSON.parse(JSON.stringify(unitsState));
    const weightAfterDINs = currentTotalWeightKg;

    // --- EUP PALLET PLACEMENT ---
    let bestOverallEUPPlacement = {
        unitsConfiguration: JSON.parse(JSON.stringify(initialUnitsStateAfterDIN)), // Start with DIN state
        totalVisualEUPs: 0,
        baseEUPs: 0,
        areaEUPs: 0,
        tempWarnings: [],
        currentWeightAfterEUPs: weightAfterDINs,
        chosenPattern: eupLoadingPattern === 'auto' ? 'none' : eupLoadingPattern, // Track best pattern
    };

    if (eupQuantity > 0) {
        const patternsToTry = eupLoadingPattern === 'auto' ? ['long', 'broad'] : [eupLoadingPattern];

        for (const pattern of patternsToTry) {
            // Reset state for this pattern trial
            let currentPatternUnitsState = JSON.parse(JSON.stringify(initialUnitsStateAfterDIN));
            let patternTotalEuroVisual = 0;
            let patternActualEUPBase = 0;
            let patternAreaUsedByEUPs = 0;
            let patternTempCurrentWeightKg = weightAfterDINs;
            let patternSpecificWarnings = [];
            let patternRemainingEupQ = eupQuantity;

            // --- GAP FILLING LOGIC ( intégré dans la boucle de pattern ) ---
            for (const unit of currentPatternUnitsState) {
                if (patternRemainingEupQ <= 0) break;

                if (unit.dinLastRowIncomplete) {
                    const gapX = unit.dinEndX - PALLET_TYPES.industrial.width; // X where the single DIN started
                    const gapY = PALLET_TYPES.industrial.length; // Gap starts after the DIN's width (120cm)
                    const gapWidth = unit.width - gapY; // Remaining width (125cm)
                    const gapLength = unit.length - gapX; // Remaining length from gap start
                    const dinLengthInGap = PALLET_TYPES.industrial.width; // The DIN occupies 100cm length here
                    const eupPalletDef = PALLET_TYPES.euro;
                    let placedInGap = false;
                    let eupLengthInGap = 0;
                    let palletVisualGap = null;

                    // Determine which EUP orientation to try based on the current pattern loop
                    // Try Broad first if pattern allows, as it fills width better (120cm)
                    if ((pattern === 'broad' || pattern === 'auto') && gapWidth >= eupPalletDef.length && gapLength >= eupPalletDef.width && patternRemainingEupQ > 0) {
                        // Try placing Broad (80L x 120W)
                        if (!(eupPalletWeight > 0 && patternTempCurrentWeightKg + eupPalletWeight > MAX_GROSS_WEIGHT_KG)) {
                            palletVisualGap = {
                                x: gapX, y: gapY, width: eupPalletDef.width, height: eupPalletDef.length, // 80L x 120W
                                type: 'euro', isStacked: false, key: `eup_gap_${unit.id}_${pattern}_broad`, unitId: unit.id,
                            };
                            placedInGap = true;
                            eupLengthInGap = eupPalletDef.width; // 80
                        } else { if (!patternSpecificWarnings.some(w=>w.includes("Weight limit for EUP gap"))) patternSpecificWarnings.push("Weight limit for EUP gap"); }
                    }

                    // Try Long if broad didn't fit/place and pattern allows
                    if (!placedInGap && (pattern === 'long' || pattern === 'auto') && gapWidth >= eupPalletDef.width && gapLength >= eupPalletDef.length && patternRemainingEupQ > 0) {
                        // Try placing Long (120L x 80W)
                         if (!(eupPalletWeight > 0 && patternTempCurrentWeightKg + eupPalletWeight > MAX_GROSS_WEIGHT_KG)) {
                            palletVisualGap = {
                                x: gapX, y: gapY, width: eupPalletDef.length, height: eupPalletDef.width, // 120L x 80W
                                type: 'euro', isStacked: false, key: `eup_gap_${unit.id}_${pattern}_long`, unitId: unit.id,
                            };
                            placedInGap = true;
                            eupLengthInGap = eupPalletDef.length; // 120
                         } else { if (!patternSpecificWarnings.some(w=>w.includes("Weight limit for EUP gap"))) patternSpecificWarnings.push("Weight limit for EUP gap"); }
                    }

                    // If an EUP was placed in the gap, update counts and unit state
                    if (placedInGap && palletVisualGap) {
                        unit.palletsVisual.push(palletVisualGap);
                        unit.occupiedRects.push({ x: palletVisualGap.x, y: palletVisualGap.y, width: palletVisualGap.width, height: palletVisualGap.height });
                        patternAreaUsedByEUPs += eupPalletDef.area;
                        patternActualEUPBase++;
                        patternTotalEuroVisual++;
                        patternTempCurrentWeightKg += eupPalletWeight;
                        patternRemainingEupQ--;

                        // Handle stacking for gap pallet
                        if (isEUPStackable && patternRemainingEupQ > 0) {
                            if (!(eupPalletWeight > 0 && patternTempCurrentWeightKg + eupPalletWeight > MAX_GROSS_WEIGHT_KG)) {
                                unit.palletsVisual.push({ ...palletVisualGap, isStacked: true, key: palletVisualGap.key.replace('gap', 'gap_stack') });
                                patternTotalEuroVisual++;
                                patternTempCurrentWeightKg += eupPalletWeight;
                                patternRemainingEupQ--;
                            } else { if (!patternSpecificWarnings.some(w=>w.includes("Weight limit stacking EUP gap"))) patternSpecificWarnings.push("Weight limit stacking EUP gap"); }
                        }
                        // Update starting X for the main EUP loop *for this unit*
                        unit.currentX = gapX + Math.max(dinLengthInGap, eupLengthInGap);
                    } else {
                        // No EUP fit in gap, start after the single DIN
                        unit.currentX = unit.dinEndX;
                    }
                    unit.currentY = 0; // Reset Y for next row

                } else {
                    // No gap, start EUPs normally after the last DIN
                    unit.currentX = unit.dinEndX;
                    unit.currentY = 0;
                }
            } // End gap filling loop for this pattern

            // --- MAIN EUP PLACEMENT LOOP (using current pattern) ---
            for (const unit of currentPatternUnitsState) {
                if (patternRemainingEupQ <= 0) break;

                while (unit.currentX < unit.length) {
                    if (patternRemainingEupQ <= 0) break;

                    let rowPalletsPlacedThisAttempt = 0;
                    const eupPalletDef = PALLET_TYPES.euro;
                    // Determine pallet dimensions based on the current pattern
                    const palletsPerRow = pattern === 'long' ? 3 : 2;
                    const palletLengthForVisual = pattern === 'long' ? eupPalletDef.length : eupPalletDef.width; // Length along truck X
                    const palletWidthForVisual = pattern === 'long' ? eupPalletDef.width : eupPalletDef.length; // Width across truck Y
                    let maxHeightInRow = 0;
                    unit.currentY = 0; // Reset Y for each new row attempt

                    for (let i = 0; i < palletsPerRow; i++) {
                        if (patternRemainingEupQ <= 0) break;

                        // Check weight limit
                        if (eupPalletWeight > 0 && patternTempCurrentWeightKg + eupPalletWeight > MAX_GROSS_WEIGHT_KG) {
                            if (!patternSpecificWarnings.some(w => w.includes("Weight limit reached for EUP"))) {
                                patternSpecificWarnings.push(`Weight limit reached for EUP pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                            }
                            unit.currentX = unit.length; // Mark unit full due to weight
                            break;
                        }

                        // Check space
                        if (unit.currentX + palletLengthForVisual <= unit.length && unit.currentY + palletWidthForVisual <= unit.width) {
                            const palletKeyBase = `eup_base_${unit.id}_${patternActualEUPBase}_${pattern}_${i}`;
                            unit.palletsVisual.push({
                                x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual,
                                type: 'euro', isStacked: false, key: palletKeyBase, unitId: unit.id,
                            });
                            unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual });
                            patternAreaUsedByEUPs += eupPalletDef.area;
                            patternActualEUPBase++;
                            patternTotalEuroVisual++;
                            patternTempCurrentWeightKg += eupPalletWeight;
                            patternRemainingEupQ--;
                            rowPalletsPlacedThisAttempt++;
                            maxHeightInRow = Math.max(maxHeightInRow, palletLengthForVisual);

                            // Handle Stacking
                            if (isEUPStackable && patternRemainingEupQ > 0) {
                                if (!(eupPalletWeight > 0 && patternTempCurrentWeightKg + eupPalletWeight > MAX_GROSS_WEIGHT_KG)) {
                                    unit.palletsVisual.push({
                                        x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual,
                                        type: 'euro', isStacked: true, key: `eup_stack_${unit.id}_${patternActualEUPBase - 1}_${pattern}_${i}`, unitId: unit.id,
                                    });
                                    patternTotalEuroVisual++;
                                    patternTempCurrentWeightKg += eupPalletWeight;
                                    patternRemainingEupQ--;
                                } else { if (!patternSpecificWarnings.some(w=>w.includes("Weight limit stacking EUP"))) patternSpecificWarnings.push("Weight limit stacking EUP"); }
                            }
                             unit.currentY += palletWidthForVisual; // Move Y for next pallet
                        } else {
                            break; // Cannot fit this pallet in width
                        }
                    } // End loop for placing pallets across width

                    if (unit.currentX >= unit.length) break; // Break if unit marked full by weight

                    if (rowPalletsPlacedThisAttempt > 0) {
                        unit.currentX += maxHeightInRow; // Advance X
                    } else {
                        // Cannot place any more EUPs in this pattern/unit
                        unit.currentX = unit.length;
                    }
                } // End while loop for unit (EUPs)
            } // End main EUP loop for this pattern

            // --- Compare results for this pattern ---
            // Prioritize placing more pallets. If equal, maybe prioritize less area? (Tighter pack)
            // Or prioritize the user's chosen pattern if not 'auto'.
            const isBetter = (
                patternTotalEuroVisual > bestOverallEUPPlacement.totalVisualEUPs ||
                (patternTotalEuroVisual === bestOverallEUPPlacement.totalVisualEUPs && patternAreaUsedByEUPs < bestOverallEUPPlacement.areaEUPs) ||
                (eupLoadingPattern !== 'auto' && pattern === eupLoadingPattern && bestOverallEUPPlacement.chosenPattern !== pattern) // Prefer user choice if counts are equal
            );

            if (isBetter) {
                bestOverallEUPPlacement = {
                    unitsConfiguration: JSON.parse(JSON.stringify(currentPatternUnitsState)),
                    totalVisualEUPs: patternTotalEuroVisual,
                    baseEUPs: patternActualEUPBase,
                    areaEUPs: patternAreaUsedByEUPs,
                    tempWarnings: patternSpecificWarnings,
                    currentWeightAfterEUPs: patternTempCurrentWeightKg,
                    chosenPattern: pattern // Record the pattern used for this best result
                };
            } else if (patternTotalEuroVisual === bestOverallEUPPlacement.totalVisualEUPs && bestOverallEUPPlacement.chosenPattern === 'none') {
                 // If auto resulted in a tie, just pick the first one tried (long)
                 bestOverallEUPPlacement.chosenPattern = pattern;
            }


        } // End patternsToTry loop

        // --- Finalize EUP Placement ---
        finalPalletArrangement = bestOverallEUPPlacement.unitsConfiguration.map(unit => ({
            unitId: unit.id, unitLength: unit.length, unitWidth: unit.width, pallets: unit.palletsVisual
        }));
        finalActualPlacedEUPBase = bestOverallEUPPlacement.baseEUPs;
        finalTotalEuroVisualPalletsPlaced = bestOverallEUPPlacement.totalVisualEUPs;
        finalTotalAreaUsedByBasePallets += bestOverallEUPPlacement.areaEUPs;
        currentTotalWeightKg = bestOverallEUPPlacement.currentWeightAfterEUPs;
        tempWarnings.push(...bestOverallEUPPlacement.tempWarnings.filter(w => !tempWarnings.includes(w)));

        if (finalTotalEuroVisualPalletsPlaced < eupQuantity && !tempWarnings.some(w => w.includes("Weight limit reached for EUP"))) {
            tempWarnings.push(`Could not fit all ${eupQuantity} Euro pallets due to space. Only ${finalTotalEuroVisualPalletsPlaced} (visual) placed.`);
        }

    } else { // No EUPs requested
        finalPalletArrangement = initialUnitsStateAfterDIN.map(unit => ({
            unitId: unit.id, unitLength: unit.length, unitWidth: unit.width, pallets: unit.palletsVisual
        }));
        // Use counts and weight only from DIN placement
        finalActualPlacedEUPBase = 0;
        finalTotalEuroVisualPalletsPlaced = 0;
        // finalTotalAreaUsedByBasePallets already calculated during DIN phase
        currentTotalWeightKg = weightAfterDINs;
    }

    // --- Final Calculations & State Updates ---
    setPalletArrangement(finalPalletArrangement);
    setLoadedEuroPalletsBase(finalActualPlacedEUPBase);
    setLoadedIndustrialPalletsBase(finalActualPlacedDINBase);
    setTotalEuroPalletsVisual(finalTotalEuroVisualPalletsPlaced);
    setTotalDinPalletsVisual(finalTotalDinVisualPalletsPlaced);
    setTotalWeightKg(currentTotalWeightKg);

    // Utilization Calculation (Simplified: based on area for mixed loads)
    const totalTruckArea = initialTruckConfigMaster.units.reduce((sum, u) => sum + (u.length * u.width), 0);
    let newUtilizationPercentage = totalTruckArea > 0 ? (finalTotalAreaUsedByBasePallets / totalTruckArea) * 100 : 0;
    setUtilizationPercentage(parseFloat(newUtilizationPercentage.toFixed(1)));

    // Final Warnings
    const totalActualLoadedBasePallets = finalActualPlacedEUPBase + finalActualPlacedDINBase;
    if (eupPalletWeight > 0 || dinPalletWeight > 0) {
        if (currentTotalWeightKg > MAX_GROSS_WEIGHT_KG && !tempWarnings.some(w => w.includes("Gross vehicle weight"))) {
            tempWarnings.push(`Potential gross vehicle weight overload (${(currentTotalWeightKg / 1000).toFixed(1)}t > ${(MAX_GROSS_WEIGHT_KG / 1000)}t).`);
        }
        // Basic Axle Load Check Placeholder (very simplified)
        if (totalActualLoadedBasePallets > 0 && currentTotalWeightKg > 0 && (currentTotalWeightKg / totalActualLoadedBasePallets) > 1500) { // Avg > 1.5t per footprint
             if (!tempWarnings.some(w => w.includes("axle load"))) {
                tempWarnings.push('High average weight per pallet footprint. Check axle load distribution.');
             }
        }
    }

    const allEUPRequestedPlaced = finalTotalEuroVisualPalletsPlaced >= eupQuantity;
    const allDINRequestedPlaced = finalTotalDinVisualPalletsPlaced >= dinQuantity;

    if (tempWarnings.length === 0 && (eupQuantity > 0 || dinQuantity > 0) && allEUPRequestedPlaced && allDINRequestedPlaced) {
      tempWarnings.push('All requested pallets placed successfully.');
    } else if (tempWarnings.length === 0 && eupQuantity === 0 && dinQuantity === 0) {
      tempWarnings.push('No pallets requested.');
    }
    setWarnings(Array.from(new Set(tempWarnings))); // Remove duplicates

  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern]);

  useEffect(() => {
    calculateLoading();
  }, [calculateLoading]);

  // --- Event Handlers ---
  const handleQuantityChange = (type, amount) => {
    if (type === 'eup') {
      setEupQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    } else if (type === 'din') {
      setDinQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    }
  };

  // --- Rendering Functions ---
  const renderPallet = (pallet, displayScale = 0.3) => { // Increased scale slightly
    const palletDetails = PALLET_TYPES[pallet.type];
    // IMPORTANT: Visual dimensions are swapped vs internal logic
    // Internal: width = dimension along truck X, height = dimension across truck Y
    // Visual: width = dimension across truck Y (scaled), height = dimension along truck X (scaled)
    const displayWidth = pallet.height * displayScale;
    const displayHeight = pallet.width * displayScale;
    const displayX = pallet.y * displayScale; // Visual X corresponds to internal Y
    const displayY = pallet.x * displayScale; // Visual Y corresponds to internal X

    return (
      <div
        key={pallet.key}
        className={`absolute ${palletDetails.color} ${palletDetails.borderColor} border flex items-center justify-center rounded-sm shadow-sm`} // Added rounded/shadow
        style={{
          left: `${displayX}px`,
          top: `${displayY}px`,
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          opacity: pallet.isStacked ? 0.7 : 1, // Slightly more transparent stack
          zIndex: pallet.isStacked ? 10 : 5,
          fontSize: '10px', // Smaller text
        }}
        title={`${palletDetails.name}${pallet.isStacked ? ' (Stacked)' : ''}`} // Tooltip
      >
        <span className="text-black font-semibold select-none">{palletDetails.label}</span>
        {/* Stacked indicator (optional subtle line) */}
        {pallet.isStacked && (
          <div className="absolute top-0 left-0 w-full h-full border-t-2 border-black opacity-30 pointer-events-none"></div>
        )}
      </div>
    );
  };

  const truckVisualizationScale = 0.3; // Scale factor for visualization

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
            {currentTruckDef.units.map((unit, index) => (
              <div key={unit.id} className="mb-4 last:mb-0 w-full flex flex-col items-center">
                {currentTruckDef.units.length > 1 && <p className="text-sm text-center font-medium text-gray-700 mb-1">Unit {index + 1} ({unit.length/100}m x {unit.width/100}m)</p>}
                <div
                  id={`truckVisualization-${unit.id}`}
                  className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner" // Added rounded/shadow
                  style={{
                    // Visual Width = Truck Width, Visual Height = Truck Length
                    width: `${unit.width * truckVisualizationScale}px`,
                    height: `${unit.length * truckVisualizationScale}px`,
                  }}
                >
                  {/* Render unusable space for Curtain Sider */}
                  {selectedTruck === 'curtainSider' && currentTruckDef.trueLength && currentTruckDef.usableLength < currentTruckDef.trueLength && (
                    <>
                      {/* Shaded area at the 'back' (top of visual) */}
                       <div className="absolute top-0 left-0 w-full bg-red-300 opacity-30 pointer-events-none"
                            style={{ height: `${((currentTruckDef.trueLength - currentTruckDef.usableLength)) * truckVisualizationScale}px` }}
                            title={`Unusable Space: ${(currentTruckDef.trueLength - currentTruckDef.usableLength)/100}m`}
                       />
                       {/* Text indicating usable length - Adjusted position */}
                       <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[8px] text-red-800 bg-white px-1 py-0.5 rounded opacity-80 pointer-events-none whitespace-nowrap">
                           Usable: {currentTruckDef.usableLength/100}m
                       </div>
                    </>
                  )}
                  {/* Render Pallets */}
                  {palletArrangement.find(pa => pa.unitId === unit.id)?.pallets.map(p => renderPallet(p, truckVisualizationScale))}
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

        {/* Side View Visualization (Conceptual) - Only show if stacking is enabled and pallets loaded */}
        {((isEUPStackable && totalEuroPalletsVisual > loadedEuroPalletsBase) || (isDINStackable && totalDinPalletsVisual > loadedIndustrialPalletsBase)) && (loadedIndustrialPalletsBase > 0 || loadedEuroPalletsBase > 0) && (
          <div className="mb-8 bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-center items-center">
              <p className="text-gray-600 text-md mb-3 font-semibold">Side View (Conceptual)</p>
              <div id="sideViewVisualization" className="w-full h-auto bg-gray-200 rounded flex justify-center items-end p-4 min-h-[100px] space-x-2">
                  {/* Show conceptual stacks: DIN first, then EUP */}
                  {Array.from({ length: loadedIndustrialPalletsBase }).slice(0, 3).map((_, idx) => { // Show up to 3 DIN base
                      const palletDetails = PALLET_TYPES.industrial;
                      const showStacked = isDINStackable && totalDinPalletsVisual > loadedIndustrialPalletsBase; // Check if any DINs are actually stacked
                      return (
                          <div key={`sideview-din-${idx}`} className="flex flex-col items-center" title="Industrial Pallet (Side View)">
                              {showStacked && <div className={`w-10 h-8 ${palletDetails.color} border ${palletDetails.borderColor} opacity-60 flex justify-center items-center text-xs font-bold rounded-t-sm`}>{palletDetails.label}</div>}
                              <div className={`w-10 h-8 ${palletDetails.color} border ${palletDetails.borderColor} ${showStacked ? 'border-t-0 rounded-b-sm' : 'rounded-sm'} flex justify-center items-center text-xs font-bold`}>{palletDetails.label}</div>
                          </div>
                      );
                  })}
                   {Array.from({ length: loadedEuroPalletsBase }).slice(0, 3).map((_, idx) => { // Show up to 3 EUP base
                      const palletDetails = PALLET_TYPES.euro;
                      const showStacked = isEUPStackable && totalEuroPalletsVisual > loadedEuroPalletsBase; // Check if any EUPs are actually stacked
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
         {/* Add your name or attribution if desired */}
         <p>Original concept by Andreas Steiner</p>
      </footer>
    </div>
  );
}
