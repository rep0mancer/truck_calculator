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

// Safe Zone: Stacking preferentially happens AFTER this distance (cm)
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

// --- WAGGON SPECIAL LOGIC (Preserved) ---
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

  const isEUPStackable = isWaggon ? false : currentIsEUPStackable;
  const isDINStackable = isWaggon ? false : currentIsDINStackable;

  // 1. DATA PREPARATION
  // Create flat list of pallets with specific stackability
  let globalId = 1;
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
  
  // Visual Labels
  allEups.forEach((p, i) => p.labelId = i + 1);
  allDins.forEach((p, i) => p.labelId = i + 1);

  // Priority Queue
  const queue = placementOrder === 'DIN_FIRST' ? [...allDins, ...allEups] : [...allEups, ...allDins];
  const notLoaded: PalletItem[] = [];

  // 2. ROW DEFINITION
  type Row = {
    type: 'euro' | 'industrial';
    length: number;
    capacity: number;
    items: PalletItem[]; // Base items
    stackedItems: PalletItem[]; // Top items
    stacked: boolean;
    startX: number; 
  };

  const rows: Row[] = [];
  let currentRow: Row | null = null;
  const totalTruckLength = truckConfig.usableLength;

  // Helper: Get dimensions for a new row
  const getRowSpec = (type: 'euro' | 'industrial', remainingTruckLength: number) => {
    if (type === 'industrial') return { length: 100, capacity: 2 };
    
    // EUP Logic
    if (currentEupLoadingPattern === 'broad') return { length: 80, capacity: 2 };
    
    // Auto/Long: Default to 3-wide (120cm)
    // Switch to Broad (80cm) ONLY if we are at the very end and 120 doesn't fit but 80 does
    const standardSpec = { length: 120, capacity: 3 };
    if (currentEupLoadingPattern === 'auto' && remainingTruckLength < 120 && remainingTruckLength >= 80) {
      return { length: 80, capacity: 2 };
    }
    return standardSpec;
  };

  // 3. THE "PLACE OR SQUEEZE" LOOP
  for (const p of queue) {
    let placed = false;

    // A. Try adding to current row (if space exists on floor of current row)
    if (currentRow && currentRow.type === p.type && currentRow.items.length < currentRow.capacity) {
      currentRow.items.push(p);
      placed = true;
    } 
    
    // B. Try starting a new row (if space exists in truck)
    if (!placed) {
      const currentUsed = rows.reduce((acc, r) => acc + r.length, 0);
      const remaining = totalTruckLength - currentUsed;
      const spec = getRowSpec(p.type, remaining);

      if (spec.length <= remaining) {
        currentRow = {
          type: p.type,
          length: spec.length,
          capacity: spec.capacity,
          items: [p],
          stackedItems: [],
          stacked: false,
          startX: currentUsed
        };
        rows.push(currentRow);
        placed = true;
      }
    }

    // C. THE SQUEEZE (Compression)
    // If we couldn't place it on the floor, we must make room.
    if (!placed) {
      // Strategy:
      // 1. Can we stack `p` directly on an existing matching row?
      // 2. If not (e.g. truck is full of DINs, `p` is EUP), can we stack a DIN row to make length for `p`?

      // Find candidate rows to receive a stack
      // Candidate must be: matching type (if stacking p) OR matching type of a movable row.
      
      // Let's try to stack `p` directly first.
      let targetRow = findBestStackTarget(rows, p.type, stackingStrategy);
      
      if (targetRow) {
        // We found a spot for p!
        placeOnStack(targetRow, p);
        placed = true;
      } else {
        // We couldn't stack `p` directly. 
        // We need to compress OTHER rows to free up floor length.
        // Look for ANY row that can be compressed (stacked upon).
        
        // We iterate until we free up enough space or run out of moves
        // For simplicity, we try to compress once per loop iteration
        const potentialCompressionTypes = ['industrial', 'euro'] as const;
        
        for (const typeToCompress of potentialCompressionTypes) {
          // We need to find a Source (floor row to remove) and a Target (floor row to stack upon).
          // Source should be near the end (to free up contiguous space).
          // Target should be near the safe zone.
          
          // Find last unstacked row of this type
          const sourceIndex = findLastMovableRowIndex(rows, typeToCompress);
          if (sourceIndex === -1) continue;
          const sourceRow = rows[sourceIndex];

          // Find best target for this source
          const compressTarget = findBestStackTarget(rows, typeToCompress, stackingStrategy, sourceIndex); // Limit search to before source

          if (compressTarget && compressTarget.items.length >= sourceRow.items.length) {
            // Move all items from source to target
            sourceRow.items.forEach(item => {
               item.stackable = true; // It was on floor, now going to stack. Assume stackable if row was movable.
               placeOnStack(compressTarget, item);
            });
            
            // Delete source row
            rows.splice(sourceIndex, 1);
            
            // Re-calc positions to see if p fits now
            let newUsed = rows.reduce((acc, r) => acc + r.length, 0);
            // Update startX for subsequent logic
            let runningX = 0; rows.forEach(r => { r.startX = runningX; runningX += r.length; });
            
            // Try to place `p` again on floor
            const newRemaining = totalTruckLength - newUsed;
            const newSpec = getRowSpec(p.type, newRemaining);
            
            if (newSpec.length <= newRemaining) {
               currentRow = {
                type: p.type,
                length: newSpec.length,
                capacity: newSpec.capacity,
                items: [p],
                stackedItems: [],
                stacked: false,
                startX: newUsed
              };
              rows.push(currentRow);
              placed = true;
              break; // Squeeze successful
            }
          }
        }
      }
    }

    if (!placed) {
      notLoaded.push(p);
    }
  }

  // 4. HELPERS
  function findBestStackTarget(allRows: Row[], type: string, strategy: StackingStrategy, beforeIndex: number = allRows.length) {
    // Filter candidates
    const candidates = allRows.slice(0, beforeIndex).filter(r => 
      r.type === type &&
      !r.stacked && 
      r.items.every(i => i.stackable) // Base must be stackable
    );

    if (candidates.length === 0) return null;

    // Sort by Strategy
    candidates.sort((a, b) => {
      const aSafe = a.startX >= FRONT_SAFE_ZONE_CM;
      const bSafe = b.startX >= FRONT_SAFE_ZONE_CM;

      if (strategy === 'axle_safe') {
        if (aSafe && !bSafe) return -1; // Prefer Safe
        if (!aSafe && bSafe) return 1;
        return a.startX - b.startX; // Front-to-back within zone
      } else {
        // Max Pairs: Prefer absolute front
        return a.startX - b.startX;
      }
    });

    // Return first that has space (though logic implies we fill row fully if moving whole row)
    // For single pallet p, we just need one slot.
    // For row compression, we need capacity match (checked in loop).
    return candidates[0];
  }

  function findLastMovableRowIndex(allRows: Row[], type: string) {
    for (let i = allRows.length - 1; i >= 0; i--) {
      const r = allRows[i];
      if (r.type === type && !r.stacked && r.items.every(item => item.stackable)) {
        return i;
      }
    }
    return -1;
  }

  function placeOnStack(row: Row, item: PalletItem) {
    // Find first empty slot in stackedItems
    // We must maintain index alignment (stackedItem[0] sits on items[0])
    let slotIdx = -1;
    for(let i=0; i<row.items.length; i++) {
      if (!row.stackedItems[i]) {
        slotIdx = i;
        break;
      }
    }
    
    if (slotIdx === -1) {
       // Should not happen if we checked candidates correctly, but push just in case
       row.stackedItems.push(item);
    } else {
       row.stackedItems[slotIdx] = item;
    }
    
    // Mark row as stacked if it has any top items
    if (row.stackedItems.length > 0) row.stacked = true;
  }


  // 5. VISUALIZATION MAPPING
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  const targetUnit = unitsState[0];
  let totalWeight = 0;
  let visualX = 0;

  // Re-calculate final X positions
  rows.forEach(r => { r.startX = visualX; visualX += r.length; });

  rows.forEach(row => {
    const visualHeight = (row.type === 'euro' && row.capacity === 3) ? 82 : 122;
    const visualWidth = row.length;

    // Base
    row.items.forEach((item, idx) => {
      const stackedItem = row.stackedItems[idx];
      
      targetUnit.palletsVisual.push({
        key: `p_${item.id}`,
        type: item.type,
        x: row.startX,
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
          x: row.startX,
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
  });

  // 6. WARNINGS
  if (notLoaded.length > 0) {
     warnings.push(`${notLoaded.length} Paletten konnten nicht geladen werden.`);
  }
  if (totalWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewichtslimit überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg.`);
  }
  // Front density
  const frontWeight = rows.filter(r => r.startX < 400).reduce((sum, r) => 
    sum + r.items.reduce((s:number, i:any)=>s+i.weight,0) + r.stackedItems.reduce((s:number, i:any)=>s+i.weight,0), 0
  );
  if (frontWeight > 10000) {
    warnings.push(`Warnung: Hohe Last im Stirnwandbereich (${KILOGRAM_FORMATTER.format(frontWeight)} kg).`);
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
