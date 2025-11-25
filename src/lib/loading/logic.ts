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

// The "Safe Zone": Stacking preferred AFTER this X position (cm)
// 3.8m is typical to clear the kingpin area.
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

// --- HELPER: WAGGON (Legacy/Specific) ---
export const calculateWaggonEuroLayout = (eupWeights: WeightEntry[], truckConfig: any) => {
  const allEupSingles = eupWeights.flatMap(e => Array(e.quantity).fill({ weight: parseFloat(e.weight)||0 }));
  const count = Math.min(allEupSingles.length, 38);
  const placements: any[] = [];
  let currentWeight = 0;
  
  // 2 Rows of 11 (Long), 1 Row of 16 (Broad)
  let placed = 0;
  // Row 1
  for(let i=0; i<11 && placed<count; i++) {
    placements.push({ x: i*120, y: 0, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null });
    currentWeight += allEupSingles[placed-1].weight;
  }
  // Row 2
  for(let i=0; i<11 && placed<count; i++) {
    placements.push({ x: i*120, y: 80, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null });
    currentWeight += allEupSingles[placed-1].weight;
  }
  // Row 3
  for(let i=0; i<16 && placed<count; i++) {
    placements.push({ x: i*80, y: 160, width: 80, height: 120, type: 'euro', labelId: ++placed, isStackedTier: null });
    currentWeight += allEupSingles[placed-1].weight;
  }

  return {
    palletArrangement: [{ unitId: truckConfig.units[0].id, unitLength: 1370, unitWidth: 290, pallets: placements }],
    loadedIndustrialPalletsBase: 0, loadedEuroPalletsBase: placed,
    totalDinPalletsVisual: 0, totalEuroPalletsVisual: placed,
    utilizationPercentage: 0, warnings: [], totalWeightKg: currentWeight, eupLoadingPatternUsed: 'custom'
  };
};

// --- MAIN LOGIC ---

