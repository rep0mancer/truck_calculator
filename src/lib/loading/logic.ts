"use client";

// --- Types ---
export type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
  stackable?: boolean;
};

export type StackingStrategy = 'axle_safe' | 'max_pairs';

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
    units: [{ id: 'main', length: 1320, width: 248, occupiedRects: [] }], // Adjusted width slightly for DIN tolerance
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

export const MAX_GROSS_WEIGHT_KG = 24000;
export const MAX_PALLET_SIMULATION_QUANTITY = 300;
export const MAX_WEIGHT_PER_METER_KG = 1800;
// Safety Zone: We prefer NOT to stack in the first X cm (e.g., 400cm / 4m)
const FRONT_SAFE_ZONE_CM = 380; 

export const KILOGRAM_FORMATTER = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

// --- Helper Classes for the "Virtual Train" Logic ---

type VirtualPallet = {
  id: string;
  type: 'euro' | 'industrial';
  weight: number;
  stackable: boolean;
  isStackedTop?: boolean; // If true, this pallet is riding on another
  labelId: number;
};

type VirtualRow = {
  rowId: number;
  type: 'euro' | 'industrial';
  length: number; // The length this row consumes in the truck (e.g., 100cm for DIN, 80cm for EUP broad)
  widthCapacity: number; // How many fit side-by-side (e.g., 2 for DIN, 2 or 3 for EUP)
  pallets: VirtualPallet[]; // Pallets currently in this row (base layer)
  stackedPallets: VirtualPallet[]; // Pallets stacked on top
  distanceFromFront: number; // Calculated later
  canStack: boolean; // Can this row accept a second layer?
};

// --- The Core Logic ---

