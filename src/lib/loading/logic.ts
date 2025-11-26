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
// Generic capacities per truck type for DIN and EUP pallets
export type TruckPalletCapacity = {
  floorDIN: number;      // max DIN pallets on the floor
  floorEUP: number;      // max EUP pallets on the floor
  stackedDIN: number;    // max DIN pallets total when stacking is used
  stackedEUP: number;    // max EUP pallets total when stacking is used
  supportsStacking: boolean; // whether this truck type supports stacking
};

export const TRUCK_CAPACITY_BY_TYPE: Record<keyof typeof TRUCK_TYPES, TruckPalletCapacity> = {
  // Tautliner / Curtain-sider (13.2m): Reference implementation
  // - DIN (120x100): 1320cm / 100cm = 13 rows × 2 pallets = 26 floor
  // - EUP (120x80 long): 1320cm / 120cm = 11 rows × 3 pallets = 33 floor
  curtainSider: {
    floorDIN: 26,
    floorEUP: 33,
    stackedDIN: 52,
    stackedEUP: 66,
    supportsStacking: true,
  },

  // Standard 13.2m (same as curtainSider)
  standard13_2: {
    floorDIN: 26,
    floorEUP: 33,
    stackedDIN: 52,
    stackedEUP: 66,
    supportsStacking: true,
  },

  // Mega 13.6m: Slightly longer trailer
  // - DIN: 1360cm / 100cm = 13.6 → 13 rows × 2 = 26 floor
  // - EUP broad: 1360cm / 80cm = 17 rows × 2 = 34 floor (better than long: 11×3=33)
  mega13_6: {
    floorDIN: 26,
    floorEUP: 34,
    stackedDIN: 52,
    stackedEUP: 68,
    supportsStacking: true,
  },

  // Frigo 13.2m: Same dimensions as curtainSider but refrigerated
  frigo13_2: {
    floorDIN: 26,
    floorEUP: 33,
    stackedDIN: 52,
    stackedEUP: 66,
    supportsStacking: true,
  },

  // Small truck 7.2m
  // - DIN: 720cm / 100cm = 7 rows × 2 = 14 floor
  // - EUP long: 720cm / 120cm = 6 rows × 3 = 18 floor
  smallTruck7_2: {
    floorDIN: 14,
    floorEUP: 18,
    stackedDIN: 28,
    stackedEUP: 36,
    supportsStacking: true,
  },

  // Road train (2x 7.2m units)
  // Total capacities across both units
  // - DIN: 14 per unit × 2 = 28 floor
  // - EUP: 18 per unit × 2 = 36 floor
  roadTrain: {
    floorDIN: 28,
    floorEUP: 36,
    stackedDIN: 56,
    stackedEUP: 72,
    supportsStacking: true,
  },

  // Waggon (16m x 2.9m): Special layout, no stacking
  // - DIN: 1600cm / 100cm = 16 rows × 2 = 32 floor
  // - EUP: Custom layout = 38 (preserved from original waggon logic)
  waggon: {
    floorDIN: 32,
    floorEUP: 38,
    stackedDIN: 32, // No stacking supported
    stackedEUP: 38, // No stacking supported
    supportsStacking: false,
  },
};

