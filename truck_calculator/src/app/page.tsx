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
  },
  rigidTruck: {
    name: 'Rigid Truck (7m)',
    units: [{ id: 'main', length: 700, width: 245, occupiedRects: [] }],
    totalLength: 700,
    usableLength: 700,
    maxWidth: 245,
  },
};

const PALLET_TYPES = {
  euro: { name: 'Euro Pallet (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700', label: 'E' },
  industrial: { name: 'Industrial Pallet (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700', label: 'I' },
};

const MAX_GROSS_WEIGHT_KG = 40000;

// This checkOverlap function might not be needed with strict grid placement
// but can be kept for safety or future flexible placement options.
function checkOverlap(rect1, rects) {
  for (const rect2 of rects) {
    if (rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y) {
      return true;
    }
  }
  return false;
}

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState('long'); // 'long' (3-across) or 'broad' (2-across)
  const [isStackable, setIsStackable] = useState(false);
  const [cargoWeight, setCargoWeight] = useState('');

  const [loadedEuroPallets, setLoadedEuroPallets] = useState(0);
  const [loadedIndustrialPallets, setLoadedIndustrialPallets] = useState(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [palletArrangement, setPalletArrangement] = useState([]);

  const currentTruckDef = TRUCK_TYPES[selectedTruck];

  const calculateLoading = useCallback(() => {
    const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[selectedTruck]));
    truckConfig.units.forEach(unit => {
        unit.occupiedRects = []; // Stores base pallet footprints for overlap check if needed, and for area calculation
        unit.currentX = 0; // Current lengthwise position for next pallet row
        unit.currentY = 0; // Current widthwise position in the current row
        unit.palletsVisual = []; // Stores all pallets (base and stacked) for visualization
    });

    const stackFactor = isStackable ? 2 : 1;
    const newWarnings = [];
    let totalAreaUsedByBasePallets = 0;
    let actualPlacedEUPBase = 0;
    let actualPlacedDINBase = 0;

    // --- DIN PALLET PLACEMENT (Priority, 2-across) ---
let dinPalletsToPlace = dinQuantity;
if (dinPalletsToPlace > 0) {
    for (const unit of truckConfig.units) {
        if (dinPalletsToPlace === 0) break;
        let unitDinPalletsPlacedBase = 0;

        while(dinPalletsToPlace > 0) {
            let rowPallets = 0;
            // let rowHeight = 0; // Max length of pallets in this row (DIN width is 100 when oriented as desired)
            const dinPalletDef = PALLET_TYPES.industrial;

            // Corrected dimensions for desired DIN pallet orientation:
            // 100cm along the truck's length (X-axis for calculation, pallet.width for visual object)
            // 120cm across the truck's width (Y-axis for calculation, pallet.height for visual object)
            const dinDimensionAlongTruckLength = dinPalletDef.width;  // 100cm
            const dinDimensionAcrossTruckWidth = dinPalletDef.length; // 120cm
            let rowHeight = 0; // Max dimension along truck length in this row

            // Try to place 2 DIN pallets across the width
            for (let i = 0; i < 2; i++) { // Assuming you always try to fit 2 DIN pallets side-by-side
                if (dinPalletsToPlace === 0) break;

                if (unit.currentX + dinDimensionAlongTruckLength <= unit.length && unit.currentY + dinDimensionAcrossTruckWidth <= unit.width) {
                    // Place base pallet
                    unit.palletsVisual.push({
                        x: unit.currentX,
                        y: unit.currentY,
                        width: dinDimensionAlongTruckLength,  // This will be pallet's length along the truck bed
                        height: dinDimensionAcrossTruckWidth, // This will be pallet's width across the truck bed
                        type: 'industrial',
                        isStacked: false,
                        key: `din_base_${unit.id}_${actualPlacedDINBase}`
                    });
                    unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinDimensionAlongTruckLength, height: dinDimensionAcrossTruckWidth });
                    totalAreaUsedByBasePallets += dinPalletDef.area;
                    actualPlacedDINBase++;
                    unitDinPalletsPlacedBase++;
                    dinPalletsToPlace--;
                    rowPallets++;
                    rowHeight = Math.max(rowHeight, dinDimensionAlongTruckLength);
                    unit.currentY += dinDimensionAcrossTruckWidth;

                    // Place stacked pallet if applicable (ensure stacked logic uses correct base pallet count)
                    if (isStackable) {
    const currentTotalDinVisuals = unit.palletsVisual.filter(p => p.type === 'industrial' && p.unitId === unit.id).length +
                                   truckConfig.units.filter(u => u.id !== unit.id)
                                                 .reduce((sum, u) => sum + u.palletsVisual.filter(p => p.type === 'industrial').length, 0);

    if (currentTotalDinVisuals < dinQuantity) {
        unit.palletsVisual.push({
            x: unit.currentX, // Same X as the base pallet
            y: unit.currentY - dinDimensionAcrossTruckWidth, // Same Y as the base pallet (before Y was advanced for next base)
            width: dinDimensionAlongTruckLength,
            height: dinDimensionAcrossTruckWidth,
            type: 'industrial',
            isStacked: true,
            key: `din_stack_${unit.id}_${actualPlacedDINBase-1}`
        });
    }
} else {
                    // Cannot fit this pallet in the current row position
                    break;
                }
            }

            if (rowPallets === 0) {
                unit.currentY = 0;
                unit.currentX = unit.length; // Mark as full for DINs for this orientation attempt
                break;
            }
            unit.currentY = 0;
            unit.currentX += rowHeight; // Move to next row start based on length used
            if (unit.currentX >= unit.length) break; // Unit full lengthwise
        }
    }
}
if (dinPalletsToPlace > 0) {
    newWarnings.push(`Could not fit all ${dinQuantity} Industrial pallets. Only ${actualPlacedDINBase} base pallets placed.`);
}

    // --- EUP PALLET PLACEMENT (After DINs) ---
    let eupPalletsToPlace = eupQuantity;
    if (eupPalletsToPlace > 0) {
        for (const unit of truckConfig.units) {
            if (eupPalletsToPlace === 0) break;
            let unitEupPalletsPlacedBase = 0;

            // Reset currentX/Y if DINs filled the unit, or continue if DINs left space
            // This needs more robust state tracking from DIN placement per unit.
            // For now, assume EUPs start fresh in each unit if DINs were placed, or use remaining space.
            // A better approach: track remaining rectangular spaces after DINs.
            // Simplified: if unit.currentX was advanced by DINs, continue from there.
            // If unit.currentY is not 0, it means DINs partially filled a row.
            // This part is complex and needs careful state management from DIN phase.
            // For this iteration, let's assume EUPs try to fill from unit.currentX, unit.currentY
            // If unit.currentY != 0, it means a DIN row was partial. EUPs might fit next to it.

            while(eupPalletsToPlace > 0) {
                let rowPallets = 0;
                let rowHeight = 0;
                const eupPalletDef = PALLET_TYPES.euro;
                const palletsPerRow = eupLoadingPattern === 'long' ? 3 : 2;
                const palletWidth = eupLoadingPattern === 'long' ? eupPalletDef.width : eupPalletDef.length; // 80 for long, 120 for broad
                const palletLength = eupLoadingPattern === 'long' ? eupPalletDef.length : eupPalletDef.width; // 120 for long, 80 for broad

                for (let i = 0; i < palletsPerRow; i++) {
                    if (eupPalletsToPlace === 0) break;
                    if (unit.currentX + palletLength <= unit.length && unit.currentY + palletWidth <= unit.width) {
                        unit.palletsVisual.push({
                            x: unit.currentX,
                            y: unit.currentY,
                            width: palletLength,
                            height: palletWidth,
                            type: 'euro',
                            isStacked: false,
                            key: `eup_base_${unit.id}_${actualPlacedEUPBase}`
                        });
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: palletLength, height: palletWidth });
                        totalAreaUsedByBasePallets += eupPalletDef.area;
                        actualPlacedEUPBase++;
                        unitEupPalletsPlacedBase++;
                        eupPalletsToPlace--;
                        rowPallets++;
                        rowHeight = Math.max(rowHeight, palletLength);
                        unit.currentY += palletWidth;

// New logic for adding a STACKED EUP on top of the base one just placed:
if (isStackable) {
    // Check if adding a stacked pallet would exceed the total requested EUP quantity.
    // `actualPlacedEUPBase` is the count of footprints.
    // `palletsVisual.filter(p => p.type === 'euro').length` is total visual EUPs (base+stacked) so far.
    const currentTotalEuroVisuals = unit.palletsVisual.filter(p => p.type === 'euro' && p.unitId === unit.id).length + 
                                   truckConfig.units.filter(u => u.id !== unit.id)
                                                 .reduce((sum, u) => sum + u.palletsVisual.filter(p => p.type === 'euro').length, 0);

    if (currentTotalEuroVisuals < eupQuantity) {
        unit.palletsVisual.push({
            x: unit.currentX, // Same X as the base pallet
            y: unit.currentY - palletWidth, // Same Y as the base pallet (before Y was advanced for next base)
            width: palletLength,
            height: palletWidth,
            type: 'euro',
            isStacked: true, // This is the top pallet of a stack
            key: `eup_stack_${unit.id}_${actualPlacedEUPBase-1}` // Links to the base pallet
        });
        // Note: We don't decrement eupPalletsToPlace here again, as it was for base footprints.
        // The total quantity check (currentTotalEuroVisuals < eupQuantity) manages overall count.
    }
}
                    } else {
                        break;
                    }
                }
                if (rowPallets === 0) {
                    unit.currentY = 0;
                    unit.currentX = unit.length; // Mark as full for EUPs
                    break;
                }
                unit.currentY = 0;
                unit.currentX += rowHeight;
                if (unit.currentX >= unit.length) break;
            }
        }
    }
    if (eupPalletsToPlace > 0) {
        newWarnings.push(`Could not fit all ${eupQuantity} Euro pallets. Only ${actualPlacedEUPBase} base pallets placed.`);
    }

    // Consolidate visual arrangements from all units
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

    setLoadedEuroPallets(actualPlacedEUPBase);
    setLoadedIndustrialPallets(actualPlacedDINBase);

    const totalTruckArea = truckConfig.units.reduce((sum, u) => sum + (u.length * u.width), 0);
    const calculatedUtilization = totalTruckArea > 0 ? (totalAreaUsedByBasePallets / totalTruckArea) * 100 : 0;
    setUtilizationPercentage(parseFloat(calculatedUtilization.toFixed(1)));

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

    if (newWarnings.length === 0 && (eupQuantity > 0 || dinQuantity > 0) && (actualPlacedEUPBase === eupQuantity && actualPlacedDINBase === dinQuantity) ) {
      newWarnings.push('All requested pallets placed successfully.');
    } else if (newWarnings.length === 0 && eupQuantity === 0 && dinQuantity === 0) {
        newWarnings.push('No pallets requested.');
    }
    setWarnings(newWarnings);

