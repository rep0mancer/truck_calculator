"use client";

import React, { useState, useEffect, useCallback } from 'react';

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
  },
  curtainSider: {
    name: 'Curtain-Sider Semi-trailer (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    trueLength: 1360,
    maxWidth: 245,
    // Example capacities (pallets) for single layer
    singleLayerEUPCapacityLong: 33,
    singleLayerEUPCapacityBroad: 32,
    singleLayerDINCapacity: 26,
  },
  rigidTruck: {
    name: 'Rigid Truck (7m)',
    units: [{ id: 'main', length: 700, width: 245, occupiedRects: [] }],
    totalLength: 700,
    usableLength: 700,
    maxWidth: 245,
    // Example capacities for rigid truck
    singleLayerEUPCapacityLong: 15, // (700/120)*3 = 5*3 = 15
    singleLayerEUPCapacityBroad: 10, // (700/80)*2 = 8*2 = 16, but width might limit, (700/120)*2 = 10
    singleLayerDINCapacity: 14,  // (700/100)*2 = 7*2 = 14
  },
};

const PALLET_TYPES = {
  euro: { name: 'Euro Pallet (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700', label: 'E' },
  industrial: { name: 'Industrial Pallet (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700', label: 'I' },
};

const MAX_GROSS_WEIGHT_KG = 40000;

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState('long');
  const [isStackable, setIsStackable] = useState(false);
  const [cargoWeight, setCargoWeight] = useState('');

  const [loadedEuroPallets, setLoadedEuroPallets] = useState(0);
  const [loadedIndustrialPallets, setLoadedIndustrialPallets] = useState(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [palletArrangement, setPalletArrangement] = useState([]);

  const currentTruckDef = TRUCK_TYPES[selectedTruck];

  // Effect for automatic stacking logic
  useEffect(() => {
    const currentTruck = TRUCK_TYPES[selectedTruck];
    let singleLayerEUPCapacity = 0;
    let singleLayerDINCapacity = 0;

    if (currentTruck.name === 'Curtain-Sider Semi-trailer (13.2m)') {
      singleLayerEUPCapacity = eupLoadingPattern === 'long' ? currentTruck.singleLayerEUPCapacityLong : currentTruck.singleLayerEUPCapacityBroad;
      singleLayerDINCapacity = currentTruck.singleLayerDINCapacity;
    } else if (currentTruck.name === 'Rigid Truck (7m)') {
      singleLayerEUPCapacity = eupLoadingPattern === 'long' ? currentTruck.singleLayerEUPCapacityLong : currentTruck.singleLayerEUPCapacityBroad;
      singleLayerDINCapacity = currentTruck.singleLayerDINCapacity;
    }
    // Add more capacity calculations for other truck types if needed

    let shouldForceStackable = false;
    if (eupQuantity > 0 && singleLayerEUPCapacity > 0 && eupQuantity > singleLayerEUPCapacity) {
      shouldForceStackable = true;
    }
    if (dinQuantity > 0 && singleLayerDINCapacity > 0 && dinQuantity > singleLayerDINCapacity) {
      shouldForceStackable = true;
    }

    if (shouldForceStackable && !isStackable) {
      setIsStackable(true);
    }
    // If quantities drop, user has to manually uncheck. This prevents unchecking if user explicitly set it.
  }, [eupQuantity, dinQuantity, selectedTruck, eupLoadingPattern, isStackable]);


  const calculateLoading = useCallback(() => {
    const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[selectedTruck]));
    truckConfig.units.forEach(unit => {
      unit.occupiedRects = [];
      unit.currentX = 0;
      unit.currentY = 0;
      unit.palletsVisual = [];
    });

    const newWarnings = [];
    let totalAreaUsedByBasePallets = 0;
    let actualPlacedEUPBase = 0;
    let actualPlacedDINBase = 0;
    let totalEuroVisualPalletsPlaced = 0;
    let totalDinVisualPalletsPlaced = 0;

    // --- DIN PALLET PLACEMENT ---
    let dinPalletsToPlaceBase = dinQuantity; // Tracks base footprints needed
    if (dinQuantity > 0) {
        for (const unit of truckConfig.units) {
            if (actualPlacedDINBase >= dinQuantity && !isStackable) break; // Stop if all base are placed and not stackable
            if (totalDinVisualPalletsPlaced >= dinQuantity && isStackable) break; // Stop if total requested (incl. stacks) are placed

            while (true) {
                if (actualPlacedDINBase >= dinQuantity && !isStackable) break;
                if (totalDinVisualPalletsPlaced >= dinQuantity && isStackable) break;

                let rowPallets = 0;
                const dinPalletDef = PALLET_TYPES.industrial;
                const dinDimensionAlongTruckLength = dinPalletDef.width;  // 100cm
                const dinDimensionAcrossTruckWidth = dinPalletDef.length; // 120cm
                let rowHeight = 0;

                const originalUnitY = unit.currentY; // Store Y before attempting to fill a row

                for (let i = 0; i < 2; i++) { // Try to place 2 DIN pallets across
                    if (actualPlacedDINBase >= dinQuantity && !isStackable) break;
                    if (totalDinVisualPalletsPlaced >= dinQuantity && isStackable) break;

                    if (unit.currentX + dinDimensionAlongTruckLength <= unit.length && unit.currentY + dinDimensionAcrossTruckWidth <= unit.width) {
                        if (totalDinVisualPalletsPlaced < dinQuantity) {
                             unit.palletsVisual.push({
                                x: unit.currentX,
                                y: unit.currentY,
                                width: dinDimensionAlongTruckLength,
                                height: dinDimensionAcrossTruckWidth,
                                type: 'industrial',
                                isStacked: false,
                                key: `din_base_${unit.id}_${actualPlacedDINBase}`,
                                unitId: unit.id,
                            });
                            if (actualPlacedDINBase < dinQuantity) { // Only count as new base if it's fulfilling a requested base
                                unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth });
                                totalAreaUsedByBasePallets += dinPalletDef.area;
                                actualPlacedDINBase++;
                            }
                            totalDinVisualPalletsPlaced++;
                            rowPallets++;
                            rowHeight = Math.max(rowHeight, dinDimensionAlongTruckLength);
                        }

                        // Add stacked pallet if applicable and needed
                        if (isStackable && totalDinVisualPalletsPlaced < dinQuantity) {
                            unit.palletsVisual.push({
                                x: unit.currentX,
                                y: unit.currentY, // Same position as base
                                width: dinDimensionAlongTruckLength,
                                height: dinDimensionAcrossTruckWidth,
                                type: 'industrial',
                                isStacked: true,
                                key: `din_stack_${unit.id}_${actualPlacedDINBase -1 }`, // or a unique key for stack
                                unitId: unit.id,
                            });
                            totalDinVisualPalletsPlaced++;
                        }
                        unit.currentY += dinDimensionAcrossTruckWidth;
                    } else {
                        // Cannot fit this pallet in the current row position
                        break; 
                    }
                }

                if (rowPallets === 0) { // Cannot fit any more DIN pallets in this unit at current X
                    unit.currentY = 0; // Reset Y for next row attempt or EUPs
                    if (originalUnitY === 0) { // If we couldn't even start a row at currentX
                        unit.currentX = unit.length; // Mark as full for DINs
                    }
                    break; // Break from while loop for this unit
                }
                unit.currentY = 0; // Reset Y for next row
                unit.currentX += rowHeight; // Move to next row start
                if (unit.currentX >= unit.length) break; // Unit full lengthwise
            }
        }
    }
    if (actualPlacedDINBase < dinQuantity && totalDinVisualPalletsPlaced < dinQuantity) {
        newWarnings.push(`Could not fit all ${dinQuantity} Industrial pallets. Only ${actualPlacedDINBase} base (${totalDinVisualPalletsPlaced} total visual) placed.`);
    }


    // --- EUP PALLET PLACEMENT ---
    let eupPalletsToPlaceBase = eupQuantity; // Tracks base footprints
    if (eupQuantity > 0) {
        for (const unit of truckConfig.units) {
            if (actualPlacedEUPBase >= eupQuantity && !isStackable) break;
            if (totalEuroVisualPalletsPlaced >= eupQuantity && isStackable) break;
            
            while(true) {
                if (actualPlacedEUPBase >= eupQuantity && !isStackable) break;
                if (totalEuroVisualPalletsPlaced >= eupQuantity && isStackable) break;

                let rowPallets = 0;
                let rowHeight = 0;
                const eupPalletDef = PALLET_TYPES.euro;
                const palletsPerRow = eupLoadingPattern === 'long' ? 3 : 2;
                const palletWidthForVisual = eupLoadingPattern === 'long' ? eupPalletDef.width : eupPalletDef.length;
                const palletLengthForVisual = eupLoadingPattern === 'long' ? eupPalletDef.length : eupPalletDef.width;
                
                const originalUnitY = unit.currentY;

                for (let i = 0; i < palletsPerRow; i++) {
                    if (actualPlacedEUPBase >= eupQuantity && !isStackable) break;
                    if (totalEuroVisualPalletsPlaced >= eupQuantity && isStackable) break;

                    if (unit.currentX + palletLengthForVisual <= unit.length && unit.currentY + palletWidthForVisual <= unit.width) {
                        if (totalEuroVisualPalletsPlaced < eupQuantity) {
                            unit.palletsVisual.push({
                                x: unit.currentX,
                                y: unit.currentY,
                                width: palletLengthForVisual,
                                height: palletWidthForVisual,
                                type: 'euro',
                                isStacked: false,
                                key: `eup_base_${unit.id}_${actualPlacedEUPBase}`,
                                unitId: unit.id,
                            });
                             if (actualPlacedEUPBase < eupQuantity) {
                                unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: palletLengthForVisual, height: palletWidthForVisual });
                                totalAreaUsedByBasePallets += eupPalletDef.area;
                                actualPlacedEUPBase++;
                            }
                            totalEuroVisualPalletsPlaced++;
                            rowPallets++;
                            rowHeight = Math.max(rowHeight, palletLengthForVisual);
                        }
                        
                        // Add stacked pallet
                        if (isStackable && totalEuroVisualPalletsPlaced < eupQuantity) {
                           unit.palletsVisual.push({
                                x: unit.currentX,
                                y: unit.currentY,
                                width: palletLengthForVisual,
                                height: palletWidthForVisual,
                                type: 'euro',
                                isStacked: true,
                                key: `eup_stack_${unit.id}_${actualPlacedEUPBase - 1}`,
                                unitId: unit.id,
                            });
                            totalEuroVisualPalletsPlaced++;
                        }
                        unit.currentY += palletWidthForVisual;
                    } else {
                        break;
                    }
                }
                if (rowPallets === 0) {
                    unit.currentY = 0;
                     if (originalUnitY === 0) {
                        unit.currentX = unit.length;
                    }
                    break;
                }
                unit.currentY = 0;
                unit.currentX += rowHeight;
                if (unit.currentX >= unit.length) break;
            }
        }
    }
    if (actualPlacedEUPBase < eupQuantity && totalEuroVisualPalletsPlaced < eupQuantity) {
        newWarnings.push(`Could not fit all ${eupQuantity} Euro pallets. Only ${actualPlacedEUPBase} base (${totalEuroVisualPalletsPlaced} total visual) placed.`);
    }


    let consolidatedPalletArrangement = [];
    truckConfig.units.forEach(unit => {
      consolidatedPalletArrangement.push({
        unitId: unit.id,
        unitLength: unit.length,
        unitWidth: unit.width,
        pallets: unit.palletsVisual
      });
    });
    setPalletArrangement(consolidatedPalletArrangement);

    setLoadedEuroPallets(actualPlacedEUPBase); // This remains count of base footprints
    setLoadedIndustrialPallets(actualPlacedDINBase); // This remains count of base footprints

    // Utilization Calculation
    const totalTruckArea = truckConfig.units.reduce((sum, u) => sum + (u.length * u.width), 0);
    let newUtilizationPercentage = 0;

    const currentTruckInfo = TRUCK_TYPES[selectedTruck];
    let singleLayerCapacity = 0;
    if (eupQuantity > 0 && dinQuantity === 0) { // Only EUPs
        singleLayerCapacity = eupLoadingPattern === 'long' ? currentTruckInfo.singleLayerEUPCapacityLong : currentTruckInfo.singleLayerEUPCapacityBroad;
    } else if (dinQuantity > 0 && eupQuantity === 0) { // Only DINs
        singleLayerCapacity = currentTruckInfo.singleLayerDINCapacity;
    }

    if (singleLayerCapacity > 0) { // Calculation for single pallet type loads
        const maxPalletCapacityForConfig = singleLayerCapacity * (isStackable ? 2 : 1);
        const totalVisuallyLoaded = eupQuantity > 0 ? totalEuroVisualPalletsPlaced : totalDinVisualPalletsPlaced;

        if (totalVisuallyLoaded >= maxPalletCapacityForConfig) {
            newUtilizationPercentage = 100;
        } else if (maxPalletCapacityForConfig > 0) {
            newUtilizationPercentage = (totalVisuallyLoaded / maxPalletCapacityForConfig) * 100;
        }
        // If requested is less than capacity but all requested are loaded
        const requestedQty = eupQuantity > 0 ? eupQuantity : dinQuantity;
        if (totalVisuallyLoaded === requestedQty && requestedQty < maxPalletCapacityForConfig) {
             newUtilizationPercentage = (totalVisuallyLoaded / maxPalletCapacityForConfig) * 100;
        }


    } else { // Fallback for mixed loads or unconfigured trucks
        newUtilizationPercentage = totalTruckArea > 0 ? (totalAreaUsedByBasePallets / totalTruckArea) * 100 : 0;
    }
    setUtilizationPercentage(parseFloat(newUtilizationPercentage.toFixed(1)));


    const weightInput = parseFloat(cargoWeight);
    const totalActualLoadedBasePallets = actualPlacedEUPBase + actualPlacedDINBase;
    if (!isNaN(weightInput) && weightInput > 0) {
      let totalCargoWeightKg = (weightInput > 2000 && totalActualLoadedBasePallets > 1) ? weightInput : weightInput * totalActualLoadedBasePallets;
      if (totalCargoWeightKg > MAX_GROSS_WEIGHT_KG) {
        newWarnings.push(`Potential gross vehicle weight overload (${(totalCargoWeightKg / 1000).toFixed(1)}t > ${(MAX_GROSS_WEIGHT_KG / 1000)}t).`);
      }
      if (totalActualLoadedBasePallets > 0 && (totalCargoWeightKg / totalActualLoadedBasePallets) > 1500) {
        newWarnings.push('High weight per pallet. Check axle load distribution.');
      }
    } else if (cargoWeight !== '' && isNaN(weightInput)) {
      newWarnings.push('Invalid weight input. Please enter a number.');
    }

    const allEUPRequestedPlaced = totalEuroVisualPalletsPlaced >= eupQuantity;
    const allDINRequestedPlaced = totalDinVisualPalletsPlaced >= dinQuantity;

    if (newWarnings.length === 0 && (eupQuantity > 0 || dinQuantity > 0) && allEUPRequestedPlaced && allDINRequestedPlaced) {
      newWarnings.push('All requested pallets placed successfully.');
    } else if (newWarnings.length === 0 && eupQuantity === 0 && dinQuantity === 0) {
      newWarnings.push('No pallets requested.');
    }
    setWarnings(newWarnings);

  }, [selectedTruck, eupQuantity, dinQuantity, isStackable, cargoWeight, eupLoadingPattern]);

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
    // pallet.width and pallet.height are now the oriented dimensions for visualization
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Euro Pallets (EUP):</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('eup', -1)} className="px-3 py-1 bg-vetropack-dark text-vetropack-white rounded-l-md hover:bg-opacity-80">-</button>
                <input type="number" id="eupQuantity" name="eupQuantity" value={eupQuantity} onChange={(e) => setEupQuantity(Math.max(0, parseInt(e.target.value,10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('eup', 1)} className="px-3 py-1 bg-vetropack-dark text-vetropack-white rounded-r-md hover:bg-opacity-80">+</button>
              </div>
            </div>
            
            {eupQuantity > 0 && (
                <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">EUP Loading Pattern:</label>
                    <div className="flex items-center space-x-4">
                        <div>
                            <input type="radio" id="eupLong" name="eupLoadingPattern" value="long" checked={eupLoadingPattern === 'long'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                            <label htmlFor="eupLong" className="ml-2 text-sm text-gray-700">Long (3-across)</label>
                        </div>
                        <div>
                            <input type="radio" id="eupBroad" name="eupLoadingPattern" value="broad" checked={eupLoadingPattern === 'broad'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                            <label htmlFor="eupBroad" className="ml-2 text-sm text-gray-700">Broad (2-across)</label>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center mt-2">
              <input id="stackable" name="stackable" type="checkbox" checked={isStackable} onChange={(e) => setIsStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
              <label htmlFor="stackable" className="ml-2 block text-sm text-gray-900">Pallets stackable (2 high)</label>
            </div>

            <div>
              <label htmlFor="cargoWeight" className="block text-sm font-medium text-gray-700 mb-1">Cargo Weight (kg):</label>
              <input type="text" id="cargoWeight" name="cargoWeight" value={cargoWeight} onChange={(e) => setCargoWeight(e.target.value)} placeholder="Total or Avg. per pallet" className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            </div>
          </div>

          <div className="md:col-span-2 bg-gray-200 p-4 rounded-lg border min-h-[400px] flex flex-col items-center">
            <p className="text-gray-600 text-lg mb-2 font-semibold">Truck Loading Area Visualization</p>
            {currentTruckDef.units.map((unit, index) => (
              <div key={unit.id} className="mb-4 last:mb-0">
                {currentTruckDef.name === 'Road Train (2x 7m)' && <p className="text-sm text-center font-medium text-gray-700 mb-1">Unit {index + 1} ({unit.length/100}m x {unit.width/100}m)</p>}
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
                <h3 className="text-lg font-semibold text-vetropack-blue mb-2">Loaded Pallets</h3>
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
        
        {isStackable && (loadedIndustrialPallets > 0 || loadedEuroPallets > 0) && (
          <div className="mb-8 bg-gray-200 p-4 rounded-lg border min-h-[200px] flex flex-col justify-center items-center">
              <p className="text-gray-500 text-lg mb-2">Side View Visualization (Conceptual for Stacked Pallets)</p>
              <div id="sideViewVisualization" className="w-full h-auto bg-gray-300 rounded flex justify-around items-end p-4 text-gray-400 min-h-[100px]">
                  {Array.from({ length: Math.min(5, loadedIndustrialPallets + loadedEuroPallets) }).map((_, idx) => {
                      const isDinFirst = idx < loadedIndustrialPallets;
                      const palletDetails = isDinFirst ? PALLET_TYPES.industrial : PALLET_TYPES.euro;
                      return (
                          <div key={`sideview-${idx}`} className="flex flex-col items-center mx-1">
                              <div className={`w-10 h-10 ${palletDetails.color} border ${palletDetails.borderColor} mb-0.5 flex justify-center items-center text-xs font-bold`}>{palletDetails.label}</div>
                              <div className={`w-10 h-10 ${palletDetails.color} border ${palletDetails.borderColor} opacity-60 flex justify-center items-center text-xs font-bold`}>{palletDetails.label}</div>
                          </div>
                      );
                  })}
                  {(loadedIndustrialPallets + loadedEuroPallets) === 0 && <p>[Side view of stacked pallets will appear here]</p>}
              </div>
              <p className="text-xs text-gray-500 mt-1">Shows a conceptual side view of up to 5 double-stacked pallets (DIN then EUP, based on loaded counts).</p>
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
