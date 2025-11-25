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

// 3.8m Safe Zone: Stacking preferentially happens AFTER this distance
const FRONT_SAFE_ZONE_CM = 380; 

export const KILOGRAM_FORMATTER = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

export const TRUCK_TYPES = {
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
  curtainSider: {
    name: 'Planensattel Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 248, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 248,
    maxGrossWeightKg: 24000,
  },
  frigo: {
    name: 'Frigo (Kühler) Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 246, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 246,
    maxGrossWeightKg: 18300,
  },
  smallTruck: {
    name: 'Motorwagen (7.2m)',
    units: [{ id: 'main', length: 720, width: 245, occupiedRects: [] }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 10000,
  },
  Waggon: {
    name: 'Waggon POE',
    units: [{ id: 'main', length: 1370, width: 290, occupiedRects: [] }],
    totalLength: 1370,
    usableLength: 1370,
    maxWidth: 290,
    maxDinPallets: 26,
    maxGrossWeightKg: 24000,
  },
  Waggon2: {
    name: 'Waggon KRM',
    units: [{ id: 'main', length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    maxDinPallets: 28,
    maxGrossWeightKg: 24000,
  },
};

export const PALLET_TYPES = {
  euro: { name: 'Euro Palette (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80 },
  industrial: { name: 'Industrial Palette (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100 },
};

// --- WAGGON SPECIAL LOGIC (Unchanged) ---
export const calculateWaggonEuroLayout = (
  eupWeights: WeightEntry[],
  truckConfig: any
) => {
  const allEupSingles = (eupWeights || [])
    .flatMap(entry =>
      Array.from({ length: entry.quantity }, () => ({
        weight: parseFloat(entry.weight) || 0,
      }))
    );
  const requestedEupQuantity = allEupSingles.length;
  const placements: any[] = [];
  const EUP_LENGTH = 120;
  const EUP_WIDTH = 80;
  const WAGGON_CAPACITY = 38;
  let currentWeight = 0;
  const warnings: string[] = [];

  if (requestedEupQuantity > WAGGON_CAPACITY) {
    warnings.push(`Kapazität überschritten: Max ${WAGGON_CAPACITY} EUP.`);
  }

  const palletsToPlace = Math.min(requestedEupQuantity, WAGGON_CAPACITY);
  let placedCount = 0;

  // Row 1 (11 pallets)
  for (let i = 0; i < 11 && placedCount < palletsToPlace; i++) {
    placements.push({ x: i * EUP_LENGTH, y: 0, width: EUP_LENGTH, height: EUP_WIDTH, type: 'euro', labelId: placedCount + 1, isStackedTier: null, unitId: truckConfig.units[0].id });
    currentWeight += allEupSingles[placedCount]?.weight || 0; placedCount++;
  }
  // Row 2 (11 pallets)
  for (let i = 0; i < 11 && placedCount < palletsToPlace; i++) {
    placements.push({ x: i * EUP_LENGTH, y: EUP_WIDTH, width: EUP_LENGTH, height: EUP_WIDTH, type: 'euro', labelId: placedCount + 1, isStackedTier: null, unitId: truckConfig.units[0].id });
    currentWeight += allEupSingles[placedCount]?.weight || 0; placedCount++;
  }
  // Row 3 (16 pallets - rotated)
  for (let i = 0; i < 16 && placedCount < palletsToPlace; i++) {
    placements.push({ x: i * EUP_WIDTH, y: EUP_WIDTH * 2, width: EUP_WIDTH, height: EUP_LENGTH, type: 'euro', labelId: placedCount + 1, isStackedTier: null, unitId: truckConfig.units[0].id });
    currentWeight += allEupSingles[placedCount]?.weight || 0; placedCount++;
  }

  return {
    palletArrangement: [{ unitId: truckConfig.units[0].id, unitLength: truckConfig.units[0].length, unitWidth: truckConfig.units[0].width, pallets: placements }],
    loadedIndustrialPalletsBase: 0, loadedEuroPalletsBase: placedCount,
    totalDinPalletsVisual: 0, totalEuroPalletsVisual: placedCount,
    utilizationPercentage: 0, warnings, totalWeightKg: currentWeight, eupLoadingPatternUsed: 'custom'
  };
};

// --- MAIN CALCULATION LOGIC ---

export const calculateLoadingLogic = (
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  currentIsEUPStackable: boolean,
  currentIsDINStackable: boolean,
  currentEupLoadingPattern: 'auto' | 'long' | 'broad',
  placementOrder: 'DIN_FIRST' | 'EUP_FIRST' = 'DIN_FIRST',
  maxStackedEup?: number | string,
  maxStackedDin?: number | string,
  stackingStrategy: StackingStrategy = 'axle_safe'
) => {
  const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const isWaggon = ['Waggon', 'Waggon2'].includes(truckKey);
  let warnings: string[] = [];

  // Waggon Special Path
  if (isWaggon && dinWeights.every(e => e.quantity === 0) && eupWeights.some(e => e.quantity > 0)) {
    return calculateWaggonEuroLayout(eupWeights, truckConfig);
  }

  // Force stackable to false for Waggons
  const isEUPStackable = isWaggon ? false : currentIsEUPStackable;
  const isDINStackable = isWaggon ? false : currentIsDINStackable;

  // 1. Flatten Input into simple items
  let globalIdCounter = 1;
  type PalletItem = { internalId: string, type: 'euro' | 'industrial', weight: number, stackable: boolean, labelId: number };
  
  const createItems = (entries: WeightEntry[], type: 'euro' | 'industrial', canStack: boolean) => {
    const items: PalletItem[] = [];
    entries.forEach(e => {
      const qty = Math.max(0, Number(e.quantity) || 0);
      for (let i = 0; i < qty; i++) {
        items.push({
          internalId: `${type}_${globalIdCounter++}`,
          type,
          weight: parseFloat(e.weight) || 0,
          stackable: canStack && (e.stackable !== false),
          labelId: 0 // Will assign sequential IDs later
        });
      }
    });
    return items;
  };

  const eups = createItems(eupWeights, 'euro', isEUPStackable);
  const dins = createItems(dinWeights, 'industrial', isDINStackable);
  
  // Assign Label IDs (1..N for EUP, 1..N for DIN) for clean display
  eups.forEach((p, i) => p.labelId = i + 1);
  dins.forEach((p, i) => p.labelId = i + 1);

  // Working Queues
  let floorQueue = placementOrder === 'DIN_FIRST' ? [...dins, ...eups] : [...eups, ...dins];
  
  // 2. BUILD THE FLOOR (Linear Filling)
  type Row = {
    id: number;
    type: 'euro' | 'industrial';
    length: number; // cm used along truck length
    capacity: number; // pallets per row
    items: PalletItem[];
    stackedItems: PalletItem[];
    startX: number;
    isSafeZone: boolean; // true if row starts after SAFE_ZONE
  };

  const rows: Row[] = [];
  let currentX = 0;
  const truckLength = truckConfig.usableLength;
  const floaters: PalletItem[] = []; // Items that don't fit on floor

  // Helper to determine row config
  const getRowConfig = (type: 'euro' | 'industrial', remainingLength: number) => {
    if (type === 'industrial') {
      // DIN 120x100. Standard: Wide side (120) across truck width (248).
      // Consumes 100cm length. Fits 2.
      return { length: 100, capacity: 2 };
    } else {
      // EUP 120x80.
      // Standard (Long): 120 side along length. 3 wide (240cm < 248cm). 
      // Consumes 120cm length. (e.g. 33 EUPs logic).
      
      // Fallback (Broad): 2 wide. 80cm length consumed.
      
      // Rotation Logic:
      // If 'auto', prefer 3-wide (120cm length) unless we are running out of space.
      // Check: If we use 120cm, do we exceed truck length?
      // If yes, check if 80cm fits.
      
      let useLongPattern = true; // Default 3 wide
      
      if (currentEupLoadingPattern === 'broad') {
        useLongPattern = false;
      } else if (currentEupLoadingPattern === 'auto') {
        // Intelligent switching near the end
        if (remainingLength < 120 && remainingLength >= 80) {
          useLongPattern = false; // Switch to broad to fit one last row
        }
      }

      return useLongPattern 
        ? { length: 120, capacity: 3 } 
        : { length: 80, capacity: 2 };
    }
  };

  // Fill Floor
  let currentRow: Row | null = null;

  for (const p of floorQueue) {
    const remaining = truckLength - currentX;
    
    // Check if current row can take it
    if (currentRow && currentRow.type === p.type && currentRow.items.length < currentRow.capacity) {
      currentRow.items.push(p);
    } else {
      // Try to start new row
      const cfg = getRowConfig(p.type, remaining);
      
      if (currentX + cfg.length <= truckLength) {
        // Fits!
        currentRow = {
          id: rows.length,
          type: p.type,
          length: cfg.length,
          capacity: cfg.capacity,
          items: [p],
          stackedItems: [],
          startX: currentX,
          isSafeZone: currentX >= FRONT_SAFE_ZONE_CM
        };
        rows.push(currentRow);
        currentX += cfg.length;
      } else {
        // Does not fit on floor
        floaters.push(p);
      }
    }
  }

  // 3. STACKING LOGIC (Priority Filling)
  // We have `floaters` that need to go on top of `rows`.
  // Rules: 
  // - Like on Like (DIN on DIN, EUP on EUP).
  // - Priority A: Safe Zone (Rear).
  // - Priority B: Front Zone (Front).
  
  const failedToLoad: PalletItem[] = [];

  for (const floater of floaters) {
    if (!floater.stackable) {
      failedToLoad.push(floater);
      continue;
    }

    // Find candidates matching type and not full
    // Candidate must allow stacking (base items must be stackable)
    // Candidate must effectively handle a stack (e.g. not be a half-row if we are strict, but here we just check capacity)
    // Actually, we map 1-to-1. If base slot 1 is empty, we stack there.
    
    // We need to find a specific SLOT in a row.
    // Let's flatten the available slots.
    
    let placed = false;

    // Strategy: Iterate rows based on priority
    // 1. Safe Zone Rows (startX >= 380)
    // 2. Unsafe Zone Rows (startX < 380)
    
    const sortedRows = [...rows].sort((a, b) => {
      if (a.isSafeZone && !b.isSafeZone) return -1; // A first
      if (!a.isSafeZone && b.isSafeZone) return 1;  // B first
      return a.startX - b.startX; // Front to Back within zones
    });

    for (const row of sortedRows) {
      if (row.type !== floater.type) continue;
      
      // Check individual slots in this row
      // We can stack if:
      // 1. Base slot exists (items[i])
      // 2. Base item is stackable
      // 3. Top slot is empty (stackedItems[i])
      
      for (let i = 0; i < row.items.length; i++) {
        const baseItem = row.items[i];
        if (baseItem.stackable && !row.stackedItems[i]) {
          // Found a spot!
          // Ensure array is dense-ish or just assign index
          row.stackedItems[i] = floater;
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      failedToLoad.push(floater);
    }
  }

  // 4. VISUALIZATION MAPPING
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  const targetUnit = unitsState[0]; // Single unit assumption for non-roadtrain
  let totalWeight = 0;

  rows.forEach(row => {
    // Visualization dimensions
    // X is along length. Y is across width.
    // Truck width 248.
    // EUP (120x80):
    //   - Long (3 wide): row.length=120. Visually 80 wide.
    //   - Broad (2 wide): row.length=80. Visually 120 wide.
    // DIN (120x100):
    //   - Standard (2 wide): row.length=100. Visually 120 wide. (120 side across width)
    
    // We derive visual Height (Y axis in SVG) from capacity to be safe
    // Approx: TruckWidth / Capacity
    // 248 / 2 = 124
    // 248 / 3 = 82
    const visualHeight = row.capacity === 3 ? 82 : 124; 
    const visualWidth = row.length; // Length along truck

    // Base Layer
    row.items.forEach((baseItem, idx) => {
      const topItem = row.stackedItems[idx];
      
      const baseVisual = {
        key: baseItem.internalId,
        type: baseItem.type,
        x: row.startX,
        y: idx * visualHeight,
        width: visualWidth,
        height: visualHeight,
        labelId: baseItem.labelId,
        isStackedTier: topItem ? 'base' : null,
        showAsFraction: !!topItem,
        displayBaseLabelId: baseItem.labelId,
        displayStackedLabelId: topItem?.labelId,
        unitId: targetUnit.id
      };
      targetUnit.palletsVisual.push(baseVisual);
      totalWeight += baseItem.weight;

      // Top Layer
      if (topItem) {
        const topVisual = {
          key: topItem.internalId + '_top',
          type: topItem.type,
          x: row.startX,
          y: idx * visualHeight,
          width: visualWidth,
          height: visualHeight,
          labelId: topItem.labelId,
          isStackedTier: 'top',
          showAsFraction: true,
          displayBaseLabelId: baseItem.labelId,
          displayStackedLabelId: topItem.labelId,
          unitId: targetUnit.id
        };
        targetUnit.palletsVisual.push(topVisual);
        totalWeight += topItem.weight;
      }
    });
  });

  // 5. WARNINGS & STATS
  if (failedToLoad.length > 0) {
    const dinFail = failedToLoad.filter(p => p.type === 'industrial').length;
    const eupFail = failedToLoad.filter(p => p.type === 'euro').length;
    let msg = "Nicht genügend Platz für: ";
    if (dinFail) msg += `${dinFail} DIN `;
    if (eupFail) msg += `${eupFail} EUP`;
    warnings.push(msg);
  }

  if (totalWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewichtslimit überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg.`);
  }

  // Linear Density Check (Front Loading)
  // If we have heavy items in the first 4m, warn.
  // Heuristic: Calculate density of first 4m.
  const frontRows = rows.filter(r => r.startX < 400);
  const frontWeight = frontRows.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.weight, 0) + r.stackedItems.reduce((s, i) => s + (i ? i.weight : 0), 0), 0);
  // This warning logic can be tuned based on your 10 ton rule
  // "First 4 rows at front must be below 10 tons total"
  if (frontWeight > 10000) {
    warnings.push(`Warnung: Hohe Last im Stirnwandbereich (${KILOGRAM_FORMATTER.format(frontWeight)} kg in den ersten ~4m).`);
  }

  // Calculate final utilization
  const loadedDin = targetUnit.palletsVisual.filter((p:any) => p.type === 'industrial').length;
  const loadedEup = targetUnit.palletsVisual.filter((p:any) => p.type === 'euro').length;
  const totalArea = rows.reduce((sum, r) => sum + (r.length * truckConfig.maxWidth), 0); // Approx area
  const utilization = (totalArea / (truckLength * truckConfig.maxWidth)) * 100;

  return {
    palletArrangement: unitsState.map((u: any) => ({
        unitId: u.id,
        unitLength: u.length,
        unitWidth: u.width,
        pallets: u.palletsVisual
    })),
    loadedIndustrialPalletsBase: 0, // These counters are less relevant with mixed visualizer, keeping 0 or calculating if needed
    loadedEuroPalletsBase: 0,
    totalDinPalletsVisual: loadedDin,
    totalEuroPalletsVisual: loadedEup,
    utilizationPercentage: Math.min(100, parseFloat(utilization.toFixed(1))),
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: currentEupLoadingPattern
  };
};