// Add this useEffect hook inside your HomePage component
useEffect(() => {
    const currentTruck = TRUCK_TYPES[selectedTruck];
    let singleLayerEUPCapacity = 0;
    let singleLayerDINCapacity = 0;

    // Calculate single layer capacities (example for curtain-sider)
    // This should be made more generic if you have many truck types with different capacities
    if (currentTruck.name === 'Curtain-Sider Semi-trailer (13.2m)') {
        // Assuming EUP long (3-across) for the 33 threshold
        // (1320 / 120) * 3 = 11 * 3 = 33
        singleLayerEUPCapacity = (eupLoadingPattern === 'long') ? 33 : 32; // 32 for broad (1320/80 * 2 = 16 * 2)

        // DIN (100cm along length, 120cm across width, 2-across)
        // (1320 / 100) * 2 = 13 * 2 = 26
        singleLayerDINCapacity = 26;
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
    // Consider if you want to automatically uncheck it if quantities drop below threshold.
    // The current logic only forces it on, it doesn't force it off.



  }, [selectedTruck, eupQuantity, dinQuantity, isStackable, cargoWeight, eupLoadingPattern]);

  useEffect(() => {
    calculateLoading();
  }, [calculateLoading]);

  const handleQuantityChange = (type, amount) => {
    if (type === 'eup') {
      setEupQuantity(prev => Math.max(0, (parseInt(prev, 10) || 0) + amount));
    } else if (type === 'din') {
      setDinQuantity(prev => Math.max(0, (parseInt(prev, 10) || 0) + amount));
    }
  };
  
const renderPallet = (pallet, displayScale = 0.2) => {
    const palletDetails = PALLET_TYPES[pallet.type];
    const displayWidth = pallet.height * displayScale; // Pallet's physical 'height' (Y-dim) is visual width
    const displayHeight = pallet.width * displayScale;  // Pallet's physical 'width' (X-dim) is visual height

    return (
      <div
        key={pallet.key}
        className={`absolute ${palletDetails.color} ${palletDetails.borderColor} border flex items-center justify-center`}
        style={{
          left: `${pallet.y * displayScale}px`,
          top: `${pallet.x * displayScale}px`,
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          opacity: pallet.isStacked ? 0.75 : 1, // Slightly adjusted opacity for stacked
          zIndex: pallet.isStacked ? 10 : 5,
        }}
      >
        {/* Label for the pallet */}
        <span className="text-xs text-black p-0.5 font-bold select-none">
          {palletDetails.label}
          {/* You could add numbering here if desired, e.g., based on pallet.key or a passed index */}
        </span>

        {/* Diagonal line for STACKED pallets */}
        {pallet.isStacked && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"
                 preserveAspectRatio="none"
                 viewBox={`0 0 ${pallet.height} ${pallet.width}`} // Use raw pallet dimensions for viewBox
                                                                  // to make stroke-width more consistent
            >
              {/* Diagonal line from top-left to bottom-right */}
              <line x1="0" y1="0" x2={pallet.height} y2={pallet.width} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
              {/* Alternatively, for top-right to bottom-left:
              <line x1={pallet.height} y1="0" x2="0" y2={pallet.width} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
              */}
            </svg>
          </div>
        )}
        {/* If it's a base pallet that IS part of a stack (but this pallet object is the base one)
            you might want a different indicator or to combine rendering.
            The current logic renders base and stacked pallets as separate visual items.
            So, the diagonal line will appear on the semi-transparent top pallet.
        */}
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
                  {selectedTruck === 'curtainSider' && (
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
            {selectedTruck === 'curtainSider' && <p className="text-xs text-gray-500 mt-2">Note: Shaded areas indicate unusable space on a 13.6m trailer, resulting in ~13.2m effective loading length.</p>}
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

