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

// --- WAGGON SPECIAL LOGIC ---
export const calculateWaggonEuroLayout = (eupWeights: WeightEntry[], truckConfig: any) => {
  const allEupSingles = eupWeights.flatMap(e => Array(e.quantity).fill({ weight: parseFloat(e.weight)||0 }));
  const count = Math.min(allEupSingles.length, 38);
  const placements: any[] = [];
  let currentWeight = 0;
  
  let placed = 0;
  // Row 1 (11 pallets)
  for(let i=0; i<11 && placed<count; i++) {
    placements.push({ x: i*120, y: 0, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null });
    currentWeight += allEupSingles[placed-1].weight;
  }
  // Row 2 (11 pallets)
  for(let i=0; i<11 && placed<count; i++) {
    placements.push({ x: i*120, y: 80, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null });
    currentWeight += allEupSingles[placed-1].weight;
  }
  // Row 3 (16 pallets)
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
  _globalEupStackable: boolean,
  _globalDinStackable: boolean,
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

  // 1. DATA PREPARATION
  let globalId = 1;
  const createItems = (entries: WeightEntry[], type: 'euro'|'industrial') => {
    const res: any[] = [];
    entries.forEach(e => {
      const qty = e.quantity || 0;
      const isStackable = isWaggon ? false : (e.stackable ?? false);
      for(let i=0; i<qty; i++) {
        res.push({
          id: globalId++,
          type,
          weight: parseFloat(e.weight)||0,
          stackable: isStackable,
          labelId: 0
        });
      }
    });
    return res;
  };

  const allEups = createItems(eupWeights, 'euro');
  const allDins = createItems(dinWeights, 'industrial');
  
  // Assign sequential visual labels
  allEups.forEach((p, i) => p.labelId = i + 1);
  allDins.forEach((p, i) => p.labelId = i + 1);

  const queue = placementOrder === 'DIN_FIRST' ? [...allDins, ...allEups] : [...allEups, ...allDins];

  // 2. ROW DEFINITIONS
  type Row = {
    type: 'euro' | 'industrial';
    length: number;
    capacity: number;
    items: any[];
    stackedItems: any[]; // Ensure this is initialized
    stacked: boolean;
    startX: number;
  };

  const getRowSpec = (type: 'euro' | 'industrial') => {
    if (type === 'industrial') return { length: 100, capacity: 2 };
    if (eupPattern === 'broad') return { length: 80, capacity: 2 };
    return { length: 120, capacity: 3 }; // Standard: 3 wide
  };

  // 3. INITIAL LINEAR FILL (Floor only)
  const rows: Row[] = [];
  let currentRow: Row | null = null;
  const totalTruckLength = truckConfig.usableLength;

  for (const p of queue) {
    let spec = getRowSpec(p.type);

    // EUP Auto-Rotation: Switch to Broad (80cm) if near end and needed
    if (p.type === 'euro' && eupPattern === 'auto') {
      const currentUsed = rows.reduce((acc, r) => acc + r.length, 0);
      const remaining = totalTruckLength - currentUsed;
      // If standard (120) doesn't fit but 80 does, or if we are tight on space
      if (spec.length > remaining && remaining >= 80) {
        spec = { length: 80, capacity: 2 };
      }
    }

    if (currentRow && currentRow.type === p.type && currentRow.items.length < currentRow.capacity) {
      currentRow.items.push(p);
    } else {
      currentRow = {
        type: p.type,
        length: spec.length,
        capacity: spec.capacity,
        items: [p],
        stackedItems: [], // Initialize empty!
        stacked: false,
        startX: 0
      };
      rows.push(currentRow);
    }
  }

  // 4. COMPRESSION LOOP (Stacking)
  let iterationLimit = 2000; // Safety break
  
  while (iterationLimit-- > 0) {
    // Calculate current layout length
    let currentLength = 0;
    rows.forEach(r => { r.startX = currentLength; currentLength += r.length; });

    const overflow = currentLength - totalTruckLength;
    
    // If we fit, stop (unless maximizing pairs)
    if (overflow <= 0 && stackingStrategy === 'axle_safe') break;

    // We need to stack to save space.
    // Scan from BACK to FRONT to find a row we can MOVE (Source).
    // It must be stackable (all items stackable) and not already a double-stack.
    // AND we must find a valid TARGET for it.
    
    let merged = false;

    // Iterate backwards to find a source
    for (let i = rows.length - 1; i > 0; i--) {
      const sourceRow = rows[i];
      
      // Can we move this row?
      // 1. It must not be a double stack itself (we don't triple stack)
      // 2. All its items must be stackable
      if (sourceRow.stacked || !sourceRow.items.every(item => item.stackable)) continue;

      // Find a Target for this Source
      // We search all rows physically BEFORE the source.
      // Target must be: Same Type, Not Stacked, All Items Stackable, Sufficient Base Capacity
      
      // Candidate Selection Logic
      const potentialTargets = rows.slice(0, i).filter(t => 
        t.type === sourceRow.type &&
        !t.stacked &&
        t.items.every(item => item.stackable) &&
        t.items.length >= sourceRow.items.length // Target needs base for every source item
      );

      if (potentialTargets.length === 0) continue;

      // Sort Targets based on Strategy
      potentialTargets.sort((a, b) => {
        const aSafe = a.startX >= FRONT_SAFE_ZONE_CM;
        const bSafe = b.startX >= FRONT_SAFE_ZONE_CM;

        if (stackingStrategy === 'axle_safe') {
          // Prefer Safe Zone (Rear) first
          if (aSafe && !bSafe) return -1;
          if (!aSafe && bSafe) return 1;
          // If both safe or both unsafe, fill from front-to-back
          return a.startX - b.startX;
        } else {
          // Max Pairs: Just fill front-to-back regardless of zone
          return a.startX - b.startX;
        }
      });

      const bestTarget = potentialTargets[0];

      // EXECUTE MERGE
      sourceRow.items.forEach(item => bestTarget.stackedItems.push(item));
      bestTarget.stacked = true;

      // Remove source row from array
      rows.splice(i, 1);
      
      merged = true;
      break; // Restart loop to recalc length and indices
    }

    // If we iterated the whole truck and found nothing to merge, we are done (stuck or finished)
    if (!merged) break;
  }

  // 5. VISUALIZATION MAPPING
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  const targetUnit = unitsState[0];
  let visualX = 0;
  let totalWeight = 0;
  let warnings: string[] = [];

  rows.forEach((row: Row) => {
    // Visual Dimensions
    const visualWidth = row.length;
    // Approximate Y height based on capacity (e.g. 248/2 = 124, 248/3 = 82)
    const visualHeight = row.type === 'euro' ? (row.capacity === 3 ? 82 : 120) : 120;

    // Bounds check
    if (visualX + visualWidth > targetUnit.length) {
      warnings.push("Länge reicht nicht aus.");
      return; // Stop rendering this row
    }

    // Base Items
    row.items.forEach((item: any, idx: number) => {
      const stackedItem = row.stackedItems[idx];
      
      targetUnit.palletsVisual.push({
        key: `p_${item.id}`,
        type: item.type,
        x: visualX,
        y: idx * visualHeight,
        width: visualWidth,
        height: visualHeight,
        labelId: item.labelId,
        isStackedTier: stackedItem ? 'base' : null,
        showAsFraction: !!stackedItem,
        displayBaseLabelId: item.labelId,
        displayStackedLabelId: stackedItem?.labelId,
        unitId: targetUnit.id
      });
      totalWeight += item.weight;

      // Top Item
      if (stackedItem) {
        targetUnit.palletsVisual.push({
          key: `p_${item.id}_top`,
          type: item.type,
          x: visualX,
          y: idx * visualHeight,
          width: visualWidth,
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

    visualX += visualWidth;
  });

  // 6. METRICS & WARNINGS
  if (totalWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewichtslimit überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg.`);
  }

  // Front density check (heuristic for 4m)
  const frontRows = rows.filter(r => r.startX < 400);
  const frontWeight = frontRows.reduce((sum, r) => 
    sum + r.items.reduce((s:number,i:any)=>s+i.weight,0) + r.stackedItems.reduce((s:number,i:any)=>s+i.weight,0), 0
  );
  
  if (frontWeight > 10000) {
    warnings.push(`Warnung: Hohe Last im Stirnwandbereich (${KILOGRAM_FORMATTER.format(frontWeight)} kg in den ersten 4m).`);
  }

  const totalDinVisual = targetUnit.palletsVisual.filter((p:any) => p.type === 'industrial').length;
  const totalEupVisual = targetUnit.palletsVisual.filter((p:any) => p.type === 'euro').length;

  // Check for missing pallets
  const requestedCount = queue.length;
  const visualCount = totalDinVisual + totalEupVisual;
  if (visualCount < requestedCount) {
    warnings.push(`${requestedCount - visualCount} Paletten konnten nicht geladen werden.`);
  }

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
