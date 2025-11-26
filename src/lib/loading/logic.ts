"use client";

export type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
  stackable?: boolean;
};

export type StackingStrategy = 'axle_safe' | 'max_pairs';

// --- CONSTANTS ---
export const MAX_GROSS_WEIGHT_KG = 24000;
export const MAX_PALLET_SIMULATION_QUANTITY = 300;
export const MAX_WEIGHT_PER_METER_KG = 1800;

export const KILOGRAM_FORMATTER = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

// --- TRUCK TYPES ---
export const TRUCK_TYPES = {
  curtainSider: {
    name: 'Tautliner / Planensattel (13,2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  roadTrain: {
    name: 'Hängerzug (2x 7,2m)',
    units: [
      { id: 'unit1', length: 720, width: 245, occupiedRects: [] },
      { id: 'unit2', length: 720, width: 245, occupiedRects: [] },
    ],
    totalLength: 1440,
    usableLength: 1440,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  standard13_2: {
    name: 'Planensattel (13,2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  mega13_6: {
    name: 'Mega (13,6m)',
    units: [{ id: 'main', length: 1360, width: 245, occupiedRects: [] }],
    totalLength: 1360,
    usableLength: 1360,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  frigo13_2: {
    name: 'Frigo (13,2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 20000,
  },
  smallTruck7_2: {
    name: 'Motorwagen (7,2m)',
    units: [{ id: 'main', length: 720, width: 245, occupiedRects: [] }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 12000,
  },
  waggon: {
    name: 'Waggon (16m)',
    units: [{ id: 'main', length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    maxGrossWeightKg: 28000,
  },
};

export const PALLET_TYPES = {
  euro: { name: 'Euro Palette (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80 },
  industrial: { name: 'Industrial Palette (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100 },
};

// --- TRUCK PALLET CAPACITY ---
export type TruckPalletCapacity = {
  floorDIN: number;
  floorEUP: number;
  stackedDIN: number;
  stackedEUP: number;
  supportsStacking: boolean;
};

export const TRUCK_CAPACITY_BY_TYPE: Record<keyof typeof TRUCK_TYPES, TruckPalletCapacity> = {
  curtainSider: { floorDIN: 26, floorEUP: 33, stackedDIN: 52, stackedEUP: 66, supportsStacking: true },
  standard13_2: { floorDIN: 26, floorEUP: 33, stackedDIN: 52, stackedEUP: 66, supportsStacking: true },
  mega13_6: { floorDIN: 26, floorEUP: 34, stackedDIN: 52, stackedEUP: 68, supportsStacking: true },
  frigo13_2: { floorDIN: 26, floorEUP: 33, stackedDIN: 52, stackedEUP: 66, supportsStacking: true },
  smallTruck7_2: { floorDIN: 14, floorEUP: 18, stackedDIN: 28, stackedEUP: 36, supportsStacking: true },
  roadTrain: { floorDIN: 28, floorEUP: 36, stackedDIN: 56, stackedEUP: 72, supportsStacking: true },
  waggon: { floorDIN: 32, floorEUP: 38, stackedDIN: 32, stackedEUP: 38, supportsStacking: false },
};

// --- WAGGON SPECIAL LOGIC ---
export const calculateWaggonEuroLayout = (eupWeights: WeightEntry[], truckConfig: any) => {
  const allEupSingles = eupWeights.flatMap(e => Array(e.quantity).fill({ weight: parseFloat(e.weight) || 0 }));
  const count = Math.min(allEupSingles.length, 38);
  const placements: any[] = [];
  let currentWeight = 0;
  let placed = 0;

  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({ x: i * 120, y: 0, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null, key: `eup_${placed}` });
    currentWeight += allEupSingles[placed - 1]?.weight || 0;
  }
  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({ x: i * 120, y: 80, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null, key: `eup_${placed}` });
    currentWeight += allEupSingles[placed - 1]?.weight || 0;
  }
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({ x: i * 120, y: 160, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null, key: `eup_${placed}` });
    currentWeight += allEupSingles[placed - 1]?.weight || 0;
  }
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({ x: i * 120, y: 240, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null, key: `eup_${placed}` });
    currentWeight += allEupSingles[placed - 1]?.weight || 0;
  }

  const warnings: string[] = [];
  if (allEupSingles.length > 38) {
    warnings.push(`${allEupSingles.length - 38} EUP-Palette(n) konnten nicht geladen werden (Waggon max: 38).`);
  }

  return {
    palletArrangement: [{ unitId: truckConfig.units[0].id, unitLength: 1600, unitWidth: 290, pallets: placements }],
    loadedIndustrialPalletsBase: 0, loadedEuroPalletsBase: placed,
    totalDinPalletsVisual: 0, totalEuroPalletsVisual: placed,
    utilizationPercentage: 0, warnings, totalWeightKg: currentWeight, eupLoadingPatternUsed: 'custom',
  };
};

// --- MAIN LOGIC ---
export const calculateLoadingLogic = (
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  currentIsEUPStackable: boolean,
  currentIsDINStackable: boolean,
  currentEupLoadingPattern: 'auto' | 'long' | 'broad',
  placementOrder: 'DIN_FIRST' | 'EUP_FIRST' = 'DIN_FIRST',
  _maxEupIgnored?: any,
  _maxDinIgnored?: any,
  _stackingStrategy: StackingStrategy = 'axle_safe'
) => {
  const truckConfig = TRUCK_TYPES[truckKey];
  const capacity = TRUCK_CAPACITY_BY_TYPE[truckKey];
  const truckLength = truckConfig.usableLength;
  const truckWidth = truckConfig.maxWidth;

  // For multi-unit trucks, get unit boundaries
  const units = truckConfig.units;
  const unitBoundaries: number[] = [];
  let boundaryX = 0;
  for (const unit of units) {
    boundaryX += unit.length;
    unitBoundaries.push(boundaryX);
  }

  // 1. EXPAND PALLETS
  type PalletSingle = { weight: number; stackable: boolean; entryId: number };
  const allEups: PalletSingle[] = [];
  const allDins: PalletSingle[] = [];

  eupWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    const isStackable = currentIsEUPStackable && e.stackable === true;
    for (let i = 0; i < q; i++) {
      allEups.push({ weight: w, stackable: isStackable, entryId: e.id });
    }
  });

  // Sort EUPs: non-stackable first (front), stackable last (rear)
  allEups.sort((a, b) => (a.stackable ? 1 : 0) - (b.stackable ? 1 : 0));

  dinWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    const isStackable = currentIsDINStackable && e.stackable === true;
    for (let i = 0; i < q; i++) {
      allDins.push({ weight: w, stackable: isStackable, entryId: e.id });
    }
  });

  // Sort DINs: non-stackable first (front), stackable last (rear)
  allDins.sort((a, b) => (a.stackable ? 1 : 0) - (b.stackable ? 1 : 0));

  const totalWeight = [...allDins, ...allEups].reduce((sum, p) => sum + p.weight, 0);
  const warnings: string[] = [];

  if (totalWeight > (truckConfig.maxGrossWeightKg || MAX_GROSS_WEIGHT_KG)) {
    warnings.push(
      `Gewichtslimit überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg (Max: ${KILOGRAM_FORMATTER.format(truckConfig.maxGrossWeightKg || MAX_GROSS_WEIGHT_KG)} kg).`
    );
  }

  const stackingAllowed = capacity.supportsStacking;
  const stackableEupCount = allEups.filter(p => p.stackable).length;
  const stackableDinCount = allDins.filter(p => p.stackable).length;

  // Helper: check if a pallet at position x with given width fits without crossing unit boundary
  const fitsInUnit = (x: number, width: number): boolean => {
    for (const boundary of unitBoundaries) {
      if (x < boundary && x + width > boundary) {
        return false; // Crosses boundary
      }
    }
    return x + width <= truckLength;
  };

  // 2. PLACEMENT DATA
  type FloorPos = { x: number; y: number; width: number; height: number; labelId: number; canStack: boolean; type: 'euro' | 'industrial' };
  const floorPositions: FloorPos[] = [];
  const placements: any[] = [];
  let dinLabelCounter = 0;
  let eupLabelCounter = 0;

  // 3. PLACE DIN PALLETS
  const dinRowDepth = 100;
  const dinPalletWidth = 120;
  const dinPerRow = 2;
  
  let currentX = 0;
  let dinPlaced = 0;
  const dinToPlace = Math.min(allDins.length, capacity.floorDIN);

  while (dinPlaced < dinToPlace && currentX + dinRowDepth <= truckLength) {
    // Check if this row fits without crossing unit boundary
    if (!fitsInUnit(currentX, dinRowDepth)) {
      // Skip to next unit boundary
      for (const boundary of unitBoundaries) {
        if (currentX < boundary) {
          currentX = boundary;
          break;
        }
      }
      continue;
    }

    const palletsThisRow = Math.min(dinPerRow, dinToPlace - dinPlaced);
    for (let col = 0; col < palletsThisRow; col++) {
      const y = col === 0 ? 0 : (truckWidth - dinPalletWidth);
      dinLabelCounter++;
      const canStack = dinPlaced < allDins.length && allDins[dinPlaced].stackable;
      
      floorPositions.push({
        x: currentX, y, width: dinRowDepth, height: dinPalletWidth,
        labelId: dinLabelCounter, canStack, type: 'industrial'
      });
      placements.push({
        x: currentX, y, width: dinRowDepth, height: dinPalletWidth,
        type: 'industrial', labelId: dinLabelCounter,
        isStackedTier: null, showAsFraction: false,
        displayBaseLabelId: dinLabelCounter, displayStackedLabelId: null,
        key: `din_${dinLabelCounter}`,
      });
      dinPlaced++;
    }
    currentX += dinRowDepth;
  }

  // 4. PLACE EUP PALLETS - Use mixed orientation to maximize fit
  const eupToPlace = Math.min(allEups.length, capacity.floorEUP);
  let eupPlaced = 0;
  const remainingLength = truckLength - currentX;

  // Calculate optimal EUP placement for remaining space
  // Try: all long, all broad, or mixed (long rows first, then broad)
  const calcEupFit = (length: number, pattern: 'long' | 'broad' | 'mixed'): { count: number; usedLength: number } => {
    if (pattern === 'long') {
      const rows = Math.floor(length / 120);
      return { count: rows * 3, usedLength: rows * 120 };
    } else if (pattern === 'broad') {
      const rows = Math.floor(length / 80);
      return { count: rows * 2, usedLength: rows * 80 };
    } else {
      // Mixed: try long rows first, then fill with broad
      let best = { count: 0, usedLength: 0 };
      for (let longRows = Math.floor(length / 120); longRows >= 0; longRows--) {
        const usedByLong = longRows * 120;
        const remaining = length - usedByLong;
        const broadRows = Math.floor(remaining / 80);
        const total = longRows * 3 + broadRows * 2;
        if (total > best.count) {
          best = { count: total, usedLength: usedByLong + broadRows * 80 };
        }
      }
      return best;
    }
  };

  // Determine best pattern
  let eupPattern: 'long' | 'broad' | 'mixed' = 'long';
  if (currentEupLoadingPattern === 'broad') {
    eupPattern = 'broad';
  } else if (currentEupLoadingPattern === 'long') {
    eupPattern = 'long';
  } else {
    // Auto: find best fit for remaining space
    const longFit = calcEupFit(remainingLength, 'long');
    const broadFit = calcEupFit(remainingLength, 'broad');
    const mixedFit = calcEupFit(remainingLength, 'mixed');
    
    const maxCount = Math.max(longFit.count, broadFit.count, mixedFit.count);
    if (mixedFit.count === maxCount) eupPattern = 'mixed';
    else if (broadFit.count > longFit.count) eupPattern = 'broad';
    else eupPattern = 'long';
  }

  // Place EUP with chosen/calculated pattern
  if (eupPattern === 'mixed') {
    // First place long rows, then broad rows
    const longRowDepth = 120;
    const longPalletWidth = 80;
    const longPerRow = 3;
    
    // How many long rows can we fit?
    let tempX = currentX;
    while (eupPlaced < eupToPlace && tempX + longRowDepth <= truckLength) {
      if (!fitsInUnit(tempX, longRowDepth)) {
        for (const boundary of unitBoundaries) {
          if (tempX < boundary) { tempX = boundary; break; }
        }
        continue;
      }
      
      const palletsThisRow = Math.min(longPerRow, eupToPlace - eupPlaced);
      if (palletsThisRow < longPerRow && tempX + 80 <= truckLength) {
        // Not enough for full long row, switch to broad
        break;
      }
      
      for (let col = 0; col < palletsThisRow; col++) {
        const sectionWidth = truckWidth / longPerRow;
        const y = Math.floor(col * sectionWidth + (sectionWidth - longPalletWidth) / 2);
        eupLabelCounter++;
        const canStack = eupPlaced < allEups.length && allEups[eupPlaced].stackable;
        
        floorPositions.push({
          x: tempX, y, width: longRowDepth, height: longPalletWidth,
          labelId: eupLabelCounter, canStack, type: 'euro'
        });
        placements.push({
          x: tempX, y, width: longRowDepth, height: longPalletWidth,
          type: 'euro', labelId: eupLabelCounter,
          isStackedTier: null, showAsFraction: false,
          displayBaseLabelId: eupLabelCounter, displayStackedLabelId: null,
          key: `eup_${eupLabelCounter}`,
        });
        eupPlaced++;
      }
      tempX += longRowDepth;
    }
    
    // Now fill remaining with broad rows
    const broadRowDepth = 80;
    const broadPalletWidth = 120;
    const broadPerRow = 2;
    
    while (eupPlaced < eupToPlace && tempX + broadRowDepth <= truckLength) {
      if (!fitsInUnit(tempX, broadRowDepth)) {
        for (const boundary of unitBoundaries) {
          if (tempX < boundary) { tempX = boundary; break; }
        }
        continue;
      }
      
      const palletsThisRow = Math.min(broadPerRow, eupToPlace - eupPlaced);
      for (let col = 0; col < palletsThisRow; col++) {
        const y = col === 0 ? 0 : (truckWidth - broadPalletWidth);
        eupLabelCounter++;
        const canStack = eupPlaced < allEups.length && allEups[eupPlaced].stackable;
        
        floorPositions.push({
          x: tempX, y, width: broadRowDepth, height: broadPalletWidth,
          labelId: eupLabelCounter, canStack, type: 'euro'
        });
        placements.push({
          x: tempX, y, width: broadRowDepth, height: broadPalletWidth,
          type: 'euro', labelId: eupLabelCounter,
          isStackedTier: null, showAsFraction: false,
          displayBaseLabelId: eupLabelCounter, displayStackedLabelId: null,
          key: `eup_${eupLabelCounter}`,
        });
        eupPlaced++;
      }
      tempX += broadRowDepth;
    }
    currentX = tempX;
  } else {
    // Single pattern (long or broad)
    const isLong = eupPattern === 'long';
    const rowDepth = isLong ? 120 : 80;
    const palletWidth = isLong ? 80 : 120;
    const perRow = isLong ? 3 : 2;
    
    while (eupPlaced < eupToPlace && currentX + rowDepth <= truckLength) {
      if (!fitsInUnit(currentX, rowDepth)) {
        for (const boundary of unitBoundaries) {
          if (currentX < boundary) { currentX = boundary; break; }
        }
        continue;
      }
      
      const palletsThisRow = Math.min(perRow, eupToPlace - eupPlaced);
      for (let col = 0; col < palletsThisRow; col++) {
        let y: number;
        if (isLong && perRow === 3) {
          const sectionWidth = truckWidth / perRow;
          y = Math.floor(col * sectionWidth + (sectionWidth - palletWidth) / 2);
        } else {
          y = col === 0 ? 0 : (truckWidth - palletWidth);
        }
        
        eupLabelCounter++;
        const canStack = eupPlaced < allEups.length && allEups[eupPlaced].stackable;
        
        floorPositions.push({
          x: currentX, y, width: rowDepth, height: palletWidth,
          labelId: eupLabelCounter, canStack, type: 'euro'
        });
        placements.push({
          x: currentX, y, width: rowDepth, height: palletWidth,
          type: 'euro', labelId: eupLabelCounter,
          isStackedTier: null, showAsFraction: false,
          displayBaseLabelId: eupLabelCounter, displayStackedLabelId: null,
          key: `eup_${eupLabelCounter}`,
        });
        eupPlaced++;
      }
      currentX += rowDepth;
    }
  }

  // 5. STACKING - from rear (highest x) to front
  // Sort floor positions by x descending (rear first), then by y descending
  const dinFloorPositions = floorPositions.filter(p => p.type === 'industrial').sort((a, b) => b.x - a.x || b.y - a.y);
  const eupFloorPositions = floorPositions.filter(p => p.type === 'euro').sort((a, b) => b.x - a.x || b.y - a.y);

  // Calculate stacking amounts
  const dinNeedStack = Math.max(0, allDins.length - dinPlaced);
  const eupNeedStack = Math.max(0, allEups.length - eupPlaced);
  
  const dinCanStackCount = dinFloorPositions.filter(p => p.canStack).length;
  const eupCanStackCount = eupFloorPositions.filter(p => p.canStack).length;
  
  const dinStackCount = Math.min(dinNeedStack, dinCanStackCount, capacity.stackedDIN - capacity.floorDIN);
  const eupStackCount = Math.min(eupNeedStack, eupCanStackCount, capacity.stackedEUP - capacity.floorEUP);

  // Stack DIN
  let dinStacked = 0;
  for (const pos of dinFloorPositions) {
    if (dinStacked >= dinStackCount) break;
    if (!pos.canStack) continue;
    
    dinLabelCounter++;
    dinStacked++;
    
    const basePallet = placements.find((p: any) => p.type === 'industrial' && p.labelId === pos.labelId);
    if (basePallet) {
      basePallet.isStackedTier = 'base';
      basePallet.showAsFraction = true;
      basePallet.displayStackedLabelId = dinLabelCounter;
    }
    
    placements.push({
      x: pos.x, y: pos.y, width: pos.width, height: pos.height,
      type: 'industrial', labelId: dinLabelCounter,
      isStackedTier: 'top', showAsFraction: true,
      displayBaseLabelId: pos.labelId, displayStackedLabelId: dinLabelCounter,
      key: `din_${dinLabelCounter}_top`,
    });
  }

  // Stack EUP
  let eupStacked = 0;
  for (const pos of eupFloorPositions) {
    if (eupStacked >= eupStackCount) break;
    if (!pos.canStack) continue;
    
    eupLabelCounter++;
    eupStacked++;
    
    const basePallet = placements.find((p: any) => p.type === 'euro' && p.labelId === pos.labelId);
    if (basePallet) {
      basePallet.isStackedTier = 'base';
      basePallet.showAsFraction = true;
      basePallet.displayStackedLabelId = eupLabelCounter;
    }
    
    placements.push({
      x: pos.x, y: pos.y, width: pos.width, height: pos.height,
      type: 'euro', labelId: eupLabelCounter,
      isStackedTier: 'top', showAsFraction: true,
      displayBaseLabelId: pos.labelId, displayStackedLabelId: eupLabelCounter,
      key: `eup_${eupLabelCounter}_top`,
    });
  }

  // 6. WARNINGS AND STATS
  const totalDinLoaded = dinPlaced + dinStacked;
  const totalEupLoaded = eupPlaced + eupStacked;
  
  if (allDins.length > totalDinLoaded) {
    const overflow = allDins.length - totalDinLoaded;
    if (stackableDinCount === 0 && currentIsDINStackable && allDins.length > dinPlaced) {
      warnings.push(`${overflow} DIN-Palette(n) passen nicht - keine als stapelbar markiert.`);
    } else {
      warnings.push(`${overflow} DIN-Palette(n) konnten nicht geladen werden.`);
    }
  }
  
  if (allEups.length > totalEupLoaded) {
    const overflow = allEups.length - totalEupLoaded;
    if (stackableEupCount === 0 && currentIsEUPStackable && allEups.length > eupPlaced) {
      warnings.push(`${overflow} EUP-Palette(n) passen nicht - keine als stapelbar markiert.`);
    } else {
      warnings.push(`${overflow} EUP-Palette(n) konnten nicht geladen werden.`);
    }
  }

  if (dinStacked > 0) warnings.push(`${dinStacked} DIN-Palette(n) gestapelt.`);
  if (eupStacked > 0) warnings.push(`${eupStacked} EUP-Palette(n) gestapelt.`);

  if (totalDinLoaded > 0 || totalEupLoaded > 0) {
    const parts: string[] = [];
    if (totalDinLoaded > 0) parts.push(`${totalDinLoaded} DIN`);
    if (totalEupLoaded > 0) parts.push(`${totalEupLoaded} EUP`);
    warnings.unshift(`Geladen: ${parts.join(' + ')} Palette(n).`);
  }

  const utilizationPercentage = truckLength > 0 
    ? parseFloat(((currentX / truckLength) * 100).toFixed(1)) 
    : 0;

  // 7. SPLIT INTO UNITS (for multi-unit trucks like road train)
  if (units.length > 1) {
    const unitArrangements = units.map((unit: any, unitIndex: number) => {
      let unitStartX = 0;
      for (let i = 0; i < unitIndex; i++) {
        unitStartX += units[i].length;
      }
      const unitEndX = unitStartX + unit.length;

      const unitPallets = placements
        .filter((p: any) => p.x >= unitStartX && p.x + p.width <= unitEndX)
        .map((p: any) => ({
          ...p,
          x: p.x - unitStartX,
          key: `${unit.id}_${p.key}`,
        }));

      return {
        unitId: unit.id,
        unitLength: unit.length,
        unitWidth: unit.width,
        pallets: unitPallets,
      };
    });

    return {
      palletArrangement: unitArrangements,
      loadedIndustrialPalletsBase: dinPlaced,
      loadedEuroPalletsBase: eupPlaced,
      totalDinPalletsVisual: totalDinLoaded,
      totalEuroPalletsVisual: totalEupLoaded,
      utilizationPercentage,
      warnings: Array.from(new Set(warnings)),
      totalWeightKg: totalWeight,
      eupLoadingPatternUsed: eupPattern === 'mixed' ? 'auto' : eupPattern,
    };
  }

  return {
    palletArrangement: [{
      unitId: truckConfig.units[0].id,
      unitLength: truckConfig.units[0].length,
      unitWidth: truckConfig.units[0].width,
      pallets: placements,
    }],
    loadedIndustrialPalletsBase: dinPlaced,
    loadedEuroPalletsBase: eupPlaced,
    totalDinPalletsVisual: totalDinLoaded,
    totalEuroPalletsVisual: totalEupLoaded,
    utilizationPercentage,
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: eupPattern === 'mixed' ? 'auto' : eupPattern,
  };
};
