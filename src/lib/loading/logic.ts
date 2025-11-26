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

  // 1. EXPAND PALLETS - tracking which are stackable per entry
  type PalletSingle = { weight: number; stackable: boolean; entryId: number };
  const allEups: PalletSingle[] = [];
  const allDins: PalletSingle[] = [];

  eupWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    // Pallet is stackable only if: global stacking enabled AND this entry marked stackable
    const isStackable = currentIsEUPStackable && e.stackable === true;
    for (let i = 0; i < q; i++) {
      allEups.push({ weight: w, stackable: isStackable, entryId: e.id });
    }
  });

  dinWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    const isStackable = currentIsDINStackable && e.stackable === true;
    for (let i = 0; i < q; i++) {
      allDins.push({ weight: w, stackable: isStackable, entryId: e.id });
    }
  });

  const totalWeight = [...allDins, ...allEups].reduce((sum, p) => sum + p.weight, 0);
  const warnings: string[] = [];

  if (totalWeight > (truckConfig.maxGrossWeightKg || MAX_GROSS_WEIGHT_KG)) {
    warnings.push(
      `Gewichtslimit überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg geladen (Max: ${KILOGRAM_FORMATTER.format(truckConfig.maxGrossWeightKg || MAX_GROSS_WEIGHT_KG)} kg).`
    );
  }

  // Determine best EUP pattern
  // Long: 120cm rows, 3 pallets per row (80cm each)
  // Broad: 80cm rows, 2 pallets per row (120cm each)
  let eupPattern: 'long' | 'broad' = 'long';
  if (currentEupLoadingPattern === 'broad') {
    eupPattern = 'broad';
  } else if (currentEupLoadingPattern === 'long') {
    eupPattern = 'long';
  } else {
    // Auto: choose based on which gives more capacity
    const longRows = Math.floor(truckLength / 120);
    const broadRows = Math.floor(truckLength / 80);
    const longCapacity = longRows * 3;
    const broadCapacity = broadRows * 2;
    
    // For mega (13.6m), broad gives 34 vs long gives 33
    if (broadCapacity > longCapacity) {
      eupPattern = 'broad';
    } else {
      eupPattern = 'long';
    }
  }

  // Stacking support
  const stackingAllowed = capacity.supportsStacking;

  // Count how many pallets can actually be stacked (based on per-entry stackable flag)
  const stackableEupCount = allEups.filter(p => p.stackable).length;
  const stackableDinCount = allDins.filter(p => p.stackable).length;

  // 2. CALCULATE FLOOR AND STACKED COUNTS
  const calcMath = (total: number, stackableCount: number, floorCap: number, stackCap: number, canStack: boolean) => {
    const floor = Math.min(total, floorCap);
    if (!canStack || stackableCount === 0) {
      return { floor, stacked: 0, total: floor, overflow: Math.max(0, total - floorCap) };
    }
    
    // How many need to be stacked?
    const needToStack = Math.max(0, total - floorCap);
    // How many CAN be stacked? Limited by stackable count and capacity
    const maxStackable = Math.min(stackableCount, stackCap - floorCap);
    const stacked = Math.min(needToStack, maxStackable);
    
    const placed = floor + stacked;
    return { floor, stacked, total: placed, overflow: Math.max(0, total - placed) };
  };

  const dinMath = calcMath(allDins.length, stackableDinCount, capacity.floorDIN, capacity.stackedDIN, stackingAllowed && currentIsDINStackable);
  const eupMath = calcMath(allEups.length, stackableEupCount, capacity.floorEUP, capacity.stackedEUP, stackingAllowed && currentIsEUPStackable);

  // Generate appropriate messages
  if (dinMath.overflow > 0) {
    if (stackableDinCount === 0 && currentIsDINStackable) {
      warnings.push(`${dinMath.overflow} DIN-Palette(n) passen nicht - keine als stapelbar markiert.`);
    } else {
      warnings.push(`${dinMath.overflow} DIN-Palette(n) konnten nicht geladen werden.`);
    }
  }
  if (eupMath.overflow > 0) {
    if (stackableEupCount === 0 && currentIsEUPStackable) {
      warnings.push(`${eupMath.overflow} EUP-Palette(n) passen nicht - keine als stapelbar markiert.`);
    } else {
      warnings.push(`${eupMath.overflow} EUP-Palette(n) konnten nicht geladen werden.`);
    }
  }

  // Info about stacking
  if (dinMath.stacked > 0) {
    warnings.push(`${dinMath.stacked} DIN-Palette(n) gestapelt.`);
  }
  if (eupMath.stacked > 0) {
    warnings.push(`${eupMath.stacked} EUP-Palette(n) gestapelt.`);
  }

  // 3. DETERMINE BLOCK ORDER
  const dinStacked = dinMath.stacked > 0;
  const eupStacked = eupMath.stacked > 0;
  let dinFirst = true;
  if (dinStacked && !eupStacked) {
    dinFirst = false; // EUP front, DIN (stacked) rear
  }

  // 4. GENERATE VISUAL PLACEMENTS
  const placements: any[] = [];
  let dinLabelCounter = 0;
  let eupLabelCounter = 0;

  // Generate DIN block
  const generateDinBlock = (startX: number): number => {
    if (dinMath.floor === 0) return 0;

    const rowDepth = 100; // 100cm along truck
    const palletWidth = 120; // 120cm across truck
    const palletsPerRow = 2;
    const numRows = Math.ceil(dinMath.floor / palletsPerRow);

    type FloorPos = { row: number; col: number; x: number; y: number; labelId: number; canStack: boolean };
    const floorPositions: FloorPos[] = [];

    // Place floor pallets
    let palletIdx = 0;
    for (let row = 0; row < numRows; row++) {
      const x = startX + row * rowDepth;
      const palletsThisRow = Math.min(palletsPerRow, dinMath.floor - row * palletsPerRow);
      for (let col = 0; col < palletsThisRow; col++) {
        const y = col === 0 ? 0 : (truckWidth - palletWidth);
        dinLabelCounter++;
        const canStack = palletIdx < allDins.length && allDins[palletIdx].stackable;
        floorPositions.push({ row, col, x, y, labelId: dinLabelCounter, canStack });
        placements.push({
          x, y, width: rowDepth, height: palletWidth,
          type: 'industrial', labelId: dinLabelCounter,
          isStackedTier: null, showAsFraction: false,
          displayBaseLabelId: dinLabelCounter, displayStackedLabelId: null,
          key: `din_${dinLabelCounter}`,
        });
        palletIdx++;
      }
    }

    // Stack pallets - from rear (last position) to front, only on stackable positions
    if (dinMath.stacked > 0) {
      let stackedCount = 0;
      // Go from last position backward
      for (let i = floorPositions.length - 1; i >= 0 && stackedCount < dinMath.stacked; i--) {
        const basePos = floorPositions[i];
        if (!basePos.canStack) continue; // Skip non-stackable positions

        dinLabelCounter++;
        stackedCount++;

        // Update base pallet
        const basePallet = placements.find((p: any) => p.type === 'industrial' && p.labelId === basePos.labelId);
        if (basePallet) {
          basePallet.isStackedTier = 'base';
          basePallet.showAsFraction = true;
          basePallet.displayStackedLabelId = dinLabelCounter;
        }

        // Add top pallet
        placements.push({
          x: basePos.x, y: basePos.y, width: rowDepth, height: palletWidth,
          type: 'industrial', labelId: dinLabelCounter,
          isStackedTier: 'top', showAsFraction: true,
          displayBaseLabelId: basePos.labelId, displayStackedLabelId: dinLabelCounter,
          key: `din_${dinLabelCounter}_top`,
        });
      }
    }

    return numRows * rowDepth;
  };

  // Generate EUP block
  const generateEupBlock = (startX: number): number => {
    if (eupMath.floor === 0) return 0;

    const isLong = eupPattern === 'long';
    const rowDepth = isLong ? 120 : 80;
    const palletWidth = isLong ? 80 : 120;
    const palletsPerRow = isLong ? 3 : 2;
    const numRows = Math.ceil(eupMath.floor / palletsPerRow);

    type FloorPos = { row: number; col: number; x: number; y: number; labelId: number; canStack: boolean };
    const floorPositions: FloorPos[] = [];

    let palletIdx = 0;
    for (let row = 0; row < numRows; row++) {
      const x = startX + row * rowDepth;
      const palletsThisRow = Math.min(palletsPerRow, eupMath.floor - row * palletsPerRow);

      for (let col = 0; col < palletsThisRow; col++) {
        let y: number;
        if (isLong && palletsPerRow === 3) {
          // 3 pallets of 80cm across 245cm: evenly distributed
          const sectionWidth = truckWidth / palletsPerRow;
          y = Math.floor(col * sectionWidth + (sectionWidth - palletWidth) / 2);
        } else {
          // 2 pallets: y=0 and y=truckWidth-palletWidth
          y = col === 0 ? 0 : (truckWidth - palletWidth);
        }

        eupLabelCounter++;
        const canStack = palletIdx < allEups.length && allEups[palletIdx].stackable;
        floorPositions.push({ row, col, x, y, labelId: eupLabelCounter, canStack });
        placements.push({
          x, y, width: rowDepth, height: palletWidth,
          type: 'euro', labelId: eupLabelCounter,
          isStackedTier: null, showAsFraction: false,
          displayBaseLabelId: eupLabelCounter, displayStackedLabelId: null,
          key: `eup_${eupLabelCounter}`,
        });
        palletIdx++;
      }
    }

    // Stack EUP - from rear to front, only on stackable positions
    if (eupMath.stacked > 0) {
      let stackedCount = 0;
      for (let i = floorPositions.length - 1; i >= 0 && stackedCount < eupMath.stacked; i--) {
        const basePos = floorPositions[i];
        if (!basePos.canStack) continue;

        eupLabelCounter++;
        stackedCount++;

        const basePallet = placements.find((p: any) => p.type === 'euro' && p.labelId === basePos.labelId);
        if (basePallet) {
          basePallet.isStackedTier = 'base';
          basePallet.showAsFraction = true;
          basePallet.displayStackedLabelId = eupLabelCounter;
        }

        placements.push({
          x: basePos.x, y: basePos.y, width: rowDepth, height: palletWidth,
          type: 'euro', labelId: eupLabelCounter,
          isStackedTier: 'top', showAsFraction: true,
          displayBaseLabelId: basePos.labelId, displayStackedLabelId: eupLabelCounter,
          key: `eup_${eupLabelCounter}_top`,
        });
      }
    }

    return numRows * rowDepth;
  };

  // Place blocks in order
  let currentX = 0;
  let dinBlockLen = 0;
  let eupBlockLen = 0;

  if (dinFirst) {
    dinBlockLen = generateDinBlock(currentX);
    currentX += dinBlockLen;
    eupBlockLen = generateEupBlock(currentX);
  } else {
    eupBlockLen = generateEupBlock(currentX);
    currentX += eupBlockLen;
    dinBlockLen = generateDinBlock(currentX);
  }

  const totalUsedLength = dinBlockLen + eupBlockLen;
  const utilizationPercentage = truckLength > 0 
    ? parseFloat(((totalUsedLength / truckLength) * 100).toFixed(1)) 
    : 0;

  // Summary message
  if (dinMath.total > 0 || eupMath.total > 0) {
    const parts: string[] = [];
    if (dinMath.total > 0) parts.push(`${dinMath.total} DIN`);
    if (eupMath.total > 0) parts.push(`${eupMath.total} EUP`);
    warnings.unshift(`Geladen: ${parts.join(' + ')} Palette(n).`);
  }

  return {
    palletArrangement: [{
      unitId: truckConfig.units[0].id,
      unitLength: truckConfig.units[0].length,
      unitWidth: truckConfig.units[0].width,
      pallets: placements,
    }],
    loadedIndustrialPalletsBase: dinMath.floor,
    loadedEuroPalletsBase: eupMath.floor,
    totalDinPalletsVisual: dinMath.total,
    totalEuroPalletsVisual: eupMath.total,
    utilizationPercentage,
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: eupPattern,
  };
};
