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

// Safety Threshold: Stacking starts at Row 5 (DIN) or ~4m to protect Kingpin
const SAFE_ZONE_START_CM = 400; 

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

// --- WAGGON LOGIC (Preserved) ---
export const calculateWaggonEuroLayout = (eupWeights: WeightEntry[], truckConfig: any) => {
  const allEupSingles = eupWeights.flatMap(e => Array(e.quantity).fill({ weight: parseFloat(e.weight)||0 }));
  const count = Math.min(allEupSingles.length, 38);
  const placements: any[] = [];
  let currentWeight = 0;
  let placed = 0;

  // Row 1
  for(let i=0; i<11 && placed<count; i++) {
    placements.push({ x: i*120, y: 0, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null, unitId: truckConfig.units[0].id });
    currentWeight += allEupSingles[placed-1].weight;
  }
  // Row 2
  for(let i=0; i<11 && placed<count; i++) {
    placements.push({ x: i*120, y: 80, width: 120, height: 80, type: 'euro', labelId: ++placed, isStackedTier: null, unitId: truckConfig.units[0].id });
    currentWeight += allEupSingles[placed-1].weight;
  }
  // Row 3
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
  
  if (isWaggon && dinWeights.every(e => e.quantity === 0) && eupWeights.some(e => e.quantity > 0)) {
    const res = calculateWaggonEuroLayout(eupWeights, truckConfig);
    if(currentIsEUPStackable) res.warnings.push("Stapeln ist auf dem Waggon nicht möglich.");
    return res;
  }

  const isEUPStackable = isWaggon ? false : currentIsEUPStackable;
  const isDINStackable = isWaggon ? false : currentIsDINStackable;

  // 1. DATA PREPARATION
  let globalId = 1;
  // We flatten inputs into individual items
  type PalletItem = { id: number, type: 'euro' | 'industrial', weight: number, stackable: boolean, labelId: number };
  
  const createItems = (entries: WeightEntry[], type: 'euro'|'industrial', canStack: boolean) => {
    const res: PalletItem[] = [];
    entries.forEach(e => {
      const qty = Math.max(0, Number(e.quantity) || 0);
      const rowStackable = canStack && (e.stackable !== false);
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
  const truckLength = truckConfig.usableLength;

  // 2. ROW DEFINITION
  type Row = {
    id: number;
    type: 'euro' | 'industrial';
    length: number;
    capacity: number;
    items: PalletItem[]; // Base items
    stackedItems: PalletItem[]; // Items on top
    startX: number; 
  };

  const rows: Row[] = [];
  let currentRow: Row | null = null;

  // Helper: Specs
  const getSpec = (type: 'euro' | 'industrial') => {
    if (type === 'industrial') return { length: 100, capacity: 2 };
    if (currentEupLoadingPattern === 'broad') return { length: 80, capacity: 2 };
    return { length: 120, capacity: 3 }; // Long/Auto Default
  };

  // 3. INITIAL LAYOUT (All on Floor)
  // We lay them out linearly. No stacking yet.
  for (const p of queue) {
    let spec = getSpec(p.type);

    // Smart EUP Rotation for last meter
    if (p.type === 'euro' && currentEupLoadingPattern === 'auto') {
      const currentUsed = rows.reduce((acc, r) => acc + r.length, 0);
      const remaining = truckLength - currentUsed;
      // If 120 doesn't fit but 80 does, switch mode
      if (spec.length > remaining && remaining >= 80) {
        spec = { length: 80, capacity: 2 };
      }
    }

    if (currentRow && currentRow.type === p.type && currentRow.items.length < currentRow.capacity) {
      currentRow.items.push(p);
    } else {
      currentRow = {
        id: rows.length,
        type: p.type,
        length: spec.length,
        capacity: spec.capacity,
        items: [p],
        stackedItems: [],
        startX: 0
      };
      rows.push(currentRow);
    }
  }

  // 4. THE DEFICIT SOLVER (Compression)
  // Calculate initial length
  const updatePositions = () => {
    let cursor = 0;
    rows.forEach(r => { r.startX = cursor; cursor += r.length; });
    return cursor;
  };

  let currentLength = updatePositions();
  let overflow = currentLength - truckLength;
  let iterations = 0;

  // Loop while we have overflow (and safety break)
  while (overflow > 0 && iterations < 2000) {
    iterations++;

    // We need to move items from the BACK (end of truck) to the TOP (stacks).
    // 1. Identify the Source: The last row that has items.
    const sourceRowIndex = rows.length - 1;
    const sourceRow = rows[sourceRowIndex];

    // If empty (shouldn't happen in valid loop), pop
    if (!sourceRow || sourceRow.items.length === 0) {
      rows.pop();
      currentLength = updatePositions();
      overflow = currentLength - truckLength;
      continue;
    }

    // 2. Identify a Target
    // We look for a row *before* the source that can accept these items.
    // Conditions: Same Type, Not Stacked, Base Items Stackable.
    
    const targets = rows.slice(0, sourceRowIndex).filter(r => 
      r.type === sourceRow.type &&
      r.stackedItems.length === 0 && // Not already double stacked
      r.items.every(i => i.stackable) && // Base supports stack
      sourceRow.items.every(i => i.stackable) && // Items can be stacked
      r.items.length >= sourceRow.items.length // Structural support
    );

    if (targets.length === 0) {
      // No valid place to put these items. We cannot compress further.
      break; 
    }

    // 3. Sort Targets by Strategy
    // 'axle_safe': Prefer Safe Zone (Row 5+ / > 4m), then Front.
    // 'max_pairs': Prefer Front.
    targets.sort((a, b) => {
      const aSafe = a.startX >= SAFE_ZONE_START_CM;
      const bSafe = b.startX >= SAFE_ZONE_START_CM;
      
      if (stackingStrategy === 'axle_safe') {
        if (aSafe && !bSafe) return -1; // A is Safe, B isn't -> Prefer A
        if (!aSafe && bSafe) return 1;
        // Within zone: fill Front-to-Back
        return a.startX - b.startX;
      } else {
        // Max Pairs: simple Front-to-Back
        return a.startX - b.startX;
      }
    });

    const bestTarget = targets[0];

    // 4. Move Items
    sourceRow.items.forEach(item => {
      item.weight = item.weight; // preserve weight
      bestTarget.stackedItems.push(item);
    });
    
    // 5. Remove Source Row
    rows.splice(sourceRowIndex, 1);

    // 6. Recalculate
    currentLength = updatePositions();
    overflow = currentLength - truckLength;
  }

  // 5. VISUALIZATION OUTPUT
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  const targetUnit = unitsState[0];
  let totalWeight = 0;
  const warnings: string[] = [];
  const notLoadedCount = 0; // Logic drops rows if they don't fit, but here we just check overflow visually

  rows.forEach(row => {
    // If row starts after truck end, it's visually overflow
    if (row.startX >= truckLength) {
      // We can count these as "not loaded" implicitly or add warning
      return; 
    }

    const visualWidth = row.length;
    // Y-Dim: EUP 3-wide -> 82px, 2-wide -> 120px. DIN -> 120px.
    const visualHeight = (row.type === 'euro' && row.capacity === 3) ? 82 : 122;

    // Base Layer
    row.items.forEach((item, idx) => {
      const topItem = row.stackedItems[idx];

      // Add Base
      targetUnit.palletsVisual.push({
        key: `p_${item.id}`,
        type: item.type,
        x: row.startX,
        y: idx * visualHeight,
        width: visualWidth,
        height: visualHeight,
        labelId: item.labelId,
        isStackedTier: topItem ? 'base' : null,
        showAsFraction: !!topItem,
        displayBaseLabelId: item.labelId,
        displayStackedLabelId: topItem?.labelId,
        unitId: targetUnit.id
      });
      totalWeight += item.weight;

      // Add Top
      if (topItem) {
        targetUnit.palletsVisual.push({
          key: `p_${topItem.id}_top`,
          type: topItem.type,
          x: row.startX,
          y: idx * visualHeight,
          width: visualWidth,
          height: visualHeight,
          labelId: topItem.labelId,
          isStackedTier: 'top',
          showAsFraction: true,
          displayBaseLabelId: item.labelId,
          displayStackedLabelId: topItem.labelId,
          unitId: targetUnit.id
        });
        totalWeight += topItem.weight;
      }
    });
  });

  // Warnings
  if (currentLength > truckLength) {
    // Calculate how many items are in the overflow rows
    const overflowRows = rows.filter(r => r.startX >= truckLength);
    const lostCount = overflowRows.reduce((sum, r) => sum + r.items.length + r.stackedItems.length, 0);
    warnings.push(`${lostCount} Paletten passen nicht.`);
  }
  
  if (totalWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewichtslimit: ${KILOGRAM_FORMATTER.format(totalWeight)} kg.`);
  }

  // Front density check
  const frontWeight = rows.filter(r => r.startX < 400).reduce((sum, r) => {
     return sum + r.items.reduce((s:number, i:any)=>s+i.weight, 0) + r.stackedItems.reduce((s:number, i:any)=>s+i.weight, 0);
  }, 0);
  
  if (frontWeight > 10000) {
    warnings.push(`Warnung: Hohe Last Front (${KILOGRAM_FORMATTER.format(frontWeight)} kg).`);
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
    utilizationPercentage: parseFloat(((Math.min(currentLength, truckLength) / truckLength) * 100).toFixed(1)),
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: currentEupLoadingPattern
  };
};
