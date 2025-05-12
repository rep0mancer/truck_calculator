"use client";

import React, { useState, useEffect, useCallback } from 'react';

// Constants for truck types, including single-layer capacities
const TRUCK_TYPES = {
  roadTrain: {
    name: 'Road Train (2x 7m)',
    units: [
      { id: 'unit1', length: 700, width: 245, occupiedRects: [] },
      { id: 'unit2', length: 700, width: 245, occupiedRects: [] },
    ],
    totalLength: 1400,
    usableLength: 1400,
    maxWidth: 245,
    // Capacities per unit (multiply by number of units for total)
    singleLayerEUPCapacityLongPerUnit: 15, // (700/120)*3 = 5*3 = 15
    singleLayerEUPCapacityBroadPerUnit: 8,  // (700/80)*2 = 8*2 = 16, but width might limit to e.g. (245/120)=2 wide -> 8*2=16. More precise: floor(700/80) * floor(245/120) = 8 * 2 = 16. Or floor(700/120)*floor(245/80) = 5 * 3 = 15
    singleLayerDINCapacityPerUnit: 14,   // (700/100)*2 = 7*2 = 14
  },
  curtainSider: {
    name: 'Curtain-Sider Semi-trailer (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    trueLength: 1360,
    maxWidth: 245,
    singleLayerEUPCapacityLong: 33, // (1320 / 120cm per EUP length) * 3 across = 11 rows * 3 = 33
    singleLayerEUPCapacityBroad: 32, // floor(1320 / 80cm per EUP width) * 2 across = 16 rows * 2 = 32
    singleLayerDINCapacity: 26,    // floor(1320 / 100cm per DIN width) * 2 across = 13 rows * 2 = 26
  },
  rigidTruck: {
    name: 'Rigid Truck (7m)',
    units: [{ id: 'main', length: 700, width: 245, occupiedRects: [] }],
    totalLength: 700,
    usableLength: 700,
    maxWidth: 245,
    singleLayerEUPCapacityLong: 15, // (700 / 120) * 3 = 5 * 3 = 15
    singleLayerEUPCapacityBroad: 16, // floor(700 / 80) * 2 = 8 * 2 = 16
    singleLayerDINCapacity: 14,  // (700 / 100) * 2 = 7 * 2 = 14
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
  // State for selected truck, pallet quantities, loading patterns, etc.
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  // const [eupLoadingPattern, setEupLoadingPattern] = useState('long'); // Removed for auto-selection
  const [isEUPStackable, setIsEUPStackable] = useState(false); // Separate stacking for EUP
  const [isDINStackable, setIsDINStackable] = useState(false); // Separate stacking for DIN
  const [cargoWeight, setCargoWeight] = useState('');

  const [loadedEuroPallets, setLoadedEuroPallets] = useState(0); // Base footprints
  const [loadedIndustrialPallets, setLoadedIndustrialPallets] = useState(0); // Base footprints
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [palletArrangement, setPalletArrangement] = useState([]);

  const currentTruckDef = TRUCK_TYPES[selectedTruck];

  // Effect for automatic stacking logic
  useEffect(() => {
    const currentTruck = TRUCK_TYPES[selectedTruck];
    let singleLayerEUPCapacity = 0;
    let singleLayerDINCapacity = 0;

    if (currentTruck.name === 'Road Train (2x 7m)') {
        // For road train, sum capacities of units. Assuming 'long' for EUP default auto-stack check.
        singleLayerEUPCapacity = (currentTruck.singleLayerEUPCapacityLongPerUnit || 0) * currentTruck.units.length;
        singleLayerDINCapacity = (currentTruck.singleLayerDINCapacityPerUnit || 0) * currentTruck.units.length;
    } else { // For single-unit trucks like CurtainSider and RigidTruck
        singleLayerEUPCapacity = currentTruck.singleLayerEUPCapacityLong; // Default to long for auto-stack check, actual placement will optimize
        singleLayerDINCapacity = currentTruck.singleLayerDINCapacity;
    }


    if (eupQuantity > 0 && singleLayerEUPCapacity > 0 && eupQuantity > singleLayerEUPCapacity && !isEUPStackable) {
      setIsEUPStackable(true);
    }
    if (dinQuantity > 0 && singleLayerDINCapacity > 0 && dinQuantity > singleLayerDINCapacity && !isDINStackable) {
      setIsDINStackable(true);
    }
  }, [eupQuantity, dinQuantity, selectedTruck, isEUPStackable, isDINStackable]); // Added individual stackable states


  const calculateLoading = useCallback(() => {
    const initialTruckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[selectedTruck]));
    let finalPalletArrangement = [];
    let finalWarnings = [];
    let finalActualPlacedEUPBase = 0;
    let finalActualPlacedDINBase = 0;
    let finalTotalAreaUsedByBasePallets = 0;
    let finalTotalEuroVisualPalletsPlaced = 0;
    let finalTotalDinVisualPalletsPlaced = 0;

    // --- DIN PALLET PLACEMENT ---
    // This part remains largely the same, but uses isDINStackable
    const dinTruckConfig = JSON.parse(JSON.stringify(initialTruckConfig));
    dinTruckConfig.units.forEach(unit => {
      unit.occupiedRects = []; unit.currentX = 0; unit.currentY = 0; unit.palletsVisual = [];
    });

    if (dinQuantity > 0) {
        for (const unit of dinTruckConfig.units) {
            if (finalActualPlacedDINBase >= dinQuantity && !isDINStackable) break;
            if (finalTotalDinVisualPalletsPlaced >= dinQuantity && isDINStackable) break;

            while (true) {
                if (finalActualPlacedDINBase >= dinQuantity && !isDINStackable) break;
                if (finalTotalDinVisualPalletsPlaced >= dinQuantity && isDINStackable) break;
                
                let rowPallets = 0;
                const dinPalletDef = PALLET_TYPES.industrial;
                const dinDimensionAlongTruckLength = dinPalletDef.width;
                const dinDimensionAcrossTruckWidth = dinPalletDef.length;
                let rowHeight = 0;
                const originalUnitY = unit.currentY;

                for (let i = 0; i < 2; i++) {
                    if (finalActualPlacedDINBase >= dinQuantity && !isDINStackable) break;
                    if (finalTotalDinVisualPalletsPlaced >= dinQuantity && isDINStackable) break;

                    if (unit.currentX + dinDimensionAlongTruckLength <= unit.length && unit.currentY + dinDimensionAcrossTruckWidth <= unit.width) {
                        if (finalTotalDinVisualPalletsPlaced < dinQuantity) {
                            unit.palletsVisual.push({
                                x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth,
                                type: 'industrial', isStacked: false, key: `din_base_${unit.id}_${finalActualPlacedDINBase}`, unitId: unit.id,
                            });
                            if (finalActualPlacedDINBase < dinQuantity) {
                                unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth });
                                finalTotalAreaUsedByBasePallets += dinPalletDef.area;
                                finalActualPlacedDINBase++;
                            }
                            finalTotalDinVisualPalletsPlaced++;
                            rowPallets++;
                            rowHeight = Math.max(rowHeight, dinDimensionAlongTruckLength);
                        }

                        if (isDINStackable && finalTotalDinVisualPalletsPlaced < dinQuantity) {
                            unit.palletsVisual.push({
                                x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth,
                                type: 'industrial', isStacked: true, key: `din_stack_${unit.id}_${finalActualPlacedDINBase -1}`, unitId: unit.id,
                            });
                            finalTotalDinVisualPalletsPlaced++;
                        }
                        unit.currentY += dinDimensionAcrossTruckWidth;
                    } else { break; }
                }
                if (rowPallets === 0) {
                    unit.currentY = 0;
                    if (originalUnitY === 0) unit.currentX = unit.length;
                    break;
                }
                unit.currentY = 0;
                unit.currentX += rowHeight;
                if (unit.currentX >= unit.length) break;
            }
        }
    }
    if (finalActualPlacedDINBase < dinQuantity && finalTotalDinVisualPalletsPlaced < dinQuantity) {
        finalWarnings.push(`Could not fit all ${dinQuantity} Industrial pallets. Only ${finalActualPlacedDINBase} base (${finalTotalDinVisualPalletsPlaced} total visual) placed.`);
    }

    // --- EUP PALLET PLACEMENT (with auto-orientation) ---
    let bestEUPArrangement = { palletsVisual: [], occupiedRects: [], placedBase: 0, placedVisual: 0, areaUsed:0 };
    
    if (eupQuantity > 0) {
        const patternsToTry = ['long', 'broad'];
        let bestPatternResult = { count: -1, arrangement: null, baseCount: 0, visualCount: 0, area: 0};

        for (const pattern of patternsToTry) {
            const tempTruckConfig = JSON.parse(JSON.stringify(dinTruckConfig)); // Start from state after DINs
            let currentPatternPlacedEUPBase = 0;
            let currentPatternTotalEuroVisual = 0;
            let currentPatternAreaUsed = 0;

            for (const unit of tempTruckConfig.units) {
                 // Reset EUP-specific counters for this unit and pattern
                unit.currentX = unit.currentX; // Keep X from DIN placement
                unit.currentY = 0; // Reset Y for EUPs in this unit for this pattern trial

                if (currentPatternPlacedEUPBase >= eupQuantity && !isEUPStackable) break;
                if (currentPatternTotalEuroVisual >= eupQuantity && isEUPStackable) break;
            
                while(true) {
                    if (currentPatternPlacedEUPBase >= eupQuantity && !isEUPStackable) break;
                    if (currentPatternTotalEuroVisual >= eupQuantity && isEUPStackable) break;

                    let rowPallets = 0;
                    let rowHeight = 0;
                    const eupPalletDef = PALLET_TYPES.euro;
                    const palletsPerRow = pattern === 'long' ? 3 : 2;
                    const palletWidthForVisual = pattern === 'long' ? eupPalletDef.width : eupPalletDef.length;
                    const palletLengthForVisual = pattern === 'long' ? eupPalletDef.length : eupPalletDef.width;
                    const originalUnitY = unit.currentY;

                    for (let i = 0; i < palletsPerRow; i++) {
                        if (currentPatternPlacedEUPBase >= eupQuantity && !isEUPStackable) break;
                        if (currentPatternTotalEuroVisual >= eupQuantity && isEUPStackable) break;

                        if (unit.currentX + palletLengthForVisual <= unit.length && unit.currentY + palletWidthForVisual <= unit.width) {
                            if (currentPatternTotalEuroVisual < eupQuantity) {
                                unit.palletsVisual.push({
                                    x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual,
                                    type: 'euro', isStacked: false, key: `eup_base_${unit.id}_${currentPatternPlacedEUPBase}_${pattern}`, unitId: unit.id,
                                });
                                if (currentPatternPlacedEUPBase < eupQuantity) {
                                    unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual });
                                    currentPatternAreaUsed += eupPalletDef.area;
                                    currentPatternPlacedEUPBase++;
                                }
                                currentPatternTotalEuroVisual++;
                                rowPallets++;
                                rowHeight = Math.max(rowHeight, palletLengthForVisual);
                            }
                            
                            if (isEUPStackable && currentPatternTotalEuroVisual < eupQuantity) {
                               unit.palletsVisual.push({
                                    x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual,
                                    type: 'euro', isStacked: true, key: `eup_stack_${unit.id}_${currentPatternPlacedEUPBase - 1}_${pattern}`, unitId: unit.id,
                                });
                                currentPatternTotalEuroVisual++;
                            }
                            unit.currentY += palletWidthForVisual;
                        } else { break; }
                    }
                    if (rowPallets === 0) {
                        unit.currentY = 0;
                        if(originalUnitY === 0) unit.currentX = unit.length;
                        break;
                    }
                    unit.currentY = 0;
                    unit.currentX += rowHeight;
                    if (unit.currentX >= unit.length) break;
                }
            }
            // After trying placement for all units with the current pattern
            if (currentPatternTotalEuroVisual > bestPatternResult.visualCount) {
                bestPatternResult = { 
                    count: currentPatternTotalEuroVisual, // Prioritize total visual pallets
                    arrangement: JSON.parse(JSON.stringify(tempTruckConfig.units)), // Deep copy the units with their palletsVisual
                    baseCount: currentPatternPlacedEUPBase,
                    visualCount: currentPatternTotalEuroVisual,
                    area: currentPatternAreaUsed,
                };
            }
        } // End of patternsToTry loop

        // Apply the best EUP arrangement
        if (bestPatternResult.arrangement) {
            finalActualPlacedEUPBase = bestPatternResult.baseCount;
            finalTotalEuroVisualPalletsPlaced = bestPatternResult.visualCount;
            finalTotalAreaUsedByBasePallets += bestPatternResult.area;
            
            // Combine DIN and best EUP arrangements
            let combinedPallets = [];
            initialTruckConfig.units.forEach((origUnit, index) => {
                const dinPalletsForUnit = dinTruckConfig.units[index].palletsVisual;
                const eupPalletsForUnit = bestPatternResult.arrangement[index].palletsVisual;
                // Filter out EUPs from dinTruckConfig.units[index] if any were speculatively added
                const finalDinPallets = dinPalletsForUnit.filter(p => p.type === 'industrial');
                combinedPallets.push({
                    unitId: origUnit.id,
                    unitLength: origUnit.length,
                    unitWidth: origUnit.width,
                    pallets: [...finalDinPallets, ...eupPalletsForUnit]
                });
            });
            finalPalletArrangement = combinedPallets;
        }
         if (finalActualPlacedEUPBase < eupQuantity && finalTotalEuroVisualPalletsPlaced < eupQuantity) {
            finalWarnings.push(`Could not fit all ${eupQuantity} Euro pallets. Only ${finalActualPlacedEUPBase} base (${finalTotalEuroVisualPalletsPlaced} total visual) placed.`);
        }

    } else { // No EUPs requested, just use DIN arrangement
        dinTruckConfig.units.forEach(unit => {
            finalPalletArrangement.push({
                unitId: unit.id, unitLength: unit.length, unitWidth: unit.width, pallets: unit.palletsVisual
            });
        });
    }
    
    setPalletArrangement(finalPalletArrangement);
    setLoadedEuroPallets(finalActualPlacedEUPBase);
    setLoadedIndustrialPallets(finalActualPlacedDINBase);

    // Utilization Calculation
    const totalTruckArea = initialTruckConfig.units.reduce((sum, u) => sum + (u.length * u.width), 0);
    let newUtilizationPercentage = 0;
    const currentTruckInfo = TRUCK_TYPES[selectedTruck];

    let singleTypeBaseCapacity = 0;
    let relevantQuantity = 0;
    let relevantTotalVisualPlaced = 0;
    let relevantStackableState = false;

    if (eupQuantity > 0 && dinQuantity === 0) { // Only EUPs
        // Determine which EUP capacity was effectively used by the auto-orientation
        // This is tricky as the best pattern is chosen. For simplicity, use the larger capacity for the "max"
        singleTypeBaseCapacity = Math.max(currentTruckInfo.singleLayerEUPCapacityLong || 0, currentTruckInfo.singleLayerEUPCapacityBroad || 0);
        relevantQuantity = eupQuantity;
        relevantTotalVisualPlaced = finalTotalEuroVisualPalletsPlaced;
        relevantStackableState = isEUPStackable;
    } else if (dinQuantity > 0 && eupQuantity === 0) { // Only DINs
        singleTypeBaseCapacity = currentTruckInfo.singleLayerDINCapacity || 0;
        relevantQuantity = dinQuantity;
        relevantTotalVisualPlaced = finalTotalDinVisualPalletsPlaced;
        relevantStackableState = isDINStackable;
    }
    
    if (singleTypeBaseCapacity > 0) {
        const maxPalletCapacityForConfig = singleTypeBaseCapacity * (relevantStackableState ? 2 : 1);
        if (relevantTotalVisualPlaced >= maxPalletCapacityForConfig) {
            newUtilizationPercentage = 100;
        } else if (maxPalletCapacityForConfig > 0) {
            newUtilizationPercentage = (relevantTotalVisualPlaced / maxPalletCapacityForConfig) * 100;
        }
        if (relevantTotalVisualPlaced === relevantQuantity && relevantQuantity < maxPalletCapacityForConfig) {
             newUtilizationPercentage = (relevantTotalVisualPlaced / maxPalletCapacityForConfig) * 100;
        }
    } else { 
        newUtilizationPercentage = totalTruckArea > 0 ? (finalTotalAreaUsedByBasePallets / totalTruckArea) * 100 : 0;
    }
    setUtilizationPercentage(parseFloat(newUtilizationPercentage.toFixed(1)));

    // Weight and other warnings
    const weightInput = parseFloat(cargoWeight);
    const totalActualLoadedBasePallets = finalActualPlacedEUPBase + finalActualPlacedDINBase;
    if (!isNaN(weightInput) && weightInput > 0) {
      let totalCargoWeightKg = (weightInput > 2000 && totalActualLoadedBasePallets > 1) ? weightInput : weightInput * totalActualLoadedBasePallets;
      if (totalCargoWeightKg > MAX_GROSS_WEIGHT_KG) {
        finalWarnings.push(`Potential gross vehicle weight overload (${(totalCargoWeightKg / 1000).toFixed(1)}t > ${(MAX_GROSS_WEIGHT_KG / 1000)}t).`);
      }
      if (totalActualLoadedBasePallets > 0 && (totalCargoWeightKg / totalActualLoadedBasePallets) > 1500) {
        finalWarnings.push('High weight per pallet. Check axle load distribution.');
      }
    } else if (cargoWeight !== '' && isNaN(weightInput)) {
      finalWarnings.push('Invalid weight input. Please enter a number.');
    }

    const allEUPRequestedPlaced = finalTotalEuroVisualPalletsPlaced >= eupQuantity;
    const allDINRequestedPlaced = finalTotalDinVisualPalletsPlaced >= dinQuantity;

    if (finalWarnings.length === 0 && (eupQuantity > 0 || dinQuantity > 0) && allEUPRequestedPlaced && allDINRequestedPlaced) {
      finalWarnings.push('All requested pallets placed successfully.');
    } else if (finalWarnings.length === 0 && eupQuantity === 0 && dinQuantity === 0) {
      finalWarnings.push('No pallets requested.');
    }
    setWarnings(finalWarnings);

  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, cargoWeight]); // Removed eupLoadingPattern

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
               <div className="flex items-center mt-2">
                <input id="eupStackable" name="eupStackable" type="checkbox" checked={isEUPStackable} onChange={(e) => setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="eupStackable" className="ml-2 block text-sm text-gray-900">EUP Stackable (2 high)</label>
              </div>
            </div>
            
            {/* Removed EUP Loading Pattern radio buttons as it's now automatic */}

            <div>
              <label htmlFor="cargoWeight" className="block text-sm font-medium text-gray-700 mb-1">Cargo Weight (kg):</label>
              <input type="text" id="cargoWeight" name="cargoWeight" value={cargoWeight} onChange={(e) => setCargoWeight(e.target.value)} placeholder="Total or Avg. per pallet" className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
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
