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

  // Row 1: 11 pallets (long orientation)
  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({
      x: i * 120, y: 0, width: 120, height: 80,
      type: 'euro', labelId: ++placed, isStackedTier: null, key: `eup_${placed}`,
    });
    currentWeight += allEupSingles[placed - 1]?.weight || 0;
  }
  // Row 2: 11 pallets
  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({
      x: i * 120, y: 80, width: 120, height: 80,
      type: 'euro', labelId: ++placed, isStackedTier: null, key: `eup_${placed}`,
    });
    currentWeight += allEupSingles[placed - 1]?.weight || 0;
  }
  // Row 3: 8 pallets
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({
      x: i * 120, y: 160, width: 120, height: 80,
      type: 'euro', labelId: ++placed, isStackedTier: null, key: `eup_${placed}`,
    });
    currentWeight += allEupSingles[placed - 1]?.weight || 0;
  }
  // Row 4: 8 pallets
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({
      x: i * 120, y: 240, width: 120, height: 80,
      type: 'euro', labelId: ++placed, isStackedTier: null, key: `eup_${placed}`,
    });
    currentWeight += allEupSingles[placed - 1]?.weight || 0;
  }

  return {
    palletArrangement: [{ unitId: truckConfig.units[0].id, unitLength: 1600, unitWidth: 290, pallets: placements }],
    loadedIndustrialPalletsBase: 0,
    loadedEuroPalletsBase: placed,
    totalDinPalletsVisual: 0,
    totalEuroPalletsVisual: placed,
    utilizationPercentage: 0,
    warnings: [],
    totalWeightKg: currentWeight,
    eupLoadingPatternUsed: 'custom',
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

  // 1. EXPAND PALLETS
  const allEups: { weight: number; stackable: boolean }[] = [];
  const allDins: { weight: number; stackable: boolean }[] = [];

  eupWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    for (let i = 0; i < q; i++) {
      allEups.push({ weight: w, stackable: currentIsEUPStackable && e.stackable !== false });
    }
  });

  dinWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    for (let i = 0; i < q; i++) {
      allDins.push({ weight: w, stackable: currentIsDINStackable && e.stackable !== false });
    }
  });

  const totalWeight = [...allDins, ...allEups].reduce((sum, p) => sum + p.weight, 0);
  const warnings: string[] = [];

  if (totalWeight > (truckConfig.maxGrossWeightKg || MAX_GROSS_WEIGHT_KG)) {
    warnings.push(
      `Warnung: Maximales zulässiges Gesamtgewicht von ${KILOGRAM_FORMATTER.format(
        truckConfig.maxGrossWeightKg || MAX_GROSS_WEIGHT_KG
      )} kg überschritten (${KILOGRAM_FORMATTER.format(totalWeight)} kg geladen).`
    );
  }

  // Determine EUP pattern (long = 3 per row, broad = 2 per row)
  let eupPattern: 'long' | 'broad' = 'long';
  if (currentEupLoadingPattern === 'broad') {
    eupPattern = 'broad';
  } else if (currentEupLoadingPattern === 'auto') {
    // Auto: long fits more on standard trucks
    const longRows = Math.floor(truckLength / 120);
    const broadRows = Math.floor(truckLength / 80);
    const longCapacity = longRows * 3;
    const broadCapacity = broadRows * 2;
    eupPattern = longCapacity >= broadCapacity ? 'long' : 'broad';
  }

  // Stacking support
  const stackingAllowed = capacity.supportsStacking;
  const dinCanStack = currentIsDINStackable && stackingAllowed;
  const eupCanStack = currentIsEUPStackable && stackingAllowed;

  // 2. CALCULATE FLOOR AND STACKED COUNTS
  const calcMath = (count: number, floorCap: number, stackCap: number, canStack: boolean) => {
    const floor = Math.min(count, floorCap);
    if (!canStack) return { floor, stacked: 0, total: floor, overflow: Math.max(0, count - floorCap) };
    const maxStack = Math.max(stackCap - floorCap, 0);
    const stacked = Math.min(Math.max(count - floorCap, 0), maxStack);
    return { floor, stacked, total: floor + stacked, overflow: Math.max(0, count - stackCap) };
  };

  const dinMath = calcMath(allDins.length, capacity.floorDIN, capacity.stackedDIN, dinCanStack);
  const eupMath = calcMath(allEups.length, capacity.floorEUP, capacity.stackedEUP, eupCanStack);

  if (dinMath.overflow > 0) {
    warnings.push(`${dinMath.overflow} DIN-Palette(n) konnten nicht geladen werden (Kapazität: ${capacity.stackedDIN}).`);
  }
  if (eupMath.overflow > 0) {
    warnings.push(`${eupMath.overflow} EUP-Palette(n) konnten nicht geladen werden (Kapazität: ${capacity.stackedEUP}).`);
  }

  // 3. DETERMINE BLOCK ORDER
  // Rule: If DIN stacked but EUP not → EUP front, DIN rear
  // Otherwise: DIN front, EUP rear (default)
  const dinStacked = dinMath.stacked > 0;
  const eupStacked = eupMath.stacked > 0;
  let dinFirst = true;
  if (dinStacked && !eupStacked) {
    dinFirst = false; // EUP goes front, DIN (stacked) goes rear
  }

  // 4. GENERATE VISUAL PLACEMENTS
  // DIN layout: 100cm rows, 2 pallets per row (120cm each across 245cm width)
  // EUP long: 120cm rows, 3 pallets per row (80cm each across 245cm width)
  // EUP broad: 80cm rows, 2 pallets per row (120cm each across 245cm width)

  const placements: any[] = [];
  let dinLabelCounter = 0;
  let eupLabelCounter = 0;

  // Generate DIN block
  const generateDinBlock = (startX: number): number => {
    if (dinMath.floor === 0) return 0;

    const rowDepth = 100; // DIN: 100cm along truck
    const palletWidth = 120; // DIN: 120cm across truck
    const palletsPerRow = 2;
    const numRows = Math.ceil(dinMath.floor / palletsPerRow);

    // Create floor position list (for stacking reference)
    type FloorPos = { row: number; col: number; x: number; y: number; labelId: number };
    const floorPositions: FloorPos[] = [];

    // Place floor pallets row by row
    for (let row = 0; row < numRows; row++) {
      const x = startX + row * rowDepth;
      const palletsThisRow = Math.min(palletsPerRow, dinMath.floor - row * palletsPerRow);
      for (let col = 0; col < palletsThisRow; col++) {
        const y = col === 0 ? 0 : (truckWidth - palletWidth);
        dinLabelCounter++;
        floorPositions.push({ row, col, x, y, labelId: dinLabelCounter });
        placements.push({
          x, y, width: rowDepth, height: palletWidth,
          type: 'industrial', labelId: dinLabelCounter,
          isStackedTier: null, showAsFraction: false,
          displayBaseLabelId: dinLabelCounter, displayStackedLabelId: null,
          key: `din_${dinLabelCounter}`,
        });
      }
    }

    // Add stacked pallets - start from LAST floor position (rear), go backward
    if (dinMath.stacked > 0) {
      for (let s = 0; s < dinMath.stacked; s++) {
        const floorIdx = floorPositions.length - 1 - s;
        if (floorIdx < 0) break;
        const basePos = floorPositions[floorIdx];
        dinLabelCounter++;

        // Update base pallet to show as stacked
        const basePallet = placements.find(
          (p: any) => p.type === 'industrial' && p.labelId === basePos.labelId
        );
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

    type FloorPos = { row: number; col: number; x: number; y: number; labelId: number };
    const floorPositions: FloorPos[] = [];

    for (let row = 0; row < numRows; row++) {
      const x = startX + row * rowDepth;
      const palletsThisRow = Math.min(palletsPerRow, eupMath.floor - row * palletsPerRow);

      for (let col = 0; col < palletsThisRow; col++) {
        let y: number;
        if (isLong && palletsPerRow === 3) {
          // 3 pallets of 80cm across 245cm width
          // Evenly distributed: y = 0, 82.5, 165 (with ~2.5cm gaps)
          const sectionWidth = truckWidth / palletsPerRow; // ~81.67
          y = Math.floor(col * sectionWidth + (sectionWidth - palletWidth) / 2);
        } else {
          // 2 pallets: one at y=0, one at y=truckWidth-palletWidth
          y = col === 0 ? 0 : (truckWidth - palletWidth);
        }

        eupLabelCounter++;
        floorPositions.push({ row, col, x, y, labelId: eupLabelCounter });
        placements.push({
          x, y, width: rowDepth, height: palletWidth,
          type: 'euro', labelId: eupLabelCounter,
          isStackedTier: null, showAsFraction: false,
          displayBaseLabelId: eupLabelCounter, displayStackedLabelId: null,
          key: `eup_${eupLabelCounter}`,
        });
      }
    }

    // Stacked EUP - from rear to front
    if (eupMath.stacked > 0) {
      for (let s = 0; s < eupMath.stacked; s++) {
        const floorIdx = floorPositions.length - 1 - s;
        if (floorIdx < 0) break;
        const basePos = floorPositions[floorIdx];
        eupLabelCounter++;

        const basePallet = placements.find(
          (p: any) => p.type === 'euro' && p.labelId === basePos.labelId
        );
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

  // 5. RETURN RESULT
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
