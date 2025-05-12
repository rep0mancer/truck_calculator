"use client";

import React, { useState, useEffect, useCallback } from 'react';

// Constants for truck types, including single-layer capacities
const TRUCK_TYPES = {
  roadTrain: {
    name: 'Road Train (2x 7m)',
    units: [
      // Corrected length for Road Train units to 7m as originally stated
      { id: 'unit1', length: 700, width: 245, occupiedRects: [] },
      { id: 'unit2', length: 700, width: 245, occupiedRects: [] },
    ],
    totalLength: 1400, // Corrected total length
    usableLength: 1400, // Corrected usable length
    maxWidth: 245,
    singleLayerEUPCapacityLongPerUnit: 15, // (700/120)*3 = 5*3 = 15
    singleLayerEUPCapacityBroadPerUnit: 16, // floor(700/80)*2 = 8*2 = 16
    singleLayerDINCapacityPerUnit: 14,   // (700/100)*2 = 7*2 = 14
  },
  curtainSider: {
    name: 'Curtain-Sider Semi-trailer (13.2m)',
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
    name: 'Small Truck (7.2m)', 
    units: [{ id: 'main', length: 720, width: 245, occupiedRects: [] }], 
    totalLength: 720, 
    usableLength: 720, 
    maxWidth: 245,
    singleLayerEUPCapacityLong: 18, 
    singleLayerEUPCapacityBroad: 18, 
    singleLayerDINCapacity: 14,  
  },
};

// Constants for pallet types
const PALLET_TYPES = {
  euro: { name: 'Euro Pallet (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700', label: 'E' },
  industrial: { name: 'Industrial Pallet (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700', label: 'I' },
};

