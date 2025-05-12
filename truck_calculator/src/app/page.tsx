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
const MAX_GROSS_WEIGHT_KG = 24000;

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
    const initialTruckConfigMaster = JSON.parse(JSON.stringify(TRUCK_TYPES[selectedTruck]));
    
    let finalPalletArrangement = [];
    let tempWarnings = []; // Use a temporary array for warnings during calculation
    let finalActualPlacedEUPBase = 0;
    let finalActualPlacedDINBase = 0;
    let finalTotalAreaUsedByBasePallets = 0;
    let finalTotalEuroVisualPalletsPlaced = 0;
    let finalTotalDinVisualPalletsPlaced = 0;
    let currentTotalWeightKg = 0;

    const eupPalletWeight = parseFloat(eupWeightPerPallet) || 0;
    const dinPalletWeight = parseFloat(dinWeightPerPallet) || 0;

    let unitsState = initialTruckConfigMaster.units.map(u => ({
        ...u,
        occupiedRects: [],
        currentX: 0,
        currentY: 0,
        palletsVisual: [],
    }));

    // --- DIN PALLET PLACEMENT ---
    if (dinQuantity > 0) {
        for (const unit of unitsState) {
            if (finalTotalDinVisualPalletsPlaced >= dinQuantity) break; 

            while (unit.currentX < unit.length) { // Loop for rows in the unit
                if (finalTotalDinVisualPalletsPlaced >= dinQuantity) break;
                
                let rowPalletsPlacedThisAttempt = 0;
                const dinPalletDef = PALLET_TYPES.industrial;
                const dinDimensionAlongTruckLength = dinPalletDef.width;
                const dinDimensionAcrossTruckWidth = dinPalletDef.length;
                let maxHeightInRow = 0; 
                const yPosAtRowStart = unit.currentY;

                for (let i = 0; i < 2; i++) { // Try to place up to 2 DINs across
                    if (finalTotalDinVisualPalletsPlaced >= dinQuantity) break;

                    if (dinPalletWeight > 0 && currentTotalWeightKg + dinPalletWeight > MAX_GROSS_WEIGHT_KG) {
                        if (!tempWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
                             tempWarnings.push(`Weight limit reached for DIN pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                        }
                        unit.currentX = unit.length; // Mark as full due to weight
                        break; 
                    }

                    if (unit.currentX + dinDimensionAlongTruckLength <= unit.length && unit.currentY + dinDimensionAcrossTruckWidth <= unit.width) {
                        unit.palletsVisual.push({
                            x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth,
                            type: 'industrial', isStacked: false, key: `din_base_${unit.id}_${finalActualPlacedDINBase}_${i}`, unitId: unit.id,
                        });
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth });
                        finalTotalAreaUsedByBasePallets += dinPalletDef.area;
                        finalActualPlacedDINBase++;
                        finalTotalDinVisualPalletsPlaced++;
                        currentTotalWeightKg += dinPalletWeight;
                        rowPalletsPlacedThisAttempt++;
                        maxHeightInRow = Math.max(maxHeightInRow, dinDimensionAlongTruckLength);
                        
                        if (isDINStackable && finalTotalDinVisualPalletsPlaced < dinQuantity) {
                            if (dinPalletWeight > 0 && currentTotalWeightKg + dinPalletWeight > MAX_GROSS_WEIGHT_KG) {
                                if (!tempWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
                                    tempWarnings.push(`Weight limit reached. Cannot stack more DIN pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                                }
                                unit.currentX = unit.length; // Mark as full due to weight
                                break; 
                            }
                            unit.palletsVisual.push({
                                x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth,
                                type: 'industrial', isStacked: true, key: `din_stack_${unit.id}_${finalActualPlacedDINBase -1}_${i}`, unitId: unit.id,
                            });
                            finalTotalDinVisualPalletsPlaced++;
                            currentTotalWeightKg += dinPalletWeight;
                        }
                        unit.currentY += dinDimensionAcrossTruckWidth;
                    } else { break; } // Cannot fit this pallet in the current width position
                } 
                if (tempWarnings.some(w => w.includes("Weight limit reached for DIN"))) break; // Break from while loop for this unit if weight limit hit

                if (rowPalletsPlacedThisAttempt > 0) {
                    // If any pallets were placed in this X-slice, advance X by the height of this slice
                    // and reset Y for the next X-slice.
                    unit.currentX += maxHeightInRow;
                    unit.currentY = 0; 
                } else { // No pallets were placed in this row attempt (at currentX, yPosAtRowStart)
                    if (yPosAtRowStart === 0) { // If we couldn't start a new line at currentX
                        unit.currentX = unit.length; // This X is done for DINs
                    } else {
                        // We were trying to fill a gap (yPosAtRowStart > 0) but couldn't.
                        // Reset Y to 0, so EUPs can try the full width at this currentX.
                        // X is NOT advanced by DINs here, as no new DIN row was formed.
                        unit.currentY = 0;
                    }
                    break; // Exit while loop for this unit (DINs are done with this X or gap)
                }
            } // End while loop for unit (DINs)
            if (tempWarnings.some(w => w.includes("Weight limit reached for DIN"))) break; // Break from outer unit loop if weight limit hit
        } 
    }
    if (finalTotalDinVisualPalletsPlaced < dinQuantity && !tempWarnings.some(w => w.includes("Weight limit reached for DIN"))) {
        tempWarnings.push(`Could not fit all ${dinQuantity} Industrial pallets due to space. Only ${finalTotalDinVisualPalletsPlaced} (visual) placed.`);
    }

    // --- EUP PALLET PLACEMENT ---
    // unitsState now contains the state after DIN placement.
    
    if (eupQuantity > 0) {
        const patternsToTry = eupLoadingPattern === 'auto' ? ['long', 'broad'] : [eupLoadingPattern];
        let bestOverallEUPPlacement = { 
            unitsConfiguration: JSON.parse(JSON.stringify(unitsState)), 
            totalVisualEUPs: 0, 
            baseEUPs: 0, 
            areaEUPs: 0, 
            tempWarnings: [],
            currentWeightAfterEUPs: currentTotalWeightKg,
            chosenPattern: eupLoadingPattern === 'auto' ? 'long' : eupLoadingPattern // Default for auto, will be updated
        };

        for (const pattern of patternsToTry) {
            let currentPatternUnitsState = JSON.parse(JSON.stringify(unitsState)); 
            let patternTotalEuroVisual = 0;
            let patternActualEUPBase = 0;
            let patternAreaUsedByEUPs = 0;
            let patternTempCurrentWeightKg = currentTotalWeightKg; 
            let patternSpecificWarnings = [];

            for (const unit of currentPatternUnitsState) {
                if (patternTotalEuroVisual >= eupQuantity) break;
                
                while (unit.currentX < unit.length) { 
                    if (patternTotalEuroVisual >= eupQuantity) break;
                    
                    let rowPalletsPlacedThisAttempt = 0;
                    const eupPalletDef = PALLET_TYPES.euro;
                    const palletsPerRow = pattern === 'long' ? 3 : 2;
                    const palletWidthForVisual = pattern === 'long' ? eupPalletDef.width : eupPalletDef.length;
                    const palletLengthForVisual = pattern === 'long' ? eupPalletDef.length : eupPalletDef.width;
                    let maxHeightInRow = 0;
                    const yPosAtRowStart = unit.currentY;

                    for (let i = 0; i < palletsPerRow; i++) {
                        if (patternTotalEuroVisual >= eupQuantity) break;

                        if (eupPalletWeight > 0 && patternTempCurrentWeightKg + eupPalletWeight > MAX_GROSS_WEIGHT_KG) {
                             if (!patternSpecificWarnings.some(w => w.includes("Weight limit reached for EUP"))) {
                                patternSpecificWarnings.push(`Weight limit reached for EUP pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                             }
                             unit.currentX = unit.length; // Mark as full due to weight
                            break; 
                        }

                        if (unit.currentX + palletLengthForVisual <= unit.length && unit.currentY + palletWidthForVisual <= unit.width) {
                            unit.palletsVisual.push({ 
                                x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual,
                                type: 'euro', isStacked: false, key: `eup_base_${unit.id}_${patternActualEUPBase}_${pattern}_${i}`, unitId: unit.id,
                            });
                            unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual });
                            patternAreaUsedByEUPs += eupPalletDef.area;
                            patternActualEUPBase++;
                            patternTotalEuroVisual++;
                            patternTempCurrentWeightKg += eupPalletWeight;
                            rowPalletsPlacedThisAttempt++;
                            maxHeightInRow = Math.max(maxHeightInRow, palletLengthForVisual);
                            
                            if (isEUPStackable && patternTotalEuroVisual < eupQuantity) {
                               if (eupPalletWeight > 0 && patternTempCurrentWeightKg + eupPalletWeight > MAX_GROSS_WEIGHT_KG) {
                                   if (!patternSpecificWarnings.some(w => w.includes("Weight limit reached for EUP"))) {
                                       patternSpecificWarnings.push(`Weight limit reached. Cannot stack more EUP pallets. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                                   }
                                   unit.currentX = unit.length; // Mark as full due to weight
                                   break;
                               }
                               unit.palletsVisual.push({
                                    x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual,
                                    type: 'euro', isStacked: true, key: `eup_stack_${unit.id}_${patternActualEUPBase - 1}_${pattern}_${i}`, unitId: unit.id,
                                });
                                patternTotalEuroVisual++;
                                patternTempCurrentWeightKg += eupPalletWeight;
                            }
                            unit.currentY += palletWidthForVisual;
                        } else { break; }
                    } 
                    if (patternSpecificWarnings.some(w => w.includes("Weight limit reached for EUP"))) break;

                    if (rowPalletsPlacedThisAttempt > 0) {
                        unit.currentX += maxHeightInRow;
                        unit.currentY = 0;
                    } else {
                        if (yPosAtRowStart === 0) {
                            unit.currentX = unit.length; 
                        } else {
                            unit.currentY = 0; // Reset Y, try next X line from start of width
                            // If a gap was unfillable, the next attempt for this unit will be at the same X but Y=0.
                            // If that also fails (rowPalletsPlacedThisAttempt is 0 and yPosAtRowStart is 0), then X becomes unit.length.
                        }
                        break; 
                    }
                } 
                if (patternSpecificWarnings.some(w => w.includes("Weight limit reached for EUP"))) break; 
            } 

            if (patternTotalEuroVisual > bestOverallEUPPlacement.totalVisualEUPs) {
                bestOverallEUPPlacement = { 
                    unitsConfiguration: JSON.parse(JSON.stringify(currentPatternUnitsState)), 
                    totalVisualEUPs: patternTotalEuroVisual, 
                    baseEUPs: patternActualEUPBase,
                    areaEUPs: patternAreaUsedByEUPs,
                    tempWarnings: patternSpecificWarnings,
                    currentWeightAfterEUPs: patternTempCurrentWeightKg,
                    chosenPattern: pattern
                };
            } else if (patternTotalEuroVisual === bestOverallEUPPlacement.totalVisualEUPs && patternAreaUsedByEUPs < bestOverallEUPPlacement.areaEUPs) {
                 bestOverallEUPPlacement = { 
                    unitsConfiguration: JSON.parse(JSON.stringify(currentPatternUnitsState)), 
                    totalVisualEUPs: patternTotalEuroVisual, 
                    baseEUPs: patternActualEUPBase,
                    areaEUPs: patternAreaUsedByEUPs,
                    tempWarnings: patternSpecificWarnings,
                    currentWeightAfterEUPs: patternTempCurrentWeightKg,
                    chosenPattern: pattern
                };
            }
        } 

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

    } else { 
        finalPalletArrangement = unitsState.map(unit => ({
            unitId: unit.id, unitLength: unit.length, unitWidth: unit.width, pallets: unit.palletsVisual
        }));
    }
    
    setPalletArrangement(finalPalletArrangement);
    setLoadedEuroPallets(finalActualPlacedEUPBase);
    setLoadedIndustrialPallets(finalActualPlacedDINBase);

    // Utilization Calculation
    const totalTruckArea = initialTruckConfigMaster.units.reduce((sum, u) => sum + (u.length * u.width), 0);
    let newUtilizationPercentage = 0;
    const currentTruckInfo = TRUCK_TYPES[selectedTruck];
    let numUnits = currentTruckInfo.units.length;

    let singleTypeBaseCapacity = 0;
    let relevantTotalVisualPlaced = 0;
    let relevantStackableState = false;
    
    if (eupQuantity > 0 && dinQuantity === 0) { 
        let eupCap = 0;
        const chosenPatternForCapacity = bestOverallEUPPlacement?.chosenPattern || (eupLoadingPattern === 'auto' ? 'long' : eupLoadingPattern);

        if (chosenPatternForCapacity === 'long') {
            eupCap = numUnits > 1 ? (currentTruckInfo.singleLayerEUPCapacityLongPerUnit || 0) * numUnits : (currentTruckInfo.singleLayerEUPCapacityLong || 0);
        } else { // broad
            eupCap = numUnits > 1 ? (currentTruckInfo.singleLayerEUPCapacityBroadPerUnit || 0) * numUnits : (currentTruckInfo.singleLayerEUPCapacityBroad || 0);
        }
        singleTypeBaseCapacity = eupCap;
        relevantTotalVisualPlaced = finalTotalEuroVisualPalletsPlaced;
        relevantStackableState = isEUPStackable;
    } else if (dinQuantity > 0 && eupQuantity === 0) { 
        singleTypeBaseCapacity = (numUnits > 1 ? (currentTruckInfo.singleLayerDINCapacityPerUnit || 0) * numUnits : (currentTruckInfo.singleLayerDINCapacity || 0));
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
        if (currentTotalWeightKg > MAX_GROSS_WEIGHT_KG && !tempWarnings.some(w => w.includes("Weight limit reached"))) {
            tempWarnings.push(`Potential gross vehicle weight overload (${(currentTotalWeightKg / 1000).toFixed(1)}t > ${(MAX_GROSS_WEIGHT_KG / 1000)}t).`);
        }
        if (totalActualLoadedBasePallets > 0 && currentTotalWeightKg > 0 && (currentTotalWeightKg / totalActualLoadedBasePallets) > 1500) { 
            tempWarnings.push('High average weight per pallet footprint. Check axle load distribution.');
        }
    }

    const allEUPRequestedPlaced = finalTotalEuroVisualPalletsPlaced >= eupQuantity;
    const allDINRequestedPlaced = finalTotalDinVisualPalletsPlaced >= dinQuantity;

    if (tempWarnings.length === 0 && (eupQuantity > 0 || dinQuantity > 0) && allEUPRequestedPlaced && allDINRequestedPlaced) {
      tempWarnings.push('All requested pallets placed successfully.');
    } else if (tempWarnings.length === 0 && eupQuantity === 0 && dinQuantity === 0) {
      tempWarnings.push('No pallets requested.');
    }
    setWarnings(Array.from(new Set(tempWarnings)));

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
