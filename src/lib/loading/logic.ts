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

// 3.8m Safe Zone: Stacking should occur AFTER this distance to protect the Kingpin/Front Axle
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

// --- HELPER FOR WAGGON (Preserved) ---
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

// --- MAIN LOGIC ---

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

  // 1. Flatten Input into simple objects
  let globalIdCounter = 1;
  type PalletItem = { internalId: string, type: 'euro' | 'industrial', weight: number, stackable: boolean, labelId: number };
  
  const createItems = (entries: WeightEntry[], type: 'euro' | 'industrial', canStack: boolean) => {
    const items: PalletItem[] = [];
    entries.forEach(e => {
      const qty = e.quantity || 0;
      for (let i = 0; i < qty; i++) {
        items.push({
          internalId: `${type}_${globalIdCounter++}`,
          type,
          weight: parseFloat(e.weight) || 0,
          stackable: canStack && (e.stackable !== false),
          labelId: 0 // Will assign later
        });
      }
    });
    return items;
  };

  const eups = createItems(eupWeights, 'euro', isEUPStackable);
  const dins = createItems(dinWeights, 'industrial', isDINStackable);
  const queue = placementOrder === 'DIN_FIRST' ? [...dins, ...eups] : [...eups, ...dins];

  // 2. Simulation: Build Lines (Rows)
  // We map pallets into rows based on the pattern.
  type Row = {
    id: number;
    type: 'euro' | 'industrial';
    length: number; // cm along truck length
    capacity: number; // items per row
    baseItems: PalletItem[];
    stackedItems: PalletItem[];
    startX: number; // calculated later
  };

  const rows: Row[] = [];
  let currentRow: Row | null = null;

  // Helper for row config
  const getRowConfig = (type: 'euro' | 'industrial') => {
    if (type === 'industrial') {
      // DIN: 120x100. Standard placement is wide side (120) across truck width.
      // Consumes 100cm length. Fits 2 wide (240cm < 248cm).
      return { length: 100, capacity: 2 }; 
    } else {
      // EUP: 120x80.
      // Pattern Auto/Long: 120 side along truck length? No, usually "Long" means 3-wide.
      // 3-wide means 80cm side is across width. 3*80=240cm. Consumes 120cm length.
      // Pattern Broad: 2-wide. 120cm side is across width. 2*120=240cm. Consumes 80cm length.
      
      // Fix for "33 EUPs": 13.2m length. 
      // If we use length 120cm (3 wide): 1320 / 120 = 11 rows. 11 * 3 = 33. PERFECT.
      // If we use length 80cm (2 wide): 1320 / 80 = 16.5 -> 16 rows. 16 * 2 = 32.
      
      if (currentEupLoadingPattern === 'broad') return { length: 80, capacity: 2 };
      return { length: 120, capacity: 3 }; // Auto defaults to Long (33 cap)
    }
  };

  // Fill Rows Linearly
  queue.forEach(p => {
    const cfg = getRowConfig(p.type);
    
    // Can we add to current row?
    if (currentRow && currentRow.type === p.type && currentRow.baseItems.length < currentRow.capacity) {
      currentRow.baseItems.push(p);
    } else {
      currentRow = {
        id: rows.length,
        type: p.type,
        length: cfg.length,
        capacity: cfg.capacity,
        baseItems: [p],
        stackedItems: [],
        startX: 0
      };
      rows.push(currentRow);
    }
  });

  // Calculate Layout Length
  let currentLength = 0;
  rows.forEach(r => {
    r.startX = currentLength;
    currentLength += r.length;
  });

  // 3. Compression (Stacking Logic)
  // This is where we handle the "28 DIN + 11 EUP" case.
  // The total length > usable length. We need to stack.
  // We want to stack rows that are AFTER the safe zone first.

  const truckLength = truckConfig.usableLength;
  let overflow = currentLength - truckLength;

  if (overflow > 0) {
    // Filter rows that *can* stack.
    // A row is stackable if ALL its base items are stackable.
    const stackableRows = rows.filter(r => r.baseItems.every(i => i.stackable) && r.baseItems.length > 0);

    // Sort candidates based on Strategy
    // 'axle_safe': Best candidates are those deeper in the truck (startX > SAFE_ZONE)
    // We want to fill from the front of the Safe Zone backwards? Or the very back?
    // Usually, we want the heavy double-stacks over the rear axles.
    stackableRows.sort((a, b) => {
      const aSafe = a.startX >= FRONT_SAFE_ZONE_CM;
      const bSafe = b.startX >= FRONT_SAFE_ZONE_CM;
      if (stackingStrategy === 'axle_safe') {
        if (aSafe && !bSafe) return -1; // a is safe, b is unsafe -> a comes first (priority to stack)
        if (!aSafe && bSafe) return 1;
        return a.startX - b.startX; // within safe zone, stack from front-to-back
      } else {
        return a.startX - b.startX; // max_pairs: just stack everything front-to-back
      }
    });

    // Process: Take rows from the END of the truck (the ones causing overflow)
    // and move their items onto the candidates.
    // We iterate backwards through the *original* rows array to identify what falls off.
    
    for (let i = rows.length - 1; i >= 0; i--) {
      if (overflow <= 0) break; // We fit!

      const sourceRow = rows[i];
      if (sourceRow.baseItems.length === 0) continue; // Already moved

      // Try to find a target for this source row
      const target = stackableRows.find(t => 
        t.id < sourceRow.id && // Target must be physically before source
        t.type === sourceRow.type && // Match type
        t.stackedItems.length === 0 && // Target not already double-stacked
        t.baseItems.length >= sourceRow.baseItems.length // Target has room/structure
      );

      if (target) {
        // Move items from source to target stack
        sourceRow.baseItems.forEach((item, idx) => {
          // safety check
          if (target.baseItems[idx]) {
             target.stackedItems.push(item);
          }
        });
        
        // Update overflow metric
        overflow -= sourceRow.length;
        
        // Empty the source row
        sourceRow.baseItems = []; 
        
        // Remove target from candidates (it's full now)
        const tIdx = stackableRows.indexOf(target);
        if (tIdx > -1) stackableRows.splice(tIdx, 1);
      }
    }
  }

  // 4. Visualization Mapping (Strict adherence to TruckVisualization.tsx props)
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  
  // Since we compacted the rows, we need to recalculate X positions for the visualizer
  let visualCursorX = 0;
  let totalWeight = 0;
  let dinCount = 0; 
  let eupCount = 0;

  // Assign label IDs sequentially for clarity
  const allItemsFlat = rows.flatMap(r => [...r.baseItems, ...r.stackedItems]);
  allItemsFlat.forEach(item => {
    if(item.type === 'euro') item.labelId = ++eupCount;
    else item.labelId = ++dinCount;
  });

  // We place items into the first unit (assuming single unit logic for standard trucks)
  // RoadTrain logic would need a split check here, but let's focus on the Tautliner case first.
  const targetUnit = unitsState[0];

  rows.forEach(row => {
    if (row.baseItems.length === 0) return; // Skip empty/moved rows

    // If this row pushes past truck length, we stop (visualize truncation)
    if (visualCursorX + row.length > targetUnit.length) {
        warnings.push("Platz reicht nicht für alle Paletten.");
        return;
    }

    // Calculate Y positions. 
    // Center the row? Standard loading starts from y=0.
    // DIN: 2 wide. Width ~248. Row cap 2. 
    // EUP: 3 wide. Row cap 3.
    const itemWidthVisual = row.type === 'euro' ? (row.length === 120 ? 80 : 120) : 120; 
    // NOTE: For visualization, 'width' is X-axis, 'height' is Y-axis in the CSS.
    // TruckVisualization: width -> X, height -> Y.
    
    // Actually, let's look at `TruckVisualization.tsx`:
    // style={{ left: x, top: y, width: w, height: h }}
    // So 'width' in data is length along truck. 'height' in data is width across truck.
    
    const visualLen = row.length; // X dimension
    // Y dimension: Total truck width / capacity
    // E.g., 248 / 2 = 124. 248 / 3 = 82.6.
    // To look nice, we use fixed sizes roughly.
    const visualWid = row.type === 'euro' ? (row.capacity === 3 ? 80 : 120) : 120; 

    // Place Base Layer
    row.baseItems.forEach((item, index) => {
      const visualItem = {
        key: item.internalId,
        type: item.type,
        x: visualCursorX,
        y: index * visualWid,
        width: visualLen,
        height: visualWid,
        labelId: item.labelId,
        isStackedTier: row.stackedItems[index] ? 'base' : null, // if there is a top item
        showAsFraction: !!row.stackedItems[index],
        displayBaseLabelId: item.labelId,
        displayStackedLabelId: row.stackedItems[index]?.labelId,
        unitId: targetUnit.id
      };
      targetUnit.palletsVisual.push(visualItem);
      totalWeight += item.weight;
    });

    // Place Top Layer
    row.stackedItems.forEach((item, index) => {
      // Find the base item to link IDs
      const baseLabel = row.baseItems[index]?.labelId;
      
      const visualItem = {
        key: item.internalId + '_top',
        type: item.type,
        x: visualCursorX,
        y: index * visualWid,
        width: visualLen,
        height: visualWid,
        labelId: item.labelId,
        isStackedTier: 'top',
        showAsFraction: true,
        displayBaseLabelId: baseLabel,
        displayStackedLabelId: item.labelId,
        unitId: targetUnit.id
      };
      targetUnit.palletsVisual.push(visualItem);
      totalWeight += item.weight;
    });

    visualCursorX += row.length;
  });

  // Statistics
  const totalDinLoaded = targetUnit.palletsVisual.filter((p:any) => p.type === 'industrial').length;
  const totalEupLoaded = targetUnit.palletsVisual.filter((p:any) => p.type === 'euro').length;
  
  // Linear Density Warning
  if (visualCursorX > 0) {
    const density = totalWeight / (visualCursorX / 100);
    if (density > MAX_WEIGHT_PER_METER_KG) {
      warnings.push(`Hohe lineare Last: ${density.toFixed(0)} kg/m (Limit: ${MAX_WEIGHT_PER_METER_KG}).`);
    }
  }
  
  if (totalWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewichtslimit überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg.`);
  }

  return {
    palletArrangement: unitsState.map((u: any) => ({
        unitId: u.id,
        unitLength: u.length,
        unitWidth: u.width,
        pallets: u.palletsVisual
    })),
    loadedIndustrialPalletsBase: dinCount, // Simplified tracking
    loadedEuroPalletsBase: eupCount,
    totalDinPalletsVisual: totalDinLoaded,
    totalEuroPalletsVisual: totalEupLoaded,
    utilizationPercentage: parseFloat(((visualCursorX / truckLength) * 100).toFixed(1)),
    warnings,
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: currentEupLoadingPattern
  };
};
