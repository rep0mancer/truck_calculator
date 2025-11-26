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
    units: [
      { id: 'main', length: 1320, width: 245, occupiedRects: [] },
    ],
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
    units: [
      { id: 'main', length: 1320, width: 245, occupiedRects: [] },
    ],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  mega13_6: {
    name: 'Mega (13,6m)',
    units: [
      { id: 'main', length: 1360, width: 245, occupiedRects: [] },
    ],
    totalLength: 1360,
    usableLength: 1360,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  frigo13_2: {
    name: 'Frigo (13,2m)',
    units: [
      { id: 'main', length: 1320, width: 245, occupiedRects: [] },
    ],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 20000,
  },
  smallTruck7_2: {
    name: 'Motorwagen (7,2m)',
    units: [
      { id: 'main', length: 720, width: 245, occupiedRects: [] },
    ],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 12000,
  },
  waggon: {
    name: 'Waggon (16m)',
    units: [
      { id: 'main', length: 1600, width: 290, occupiedRects: [] },
    ],
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

// --- TRUCK PALLET CAPACITY CONFIGURATION ---
export type TruckPalletCapacity = {
  floorDIN: number;
  floorEUP: number;
  stackedDIN: number;
  stackedEUP: number;
  supportsStacking: boolean;
};

export const TRUCK_CAPACITY_BY_TYPE: Record<keyof typeof TRUCK_TYPES, TruckPalletCapacity> = {
  curtainSider: {
    floorDIN: 26,
    floorEUP: 33,
    stackedDIN: 52,
    stackedEUP: 66,
    supportsStacking: true,
  },
  standard13_2: {
    floorDIN: 26,
    floorEUP: 33,
    stackedDIN: 52,
    stackedEUP: 66,
    supportsStacking: true,
  },
  mega13_6: {
    floorDIN: 26,
    floorEUP: 34,
    stackedDIN: 52,
    stackedEUP: 68,
    supportsStacking: true,
  },
  frigo13_2: {
    floorDIN: 26,
    floorEUP: 33,
    stackedDIN: 52,
    stackedEUP: 66,
    supportsStacking: true,
  },
  smallTruck7_2: {
    floorDIN: 14,
    floorEUP: 18,
    stackedDIN: 28,
    stackedEUP: 36,
    supportsStacking: true,
  },
  roadTrain: {
    floorDIN: 28,
    floorEUP: 36,
    stackedDIN: 56,
    stackedEUP: 72,
    supportsStacking: true,
  },
  waggon: {
    floorDIN: 32,
    floorEUP: 38,
    stackedDIN: 32,
    stackedEUP: 38,
    supportsStacking: false,
  },
};

// --- WAGGON SPECIAL LOGIC (Preserved) ---
export const calculateWaggonEuroLayout = (eupWeights: WeightEntry[], truckConfig: any) => {
  const allEupSingles = eupWeights.flatMap(e => Array(e.quantity).fill({ weight: parseFloat(e.weight) || 0 }));
  const count = Math.min(allEupSingles.length, 38);
  const placements: any[] = [];
  let currentWeight = 0;
  let placed = 0;

  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({
      x: i * 120, y: 0, width: 80, height: 120,
      type: 'euro', labelId: ++placed, isStackedTier: null, unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }
  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({
      x: i * 120, y: 80, width: 80, height: 120,
      type: 'euro', labelId: ++placed, isStackedTier: null, unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({
      x: i * 120, y: 160, width: 80, height: 120,
      type: 'euro', labelId: ++placed, isStackedTier: null, unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({
      x: i * 120, y: 240, width: 80, height: 120,
      type: 'euro', labelId: ++placed, isStackedTier: null, unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }

  return {
    palletArrangement: [{
      unitId: truckConfig.units[0].id, unitLength: 1370, unitWidth: 290, pallets: placements,
    }],
    loadedIndustrialPalletsBase: 0, loadedEuroPalletsBase: placed,
    totalDinPalletsVisual: 0, totalEuroPalletsVisual: placed,
    utilizationPercentage: 0, warnings: [], totalWeightKg: currentWeight, eupLoadingPatternUsed: 'custom',
  };
};

// --- TYPES ---
type PalletItem = {
  id: number;
  type: 'euro' | 'industrial';
  weight: number;
  stackable: boolean;
  labelId: number;
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
  const totalTruckLength = truckConfig.usableLength;
  const truckWidth = truckConfig.maxWidth;

  // 1. EXPAND PALLETS
  const allEups: PalletItem[] = [];
  const allDins: PalletItem[] = [];
  let labelEuro = 1;
  let labelDin = 1;

  eupWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    for (let i = 0; i < q; i++) {
      allEups.push({
        id: allEups.length + 1, type: 'euro', weight: w,
        stackable: currentIsEUPStackable && e.stackable !== false, labelId: labelEuro++,
      });
    }
  });

  dinWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    for (let i = 0; i < q; i++) {
      allDins.push({
        id: allDins.length + 1, type: 'industrial', weight: w,
        stackable: currentIsDINStackable && e.stackable !== false, labelId: labelDin++,
      });
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

  // Determine EUP pattern
  let eupPattern: 'long' | 'broad' = 'long';
  if (currentEupLoadingPattern === 'broad') {
    eupPattern = 'broad';
  } else if (currentEupLoadingPattern === 'auto') {
    if (truckKey === 'mega13_6') {
      eupPattern = 'broad';
    } else {
      const maxEupsLong = Math.floor(totalTruckLength / 120) * 3;
      eupPattern = allEups.length <= maxEupsLong ? 'long' : 'broad';
    }
  }

  // Check stacking support
  const stackingAllowed = capacity.supportsStacking;
  const dinStackable = currentIsDINStackable && stackingAllowed;
  const eupStackable = currentIsEUPStackable && stackingAllowed;

  // 2. CALCULATE FLOOR AND STACK COUNTS
  const calcStackingMath = (requested: number, floorCap: number, stackCap: number, canStack: boolean) => {
    const floorCount = Math.min(requested, floorCap);
    if (!canStack) {
      return { floorCount, extraStacks: 0, totalPlaced: floorCount, overflow: Math.max(0, requested - floorCap) };
    }
    const maxExtraStacks = Math.max(stackCap - floorCap, 0);
    const extraStacks = Math.min(Math.max(requested - floorCap, 0), maxExtraStacks);
    return {
      floorCount, extraStacks,
      totalPlaced: floorCount + extraStacks,
      overflow: Math.max(0, requested - stackCap),
    };
  };

  const dinMath = calcStackingMath(allDins.length, capacity.floorDIN, capacity.stackedDIN, dinStackable);
  const eupMath = calcStackingMath(allEups.length, capacity.floorEUP, capacity.stackedEUP, eupStackable);

  if (dinMath.overflow > 0) {
    warnings.push(`${dinMath.overflow} DIN-Paletten konnten nicht geladen werden (Kapazität überschritten).`);
  }
  if (eupMath.overflow > 0) {
    warnings.push(`${eupMath.overflow} EUP-Paletten konnten nicht geladen werden (Kapazität überschritten).`);
  }

  // 3. DETERMINE BLOCK ORDER (DIN/EUP mixing rules)
  const dinIsStacked = dinMath.extraStacks > 0;
  const eupIsStacked = eupMath.extraStacks > 0;

  // Rules:
  // - No stacking: DIN front, EUP rear → EUP block first (lower x = front), DIN block second (higher x = rear)
  //   Wait, that's backwards. "DIN front, EUP rear" means DIN at low x, EUP at high x.
  // - DIN stacked, EUP not: EUP front, DIN rear → EUP at low x, DIN at high x
  let dinFirst: boolean;
  if (!dinIsStacked && !eupIsStacked) {
    // No stacking: DIN in front (low x), EUP in rear (high x)
    dinFirst = true;
  } else if (dinIsStacked && !eupIsStacked) {
    // DIN stacked: EUP in front (low x), DIN in rear (high x)
    dinFirst = false;
  } else {
    dinFirst = placementOrder === 'DIN_FIRST';
  }

  // 4. GENERATE PLACEMENTS
  // For visualization: x = along truck (0=front/cab, high=rear), y = across truck
  // TruckVisualization swaps: visual_x = data_y, visual_y = data_x
  // So: data_x=0 appears at top (front), high data_x at bottom (rear)
  //
  // Pallet dimensions in data coordinates:
  // - width: dimension along truck (becomes visual height)
  // - height: dimension across truck (becomes visual width)
  //
  // DIN (120x100): placed 100 along truck, 120 across → width=100, height=120
  // EUP long (120x80): placed 120 along truck, 80 across → width=120, height=80
  // EUP broad (120x80): placed 80 along truck, 120 across → width=80, height=120

  type Placement = {
    x: number; y: number; width: number; height: number;
    type: 'euro' | 'industrial'; labelId: number; isStacked: boolean;
  };

  const placements: Placement[] = [];

  // Generate DIN placements
  const generateDinPlacements = (startX: number): number => {
    // DIN: 100cm along truck (width), 120cm across (height), 2 per row
    const rowDepth = 100;
    const palletHeight = 120; // across truck
    const palletsPerRow = 2;
    const numRows = Math.ceil(dinMath.floorCount / palletsPerRow);

    // Floor positions: row 0 at startX (front of this block), increasing toward rear
    // Position indices: 0,1 at row 0; 2,3 at row 1; etc.
    // Position labels: 1,2 at front row; 3,4 at next; ... ; last positions at rear
    //
    // We want stacking to start at the LAST positions (rear), going backward.
    // So if we have 10 floor positions (positions 1-10, indices 0-9):
    //   - Positions 9,10 at row 4 (rear)
    //   - Stacking starts at index 9, then 8, then 7...
    //
    // In the layout:
    //   1 2  <- row 0, x = startX (front of block)
    //   3 4  <- row 1
    //   ...
    //   9 10 <- row 4 (rear of block)

    const floorPositions: { index: number; x: number; y: number }[] = [];
    let posIndex = 0;
    for (let row = 0; row < numRows; row++) {
      const x = startX + row * rowDepth;
      for (let col = 0; col < palletsPerRow && posIndex < dinMath.floorCount; col++) {
        const y = col === 0 ? 0 : truckWidth - palletHeight;
        floorPositions.push({ index: posIndex++, x, y });
      }
    }

    // Place floor pallets: pallet 1 at position 0 (front), pallet N at position N-1 (rear)
    for (let i = 0; i < dinMath.floorCount && i < allDins.length; i++) {
      const pos = floorPositions[i];
      placements.push({
        x: pos.x, y: pos.y, width: rowDepth, height: palletHeight,
        type: 'industrial', labelId: allDins[i].labelId, isStacked: false,
      });
    }

    // Stack pallets: start at LAST floor position, work backward
    // Stacking on position indices: (floorCount-1), (floorCount-2), ...
    for (let j = 0; j < dinMath.extraStacks; j++) {
      const palletIdx = dinMath.floorCount + j;
      if (palletIdx >= allDins.length) break;

      // Stack index: start from last position (rear), go toward front
      const stackPosIdx = dinMath.floorCount - 1 - j;
      if (stackPosIdx >= 0 && stackPosIdx < floorPositions.length) {
        const pos = floorPositions[stackPosIdx];
        placements.push({
          x: pos.x, y: pos.y, width: rowDepth, height: palletHeight,
          type: 'industrial', labelId: allDins[palletIdx].labelId, isStacked: true,
        });
      }
    }

    return numRows * rowDepth;
  };

  const generateEupPlacements = (startX: number): number => {
    if (eupPattern === 'long') {
      // EUP long: 120cm along truck (width), 80cm across (height), 3 per row
      const rowDepth = 120;
      const palletHeight = 80;
      const palletsPerRow = 3;
      const numRows = Math.ceil(eupMath.floorCount / palletsPerRow);

      const floorPositions: { index: number; x: number; y: number }[] = [];
      let posIndex = 0;
      for (let row = 0; row < numRows; row++) {
        const x = startX + row * rowDepth;
        const segmentWidth = truckWidth / 3;
        const centerOffset = (segmentWidth - palletHeight) / 2;
        for (let col = 0; col < palletsPerRow && posIndex < eupMath.floorCount; col++) {
          const y = col * segmentWidth + centerOffset;
          floorPositions.push({ index: posIndex++, x, y });
        }
      }

      for (let i = 0; i < eupMath.floorCount && i < allEups.length; i++) {
        const pos = floorPositions[i];
        placements.push({
          x: pos.x, y: pos.y, width: rowDepth, height: palletHeight,
          type: 'euro', labelId: allEups[i].labelId, isStacked: false,
        });
      }

      for (let j = 0; j < eupMath.extraStacks; j++) {
        const palletIdx = eupMath.floorCount + j;
        if (palletIdx >= allEups.length) break;
        const stackPosIdx = eupMath.floorCount - 1 - j;
        if (stackPosIdx >= 0 && stackPosIdx < floorPositions.length) {
          const pos = floorPositions[stackPosIdx];
          placements.push({
            x: pos.x, y: pos.y, width: rowDepth, height: palletHeight,
            type: 'euro', labelId: allEups[palletIdx].labelId, isStacked: true,
          });
        }
      }

      return numRows * rowDepth;
    } else {
      // EUP broad: 80cm along truck (width), 120cm across (height), 2 per row
      const rowDepth = 80;
      const palletHeight = 120;
      const palletsPerRow = 2;
      const numRows = Math.ceil(eupMath.floorCount / palletsPerRow);

      const floorPositions: { index: number; x: number; y: number }[] = [];
      let posIndex = 0;
      for (let row = 0; row < numRows; row++) {
        const x = startX + row * rowDepth;
        for (let col = 0; col < palletsPerRow && posIndex < eupMath.floorCount; col++) {
          const y = col === 0 ? 0 : truckWidth - palletHeight;
          floorPositions.push({ index: posIndex++, x, y });
        }
      }

      for (let i = 0; i < eupMath.floorCount && i < allEups.length; i++) {
        const pos = floorPositions[i];
        placements.push({
          x: pos.x, y: pos.y, width: rowDepth, height: palletHeight,
          type: 'euro', labelId: allEups[i].labelId, isStacked: false,
        });
      }

      for (let j = 0; j < eupMath.extraStacks; j++) {
        const palletIdx = eupMath.floorCount + j;
        if (palletIdx >= allEups.length) break;
        const stackPosIdx = eupMath.floorCount - 1 - j;
        if (stackPosIdx >= 0 && stackPosIdx < floorPositions.length) {
          const pos = floorPositions[stackPosIdx];
          placements.push({
            x: pos.x, y: pos.y, width: rowDepth, height: palletHeight,
            type: 'euro', labelId: allEups[palletIdx].labelId, isStacked: true,
          });
        }
      }

      return numRows * rowDepth;
    }
  };

  // Generate placements in correct order
  let currentX = 0;
  let dinBlockLength = 0;
  let eupBlockLength = 0;

  if (dinFirst) {
    if (dinMath.floorCount > 0) {
      dinBlockLength = generateDinPlacements(currentX);
      currentX += dinBlockLength;
    }
    if (eupMath.floorCount > 0) {
      eupBlockLength = generateEupPlacements(currentX);
    }
  } else {
    if (eupMath.floorCount > 0) {
      eupBlockLength = generateEupPlacements(currentX);
      currentX += eupBlockLength;
    }
    if (dinMath.floorCount > 0) {
      dinBlockLength = generateDinPlacements(currentX);
    }
  }

  // 5. BUILD OUTPUT
  const totalUsedLength = dinBlockLength + eupBlockLength;
  const utilizationPercentage = parseFloat(((totalUsedLength / totalTruckLength) * 100).toFixed(1));

  // Convert placements to visual format
  const visualPallets = placements.map((p, idx) => ({
    key: idx,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    type: p.type,
    labelId: p.labelId,
    isStacked: p.isStacked,
    isStackedTier: p.isStacked ? 'top' as const : null,
  }));

  // Front weight check
  let frontWeight = 0;
  const frontThreshold = 400;
  placements.forEach(p => {
    if (p.x < frontThreshold) {
      const pallet = [...allDins, ...allEups].find(pl => pl.labelId === p.labelId && pl.type === p.type);
      if (pallet) frontWeight += pallet.weight;
    }
  });

  if (frontWeight > 10000) {
    warnings.push(`Warnung: Hohe Last im Stirnwandbereich (${KILOGRAM_FORMATTER.format(frontWeight)} kg).`);
  }

  return {
    palletArrangement: [{
      unitId: truckConfig.units[0].id,
      unitLength: truckConfig.units[0].length,
      unitWidth: truckConfig.units[0].width,
      pallets: visualPallets,
    }],
    loadedIndustrialPalletsBase: dinMath.floorCount,
    loadedEuroPalletsBase: eupMath.floorCount,
    totalDinPalletsVisual: dinMath.totalPlaced,
    totalEuroPalletsVisual: eupMath.totalPlaced,
    utilizationPercentage,
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: eupPattern,
  };
};