export const calculateLoadingLogic = (
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  globalEupStackable: boolean, // We ignore these in favor of specific entry data if available
  globalDinStackable: boolean,
  eupPattern: 'auto' | 'long' | 'broad',
  placementOrder: 'DIN_FIRST' | 'EUP_FIRST' = 'DIN_FIRST',
  _maxEupIgnored?: any,
  _maxDinIgnored?: any,
  stackingStrategy: StackingStrategy = 'axle_safe'
) => {
  const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const isWaggon = ['Waggon', 'Waggon2'].includes(truckKey);
  
  // Waggon Bypass
  if (isWaggon && dinWeights.every(e => e.quantity === 0) && eupWeights.some(e => e.quantity > 0)) {
    return calculateWaggonEuroLayout(eupWeights, truckConfig);
  }

  // 1. PREPARE DATA
  let globalId = 1;
  // Create flat list of pallets with specific stackability
  const createItems = (entries: WeightEntry[], type: 'euro'|'industrial') => {
    const res: any[] = [];
    entries.forEach(e => {
      const qty = e.quantity || 0;
      const isStackable = isWaggon ? false : (e.stackable ?? false); // Trust the row input
      for(let i=0; i<qty; i++) {
        res.push({
          id: globalId++,
          type,
          weight: parseFloat(e.weight)||0,
          stackable: isStackable,
          labelId: 0 // Assigned later
        });
      }
    });
    return res;
  };

  const allEups = createItems(eupWeights, 'euro');
  const allDins = createItems(dinWeights, 'industrial');
  
  // Assign Visual Labels (1..N per type)
  allEups.forEach((p, i) => p.labelId = i + 1);
  allDins.forEach((p, i) => p.labelId = i + 1);

  const queue = placementOrder === 'DIN_FIRST' ? [...allDins, ...allEups] : [...allEups, ...allDins];

  // 2. DEFINE ROWS (The "Tracks")
  // We don't place X/Y yet. We create logical "Rows" that consume length.
  type Row = {
    type: 'euro' | 'industrial';
    length: number;   // Length consumption in cm
    capacity: number; // Pallets width-wise
    items: any[];     // The pallets sitting here
    stacked: boolean; // Is this row double-stacked?
    startX: number;   // Calculated position
  };

  // Helper: What kind of row does this pallet want?
  const getRowSpec = (type: 'euro' | 'industrial') => {
    if (type === 'industrial') return { length: 100, capacity: 2 }; // DIN: 100cm length, 2 wide
    // EUP
    if (eupPattern === 'broad') return { length: 80, capacity: 2 };
    return { length: 120, capacity: 3 }; // Auto/Long: 120cm length, 3 wide
  };

  // 3. INITIAL FILL (Unstacked)
  // Put everything on the floor linearly.
  const rows: Row[] = [];
  let currentRow: Row | null = null;

  // If we are in mixed mode, we might need rotation switching for EUPs.
  // We handle that by checking if the standard EUP row fits.
  const totalTruckLength = truckConfig.usableLength;

  for (const p of queue) {
    let spec = getRowSpec(p.type);

    // EUP Auto-Rotation Logic:
    // If we are EUP, Auto, and near the end, check if switching to 2-wide (80cm) helps fit.
    if (p.type === 'euro' && eupPattern === 'auto') {
      // Calculate current length usage
      const currentUsed = rows.reduce((acc, r) => acc + r.length, 0);
      const remaining = totalTruckLength - currentUsed;
      
      // If standard (120) doesn't fit, but 80 does, switch spec
      if (spec.length > remaining && remaining >= 80) {
        spec = { length: 80, capacity: 2 };
      }
    }

    // Add to current row if matches
    if (currentRow && currentRow.type === p.type && currentRow.items.length < currentRow.capacity) {
      currentRow.items.push(p);
    } else {
      // New Row
      currentRow = {
        type: p.type,
        length: spec.length,
        capacity: spec.capacity,
        items: [p],
        stacked: false,
        startX: 0
      };
      rows.push(currentRow);
    }
  }

  // 4. THE COMPRESSION LOOP (The Fix for 28 DIN + 11 EUP)
  // We calculate total length. If > Truck, we MUST stack.
  // We stack based on Strategy priorities.

  let iterationLimit = 1000;
  while (iterationLimit-- > 0) {
    // A. Calculate current length
    let currentLength = 0;
    rows.forEach(r => { r.startX = currentLength; currentLength += r.length; });

    const overflow = currentLength - totalTruckLength;
    
    // B. Stop conditions
    // If we fit, AND we are in 'axle_safe' (lazy stacking), we stop.
    // If we are 'max_pairs', we keep going until no more stackables exist.
    if (overflow <= 0 && stackingStrategy === 'axle_safe') break;

    // C. Find Candidate to Stack
    // We want to turn a single row into a stacked row to save length.
    // But wait, we can't just "turn on stacking" for a row if we don't have pallets to put on it.
    // Actually, we have the pallets. They are currently occupying floor space further down the truck.
    
    // We simulate "Compression":
    // We identify a row that is currently single, has stackable items, and matches the type of the LAST row.
    // Why the last row? Because that's the one falling off the truck.
    
    const lastRow = rows[rows.length - 1];
    
    // Find a target row that can accept `lastRow`'s items.
    // Target must be:
    // 1. Same type
    // 2. Not already stacked
    // 3. All items in target must be stackable
    // 4. All items in lastRow must be stackable
    
    const candidates = rows.filter(r => 
      r !== lastRow &&
      r.type === lastRow.type &&
      !r.stacked &&
      r.items.every(i => i.stackable) &&
      lastRow.items.every(i => i.stackable) &&
      r.items.length >= lastRow.items.length // Target needs base stability
    );

    if (candidates.length === 0) break; // Can't stack anything more

    // D. Sort Candidates by Strategy
    candidates.sort((a, b) => {
      const aSafe = a.startX >= FRONT_SAFE_ZONE_CM;
      const bSafe = b.startX >= FRONT_SAFE_ZONE_CM;

      if (stackingStrategy === 'axle_safe') {
        // Prefer Safe Zone (Rear)
        if (aSafe && !bSafe) return -1;
        if (!aSafe && bSafe) return 1;
        // Inside safe zone, fill Front-to-Back (closest to axle first)
        return a.startX - b.startX;
      } else {
        // Max pairs: Fill from very front
        return a.startX - b.startX;
      }
    });

    // E. Execute Merge
    const target = candidates[0];
    // Move items from lastRow to target's "stack"
    // We don't have a "stackedItems" array in Row, we just logically merge them.
    // But we need to track them for visuals.
    // Let's change Row structure slightly to hold 'stackedItems'.
    if (!target.stackedItems) target.stackedItems = [];
    
    lastRow.items.forEach(item => {
      item.isStacked = true; // Mark for visualizer
      target.stackedItems.push(item);
    });
    target.stacked = true;

    // Remove last row
    rows.pop();
    currentRow = rows[rows.length - 1];
  }

  // 5. CONSTRUCT VISUALIZATION
  // Strict mapping to TruckVisualization props
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  let totalWeight = 0;
  
  // We assume single unit for standard trucks
  const targetUnit = unitsState[0];
  
  // Re-calc positions one last time
  let visualX = 0;
  let warnings: string[] = [];

  rows.forEach((row: any) => {
    const rowLen = row.length; // 120, 100, or 80
    const rowCap = row.capacity; // 2 or 3
    
    // Y Dimension (Width)
    // EUP 3-wide (Long): 80cm visual width
    // EUP 2-wide (Broad): 120cm visual width
    // DIN 2-wide: 120cm visual width (since 120 side is across)
    // Wait, DIN logic: 100cm length used. 120cm side is across truck.
    
    let visualHeight = 120;
    if (row.type === 'euro' && rowCap === 3) visualHeight = 80;
    
    // Check truck bounds
    if (visualX + rowLen > targetUnit.length) {
      warnings.push("Länge reicht nicht aus.");
      return;
    }

    // Base Items
    row.items.forEach((item: any, idx: number) => {
      const stackedItem = row.stackedItems ? row.stackedItems[idx] : null;
      
      // Add Base
      targetUnit.palletsVisual.push({
        key: `p_${item.id}`,
        type: item.type,
        x: visualX,
        y: idx * visualHeight,
        width: rowLen,
        height: visualHeight,
        labelId: item.labelId,
        isStackedTier: stackedItem ? 'base' : null,
        showAsFraction: !!stackedItem,
        displayBaseLabelId: item.labelId,
        displayStackedLabelId: stackedItem?.labelId,
        unitId: targetUnit.id
      });
      totalWeight += item.weight;

      // Add Top
      if (stackedItem) {
        targetUnit.palletsVisual.push({
          key: `p_${item.id}_top`,
          type: item.type,
          x: visualX,
          y: idx * visualHeight,
          width: rowLen,
          height: visualHeight,
          labelId: stackedItem.labelId,
          isStackedTier: 'top',
          showAsFraction: true,
          displayBaseLabelId: item.labelId,
          displayStackedLabelId: stackedItem.labelId,
          unitId: targetUnit.id
        });
        totalWeight += stackedItem.weight;
      }
    });

    visualX += rowLen;
  });

  // 6. WARNINGS
  if (totalWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewicht zu hoch: ${KILOGRAM_FORMATTER.format(totalWeight)} kg.`);
  }
  // Density check (Front 4m)
  const frontRows = rows.filter((r: any) => r.startX < 400);
  const frontWeight = frontRows.reduce((sum: number, r: any) => {
    const baseW = r.items.reduce((s: number, i: any) => s + i.weight, 0);
    const stackW = r.stackedItems ? r.stackedItems.reduce((s: number, i: any) => s + i.weight, 0) : 0;
    return sum + baseW + stackW;
  }, 0);
  
  if (frontWeight > 10000) { // 10 ton limit heuristic
    warnings.push(`Warnung: ${KILOGRAM_FORMATTER.format(frontWeight)} kg in den ersten 4m.`);
  }

  const totalDinVisual = targetUnit.palletsVisual.filter((p:any) => p.type === 'industrial').length;
  const totalEupVisual = targetUnit.palletsVisual.filter((p:any) => p.type === 'euro').length;

  return {
    palletArrangement: unitsState.map((u: any) => ({
        unitId: u.id,
        unitLength: u.length,
        unitWidth: u.width,
        pallets: u.palletsVisual
    })),
    loadedIndustrialPalletsBase: 0, 
    loadedEuroPalletsBase: 0,
    totalDinPalletsVisual: totalDinVisual,
    totalEuroPalletsVisual: totalEupVisual,
    utilizationPercentage: parseFloat(((visualX / totalTruckLength) * 100).toFixed(1)),
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: currentEupLoadingPattern
  };
};