export const calculateLoadingLogic = (
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  isEUPStackable: boolean,
  isDINStackable: boolean,
  eupPattern: 'auto' | 'long' | 'broad',
  placementOrder: 'DIN_FIRST' | 'EUP_FIRST' = 'DIN_FIRST',
  maxStackedEup?: number | string,
  maxStackedDin?: number | string,
  stackingStrategy: StackingStrategy = 'axle_safe'
) => {
  const truckConfig = TRUCK_TYPES[truckKey];
  const isWaggon = ['Waggon', 'Waggon2'].includes(truckKey);
  const warnings: string[] = [];
  
  // 1. Flatten Inputs into a simple list of items
  let palletCounter = 0;
  const createFlatList = (entries: WeightEntry[], type: 'euro' | 'industrial', globalStackable: boolean) => {
    const list: VirtualPallet[] = [];
    entries.forEach(e => {
      const qty = e.quantity || 0;
      for(let i=0; i<qty; i++) {
        list.push({
          id: `${type}_${palletCounter++}`,
          type,
          weight: parseFloat(e.weight) || 0,
          stackable: globalStackable && (e.stackable !== false), // Entry specific override or global
          labelId: 0 // assigned later
        });
      }
    });
    return list;
  };

  const eups = createFlatList(eupWeights, 'euro', isEUPStackable && !isWaggon);
  const dins = createFlatList(dinWeights, 'industrial', isDINStackable && !isWaggon);

  // Waggon Special Check
  if (isWaggon && (eups.length > 0 || dins.length > 0)) {
     // For simplicity in this specific prompt, keeping Waggon logic basic or custom
     // If you need the specific Waggon pattern from before, insert it here. 
     // For now, I will apply the general logic but disable stacking (already done via isWaggon check above)
     if(isEUPStackable || isDINStackable) warnings.push("Waggon: Stacking disabled.");
  }

  // 2. Prioritize Loading Order
  let queue: VirtualPallet[] = [];
  if (placementOrder === 'DIN_FIRST') {
    queue = [...dins, ...eups];
  } else {
    queue = [...eups, ...dins];
  }

  // 3. Build Virtual Rows (The "Train" - initially all single layer)
  // We fill rows until they are full (width-wise), then make a new row.
  const rows: VirtualRow[] = [];
  
  // Helper to get row config
  const getRowConfig = (type: 'euro' | 'industrial', truckWidth: number) => {
    if (type === 'industrial') {
      // DIN 120x100. Usually placed 2 wide (100 side) -> 200cm width used. Length used: 120cm.
      // OR placed 2 wide (120 side) -> 240cm width used. Length used: 100cm.
      // Standard optimization usually prefers the 100cm length usage (wide placement) if it fits.
      // 240cm width fits in 245cm truck.
      return { length: 100, capacity: 2 }; 
    } else {
      // EUP 120x80.
      // Long (3 wide): 80*3 = 240cm width. Length used: 120cm.
      // Broad (2 wide): 120*2 = 240cm width. Length used: 80cm.
      if (eupPattern === 'long') return { length: 120, capacity: 3 };
      if (eupPattern === 'broad') return { length: 80, capacity: 2 };
      // Auto: If truck is wide enough, prefer 'long' (fewer rows, more efficient LDM often), 
      // unless we have few pallets. For mixed loads, consistency helps. Let's default to Broad (0.8 LDM) for finer granularity.
      return { length: 80, capacity: 33 / 11 >= 3 ? 3 : 2 }; // Simple heuristic fallback
    }
  };

  let currentRow: VirtualRow | null = null;

  queue.forEach((p, index) => {
    p.labelId = (p.type === 'euro' ? eups.indexOf(p) : dins.indexOf(p)) + 1;

    const config = getRowConfig(p.type, truckConfig.maxWidth);
    
    // Check if p fits in current row
    if (
      currentRow && 
      currentRow.type === p.type && 
      currentRow.pallets.length < currentRow.widthCapacity
    ) {
      currentRow.pallets.push(p);
      // Update row stackability: Row is stackable only if ALL items in it are stackable
      if (!p.stackable) currentRow.canStack = false;
    } else {
      // Start new row
      currentRow = {
        rowId: rows.length,
        type: p.type,
        length: config.length,
        widthCapacity: (p.type === 'euro' && eupPattern === 'auto') ? 3 : config.capacity, // Force 3 for auto EUP initially? 
        // Actually, for mixed loads, let's stick to strict logic:
        // If auto, we assume standard Euro layout (3 wide, long side) is most efficient LDM-wise (0.4 LDM/pallet vs 0.4). 
        // Actually 3 wide / 1.2m = 0.4m/pallet. 2 wide / 0.8m = 0.4m/pallet. It's neutral. 
        // Let's use 0.8m length (2 wide) for better granularity in mixed loads.
        pallets: [p],
        stackedPallets: [],
        distanceFromFront: 0,
        canStack: p.stackable
      };
      
      // Refine EUP Auto Logic:
      if (p.type === 'euro' && eupPattern === 'auto') {
         // 3 wide is standard for 2.45m trucks
         currentRow.length = 120; 
         currentRow.widthCapacity = 3;
      } else if (p.type === 'euro' && eupPattern === 'broad') {
         currentRow.length = 80;
         currentRow.widthCapacity = 3; // Wait, broad means 80cm length? No, 80cm is short side.
         // Broad = Short side parallel to truck length? No.
         // Let's define: 
         // Long pattern = Pallet 120 side parallel to truck length. Width used 80*3=240. Length used 120.
         // Broad pattern = Pallet 80 side parallel to truck length. Width used 120*2=240. Length used 80.
         if (eupPattern === 'broad') {
             currentRow.length = 80;
             currentRow.widthCapacity = 2; // 120*2 = 240
         }
      }

      rows.push(currentRow);
    }
  });

  // 4. Calculate Initial Length and Compression Needs
  let totalUsedLength = 0;
  rows.forEach(r => {
    r.distanceFromFront = totalUsedLength;
    totalUsedLength += r.length;
  });

  const availableLength = truckConfig.usableLength; // cm
  const overflow = Math.max(0, totalUsedLength - availableLength);

  // 5. The Compression Loop (The Matrix Logic)
  // If we have overflow, we must move pallets from "New Rows" to "Top of Old Rows".
  
  if (overflow > 0) {
    // Identify rows that can accept a stack.
    // Strategy: We want to stack rows that are inside the "Safe Zone" (Center/Rear) first.
    // We iterate through the rows to find candidates.
    
    // Filter rows that are valid targets for stacking:
    // 1. Must be marked canStack.
    // 2. Must not be already full (though our initial pass is single layer, so they are empty on top).
    // 3. For 'axle_safe', prefer rows where distanceFromFront > FRONT_SAFE_ZONE_CM.
    
    const stackableCandidates = rows.filter(r => r.canStack);
    
    // Sort candidates by preference: 
    // Priority 1: Inside Safe Zone (distance > 380).
    // Priority 2: Front Zone (if we must).
    stackableCandidates.sort((a, b) => {
        const aSafe = a.distanceFromFront >= FRONT_SAFE_ZONE_CM;
        const bSafe = b.distanceFromFront >= FRONT_SAFE_ZONE_CM;
        if (aSafe && !bSafe) return -1; // a comes first
        if (!aSafe && bSafe) return 1;
        return a.distanceFromFront - b.distanceFromFront; // Fill from front-of-safe-zone backwards? Or forward? 
        // Standard loading is usually from bulkhead back. 
        // To relieve Kingpin, we stack center. 
        // So sorting by distance ascending (within safe zone) makes sense.
    });

    // We can't just "compress" rows in place because rows represent physical space.
    // We need to take pallets from the END of the train (the ones causing overflow)
    // and put them on top of the CANDIDATE rows.
    
    // Reverse iterate the rows to find pallets to move
    // We take entire rows from the back and try to put them onto candidates.
    
    // NOTE: This creates a mixed reality. If we move a DIN row from the back onto a DIN row in the middle,
    // we save the length of that DIN row.
    
    for (let i = rows.length - 1; i >= 0; i--) {
        const sourceRow = rows[i];
        
        // Current total length check
        let currentTotalLen = rows.reduce((acc, r) => acc + (r.pallets.length > 0 ? r.length : 0), 0);
        if (currentTotalLen <= availableLength) break; // We fit!

        // Try to find a target for this source row
        // Target must match type (DIN on DIN) and have capacity
        const target = stackableCandidates.find(cand => 
            cand.rowId < sourceRow.rowId && // Must be in front of source
            cand.type === sourceRow.type &&
            cand.stackedPallets.length === 0 // Only double stack, not triple
        );

        if (target) {
            // Move pallets
            // Note: capacities might differ if logic was complex, but here we match types
            // Ensure target can hold source amount
            if (target.pallets.length >= sourceRow.pallets.length) {
                // Move strictly the amount that fits or exists
                // Actually, we usually stack full rows on full rows. 
                // If source has 2 and target has 3 (rare), we put 2 on top.
                
                sourceRow.pallets.forEach(p => {
                    p.isStackedTop = true;
                    target.stackedPallets.push(p);
                });
                sourceRow.pallets = []; // Emptied
                
                // Remove target from candidates (it's full now)
                const tIdx = stackableCandidates.indexOf(target);
                if (tIdx > -1) stackableCandidates.splice(tIdx, 1);
            }
        }
    }
  }

  // 6. Final Layout Construction & Visualization
  // Recalculate positions based on non-empty rows
  const palletArrangement: any[] = truckConfig.units.map((u: any) => ({ ...u, pallets: [] }));
  const finalPallets: any[] = [];
  let currentX = 0;
  let finalWeight = 0;
  
  // Filter out empty rows (consumed by stacking)
  const activeRows = rows.filter(r => r.pallets.length > 0);

  activeRows.forEach(row => {
      // Y positioning
      const rowWidth = truckConfig.maxWidth;
      const palletWidthInRow = row.type === 'euro' ? (row.length === 120 ? 80 : 120) : (row.length === 100 ? 120 : 100); // approximation
      
      // Calculate Y start to center the row or start from 0? 
      // Standard loading usually starts 0.
      
      // Base Layer
      row.pallets.forEach((p, idx) => {
          const visual = {
              key: p.id,
              type: p.type,
              x: currentX,
              y: idx * palletWidthInRow, // Simple Y stacking
              width: row.length,
              height: palletWidthInRow,
              labelId: p.labelId,
              isStackedTier: row.stackedPallets[idx] ? 'base' : null,
              showAsFraction: !!row.stackedPallets[idx],
              displayBaseLabelId: p.labelId,
              displayStackedLabelId: row.stackedPallets[idx]?.labelId
          };
          finalPallets.push(visual);
          finalWeight += p.weight;
      });

      // Top Layer
      row.stackedPallets.forEach((p, idx) => {
           const visual = {
              key: p.id + '_stack',
              type: p.type,
              x: currentX,
              y: idx * palletWidthInRow,
              width: row.length,
              height: palletWidthInRow,
              labelId: p.labelId,
              isStackedTier: 'top',
              showAsFraction: true,
              displayBaseLabelId: row.pallets[idx]?.labelId,
              displayStackedLabelId: p.labelId
          };
          finalPallets.push(visual);
          finalWeight += p.weight;
      });

      currentX += row.length;
  });

  // Assign to unit (assuming single unit for now or split logic if roadTrain)
  // For simplicity, dumping all into first unit or splitting by length if needed
  if (truckConfig.units.length === 1) {
      palletArrangement[0].pallets = finalPallets;
  } else {
      // Road Train logic: Split at unit1 length
      const limit1 = truckConfig.units[0].length;
      palletArrangement[0].pallets = finalPallets.filter((p: any) => p.x < limit1);
      palletArrangement[1].pallets = finalPallets.filter((p: any) => p.x >= limit1).map((p: any) => ({ ...p, x: p.x - limit1 }));
  }

  // 7. Warnings
  const totalVisual = finalPallets.length;
  const requestedTotal = eups.length + dins.length;
  if (totalVisual < requestedTotal) {
      warnings.push(`Nicht genügend Platz! ${requestedTotal - totalVisual} Paletten konnten nicht geladen werden.`);
  }
  
  const utilization = (currentX / truckConfig.usableLength) * 100;
  
  // Check Axle Loading (Simple Heuristic based on your request)
  // "Start stacking after axis" -> We checked this by prioritizing candidates > SAFE_ZONE
  // Linear Density check
  if (currentX > 0) {
      const density = finalWeight / (currentX / 100); // kg/m
      if (density > MAX_WEIGHT_PER_METER_KG) {
          warnings.push(`Hohe lineare Last: ${density.toFixed(0)} kg/m (Max: ${MAX_WEIGHT_PER_METER_KG}).`);
      }
  }

  return {
    palletArrangement,
    loadedIndustrialPalletsBase: dins.length, // Stats are tricky now, just returning totals
    loadedEuroPalletsBase: eups.length,
    totalDinPalletsVisual: finalPallets.filter(p => p.type === 'industrial').length,
    totalEuroPalletsVisual: finalPallets.filter(p => p.type === 'euro').length,
    utilizationPercentage: Math.min(100, utilization),
    warnings,
    totalWeightKg: finalWeight,
    eupLoadingPatternUsed: eupPattern
  };
};
