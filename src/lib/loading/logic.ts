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

// 3.8m Safe Zone: Stacking preferentially happens AFTER this distance (cm)
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
  // Row 3 (16 pallets)
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
  
  // Waggon Bypass
  if (isWaggon && dinWeights.every(e => e.quantity === 0) && eupWeights.some(e => e.quantity > 0)) {
    const res = calculateWaggonEuroLayout(eupWeights, truckConfig);
    if(currentIsEUPStackable) res.warnings.push("Stapeln ist auf dem Waggon nicht möglich.");
    return res;
  }

  const isEUPStackable = isWaggon ? false : currentIsEUPStackable;
  const isDINStackable = isWaggon ? false : currentIsDINStackable;

  // 1. PREPARE GROUPS
  // We work with groups of items instead of individual simulated pallets to ensure stable sorting.
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
  
  // Visual IDs
  allEups.forEach((p, i) => p.labelId = i + 1);
  allDins.forEach((p, i) => p.labelId = i + 1);

  // Create Logical Blocks
  type Block = {
    type: 'euro' | 'industrial';
    items: PalletItem[];
    rowLength: number; // Length of 1 row
    rowCapacity: number; // Items per row
    stackable: boolean;
    assignedStacks: number; // How many items are stacked
  };

  const blocks: Block[] = [];

  // Helper to get specs
  const getSpec = (type: 'euro' | 'industrial') => {
    if (type === 'industrial') return { len: 100, cap: 2 }; // DIN: 2 wide, 100 length
    if (currentEupLoadingPattern === 'broad') return { len: 80, cap: 2 }; // EUP Broad: 2 wide, 80 length
    return { len: 120, cap: 3 }; // EUP Auto/Long: 3 wide, 120 length
  };

  // Add to blocks based on placement order
  if (placementOrder === 'DIN_FIRST') {
    if (allDins.length) blocks.push({ type: 'industrial', items: allDins, rowLength: 100, rowCapacity: 2, stackable: isDINStackable, assignedStacks: 0 });
    if (allEups.length) {
       const spec = getSpec('euro');
       blocks.push({ type: 'euro', items: allEups, rowLength: spec.len, rowCapacity: spec.cap, stackable: isEUPStackable, assignedStacks: 0 });
    }
  } else {
    if (allEups.length) {
       const spec = getSpec('euro');
       blocks.push({ type: 'euro', items: allEups, rowLength: spec.len, rowCapacity: spec.cap, stackable: isEUPStackable, assignedStacks: 0 });
    }
    if (allDins.length) blocks.push({ type: 'industrial', items: allDins, rowLength: 100, rowCapacity: 2, stackable: isDINStackable, assignedStacks: 0 });
  }

  // 2. CALCULATE TOPOLOGY (The Solver)
  const totalTruckLength = truckConfig.usableLength;
  
  // Function to calc total length given current stacking config
  const calculateTotalLength = () => {
    return blocks.reduce((acc, b) => {
      // Items on the floor = Total Items - Stacked Items
      const floorItems = Math.max(0, b.items.length - b.assignedStacks);
      const rowsNeeded = Math.ceil(floorItems / b.rowCapacity);
      return acc + (rowsNeeded * b.rowLength);
    }, 0);
  };

  // Loop: Increase stacks until fit or impossible
  let iterations = 0;
  while (calculateTotalLength() > totalTruckLength && iterations < 1000) {
    iterations++;
    
    // Find a block that CAN stack more
    // We prioritize the block that matches the logic: 
    // To fit 28 DIN + 11 EUP, we usually need to stack the DINs to make room for EUP.
    // Simple heuristic: Find the block with the most unstacked stackable items? 
    // Or just iterate?
    
    // We pick the block that is (1) stackable and (2) has base items that can accept a stack.
    // Capacity check: For every stack, we need a base. Max Stacks = Floor Items * 1.
    // So we can stack until assignedStacks == floorItems. (Approx 50% of total).
    
    let bestBlock: Block | null = null;
    
    // Try to find a block where adding a stack reduces row count efficiently
    // For now, just pick the first valid one, or prefer the larger one?
    // Let's prioritize the one appearing LAST in list (EUPs) if possible to compress tail?
    // No, usually we compress DINs (first) to make room.
    
    // Filter blocks that can accept more stacks
    const candidates = blocks.filter(b => b.stackable && b.assignedStacks < (b.items.length / 2));
    
    if (candidates.length === 0) break; // Can't stack more
    
    // Naive: just pick first available. This handles 28 DIN + 11 EUP correctly because DIN is first.
    // Better: Pick the one causing the length issue?
    // Let's pick the one with the most remaining stackable potential.
    bestBlock = candidates.reduce((prev, curr) => (curr.items.length > prev.items.length ? curr : prev));
    
    if (bestBlock) {
      bestBlock.assignedStacks++;
    }
  }

  // 3. GENERATE VISUAL ROWS
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  const targetUnit = unitsState[0];
  let currentX = 0;
  let warnings: string[] = [];
  let totalWeight = 0;

  blocks.forEach(block => {
    // We need to distribute `block.assignedStacks` onto the rows.
    // First, calculate how many floor rows we have.
    const floorItemsCount = block.items.length - block.assignedStacks;
    const rowCount = Math.ceil(floorItemsCount / block.rowCapacity);
    
    // Create logical rows
    const rows = Array.from({ length: rowCount }, (_, i) => ({
      index: i,
      base: [] as PalletItem[],
      top: [] as PalletItem[],
      x: 0
    }));

    // Fill Base
    let itemIdx = 0;
    // Items 0 to floorItemsCount-1 go to base
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < block.rowCapacity; c++) {
        if (itemIdx < floorItemsCount) {
          rows[r].base.push(block.items[itemIdx++]);
        }
      }
    }

    // Fill Top (The Stacks)
    // We have `block.assignedStacks` items to place on top (indices floorItemsCount to end).
    // STRATEGY APPLIES HERE: Where do we put these top items?
    
    // axle_safe: Fill rows from BACK (rowCount-1) to FRONT (0).
    // max_pairs: Fill rows from FRONT (0) to BACK (rowCount-1).
    
    // We create a list of valid slot indices [row, col] that can accept a stack.
    const validSlots: {r: number, c: number, xVal: number}[] = [];
    
    rows.forEach((r, rIdx) => {
      r.base.forEach((_, cIdx) => {
        // Determine X position relative to truck start to use SAFE_ZONE logic properly
        const rowX = currentX + (rIdx * block.rowLength);
        validSlots.push({ r: rIdx, c: cIdx, xVal: rowX });
      });
    });

    // Sort slots based on strategy
    validSlots.sort((a, b) => {
      const aSafe = a.xVal >= FRONT_SAFE_ZONE_CM;
      const bSafe = b.xVal >= FRONT_SAFE_ZONE_CM;

      if (stackingStrategy === 'axle_safe') {
        // Priority 1: Safe Zone (Rear)
        if (aSafe && !bSafe) return -1;
        if (!aSafe && bSafe) return 1;
        // Priority 2: Within zone, fill front-to-back?
        // The user said: "Stacking should begin at DIN position 9". This means Front-of-Safe-Zone.
        return a.xVal - b.xVal;
      } else {
        // Max Pairs: Fill from absolute front (0)
        return a.xVal - b.xVal;
      }
    });

    // Place the stack items
    let stackItemIdx = floorItemsCount;
    for (let i = 0; i < block.assignedStacks; i++) {
      if (i < validSlots.length) {
        const slot = validSlots[i];
        const item = block.items[stackItemIdx++];
        if (item) {
           rows[slot.r].top[slot.c] = item;
        }
      }
    }

    // Render Rows to Visuals
    rows.forEach((row, rIdx) => {
      const rowLen = block.rowLength;
      const rowVisualHeight = (block.type === 'euro' && block.rowCapacity === 3) ? 82 : 122;
      
      if (currentX + rowLen > targetUnit.length) {
         if (!warnings.includes("Platzmangel")) warnings.push("Nicht genügend Platz für alle Paletten.");
         return;
      }

      row.base.forEach((baseItem, cIdx) => {
        const topItem = row.top[cIdx];
        
        // Base Visual
        targetUnit.palletsVisual.push({
          key: `p_${baseItem.id}`,
          type: baseItem.type,
          x: currentX,
          y: cIdx * rowVisualHeight,
          width: rowLen,
          height: rowVisualHeight,
          labelId: baseItem.labelId,
          isStackedTier: topItem ? 'base' : null,
          showAsFraction: !!topItem,
          displayBaseLabelId: baseItem.labelId,
          displayStackedLabelId: topItem?.labelId,
          unitId: targetUnit.id
        });
        totalWeight += baseItem.weight;

        // Top Visual
        if (topItem) {
          targetUnit.palletsVisual.push({
            key: `p_${topItem.id}_top`,
            type: topItem.type,
            x: currentX,
            y: cIdx * rowVisualHeight,
            width: rowLen,
            height: rowVisualHeight,
            labelId: topItem.labelId,
            isStackedTier: 'top',
            showAsFraction: true,
            displayBaseLabelId: baseItem.labelId,
            displayStackedLabelId: topItem.labelId,
            unitId: targetUnit.id
          });
          totalWeight += topItem.weight;
        }
      });
      currentX += rowLen;
    });
  });

  // 4. METRICS
  if (totalWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewichtslimit überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg.`);
  }
  
  // Front density
  const frontWeight = targetUnit.palletsVisual
    .filter((p: any) => p.x < 400)
    .reduce((acc: number, p: any) => {
       // Find weight from original list... simplified:
       const w = allEups.find(e=>e.labelId===p.labelId)?.weight || allDins.find(d=>d.labelId===p.labelId)?.weight || 0;
       return acc + w;
    }, 0);

  if (frontWeight > 10000) {
    warnings.push(`Warnung: Hohe Last im Stirnwandbereich (${KILOGRAM_FORMATTER.format(frontWeight)} kg).`);
  }

  const totalDinVisual = targetUnit.palletsVisual.filter((p:any) => p.type === 'industrial').length;
  const totalEupVisual = targetUnit.palletsVisual.filter((p:any) => p.type === 'euro').length;
  const requestedCount = allDins.length + allEups.length;
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
    utilizationPercentage: parseFloat(((currentX / totalTruckLength) * 100).toFixed(1)),
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: currentEupLoadingPattern
  };
};