// Maximum gross weight for the truck
const MAX_GROSS_WEIGHT_KG = 40000;

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState('auto');
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);
  
  const [eupWeightPerPallet, setEupWeightPerPallet] = useState('');
  const [dinWeightPerPallet, setDinWeightPerPallet] = useState('');

  const [loadedEuroPallets, setLoadedEuroPallets] = useState(0);
  const [loadedIndustrialPallets, setLoadedIndustrialPallets] = useState(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [palletArrangement, setPalletArrangement] = useState([]);

  const currentTruckDef = TRUCK_TYPES[selectedTruck];

  useEffect(() => {
    const currentTruck = TRUCK_TYPES[selectedTruck];
    let singleLayerEUPCapacity = 0;
    let singleLayerDINCapacity = 0;

    if (currentTruck.units.length > 1) {
        singleLayerEUPCapacity = (currentTruck.singleLayerEUPCapacityLongPerUnit || 0) * currentTruck.units.length;
        singleLayerDINCapacity = (currentTruck.singleLayerDINCapacityPerUnit || 0) * currentTruck.units.length;
    } else {
        singleLayerEUPCapacity = currentTruck.singleLayerEUPCapacityLong || 0;
        singleLayerDINCapacity = currentTruck.singleLayerDINCapacity || 0;
    }

    if (eupQuantity > 0 && singleLayerEUPCapacity > 0 && eupQuantity > singleLayerEUPCapacity && !isEUPStackable) {
      setIsEUPStackable(true);
    }
    if (dinQuantity > 0 && singleLayerDINCapacity > 0 && dinQuantity > singleLayerDINCapacity && !isDINStackable) {
      setIsDINStackable(true);
    }
  }, [eupQuantity, dinQuantity, selectedTruck, isEUPStackable, isDINStackable]);


  const calculateLoading = useCallback(() => {
    const initialTruckConfigFull = JSON.parse(JSON.stringify(TRUCK_TYPES[selectedTruck]));
    let finalPalletArrangement = [];
    let finalWarnings = [];
    let finalActualPlacedEUPBase = 0;
    let finalActualPlacedDINBase = 0;
    let finalTotalAreaUsedByBasePallets = 0;
    let finalTotalEuroVisualPalletsPlaced = 0;
    let finalTotalDinVisualPalletsPlaced = 0;
    let currentTotalWeightKg = 0;

    const eupPalletWeight = parseFloat(eupWeightPerPallet) || 0;
    const dinPalletWeight = parseFloat(dinWeightPerPallet) || 0;

    // Create a working copy of units for DIN placement
    let unitsStateForDin = initialTruckConfigFull.units.map(u => ({
        ...u,
        occupiedRects: [],
        currentX: 0,
        currentY: 0,
        palletsVisual: [],
    }));

    if (dinQuantity > 0) {
        for (const unit of unitsStateForDin) {
            if (finalTotalDinVisualPalletsPlaced >= dinQuantity) break; 

            while (true) { // Loop for rows in the unit
                if (finalTotalDinVisualPalletsPlaced >= dinQuantity) break;
                
                let rowPallets = 0;
                const dinPalletDef = PALLET_TYPES.industrial;
                const dinDimensionAlongTruckLength = dinPalletDef.width;
                const dinDimensionAcrossTruckWidth = dinPalletDef.length;
                let rowHeight = 0; // Max length of pallets in this row
                const originalUnitYForRowAttempt = unit.currentY; // Y at the start of trying to fill this row

                for (let i = 0; i < 2; i++) { // Try to place 2 DINs across
                    if (finalTotalDinVisualPalletsPlaced >= dinQuantity) break;

                    if (dinPalletWeight > 0 && currentTotalWeightKg + dinPalletWeight > MAX_GROSS_WEIGHT_KG) {
                        if (!finalWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
                             finalWarnings.push(`Weight limit reached for DIN pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                        }
                        break; 
                    }

                    if (unit.currentX + dinDimensionAlongTruckLength <= unit.length && unit.currentY + dinDimensionAcrossTruckWidth <= unit.width) {
                        unit.palletsVisual.push({
                            x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth,
                            type: 'industrial', isStacked: false, key: `din_base_${unit.id}_${finalActualPlacedDINBase}`, unitId: unit.id,
                        });
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth });
                        finalTotalAreaUsedByBasePallets += dinPalletDef.area;
                        finalActualPlacedDINBase++;
                        finalTotalDinVisualPalletsPlaced++;
                        currentTotalWeightKg += dinPalletWeight;
                        rowPallets++;
                        rowHeight = Math.max(rowHeight, dinDimensionAlongTruckLength);
                        
                        if (isDINStackable && finalTotalDinVisualPalletsPlaced < dinQuantity) {
                            if (dinPalletWeight > 0 && currentTotalWeightKg + dinPalletWeight > MAX_GROSS_WEIGHT_KG) {
                                if (!finalWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
                                    finalWarnings.push(`Weight limit reached. Cannot stack more DIN pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                                }
                                break; 
                            }
                            unit.palletsVisual.push({
                                x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth,
                                type: 'industrial', isStacked: true, key: `din_stack_${unit.id}_${finalActualPlacedDINBase -1}`, unitId: unit.id,
                            });
                            finalTotalDinVisualPalletsPlaced++;
                            currentTotalWeightKg += dinPalletWeight;
                        }
                        unit.currentY += dinDimensionAcrossTruckWidth;
                    } else { break; } 
                } 
                if (finalWarnings.some(w => w.includes("Weight limit reached for DIN"))) break; 

                if (rowPallets === 0) { // No DINs could be placed in this attempt
                    if (originalUnitYForRowAttempt === 0) { // If we couldn't even start a new row at Y=0
                        unit.currentX = unit.length; // Mark this X as full for this unit
                    }
                    // If originalUnitYForRowAttempt > 0, it means we were trying to fill a gap but couldn't.
                    // unit.currentY remains where the last DIN was placed (or where it started if none fit).
                    // unit.currentX is not advanced by rowHeight here. EUPs will try this spot.
                    break; // Exit while loop for this unit (DINs)
                }
                
                // If DINs were placed in this row attempt:
                // If the row is considered "complete" for DINs (e.g., filled width or tried to place 2)
                // then advance X and reset Y for the *next* potential DIN row.
                // Otherwise, currentY holds the end of the last placed DIN, and X is the current row's X.
                // This state (currentX, currentY > 0) should be passed to EUP placement for gap filling.
                if (unit.currentY >= unit.width) { // Row is full width-wise
                     unit.currentX += rowHeight; 
                     unit.currentY = 0;          
                }
                // If unit.currentY < unit.width, it means the row is partial.
                // currentX is NOT advanced yet by rowHeight, currentY is where the next pallet would go.
                // EUPs will get a chance at (unit.currentX, unit.currentY).

                if (unit.currentX >= unit.length) break; 
            } 
             if (finalWarnings.some(w => w.includes("Weight limit reached for DIN"))) break; 
        } 
    }
    if (finalTotalDinVisualPalletsPlaced < dinQuantity && !finalWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
        finalWarnings.push(`Could not fit all ${dinQuantity} Industrial pallets due to space. Only ${finalTotalDinVisualPalletsPlaced} (visual) placed.`);
    }

    // --- EUP PALLET PLACEMENT ---
    let unitsStateForEUP = JSON.parse(JSON.stringify(unitsStateForDin)); // Start EUP placement from where DINs left off in each unit

    if (eupQuantity > 0) {
        const patternsToTry = eupLoadingPattern === 'auto' ? ['long', 'broad'] : [eupLoadingPattern];
        let bestOverallEUPPlacement = { units: JSON.parse(JSON.stringify(unitsStateForDin)), totalVisual: finalTotalEuroVisualPalletsPlaced, base: finalActualPlacedEUPBase, area: finalTotalAreaUsedByBasePallets, tempWarnings: [] };


        for (const pattern of patternsToTry) {
            let currentPatternUnitsState = JSON.parse(JSON.stringify(unitsStateForDin)); // Fresh copy of DIN state for each pattern
            let patternTotalEuroVisual = 0;
            let patternActualEUPBase = 0;
            let patternTotalAreaUsed = finalTotalAreaUsedByBasePallets; // Start with area used by DINs
            let patternTempCurrentWeightKg = currentTotalWeightKg; // Start with weight from DINs
            let patternSpecificWarnings = [];

            for (const unit of currentPatternUnitsState) {
                if (patternTotalEuroVisual >= eupQuantity) break;

                while (true) { // Loop for rows in the unit for EUPs
                    if (patternTotalEuroVisual >= eupQuantity) break;
                    
                    let rowPallets = 0;
                    const eupPalletDef = PALLET_TYPES.euro;
                    const palletsPerRow = pattern === 'long' ? 3 : 2;
                    const palletWidthForVisual = pattern === 'long' ? eupPalletDef.width : eupPalletDef.length;
                    const palletLengthForVisual = pattern === 'long' ? eupPalletDef.length : eupPalletDef.width;
                    let rowHeight = 0;
                    const originalUnitYForRowAttempt = unit.currentY;

                    for (let i = 0; i < palletsPerRow; i++) {
                        if (patternTotalEuroVisual >= eupQuantity) break;

                        if (eupPalletWeight > 0 && patternTempCurrentWeightKg + eupPalletWeight > MAX_GROSS_WEIGHT_KG) {
                             if (!patternSpecificWarnings.some(w => w.includes("Weight limit reached for EUP"))) {
                                patternSpecificWarnings.push(`Weight limit reached for EUP pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                             }
                            break; 
                        }

                        if (unit.currentX + palletLengthForVisual <= unit.length && unit.currentY + palletWidthForVisual <= unit.width) {
                            unit.palletsVisual.push({
                                x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual,
                                type: 'euro', isStacked: false, key: `eup_base_${unit.id}_${patternActualEUPBase}_${pattern}`, unitId: unit.id,
                            });
                            unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual });
                            patternTotalAreaUsed += eupPalletDef.area;
                            patternActualEUPBase++;
                            patternTotalEuroVisual++;
                            patternTempCurrentWeightKg += eupPalletWeight;
                            rowPallets++;
                            rowHeight = Math.max(rowHeight, palletLengthForVisual);
                            
                            if (isEUPStackable && patternTotalEuroVisual < eupQuantity) {
                               if (eupPalletWeight > 0 && patternTempCurrentWeightKg + eupPalletWeight > MAX_GROSS_WEIGHT_KG) {
                                   if (!patternSpecificWarnings.some(w => w.includes("Weight limit reached for EUP"))) {
                                       patternSpecificWarnings.push(`Weight limit reached. Cannot stack more EUP pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                                   }
                                   break;
                               }
                               unit.palletsVisual.push({
                                    x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual,
                                    type: 'euro', isStacked: true, key: `eup_stack_${unit.id}_${patternActualEUPBase - 1}_${pattern}`, unitId: unit.id,
                                });
                                patternTotalEuroVisual++;
                                patternTempCurrentWeightKg += eupPalletWeight;
                            }
                            unit.currentY += palletWidthForVisual;
                        } else { break; }
                    } 
                    if (patternSpecificWarnings.some(w => w.includes("Weight limit reached for EUP"))) break;

                    if (rowPallets === 0) {
                        if (originalUnitYForRowAttempt === 0) {
                            unit.currentX = unit.length;
                        }
                        // If originalUnitYForRowAttempt > 0 and no EUP fit, the gap was too small.
                        // The unit.currentX remains, unit.currentY remains. The while loop breaks.
                        // This X,Y will be the starting point if this unit is revisited by another logic (e.g. next truck unit).
                        // For now, we break, meaning this unit is done for EUPs for this pattern attempt.
                        // A more advanced algorithm might try to advance X past the previous DIN row.
                        unit.currentY = 0; // Reset Y for next X row if we didn't fill the gap.
                        break; 
                    }
                    
                    if (unit.currentY >= unit.width) { // Row filled width-wise
                        unit.currentX += rowHeight; 
                        unit.currentY = 0;          
                    }
                    // If row partial, currentY is where next EUP in this row would go, X is this row's X.
                    // This state is fine for the next iteration of the while loop to try and complete the row.

                    if (unit.currentX >= unit.length) break;
                } 
                if (patternSpecificWarnings.some(w => w.includes("Weight limit reached for EUP"))) break; 
            } 

            if (patternTotalEuroVisual > bestOverallEUPPlacement.totalVisual) {
                bestOverallEUPPlacement = { 
                    units: JSON.parse(JSON.stringify(currentPatternUnitsState)), 
                    totalVisual: patternTotalEuroVisual, 
                    base: patternActualEUPBase,
                    area: patternTotalAreaUsed - finalTotalAreaUsedByBasePallets, // Area of EUPs only for this pattern
                    tempWarnings: patternSpecificWarnings 
                };
            } else if (patternTotalEuroVisual === bestOverallEUPPlacement.totalVisual && (patternTotalAreaUsed - finalTotalAreaUsedByBasePallets) < bestOverallEUPPlacement.area) {
                bestOverallEUPPlacement = { 
                    units: JSON.parse(JSON.stringify(currentPatternUnitsState)), 
                    totalVisual: patternTotalEuroVisual, 
                    base: patternActualEUPBase,
                    area: patternTotalAreaUsed - finalTotalAreaUsedByBasePallets,
                    tempWarnings: patternSpecificWarnings
                };
            }
        } 

        // Consolidate the best EUP placement with the DIN placement
        finalPalletArrangement = bestOverallEUPPlacement.units.map(unit => ({
            unitId: unit.id,
            unitLength: unit.length,
            unitWidth: unit.width,
            pallets: unit.palletsVisual // This now contains both DINs and the best EUPs
        }));
        finalActualPlacedEUPBase = bestOverallEUPPlacement.base;
        finalTotalEuroVisualPalletsPlaced = bestOverallEUPPlacement.totalVisual;
        finalTotalAreaUsedByBasePallets += bestOverallEUPPlacement.area; // Add area of best EUPs
        currentTotalWeightKg = currentTotalWeightKg - (finalTotalDinVisualPalletsPlaced * dinPalletWeight) + (finalTotalDinVisualPalletsPlaced * dinPalletWeight) + (finalTotalEuroVisualPalletsPlaced * eupPalletWeight); // Update total weight
        finalWarnings.push(...bestOverallEUPPlacement.tempWarnings.filter(w => !finalWarnings.includes(w)));
        
        if (finalTotalEuroVisualPalletsPlaced < eupQuantity && !finalWarnings.some(w => w.includes("Weight limit reached for EUP"))) {
            finalWarnings.push(`Could not fit all ${eupQuantity} Euro pallets due to space. Only ${finalTotalEuroVisualPalletsPlaced} (visual) placed.`);
        }

    } else { // No EUPs requested, final arrangement is just DINs
        finalPalletArrangement = unitsStateForDin.map(unit => ({
            unitId: unit.id, unitLength: unit.length, unitWidth: unit.width, pallets: unit.palletsVisual
        }));
    }
    
    setPalletArrangement(finalPalletArrangement);
    setLoadedEuroPallets(finalActualPlacedEUPBase);
    setLoadedIndustrialPallets(finalActualPlacedDINBase);

    // Utilization Calculation
    const totalTruckArea = initialTruckConfigFull.units.reduce((sum, u) => sum + (u.length * u.width), 0);
    let newUtilizationPercentage = 0;
    const currentTruckInfo = TRUCK_TYPES[selectedTruck];
    let numUnits = currentTruckInfo.units.length;

    let singleTypeBaseCapacity = 0;
    let relevantTotalVisualPlaced = 0;
    let relevantStackableState = false;
    let chosenEupPatternForCapacity = eupLoadingPattern === 'auto' ? 'long' : eupLoadingPattern; // Default to long for auto for capacity calc
    
    // If auto, we need to determine which pattern was chosen by bestOverallEUPPlacement to use correct capacity
    // This is complex as bestOverallEUPPlacement.arrangement doesn't directly store the pattern name.
    // For now, if 'auto', we might use an average or the 'long' capacity for % calc, or make it more sophisticated later.


    if (eupQuantity > 0 && dinQuantity === 0) { 
        let eupCap = currentTruckInfo.singleLayerEUPCapacityLong; // Default
        if (numUnits > 1) eupCap = (currentTruckInfo.singleLayerEUPCapacityLongPerUnit || 0) * numUnits;
        
        if (eupLoadingPattern === 'broad') {
            eupCap = currentTruckInfo.singleLayerEUPCapacityBroad;
            if (numUnits > 1) eupCap = (currentTruckInfo.singleLayerEUPCapacityBroadPerUnit || 0) * numUnits;
        } else if (eupLoadingPattern === 'auto') {
            // If auto, we ideally need to know which pattern was chosen.
            // For simplicity in this iteration, we'll use the 'long' capacity as a base for auto.
            // A more accurate way would be to derive the pattern from bestOverallEUPPlacement if possible.
             eupCap = (currentTruckInfo.singleLayerEUPCapacityLongPerUnit && numUnits > 1 ? currentTruckInfo.singleLayerEUPCapacityLongPerUnit * numUnits : currentTruckInfo.singleLayerEUPCapacityLong) || 0;
        }
        singleTypeBaseCapacity = eupCap;
        relevantTotalVisualPlaced = finalTotalEuroVisualPalletsPlaced;
        relevantStackableState = isEUPStackable;
    } else if (dinQuantity > 0 && eupQuantity === 0) { 
        singleTypeBaseCapacity = (currentTruckInfo.singleLayerDINCapacityPerUnit && numUnits > 1 ? currentTruckInfo.singleLayerDINCapacityPerUnit * numUnits : currentTruckInfo.singleLayerDINCapacity) || 0;
        relevantTotalVisualPlaced = finalTotalDinVisualPalletsPlaced;
        relevantStackableState = isDINStackable;
    }
    
    if (singleTypeBaseCapacity > 0) {
        const maxPalletCapacityForConfig = singleTypeBaseCapacity * (relevantStackableState ? 2 : 1);
        if (relevantTotalVisualPlaced >= maxPalletCapacityForConfig && maxPalletCapacityForConfig > 0) {
            newUtilizationPercentage = 100;
        } else if (maxPalletCapacityForConfig > 0) {
            newUtilizationPercentage = (relevantTotalVisualPlaced / maxPalletCapacityForConfig) * 100;
        }
    } else { 
        newUtilizationPercentage = totalTruckArea > 0 ? (finalTotalAreaUsedByBasePallets / totalTruckArea) * 100 : 0;
    }
    setUtilizationPercentage(parseFloat(newUtilizationPercentage.toFixed(1)));

    const totalActualLoadedBasePallets = finalActualPlacedEUPBase + finalActualPlacedDINBase;
    if (eupPalletWeight > 0 || dinPalletWeight > 0) { 
        if (currentTotalWeightKg > MAX_GROSS_WEIGHT_KG && !finalWarnings.some(w => w.includes("Weight limit reached"))) {
            finalWarnings.push(`Potential gross vehicle weight overload (${(currentTotalWeightKg / 1000).toFixed(1)}t > ${(MAX_GROSS_WEIGHT_KG / 1000)}t).`);
        }
        if (totalActualLoadedBasePallets > 0 && currentTotalWeightKg > 0 && (currentTotalWeightKg / totalActualLoadedBasePallets) > 1500) { // Check if currentTotalWeightKg > 0
            finalWarnings.push('High average weight per pallet footprint. Check axle load distribution.');
        }
    }

    const allEUPRequestedPlaced = finalTotalEuroVisualPalletsPlaced >= eupQuantity;
    const allDINRequestedPlaced = finalTotalDinVisualPalletsPlaced >= dinQuantity;

    if (finalWarnings.length === 0 && (eupQuantity > 0 || dinQuantity > 0) && allEUPRequestedPlaced && allDINRequestedPlaced) {
      finalWarnings.push('All requested pallets placed successfully.');
    } else if (finalWarnings.length === 0 && eupQuantity === 0 && dinQuantity === 0) {
      finalWarnings.push('No pallets requested.');
    }
    setWarnings(Array.from(new Set(finalWarnings)));

  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern]);

  useEffect(() => {
    calculateLoading();
  }, [calculateLoading]);

  const handleQuantityChange = (type, amount) => {
    if (type === 'eup') {
      setEupQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    } else if (type === 'din') {
      setDinQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    }
  };
  
  const renderPallet = (pallet, displayScale = 0.2) => {
    const palletDetails = PALLET_TYPES[pallet.type];
    const displayWidth = pallet.height * displayScale; 
    const displayHeight = pallet.width * displayScale; 

    return (
      <div
        key={pallet.key}
        className={`absolute ${palletDetails.color} ${palletDetails.borderColor} border flex items-center justify-center`}
        style={{
          left: `${pallet.y * displayScale}px`,
          top: `${pallet.x * displayScale}px`,
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          opacity: pallet.isStacked ? 0.75 : 1,
          zIndex: pallet.isStacked ? 10 : 5, 
        }}
      >
        <span className="text-xs text-black p-0.5 font-bold select-none">{palletDetails.label}</span>
        {pallet.isStacked && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"
                 preserveAspectRatio="none"
                 viewBox={`0 0 ${pallet.height} ${pallet.width}`} 
            >
              <line x1="0" y1="0" x2={pallet.height} y2={pallet.width} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
            </svg>
          </div>
        )}
      </div>
    );
  };

  const truckVisualizationScale = 0.3;

  return (
    <div className="container mx-auto p-4 font-sans bg-gray-100 min-h-screen">
      <header className="bg-vetropack-blue text-vetropack-white p-6 rounded-t-lg shadow-md">
        <h1 className="text-3xl font-bold text-center">Loading Space Calculator</h1>
        <p className="text-center text-sm">European Standards Compliant</p>
      </header>

      <main className="p-6 bg-white shadow-md rounded-b-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-1 space-y-6 bg-slate-50 p-4 rounded-lg border">
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">Truck Type:</label>
              <select id="truckType" name="truckType" value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {Object.keys(TRUCK_TYPES).map(key => (
                  <option key={key} value={key}>{TRUCK_TYPES[key].name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industrial Pallets (DIN):</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('din', -1)} className="px-3 py-1 bg-vetropack-dark text-vetropack-white rounded-l-md hover:bg-opacity-80">-</button>
                <input type="number" id="dinQuantity" name="dinQuantity" value={dinQuantity} onChange={(e) => setDinQuantity(Math.max(0, parseInt(e.target.value,10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('din', 1)} className="px-3 py-1 bg-vetropack-dark text-vetropack-white rounded-r-md hover:bg-opacity-80">+</button>
              </div>
              <div className="mt-1">
                <label htmlFor="dinWeightPerPallet" className="text-xs font-medium text-gray-600">Weight/DIN (kg):</label>
                <input type="number" id="dinWeightPerPallet" name="dinWeightPerPallet" value={dinWeightPerPallet} onChange={(e) => setDinWeightPerPallet(e.target.value)} placeholder="e.g. 500" className="mt-1 block w-full py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input id="dinStackable" name="dinStackable" type="checkbox" checked={isDINStackable} onChange={(e) => setIsDINStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="dinStackable" className="ml-2 block text-sm text-gray-900">DIN Stackable (2 high)</label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Euro Pallets (EUP):</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('eup', -1)} className="px-3 py-1 bg-vetropack-dark text-vetropack-white rounded-l-md hover:bg-opacity-80">-</button>
                <input type="number" id="eupQuantity" name="eupQuantity" value={eupQuantity} onChange={(e) => setEupQuantity(Math.max(0, parseInt(e.target.value,10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('eup', 1)} className="px-3 py-1 bg-vetropack-dark text-vetropack-white rounded-r-md hover:bg-opacity-80">+</button>
              </div>
              <div className="mt-1">
                <label htmlFor="eupWeightPerPallet" className="text-xs font-medium text-gray-600">Weight/EUP (kg):</label>
                <input type="number" id="eupWeightPerPallet" name="eupWeightPerPallet" value={eupWeightPerPallet} onChange={(e) => setEupWeightPerPallet(e.target.value)} placeholder="e.g. 400" className="mt-1 block w-full py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
               <div className="flex items-center mt-2">
                <input id="eupStackable" name="eupStackable" type="checkbox" checked={isEUPStackable} onChange={(e) => setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="eupStackable" className="ml-2 block text-sm text-gray-900">EUP Stackable (2 high)</label>
              </div>
            </div>
            
            {eupQuantity > 0 && (
                <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">EUP Loading Pattern:</label>
                    <div className="flex items-center space-x-4">
                        <div>
                            <input type="radio" id="eupAuto" name="eupLoadingPatternOption" value="auto" checked={eupLoadingPattern === 'auto'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                            <label htmlFor="eupAuto" className="ml-2 text-sm text-gray-700">Auto-Optimize</label>
                        </div>
                        <div>
                            <input type="radio" id="eupLong" name="eupLoadingPatternOption" value="long" checked={eupLoadingPattern === 'long'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                            <label htmlFor="eupLong" className="ml-2 text-sm text-gray-700">Long (3-across)</label>
                        </div>
                        <div>
                            <input type="radio" id="eupBroad" name="eupLoadingPatternOption" value="broad" checked={eupLoadingPattern === 'broad'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                            <label htmlFor="eupBroad" className="ml-2 text-sm text-gray-700">Broad (2-across)</label>
                        </div>
                    </div>
                </div>
            )}
          </div>

          <div className="md:col-span-2 bg-gray-200 p-4 rounded-lg border min-h-[400px] flex flex-col items-center">
            <p className="text-gray-600 text-lg mb-2 font-semibold">Truck Loading Area Visualization</p>
            {currentTruckDef.units.map((unit, index) => (
              <div key={unit.id} className="mb-4 last:mb-0">
                {currentTruckDef.units.length > 1 && <p className="text-sm text-center font-medium text-gray-700 mb-1">Unit {index + 1} ({unit.length/100}m x {unit.width/100}m)</p>}
                <div 
                    id={`truckVisualization-${unit.id}`}
                    className="relative bg-gray-400 border-2 border-gray-500 overflow-hidden"
                    style={{
                        width: `${unit.width * truckVisualizationScale}px`,
                        height: `${unit.length * truckVisualizationScale}px`,
                    }}
                >
                  {selectedTruck === 'curtainSider' && currentTruckDef.trueLength && (
                    <>
                        <div className="absolute top-0 left-0 h-full bg-red-300 opacity-30"
                             style={{ width: `${((currentTruckDef.trueLength - currentTruckDef.usableLength)/2) * truckVisualizationScale}px` }} />
                        <div className="absolute top-0 right-0 h-full bg-red-300 opacity-30"
                             style={{ width: `${((currentTruckDef.trueLength - currentTruckDef.usableLength)/2) * truckVisualizationScale}px` }} />
                        <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center text-xs text-red-700 opacity-70"
                             style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', pointerEvents: 'none' }}>
                             <span className="bg-white px-1 rounded">Usable: {currentTruckDef.usableLength/100}m (of {currentTruckDef.trueLength/100}m total)</span>
                        </div>
                    </>
                  )}
                  {palletArrangement.find(pa => pa.unitId === unit.id)?.pallets.map(p => renderPallet(p, truckVisualizationScale))}
                </div>
              </div>
            ))}
            {selectedTruck === 'curtainSider' && currentTruckDef.trueLength && <p className="text-xs text-gray-500 mt-2">Note: Shaded areas indicate unusable space on a 13.6m trailer, resulting in ~13.2m effective loading length.</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-vetropack-blue bg-opacity-10 p-4 rounded-lg border border-vetropack-blue">
                <h3 className="text-lg font-semibold text-vetropack-blue mb-2">Loaded Pallets (Base Footprints)</h3>
                <p>Industrial Pallets: <span id="loadedIndustrial" className="font-bold">{loadedIndustrialPallets}</span></p>
                <p>Euro Pallets: <span id="loadedEuro" className="font-bold">{loadedEuroPallets}</span></p>
            </div>
            <div className="bg-green-500 bg-opacity-10 p-4 rounded-lg border border-green-500">
                <h3 className="text-lg font-semibold text-green-700 mb-2">Loading Area Utilization</h3>
                <p><span id="utilizationPercentage" className="font-bold text-2xl">{utilizationPercentage}</span>%</p>
            </div>
            <div className="bg-red-500 bg-opacity-10 p-4 rounded-lg border border-red-500">
                <h3 className="text-lg font-semibold text-red-700 mb-2">Warnings</h3>
                <ul id="warningsList" className="list-disc list-inside text-sm space-y-1">
                    {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                </ul>
            </div>
        </div>
        
        {(isEUPStackable || isDINStackable) && (loadedIndustrialPallets > 0 || loadedEuroPallets > 0) && (
          <div className="mb-8 bg-gray-200 p-4 rounded-lg border min-h-[200px] flex flex-col justify-center items-center">
              <p className="text-gray-500 text-lg mb-2">Side View Visualization (Conceptual for Stacked Pallets)</p>
              <div id="sideViewVisualization" className="w-full h-auto bg-gray-300 rounded flex justify-around items-end p-4 text-gray-400 min-h-[100px]">
                  {Array.from({ length: Math.min(5, loadedIndustrialPallets + loadedEuroPallets) }).map((_, idx) => {
                      const isDinFirst = idx < loadedIndustrialPallets;
                      const palletDetails = isDinFirst ? PALLET_TYPES.industrial : PALLET_TYPES.euro;
                      const showStacked = (isDinFirst && isDINStackable) || (!isDinFirst && isEUPStackable);
                      return (
                          <div key={`sideview-${idx}`} className="flex flex-col items-center mx-1">
                              <div className={`w-10 h-10 ${palletDetails.color} border ${palletDetails.borderColor} mb-0.5 flex justify-center items-center text-xs font-bold`}>{palletDetails.label}</div>
                              {showStacked && <div className={`w-10 h-10 ${palletDetails.color} border ${palletDetails.borderColor} opacity-60 flex justify-center items-center text-xs font-bold`}>{palletDetails.label}</div>}
                          </div>
                      );
                  })}
                  {(loadedIndustrialPallets + loadedEuroPallets) === 0 && <p>[Side view of stacked pallets will appear here]</p>}
              </div>
              <p className="text-xs text-gray-500 mt-1">Shows a conceptual side view of up to 5 pallets (DIN then EUP). Stacked layer shown if respective stacking option is enabled.</p>
          </div>
        )}

      </main>

      <footer className="text-center py-4 mt-8 text-sm text-gray-600 border-t border-gray-300">
        <p>Loading Space Calculator &copy; {new Date().getFullYear()}</p>
        <p>Created by Andreas Steiner</p>
      </footer>
    </div>
  );
}
