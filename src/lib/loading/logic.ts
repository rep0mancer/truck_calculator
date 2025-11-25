"use client";

// Define the type for a single weight entry
export type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
  stackable?: boolean;
};

export type StackBand = 'front' | 'stack' | 'rear';
export type StackingStrategy = 'axle_safe' | 'max_pairs';

// --- CONFIGURATION CONSTANTS ---
export const MAX_GROSS_WEIGHT_KG = 24000;
export const MAX_PALLET_SIMULATION_QUANTITY = 300;
export const STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING = 18;
export const STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING = 16;
export const MAX_WEIGHT_PER_METER_KG = 1800;

// The distance (in cm) from the front wall where we PREFER not to stack
// to protect the kingpin/front axle load. 3.8m is a standard threshold.
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
  euro: { name: 'Euro Palette (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700' },
  industrial: { name: 'Industrial Palette (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700' },
};

// --- WAGGON LOGIC (Preserved) ---
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
    warnings.push(
      `Die maximale Kapazität des Waggons von ${WAGGON_CAPACITY} EUP wurde überschritten. ${
        requestedEupQuantity - WAGGON_CAPACITY
      } Palette(n) konnten nicht geladen werden.`
    );
  }

  const palletsToPlace = Math.min(requestedEupQuantity, WAGGON_CAPACITY);
  let placedCount = 0;

  // Pattern: 2 rows of 11 (long orientation) + 1 row of 16 (broad orientation)
  // Row 1: 11 pallets, 120cm along truck length
  for (let i = 0; i < 11 && placedCount < palletsToPlace; i++) {
    placements.push({
      x: i * EUP_LENGTH,
      y: 0,
      width: EUP_LENGTH,
      height: EUP_WIDTH,
      type: 'euro',
      key: `eup_waggon_${placedCount}`,
      labelId: placedCount + 1,
    });
    currentWeight += allEupSingles[placedCount]?.weight || 0;
    placedCount++;
  }

  // Row 2: 11 pallets, 120cm along truck length
  for (let i = 0; i < 11 && placedCount < palletsToPlace; i++) {
    placements.push({
      x: i * EUP_LENGTH,
      y: EUP_WIDTH,
      width: EUP_LENGTH,
      height: EUP_WIDTH,
      type: 'euro',
      key: `eup_waggon_${placedCount}`,
      labelId: placedCount + 1,
    });
    currentWeight += allEupSingles[placedCount]?.weight || 0;
    placedCount++;
  }

  // Row 3: 16 pallets, 80cm along truck length
  for (let i = 0; i < 16 && placedCount < palletsToPlace; i++) {
    placements.push({
      x: i * EUP_WIDTH,
      y: EUP_WIDTH * 2,
      width: EUP_WIDTH,
      height: EUP_LENGTH,
      type: 'euro',
      key: `eup_waggon_${placedCount}`,
      labelId: placedCount + 1,
    });
    currentWeight += allEupSingles[placedCount]?.weight || 0;
    placedCount++;
  }

  const finalPalletArrangement = [
    {
      unitId: truckConfig.units[0].id,
      unitLength: truckConfig.units[0].length,
      unitWidth: truckConfig.units[0].width,
      pallets: placements,
    },
  ];

  const totalPalletArea = placedCount * (EUP_LENGTH * EUP_WIDTH);
  const totalTruckArea = truckConfig.usableLength * truckConfig.maxWidth;
  const utilization = totalTruckArea > 0 ? (totalPalletArea / totalTruckArea) * 100 : 0;

  return {
    palletArrangement: finalPalletArrangement,
    loadedIndustrialPalletsBase: 0,
    loadedEuroPalletsBase: placedCount,
    totalDinPalletsVisual: 0,
    totalEuroPalletsVisual: placedCount,
    utilizationPercentage: parseFloat(utilization.toFixed(1)),
    warnings,
    totalWeightKg: currentWeight,
    eupLoadingPatternUsed: 'custom',
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

  // --- Waggon Checks ---
  const isWaggon = ['Waggon', 'Waggon2'].includes(truckKey);
  const isDinEmpty = dinWeights.every(entry => entry.quantity === 0);
  const isEupPresent = eupWeights.some(entry => entry.quantity > 0);

  if (isWaggon && isDinEmpty && isEupPresent) {
    const result = calculateWaggonEuroLayout(eupWeights, truckConfig);
    if (currentIsEUPStackable) {
       result.warnings.push("Info: Stapeln ist auf dem Waggon nicht möglich und wurde deaktiviert.");
    }
    return result;
  }

  // Force stackable to false for Waggons, otherwise respect input
  const isEUPStackable = isWaggon ? false : currentIsEUPStackable;
  const isDINStackable = isWaggon ? false : currentIsDINStackable;

  // 1. Helper: Flatten Inputs into a simple list of items with properties
  let uniqueIdSeed = 1;
  const createFlatList = (entries: WeightEntry[], type: 'euro' | 'industrial', globalStackable: boolean) => {
    const list: any[] = [];
    entries.forEach(e => {
      const qty = Math.max(0, Number(e.quantity) || 0);
      for(let i=0; i<qty; i++) {
        list.push({
          internalId: uniqueIdSeed++,
          type,
          weight: parseFloat(e.weight) || 0,
          stackable: globalStackable && (e.stackable !== false), // Entry specific override
          isStacked: false,
          pairId: null
        });
      }
    });
    return list;
  };

  const eups = createFlatList(eupWeights, 'euro', isEUPStackable);
  const dins = createFlatList(dinWeights, 'industrial', isDINStackable);

  // 2. Create the "Loading Queue" based on placement order
  let queue = placementOrder === 'DIN_FIRST' ? [...dins, ...eups] : [...eups, ...dins];

  // 3. OPTIMIZATION PHASE: The "Virtual Train"
  // Before placing anything visually, we simulate the length to determine WHO needs to be stacked.
  // This solves the "Stack only after X meters" problem.

  const truckLength = truckConfig.usableLength;
  const truckWidth = truckConfig.maxWidth;

  // Helper to guess length consumption of a pallet in the truck
  const getLinearLength = (p: any) => {
    if (p.type === 'industrial') {
      // DIN 120x100 usually goes 2 wide (100 side) -> 200 width. Length used = 120.
      // Or 2 wide (120 side) -> 240 width. Length used = 100.
      // Standard tautliner optimization is usually the 100cm length consumption (wide side).
      return 100; 
    } else {
      // EUP
      if (currentEupLoadingPattern === 'long') return 120; // 3 wide
      if (currentEupLoadingPattern === 'broad') return 80; // 2 wide
      // Auto fallback: assume 3 wide (1.2m length) if possible, else 0.8m length
      return 80; // Defaulting to 0.8 creates a safer 'worst case' length for mixed loads
    }
  };

  const getWidthCapacity = (p: any) => {
    if (p.type === 'industrial') return 2;
    if (currentEupLoadingPattern === 'long') return 3; // 3x80 = 240
    return 2; // 2x120 = 240 (Broad) or Auto fallback
  };

  // Simulation: Organize into Virtual Rows
  // This does NOT place them X/Y yet, just groups them into rows to calculate linear density
  let virtualRows: any[] = [];
  let currentRow: any = null;

  queue.forEach(p => {
    const rowLen = getLinearLength(p);
    const rowCap = getWidthCapacity(p);

    if (currentRow && currentRow.type === p.type && currentRow.items.length < currentRow.capacity) {
      currentRow.items.push(p);
      // A row is stackable only if ALL items in it are stackable
      if (!p.stackable) currentRow.stackable = false;
    } else {
      currentRow = {
        id: virtualRows.length,
        type: p.type,
        length: rowLen,
        capacity: rowCap,
        items: [p],
        stackable: p.stackable,
        stackedItems: [], // Items sitting on top
        distanceStart: 0
      };
      virtualRows.push(currentRow);
    }
  });

  // Calculate Train Length
  let currentTrainLength = 0;
  virtualRows.forEach(r => {
    r.distanceStart = currentTrainLength;
    currentTrainLength += r.length;
  });

  // 4. COMPRESSION LOGIC (The Fix)
  const overflow = currentTrainLength - truckLength;
  
  // If we have overflow OR simply want to maximize pairs (max_pairs strategy)
  if (overflow > 0 || stackingStrategy === 'max_pairs') {
    
    // Find candidates for stacking.
    // We iterate from the BACK of the train (items that don't fit) 
    // and try to put them on top of valid rows.
    
    // Sort valid target rows.
    // For 'axle_safe': We prefer rows where distanceStart > FRONT_SAFE_ZONE_CM (380cm).
    // If we run out of those, we fall back to front rows.
    const candidates = virtualRows.filter(r => r.stackable && r.stackedItems.length === 0);
    
    candidates.sort((a, b) => {
      const aSafe = a.distanceStart >= FRONT_SAFE_ZONE_CM;
      const bSafe = b.distanceStart >= FRONT_SAFE_ZONE_CM;
      
      if (stackingStrategy === 'axle_safe') {
        if (aSafe && !bSafe) return -1; // A is better (it's in safe zone)
        if (!aSafe && bSafe) return 1;  // B is better
        // If both are safe or both unsafe, prioritize filling from front-of-safe-zone
        return a.distanceStart - b.distanceStart; 
      } else {
        // Max pairs: just fill from front to back regardless
        return a.distanceStart - b.distanceStart;
      }
    });

    // We need to take pallets from the END of the list (virtualRows) and move them to candidates.
    // We process virtualRows in reverse.
    for (let i = virtualRows.length - 1; i >= 0; i--) {
      const sourceRow = virtualRows[i];
      
      // If we fit now, stop? Only if strategy is axle_safe and we just want to fit.
      // But usually if stackable is on, we want to stack efficienty.
      // Let's assume we stop if we fit AND strategy is axle_safe.
      // Re-calc length
      const actualLen = virtualRows.reduce((acc, r) => acc + (r.items.length > 0 ? r.length : 0), 0);
      if (stackingStrategy === 'axle_safe' && actualLen <= truckLength) break;

      // Attempt to move this row's items to a candidate
      const target = candidates.find(c => 
        c.id < sourceRow.id && // Must be in front
        c.type === sourceRow.type && // Same type
        c.items.length > 0 && // Target must exist
        c.stackedItems.length === 0 // Target not already stacked
      );

      if (target) {
        // Move items
        // We assume row capacity is consistent for same type
        sourceRow.items.forEach((p: any) => {
          p.isStacked = true;
          target.stackedItems.push(p);
        });
        sourceRow.items = []; // Emptied this row
        
        // Target is now full/stacked, remove from candidates
        const cIdx = candidates.indexOf(target);
        if (cIdx > -1) candidates.splice(cIdx, 1);
      }
    }
  }

  // 5. VISUALIZATION PLACEMENT (The Reconstruction)
  // Now we take our "Virtual Rows" and turn them back into the strict x/y coordinate system
  // that TruckVisualization.tsx expects.

  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  let warnings: string[] = [];
  
  let dinCounter = 0;
  let eupCounter = 0;
  let currentWeight = 0;
  
  // We only support single unit logic for the complex stacking for now (standard trucks)
  // If road train, we might split linearly.
  
  let currentUnitIndex = 0;
  let currentX = 0;
  let currentUnit = unitsState[0];

  // Filter out empty rows (fully moved to stacks)
  const activeRows = virtualRows.filter(r => r.items.length > 0);

  activeRows.forEach(row => {
    // Check if we need to jump to next unit (Road Train)
    if (currentX + row.length > currentUnit.length) {
      if (unitsState[currentUnitIndex + 1]) {
        currentUnitIndex++;
        currentUnit = unitsState[currentUnitIndex];
        currentX = 0;
      } else {
        // Truck full, these pallets don't fit visually
        warnings.push("Nicht genügend Platz für alle Paletten.");
        return; 
      }
    }

    // Determine dimensions for visualizer
    const pType = row.type;
    const pLength = pType === 'euro' ? (row.length === 120 ? 120 : 80) : 120; // Visual Length
    const pWidth = pType === 'euro' ? (row.length === 120 ? 80 : 120) : 100; // Visual Width
    
    // Actual Orientation Hack:
    // If EUP is in 'long' pattern (3 wide), visually it's 120 deep, 80 wide.
    // If EUP is in 'broad' pattern (2 wide), visually it's 80 deep, 120 wide.
    // If DIN, usually 100 deep (length consumed), 120 wide. 
    // Wait, getLinearLength returned 100 for DIN. So X dim is 100. Y dim is 120.
    
    const visualDimX = row.length;
    // If row capacity is 2, width is truckWidth / 2 ~ish. 
    // We calculate Y based on capacity.
    const visualDimY = pType === 'euro' ? (row.capacity === 3 ? 80 : 120) : 120; // Approx visual width

    // Place Base Layer
    row.items.forEach((p: any, idx: number) => {
      const labelId = p.type === 'euro' ? ++eupCounter : ++dinCounter;
      p.labelId = labelId; // Store for stacking reference
      
      const visual: any = {
        key: `p_${p.internalId}`,
        type: p.type,
        x: currentX,
        y: idx * visualDimY,
        width: visualDimX, // Along truck length
        height: visualDimY, // Along truck width
        labelId: labelId,
        isStackedTier: row.stackedItems[idx] ? 'base' : null,
        showAsFraction: !!row.stackedItems[idx],
        displayBaseLabelId: labelId,
        displayStackedLabelId: null, // filled below
        unitId: currentUnit.id
      };
      
      currentUnit.palletsVisual.push(visual);
      currentWeight += p.weight;
    });

    // Place Top Layer (if any)
    row.stackedItems.forEach((p: any, idx: number) => {
      // Ensure we don't crash if stack count > base count (shouldn't happen due to logic above)
      if (idx >= row.items.length) return;

      const labelId = p.type === 'euro' ? ++eupCounter : ++dinCounter;
      const baseItemVisual = currentUnit.palletsVisual.find((v:any) => v.labelId === row.items[idx].labelId);
      
      if (baseItemVisual) {
        baseItemVisual.displayStackedLabelId = labelId; // Update base
        
        const visual: any = {
          key: `p_${p.internalId}_stack`,
          type: p.type,
          x: currentX,
          y: idx * visualDimY,
          width: visualDimX,
          height: visualDimY,
          labelId: labelId,
          isStackedTier: 'top',
          showAsFraction: true,
          displayBaseLabelId: baseItemVisual.labelId,
          displayStackedLabelId: labelId,
          unitId: currentUnit.id
        };
        currentUnit.palletsVisual.push(visual);
        currentWeight += p.weight;
      }
    });

    currentX += row.length;
  });

  // 6. Post-Calculation Metrics
  const loadedDin = dinCounter;
  const loadedEup = eupCounter;
  const totalArea = activeRows.reduce((sum, r) => sum + (r.length * truckWidth), 0);
  const utilization = (totalArea / (truckLength * truckWidth)) * 100;

  // Weight warnings
  if (currentWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewichtslimit überschritten: ${KILOGRAM_FORMATTER.format(currentWeight)} kg (Max: ${KILOGRAM_FORMATTER.format(truckConfig.maxGrossWeightKg)})`);
  }

  // Final Object Assembly
  const palletArrangement = unitsState.map((u: any) => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: u.palletsVisual
  }));

  return {
    palletArrangement,
    loadedIndustrialPalletsBase: loadedDin, // Approximate base/total split logic simplified here
    loadedEuroPalletsBase: loadedEup,
    totalDinPalletsVisual: loadedDin,
    totalEuroPalletsVisual: loadedEup,
    utilizationPercentage: Math.min(100, parseFloat(utilization.toFixed(1))),
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: currentWeight,
    eupLoadingPatternUsed: currentEupLoadingPattern
  };
};
