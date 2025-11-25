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
    placements.push({ x: i*120, y: 0, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null, unitId: truckConfig.units[0].id });
    currentWeight += allEupSingles[placed-1].weight;
  }
  // Row 2 (11 pallets)
  for(let i=0; i<11 && placed<count; i++) {
    placements.push({ x: i*120, y: 80, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null, unitId: truckConfig.units[0].id });
    currentWeight += allEupSingles[placed-1].weight;
  }
  // Row 3 (16 pallets - rotated)
  for(let i=0; i<16 && placed<count; i++) {
    placements.push({ x: i*80, y: 160, width: 80, height: 120, type: 'euro', labelId: ++placed, isStackedTier: null, unitId: truckConfig.units[0].id });
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
  currentIsEUPStackable: boolean,
  currentIsDINStackable: boolean,
  currentEupLoadingPattern: 'auto' | 'long' | 'broad',
  placementOrder: 'DIN_FIRST' | 'EUP_FIRST' = 'DIN_FIRST',
  _maxEupIgnored?: any,
  _maxDinIgnored?: any,
  stackingStrategy: StackingStrategy = 'axle_safe'
) => {
  const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const isWaggon = ['Waggon', 'Waggon2'].includes(truckKey);
  let warnings: string[] = [];

  // Waggon Bypass
  if (isWaggon && dinWeights.every(e => e.quantity === 0) && eupWeights.some(e => e.quantity > 0)) {
    const res = calculateWaggonEuroLayout(eupWeights, truckConfig);
    if(currentIsEUPStackable) res.warnings.push("Stapeln ist auf dem Waggon nicht möglich.");
    return res;
  }

  // Force stackable to false for Waggons
  const isEUPStackable = isWaggon ? false : currentIsEUPStackable;
  const isDINStackable = isWaggon ? false : currentIsDINStackable;

  // 1. DATA PREPARATION
  let globalId = 1;
  type PalletItem = { id: number, type: 'euro' | 'industrial', weight: number, stackable: boolean, labelId: number };
  
  const createItems = (entries: WeightEntry[], type: 'euro'|'industrial', canStack: boolean) => {
    const res: PalletItem[] = [];
    entries.forEach(e => {
      const qty = Math.max(0, Number(e.quantity) || 0);
      const rowStackable = canStack && (e.stackable !== false); // Respect row setting
      for(let i=0; i<qty; i++) {
        res.push({
          id: globalId++,
          type,
          weight: parseFloat(e.weight)||0,
          stackable: rowStackable,
          labelId: 0
        });
      }
    });
    return res;
  };

  const allEups = createItems(eupWeights, 'euro', isEUPStackable);
  const allDins = createItems(dinWeights, 'industrial', isDINStackable);
  
  allEups.forEach((p, i) => p.labelId = i + 1);
  allDins.forEach((p, i) => p.labelId = i + 1);

  const queue = placementOrder === 'DIN_FIRST' ? [...allDins, ...allEups] : [...allEups, ...allDins];

  // 2. ROW DEFINITIONS
  type Row = {
    type: 'euro' | 'industrial';
    length: number;
    capacity: number;
    items: PalletItem[];
    stackedItems: PalletItem[]; 
    stacked: boolean;
    startX: number; // cm from front
  };

  const getRowSpec = (type: 'euro' | 'industrial') => {
    if (type === 'industrial') return { length: 100, capacity: 2 };
    if (currentEupLoadingPattern === 'broad') return { length: 80, capacity: 2 };
    return { length: 120, capacity: 3 }; // Default Auto/Long: 3 wide
  };

  // 3. INITIAL LINEAR FILL (Pass 1)
  const rows: Row[] = [];
  let currentRow: Row | null = null;
  const totalTruckLength = truckConfig.usableLength;

  for (const p of queue) {
    let spec = getRowSpec(p.type);

    // Auto-Rotation for EUP: switch to broad if we are near the end and it helps
    if (p.type === 'euro' && currentEupLoadingPattern === 'auto') {
      const currentUsed = rows.reduce((acc, r) => acc + r.length, 0);
      const remaining = totalTruckLength - currentUsed;
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
        stackedItems: [],
        stacked: false,
        startX: 0
      };
      rows.push(currentRow);
    }
  }

  // 4. COMPRESSION LOOP (Pass 2)
  let iterationLimit = 5000;
  
  while (iterationLimit-- > 0) {
    // Recalculate positions
    let currentLength = 0;
    rows.forEach(r => { r.startX = currentLength; currentLength += r.length; });

    const overflow = currentLength - totalTruckLength;
    if (overflow <= 0) break; // Fit successful

    // Find a merge: Move a row from somewhere to the top of another row.
    // To clear space at the END, we should try to merge the LAST movable row onto a valid target.
    // But "last" might be EUP, while we want to stack DINs in the middle.
    // So we search for ANY valid (Target, Source) pair that reduces length.
    
    // We prefer to pick a Source that is near the end (to clear overflow directly),
    // and a Target based on Strategy.

    let bestMove: { sourceIndex: number, targetIndex: number } | null = null;
    
    // Iterate backwards for Source (try to clear from back)
    for (let s = rows.length - 1; s > 0; s--) {
      const source = rows[s];
      // Source validity: Not stacked, All items stackable
      if (source.stacked || !source.items.every(i => i.stackable)) continue;

      // Find compatible Targets (must be before Source)
      // Target validity: Same type, Not stacked, All items stackable, Capacity match
      const potentialTargets = rows.slice(0, s).map((r, idx) => ({ row: r, index: idx })).filter(t => 
        t.row.type === source.type &&
        !t.row.stacked &&
        t.row.items.every(i => i.stackable) &&
        t.row.items.length >= source.items.length
      );

      if (potentialTargets.length === 0) continue;

      // Sort Targets by Strategy
      potentialTargets.sort((a, b) => {
        const aSafe = a.row.startX >= FRONT_SAFE_ZONE_CM;
        const bSafe = b.row.startX >= FRONT_SAFE_ZONE_CM;
        
        if (stackingStrategy === 'axle_safe') {
          if (aSafe && !bSafe) return -1; // Prefer Safe
          if (!aSafe && bSafe) return 1;
          // If equal, prefer closest to safe zone start (smallest X in safe zone) ?
          // Actually standard is front-to-back fill within zone.
          return a.row.startX - b.row.startX; 
        } else {
          // Max Pairs: Front-to-Back
          return a.row.startX - b.row.startX;
        }
      });

      // Found a move!
      bestMove = { sourceIndex: s, targetIndex: potentialTargets[0].index };
      break; // Found the best move for the further-back source
    }

    if (bestMove) {
      const source = rows[bestMove.sourceIndex];
      const target = rows[bestMove.targetIndex];
      
      // Move items
      source.items.forEach(item => target.stackedItems.push(item));
      target.stacked = true;
      
      // Remove source
      rows.splice(bestMove.sourceIndex, 1);
    } else {
      break; // No moves possible, stop compression
    }
  }

  // 5. VISUALIZATION MAPPING (Pass 3)
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  const targetUnit = unitsState[0]; 
  let totalWeight = 0;
  let visualX = 0;

  rows.forEach(row => {
    // Visual Dimensions
    // Truck Width ~248.
    // EUP (3 wide) -> Visual Height ~82
    // EUP (2 wide) -> Visual Height ~120
    // DIN (2 wide) -> Visual Height ~120
    const visualHeight = (row.type === 'euro' && row.capacity === 3) ? 82 : 122;
    const visualWidth = row.length;

    // Base
    row.items.forEach((item, idx) => {
      const stackedItem = row.stackedItems[idx];
      // Bounds Check for Visuals
      if (visualX + visualWidth > targetUnit.length) {
        if (!warnings.includes("Nicht genügend Platz für alle Paletten.")) 
           warnings.push("Nicht genügend Platz für alle Paletten.");
        return;
      }

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

      // Top
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

  // 6. METRICS
  if (totalWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewichtslimit überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg.`);
  }
  
  // Linear Density Check (Front 4m)
  const frontRows = rows.filter(r => r.startX < 400);
  const frontWeight = frontRows.reduce((sum, r) => {
    return sum + r.items.reduce((s:number, i:any)=>s+i.weight,0) + r.stackedItems.reduce((s:number, i:any)=>s+i.weight,0);
  }, 0);
  if (frontWeight > 10000) {
    warnings.push(`Warnung: Hohe Last im Stirnwandbereich (${KILOGRAM_FORMATTER.format(frontWeight)} kg).`);
  }

  const totalDinVisual = targetUnit.palletsVisual.filter((p:any) => p.type === 'industrial').length;
  const totalEupVisual = targetUnit.palletsVisual.filter((p:any) => p.type === 'euro').length;
  const requestedCount = queue.length;
  const visualCount = totalDinVisual + totalEupVisual;
  
  if (visualCount < requestedCount) {
    warnings.push(`${requestedCount - visualCount} Paletten passen nicht.`);
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