// --- WAGGON SPECIAL LOGIC (Preserved for custom EUP layout) ---
export const calculateWaggonEuroLayout = (eupWeights: WeightEntry[], truckConfig: any) => {
  const allEupSingles = eupWeights.flatMap(e => Array(e.quantity).fill({ weight: parseFloat(e.weight) || 0 }));
  const count = Math.min(allEupSingles.length, 38);
  const placements: any[] = [];
  let currentWeight = 0;
  let placed = 0;

  // Row 1 (11 pallets)
  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({
      x: i * 120,
      y: 0,
      width: 120,
      height: 80,
      type: 'euro',
      labelId: ++placed,
      isStackedTier: null,
      unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }
  // Row 2 (11 pallets)
  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({
      x: i * 120,
      y: 80,
      width: 120,
      height: 80,
      type: 'euro',
      labelId: ++placed,
      isStackedTier: null,
      unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }
  // Row 3 (8 pallets)
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({
      x: i * 120,
      y: 160,
      width: 120,
      height: 80,
      type: 'euro',
      labelId: ++placed,
      isStackedTier: null,
      unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }
  // Row 4 (8 pallets)
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({
      x: i * 120,
      y: 240,
      width: 120,
      height: 80,
      type: 'euro',
      labelId: ++placed,
      isStackedTier: null,
      unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }

  return {
    palletArrangement: [{
      unitId: truckConfig.units[0].id,
      unitLength: 1370,
      unitWidth: 290,
      pallets: placements,
    }],
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

// --- GENERIC PALLET PLACEMENT TYPES ---
type PalletItem = {
  id: number;
  type: 'euro' | 'industrial';
  weight: number;
  stackable: boolean;
  labelId: number;
};

type FloorPosition = {
  index: number;              // Position index (0 = rear, increasing toward front)
  x: number;                  // X coordinate (along truck length)
  y: number;                  // Y coordinate (across truck width)
  type: 'euro' | 'industrial';
  width: number;              // Visual width (perpendicular to truck)
  length: number;             // Visual length (along truck)
  floorPallet: PalletItem | null;
  stackedPallet: PalletItem | null;
};

// --- GENERIC LOADING ALGORITHM ---

/**
 * Calculate floor and stacking counts based on capacities
 */
function calculateStackingMath(
  requested: number,
  floorCap: number,
  stackCap: number,
  stackingAllowed: boolean
): { floorCount: number; extraStacks: number; totalPlaced: number; overflow: number } {
  const floorCount = Math.min(requested, floorCap);
  
  if (!stackingAllowed) {
    return {
      floorCount,
      extraStacks: 0,
      totalPlaced: floorCount,
      overflow: Math.max(0, requested - floorCap),
    };
  }
  
  const maxExtraStacks = Math.max(stackCap - floorCap, 0);
  const extraStacks = Math.min(
    Math.max(requested - floorCap, 0),
    maxExtraStacks
  );
  const totalPlaced = floorCount + extraStacks;
  
  return {
    floorCount,
    extraStacks,
    totalPlaced,
    overflow: Math.max(0, requested - stackCap),
  };
}

/**
 * Generate floor positions for a pallet type in a single unit
 * Positions are ordered from rear (0) to front (floorCap - 1)
 */
function generateFloorPositions(
  type: 'euro' | 'industrial',
  floorCap: number,
  unitLength: number,
  unitWidth: number,
  eupPattern: 'long' | 'broad',
  startX: number = 0
): FloorPosition[] {
  const positions: FloorPosition[] = [];
  
  if (type === 'industrial') {
    // DIN pallets: 120x100, always placed with 100cm along truck length
    const rowLength = 100; // Along truck length
    const palletWidth = 120; // Across truck width
    const palletsPerRow = 2;
    const numRows = Math.floor(floorCap / palletsPerRow);
    
    let posIndex = 0;
    for (let row = 0; row < numRows; row++) {
      const x = startX + row * rowLength;
      for (let col = 0; col < palletsPerRow; col++) {
        const y = col === 0 ? 0 : unitWidth - palletWidth;
        positions.push({
          index: posIndex++,
          x,
          y,
          type: 'industrial',
          width: palletWidth,
          length: rowLength,
          floorPallet: null,
          stackedPallet: null,
        });
      }
    }
    // Handle odd number of floor positions
    if (floorCap % palletsPerRow !== 0) {
      const x = startX + numRows * rowLength;
      positions.push({
        index: posIndex++,
        x,
        y: (unitWidth - palletWidth) / 2, // Center the odd pallet
        type: 'industrial',
        width: palletWidth,
        length: rowLength,
        floorPallet: null,
        stackedPallet: null,
      });
    }
  } else {
    // EUP pallets: 120x80
    if (eupPattern === 'long') {
      // Long pattern: 120cm along truck length, 80cm width, 3 pallets per row
      const rowLength = 120;
      const palletWidth = 80;
      const palletsPerRow = 3;
      const numRows = Math.floor(floorCap / palletsPerRow);
      
      let posIndex = 0;
      for (let row = 0; row < numRows; row++) {
        const x = startX + row * rowLength;
        const segmentWidth = unitWidth / 3;
        const centerOffset = (segmentWidth - palletWidth) / 2;
        
        for (let col = 0; col < palletsPerRow; col++) {
          const y = col * segmentWidth + centerOffset;
          positions.push({
            index: posIndex++,
            x,
            y,
            type: 'euro',
            width: palletWidth,
            length: rowLength,
            floorPallet: null,
            stackedPallet: null,
          });
        }
      }
      // Handle remaining positions
      const remaining = floorCap % palletsPerRow;
      if (remaining > 0) {
        const x = startX + numRows * rowLength;
        const segmentWidth = unitWidth / 3;
        const centerOffset = (segmentWidth - palletWidth) / 2;
        for (let col = 0; col < remaining; col++) {
          const y = col * segmentWidth + centerOffset;
          positions.push({
            index: posIndex++,
            x,
            y,
            type: 'euro',
            width: palletWidth,
            length: rowLength,
            floorPallet: null,
            stackedPallet: null,
          });
        }
      }
    } else {
      // Broad pattern: 80cm along truck length, 120cm width, 2 pallets per row
      const rowLength = 80;
      const palletWidth = 120;
      const palletsPerRow = 2;
      const numRows = Math.floor(floorCap / palletsPerRow);
      
      let posIndex = 0;
      for (let row = 0; row < numRows; row++) {
        const x = startX + row * rowLength;
        for (let col = 0; col < palletsPerRow; col++) {
          const y = col === 0 ? 0 : unitWidth - palletWidth;
          positions.push({
            index: posIndex++,
            x,
            y,
            type: 'euro',
            width: palletWidth,
            length: rowLength,
            floorPallet: null,
            stackedPallet: null,
          });
        }
      }
      // Handle odd number
      if (floorCap % palletsPerRow !== 0) {
        const x = startX + numRows * rowLength;
        positions.push({
          index: posIndex++,
          x,
          y: (unitWidth - palletWidth) / 2,
          type: 'euro',
          width: palletWidth,
          length: rowLength,
          floorPallet: null,
          stackedPallet: null,
        });
      }
    }
  }
  
  return positions.slice(0, floorCap);
}

/**
 * Place pallets on floor and stack positions following the rules:
 * - Floor positions filled from rear (index 0) to front
 * - Stacked positions placed from rear, on top of the last floor positions (rear-to-front)
 */
function placePalletsOnPositions(
  pallets: PalletItem[],
  positions: FloorPosition[],
  floorCount: number,
  extraStacks: number
): void {
  // Place floor pallets (rear to front = index 0 to floorCount-1)
  for (let i = 0; i < floorCount && i < pallets.length; i++) {
    positions[i].floorPallet = pallets[i];
  }
  
  // Place stacked pallets on top of the last floor positions, from rear
  // Stacking starts at the rearmost positions (highest index of used floor)
  // and moves toward the front
  for (let j = 0; j < extraStacks; j++) {
    const palletIndex = floorCount + j;
    if (palletIndex >= pallets.length) break;
    
    // Stack index: start from the last floor position and work backward
    // Example: 28 DIN -> floor 0-25, stack on positions 25, 24 (rear-to-front)
    const stackIdx = floorCount - 1 - j;
    if (stackIdx >= 0 && stackIdx < positions.length) {
      positions[stackIdx].stackedPallet = pallets[palletIndex];
    }
  }
}

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

  // 1. PALLET EXPANSION
  const allEups: PalletItem[] = [];
  const allDins: PalletItem[] = [];
  let labelEuro = 1;
  let labelDin = 1;

  eupWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    for (let i = 0; i < q; i++) {
      allEups.push({
        id: allEups.length + 1,
        type: 'euro',
        weight: w,
        stackable: currentIsEUPStackable && e.stackable !== false,
        labelId: labelEuro++,
      });
    }
  });

  dinWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    for (let i = 0; i < q; i++) {
      allDins.push({
        id: allDins.length + 1,
        type: 'industrial',
        weight: w,
        stackable: currentIsDINStackable && e.stackable !== false,
        labelId: labelDin++,
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
    // Auto: use long pattern for most trucks, broad for mega
    if (truckKey === 'mega13_6') {
      eupPattern = 'broad';
    } else {
      const possibleLongRows = Math.floor(totalTruckLength / 120);
      const maxEupsLong = possibleLongRows * 3;
      eupPattern = allEups.length <= maxEupsLong ? 'long' : 'broad';
    }
  }

  // Check if stacking is supported for this truck
  const stackingAllowed = capacity.supportsStacking;
  const dinStackable = currentIsDINStackable && stackingAllowed;
  const eupStackable = currentIsEUPStackable && stackingAllowed;

  // 2. CALCULATE STACKING MATH
  const dinMath = calculateStackingMath(
    allDins.length,
    capacity.floorDIN,
    capacity.stackedDIN,
    dinStackable
  );
  
  const eupMath = calculateStackingMath(
    allEups.length,
    capacity.floorEUP,
    capacity.stackedEUP,
    eupStackable
  );

  // Report overflow
  if (dinMath.overflow > 0) {
    warnings.push(
      `${dinMath.overflow} DIN-Paletten konnten nicht geladen werden (Kapazität überschritten).`
    );
  }
  if (eupMath.overflow > 0) {
    warnings.push(
      `${eupMath.overflow} EUP-Paletten konnten nicht geladen werden (Kapazität überschritten).`
    );
  }

  // 3. DETERMINE ORDERING (DIN/EUP mixing rules)
  // Rules:
  // - If no pallets are stacked: DIN in front, EUP in rear
  // - If DIN is stacked but EUP is not: EUP in front, DIN (stacked) in rear
  const dinIsStacked = dinMath.extraStacks > 0;
  const eupIsStacked = eupMath.extraStacks > 0;
  
  let dinFirst: boolean;
  if (!dinIsStacked && !eupIsStacked) {
    // No stacking: DIN in front, EUP in rear
    // In our coordinate system (0 = rear), EUP should have lower positions (rear)
    dinFirst = false; // EUP goes first (rear), then DIN (front)
  } else if (dinIsStacked && !eupIsStacked) {
    // DIN stacked, EUP not: EUP in front, DIN (stacked) in rear
    // DIN goes first (rear positions), EUP goes after (front)
    dinFirst = true;
  } else {
    // Both stacked or only EUP stacked: use placement order parameter
    dinFirst = placementOrder === 'DIN_FIRST';
  }

  // 4. GENERATE FLOOR POSITIONS AND PLACE PALLETS
  const targetUnit = truckConfig.units[0];
  const unitLength = targetUnit.length;
  const unitWidth = targetUnit.width;

  // Generate positions for both types
  const dinPositions = generateFloorPositions(
    'industrial',
    dinMath.floorCount,
    unitLength,
    unitWidth,
    eupPattern,
    0
  );
  
  const eupPositions = generateFloorPositions(
    'euro',
    eupMath.floorCount,
    unitLength,
    unitWidth,
    eupPattern,
    0
  );

  // Place pallets on their respective positions
  placePalletsOnPositions(allDins, dinPositions, dinMath.floorCount, dinMath.extraStacks);
  placePalletsOnPositions(allEups, eupPositions, eupMath.floorCount, eupMath.extraStacks);

  // 5. CALCULATE X OFFSETS BASED ON ORDERING
  // Positions are relative; we need to offset based on which type goes first (rear)
  let dinStartX = 0;
  let eupStartX = 0;

  // Calculate the length occupied by each pallet block
  const getDinBlockLength = () => {
    if (dinPositions.length === 0) return 0;
    const rowLength = 100; // DIN always 100cm along truck
    const numRows = Math.ceil(dinMath.floorCount / 2);
    return numRows * rowLength;
  };

  const getEupBlockLength = () => {
    if (eupPositions.length === 0) return 0;
    if (eupPattern === 'long') {
      const rowLength = 120;
      const numRows = Math.ceil(eupMath.floorCount / 3);
      return numRows * rowLength;
    } else {
      const rowLength = 80;
      const numRows = Math.ceil(eupMath.floorCount / 2);
      return numRows * rowLength;
    }
  };

  const dinBlockLength = getDinBlockLength();
  const eupBlockLength = getEupBlockLength();

  if (dinFirst) {
    // DIN at rear (x=0), EUP after DIN
    dinStartX = 0;
    eupStartX = dinBlockLength;
  } else {
    // EUP at rear (x=0), DIN after EUP
    eupStartX = 0;
    dinStartX = eupBlockLength;
  }

  // Apply offsets to positions
  dinPositions.forEach(pos => { pos.x += dinStartX; });
  eupPositions.forEach(pos => { pos.x += eupStartX; });

  // 6. GENERATE VISUAL OUTPUT
  const unitsState = truckConfig.units.map((u: any) => ({
    ...u,
    palletsVisual: [] as any[]
  }));
  const visualUnit = unitsState[0];

  // Helper to add pallet to visual output
  const addToVisual = (pos: FloorPosition, pallet: PalletItem | null, isStacked: boolean) => {
    if (!pallet) return;
    visualUnit.palletsVisual.push({
      palletId: pallet.id,
      labelId: pallet.labelId,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      length: pos.length,
      type: pos.type,
      isStacked,
      baseIndex: isStacked ? pos.index : null,
    });
  };

  // Add floor pallets first
  dinPositions.forEach(pos => addToVisual(pos, pos.floorPallet, false));
  eupPositions.forEach(pos => addToVisual(pos, pos.floorPallet, false));

  // Add stacked pallets (they appear after floor pallets in the output)
  dinPositions.forEach(pos => addToVisual(pos, pos.stackedPallet, true));
  eupPositions.forEach(pos => addToVisual(pos, pos.stackedPallet, true));

  // Calculate utilization
  const totalUsedLength = Math.max(
    dinStartX + dinBlockLength,
    eupStartX + eupBlockLength
  );
  const utilizationPercentage = parseFloat(((totalUsedLength / totalTruckLength) * 100).toFixed(1));

  // 7. FRONT WEIGHT CHECK
  let frontWeight = 0;
  const frontThreshold = 400; // First 4 meters
  [...dinPositions, ...eupPositions].forEach(pos => {
    if (pos.x < frontThreshold) {
      if (pos.floorPallet) frontWeight += pos.floorPallet.weight;
      if (pos.stackedPallet) frontWeight += pos.stackedPallet.weight;
    }
  });

  if (frontWeight > 10000) {
    warnings.push(
      `Warnung: Hohe Last im Stirnwandbereich (${KILOGRAM_FORMATTER.format(frontWeight)} kg).`
    );
  }

  const totalDinVisual = dinMath.totalPlaced;
  const totalEupVisual = eupMath.totalPlaced;

  return {
    palletArrangement: unitsState.map((u: any) => ({
      unitId: u.id,
      unitLength: u.length,
      unitWidth: u.width,
      pallets: u.palletsVisual,
    })),
    loadedIndustrialPalletsBase: dinMath.floorCount,
    loadedEuroPalletsBase: eupMath.floorCount,
    totalDinPalletsVisual: totalDinVisual,
    totalEuroPalletsVisual: totalEupVisual,
    utilizationPercentage,
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: eupPattern,
  };
};
