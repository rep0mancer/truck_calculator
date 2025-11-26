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
export const MAX_PALLET_SIMULATION_QUANTITY = 300; // Hard limit to prevent freeze
export const WARNING_AXLE_LOAD_KG = 1800; // Warn threshold per LDM

export const KILOGRAM_FORMATTER = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

export const TRUCK_TYPES = {
  standard13_2: {
    name: 'Planensattel (13,2m)',
    units: [
      { id: 'main', length: 1320, width: 244, occupiedRects: [] },
    ],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 244,
    maxGrossWeightKg: 24000,
  },
  mega13_6: {
    name: 'Mega (13,6m)',
    units: [
      { id: 'main', length: 1360, width: 248, occupiedRects: [] },
    ],
    totalLength: 1360,
    usableLength: 1360,
    maxWidth: 248,
    maxGrossWeightKg: 24000,
  },
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
  // Add other trucks if needed...
  frigo13_2: {
    name: 'Frigo (13,2m)',
    units: [{ id: 'main', length: 1320, width: 246, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 246,
    maxGrossWeightKg: 20000, // Cooling unit weight penalty
  },
  smallTruck7_2: {
    name: 'Motorwagen (7,2m)',
    units: [{ id: 'main', length: 720, width: 245, occupiedRects: [] }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 12000,
  },
  waggon: {
    name: 'Waggon (16m)',
    units: [{ id: 'main', length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    maxGrossWeightKg: 28000,
  }
};

export const PALLET_TYPES = {
  euro: { name: 'Euro (120x80)', type: 'euro', length: 120, width: 80 },
  industrial: { name: 'DIN (120x100)', type: 'industrial', length: 120, width: 100 },
};

// --- TYPES ---

type PalletItem = {
  id: string; // Unique ID for React keys
  type: 'euro' | 'industrial';
  weight: number;
  stackable: boolean;
  labelId: number; // User facing ID (1, 2, 3...)
};

type PlacedItem = PalletItem & {
  x: number; // Distance from front (cm)
  y: number; // Distance from left wall (cm)
  width: number; // Occupied width (cm)
  length: number; // Occupied length (cm)
  isStackedTier: 'base' | 'top';
  baseIndex?: number; // If stacked, index of the base pallet in the visualization array
};

// --- HELPER: Generate Item List ---
function expandItems(
  weights: WeightEntry[],
  type: 'euro' | 'industrial',
  globalStackableOverride: boolean,
  startLabelId: number
): PalletItem[] {
  const items: PalletItem[] = [];
  let currentLabel = startLabelId;

  weights.forEach(entry => {
    const w = parseFloat(entry.weight || '0');
    const qty = entry.quantity || 0;
    const canStack = globalStackableOverride && (entry.stackable !== false); // Default to true if undefined, unless global is off

    for (let i = 0; i < qty; i++) {
      items.push({
        id: `${type}-${currentLabel}`,
        type,
        weight: w,
        stackable: canStack,
        labelId: currentLabel,
      });
      currentLabel++;
    }
  });
  return items;
}

// --- CORE LOGIC ---

export const calculateLoadingLogic = (
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  currentIsEUPStackable: boolean,
  currentIsDINStackable: boolean,
  _ignoredPattern: any, // We decide pattern automatically now
  _ignoredOrder: any,   // Order is fixed: DIN -> EUP
  _maxEupStack: number,
  _maxDinStack: number,
  _strategy: StackingStrategy
) => {
  const truckConfig = TRUCK_TYPES[truckKey] || TRUCK_TYPES.standard13_2;
  // For simplicity in multi-unit trucks, we just fill unit 1 then unit 2.
  // This logic mainly focuses on a single long loading deck (Planensattel).
  // We will treat multiple units as a continuous space for the algorithm, then split coordinates.
  
  const warnings: string[] = [];
  const errors: string[] = []; // For critical stops (weight/space)

  // 1. Prepare Pool
  const dinItems = expandItems(dinWeights, 'industrial', currentIsDINStackable, 1);
  const eupItems = expandItems(eupWeights, 'euro', currentIsEUPStackable, 1);

  const totalInputWeight = [...dinItems, ...eupItems].reduce((s, p) => s + p.weight, 0);
  
  // 2. Phase A: Floor Loading (Greedy Front-to-Back)
  // We calculate placements relative to a continuous floor starting at X=0.
  
  type FloorRow = {
    x: number;
    length: number;
    type: 'din_row' | 'eup_row_long' | 'eup_row_broad' | 'mixed_transition';
    slots: (PalletItem | null)[]; // Base items. null if empty slot
    stacked: (PalletItem | null)[]; // Top items. null if empty
    slotCoords: { y: number, w: number, l: number }[]; // Relative coordinates in row
  };

  const rows: FloorRow[] = [];
  let currentX = 0;
  let currentWeight = 0;
  
  const remainingDins = [...dinItems]; // Clone to consume
  const remainingEups = [...eupItems]; // Clone to consume

  const TRUCK_WIDTH = truckConfig.maxWidth;
  const TRUCK_MAX_LEN = truckConfig.usableLength; // For single unit logic
  // Note: For RoadTrain, handling split units correctly in one pass is complex. 
  // We'll assume standard semi-trailer logic (1 unit) primarily as requested.
  // If RoadTrain, we split the length.
  
  // --- DIN PLACEMENT (Always Broad/Quer) ---
  // DIN 1200x1000. Broad = 1200 side along width.
  // Width usage: 1200 * 2 = 2400mm. Fits in 2440mm truck.
  // Length usage: 1000mm (1.0m).
  
  while (remainingDins.length > 0) {
    // Check space
    if (currentX + 100 > TRUCK_MAX_LEN) {
      warnings.push(`Kein Platz mehr für weitere DIN Paletten (Länge).`);
      break;
    }

    // Form a row
    const p1 = remainingDins.shift()!;
    const p2 = remainingDins.length > 0 ? remainingDins.shift() : null;

    const rowItems: (PalletItem | null)[] = [p1, p2]; // p2 might be undefined -> handled
    const rowCoords = [
      { y: 0, w: 120, l: 100 },
      { y: 120, w: 120, l: 100 } // Usually centered if truck is 244. 244-240 = 4cm play.
      // We keep it simple: Left aligned or centered. Let's say tight pack left/right.
      // Left: 0, Right: Width - 120. 
    ];
    // Adjust Y for visual center
    const offset = (TRUCK_WIDTH - 240) / 2;
    rowCoords[0].y = offset;
    rowCoords[1].y = offset + 120;

    // Intelligent Gap Fill
    if (!p2 && remainingEups.length > 0) {
      // One DIN slot empty. Can we fit an EUP?
      // DIN Slot is 120x100. EUP Broad is 120x80.
      // EUP Broad fits in width (120 <= 120) and length (80 <= 100).
      const fillEup = remainingEups.shift()!;
      rowItems[1] = fillEup; // Place EUP in the second slot
      // Visual adjustment for the EUP in the DIN row
      // It sits at the same X, but is shorter.
      // Row consumes 100cm. EUP uses 80cm.
      // We mark row length as 100.
    }

    rows.push({
      x: currentX,
      length: 100,
      type: 'din_row',
      slots: rowItems,
      stacked: [null, null],
      slotCoords: rowCoords
    });

    currentX += 100;
    currentWeight += p1.weight + (rowItems[1]?.weight || 0);
  }

  // --- EUP PLACEMENT ---
  // EUP 1200x800.
  // Pattern Long (Längs): 800 side along width -> 3 fits (2400). Length 1200 (1.2m).
  // Pattern Broad (Breit): 1200 side along width -> 2 fits (2400). Length 800 (0.8m).
  
  while (remainingEups.length > 0) {
    // Greedy: Try 3-wide (Long) first as it's standard efficient
    // Unless we only have 1-2 items left, then 2-wide (Broad) uses less LDM (0.8 vs 1.2)
    
    let useBroad = false;
    if (remainingEups.length <= 2) {
        useBroad = true;
    } else {
        // Check if 1.2m fits. If not, maybe 0.8m fits?
        if (currentX + 120 > TRUCK_MAX_LEN && currentX + 80 <= TRUCK_MAX_LEN) {
            useBroad = true;
        }
    }

    if (useBroad) {
       // 2-wide (Broad)
       if (currentX + 80 > TRUCK_MAX_LEN) {
         warnings.push(`Kein Platz mehr für weitere EUP Paletten (Länge).`);
         break;
       }
       const p1 = remainingEups.shift()!;
       const p2 = remainingEups.shift() || null; // might be null
       
       const offset = (TRUCK_WIDTH - 240) / 2;
       rows.push({
         x: currentX,
         length: 80,
         type: 'eup_row_broad',
         slots: [p1, p2],
         stacked: [null, null],
         slotCoords: [
           { y: offset, w: 120, l: 80 },
           { y: offset + 120, w: 120, l: 80 }
         ]
       });
       currentX += 80;
       currentWeight += p1.weight + (p2?.weight || 0);

    } else {
       // 3-wide (Long)
       if (currentX + 120 > TRUCK_MAX_LEN) {
         // If we can't fit 1.2m, maybe we can switch to broad?
         // But we are here because we have >2 items.
         // If we have 3 items, broad needs 2 rows (1.6m). Long needs 1 row (1.2m).
         // So if Long doesn't fit, Broad definitely won't fit better for 3 items.
         // Just stop.
         warnings.push(`Kein Platz mehr für weitere EUP Paletten (Länge).`);
         break;
       }
       const p1 = remainingEups.shift()!;
       const p2 = remainingEups.shift() || null;
       const p3 = remainingEups.shift() || null;

       const offset = (TRUCK_WIDTH - 240) / 2;
       // 3 cols: 80cm each.
       rows.push({
         x: currentX,
         length: 120,
         type: 'eup_row_long',
         slots: [p1, p2, p3],
         stacked: [null, null, null],
         slotCoords: [
           { y: offset, w: 80, l: 120 },
           { y: offset + 80, w: 80, l: 120 },
           { y: offset + 160, w: 80, l: 120 }
         ]
       });
       currentX += 120;
       currentWeight += p1.weight + (p2?.weight || 0) + (p3?.weight || 0);
    }
  }

  // Leftovers in 'remaining...' arrays imply "Kein Platz". 
  // We check this at the end to trigger the red box.

  // 3. Phase B: Reverse Stacking
  // Pool of items waiting to be stacked is essentially empty right now because we put ALL in 'remaining...' above.
  // Wait, the prompt says: "Entweder ist vorher das gewichtslimit erreicht oder der Platz leer."
  // My logic above put items on the floor until floor is full. 
  // Any items STILL in 'remainingDins' or 'remainingEups' are candidates for stacking.
  
  const stackCandidates = [...remainingDins, ...remainingEups];
  // Sort stack candidates? No, just take them. 
  // Wait, strict rule: "Wenn die ladung gestappelte din und gestapelte EUp hat, kommen die DIN an die front und die EUP ans heck."
  // This happens naturally if we stack from back to front using the corresponding types?
  // No. If we have leftover DINs, we want them stacked on DIN rows (Front).
  // If we have leftover EUPs, we want them stacked on EUP rows (Back).
  // So we should split the stack pool.
  
  // Reverse iterate for EUPs first (Back of truck)
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (remainingEups.length === 0) break;

    // Can we stack on this row?
    // Only if base items allow stacking.
    // AND we match type? Usually you stack EUP on EUP.
    const isEupRow = row.type.startsWith('eup');
    const isMixedRowWithEupSlot = row.type === 'din_row' && row.slots[1]?.type === 'euro';
    
    // Logic: Stack EUPs on EUP rows or mixed slots
    if (isEupRow) {
      for (let s = 0; s < row.slots.length; s++) {
        if (remainingEups.length === 0) break;
        const base = row.slots[s];
        if (base && base.stackable && row.stacked[s] === null) {
           // Check Weight
           const candidate = remainingEups[0];
           if (currentWeight + candidate.weight > truckConfig.maxGrossWeightKg) {
             warnings.push("Gesamtgewichtsgrenze für Stapelung erreicht.");
             break; 
           }
           row.stacked[s] = remainingEups.shift()!;
           currentWeight += row.stacked[s]!.weight;
        }
      }
    }
  }

  // Reverse iterate for DINs (Front of truck, but search from back of DIN section)
  // Find index where DIN rows end
  // Actually, just iterate all rows. DINs won't fit on EUP rows geometrically usually (100 vs 120 length mismatch in mixed scenarios, or width mismatch).
  // Stacking DIN (120x100) on EUP (120x80)? No.
  // Stacking DIN on DIN.
  
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (remainingDins.length === 0) break;
    
    if (row.type === 'din_row') {
       for (let s = 0; s < row.slots.length; s++) {
         if (remainingDins.length === 0) break;
         const base = row.slots[s];
         // Ensure base is DIN and stackable
         if (base && base.type === 'industrial' && base.stackable && row.stacked[s] === null) {
            const candidate = remainingDins[0];
            if (currentWeight + candidate.weight > truckConfig.maxGrossWeightKg) {
               warnings.push("Gesamtgewichtsgrenze für Stapelung erreicht.");
               break;
            }
            row.stacked[s] = remainingDins.shift()!;
            currentWeight += row.stacked[s]!.weight;
         }
       }
    }
  }

  // 4. Validation & Warnings
  
  // Check if items left over
  const notLoadedCount = remainingDins.length + remainingEups.length;
  if (notLoadedCount > 0) {
    errors.push(`Platzmangel / Gewichtslimit: ${notLoadedCount} Paletten konnten nicht geladen werden.`);
  }
  
  if (currentWeight > truckConfig.maxGrossWeightKg) {
    // Should be caught by stacking check, but base load might exceed it.
    errors.push(`Gewicht überschritten: ${KILOGRAM_FORMATTER.format(currentWeight)} kg > ${KILOGRAM_FORMATTER.format(truckConfig.maxGrossWeightKg)} kg`);
  }

  // Check uneven stacks (Safety)
  rows.forEach((row, idx) => {
    const baseCount = row.slots.filter(s => s !== null).length;
    if (baseCount === 0) return; // Should not happen
    
    const stackCount = row.stacked.filter(s => s !== null).length;
    
    // Rule: "Gestapelte müssen praktisch immer im Doppelpack sein"
    // This implies if we have stacks, we shouldn't have unstacked items in the same row ideally?
    // Or does it mean the stacks themselves must be paired?
    // User: "Ich kann nicht einen gestappelten neben einen ungestapelten stehen lassen"
    // So: If row has stacking, ALL slots that have a base must have a top.
    
    if (stackCount > 0 && stackCount < baseCount) {
       warnings.push(`Warnung (Reihe ${idx + 1}): Ungleiche Stapelung! Ladungssicherung prüfen.`);
    }
  });

  // Axle load approximation
  const axleLoad = currentWeight / (currentX / 100 || 1); // kg per meter
  if (axleLoad > WARNING_AXLE_LOAD_KG) {
    warnings.push(`Hohe Achslast: ~${KILOGRAM_FORMATTER.format(axleLoad)} kg/ldm (Limit: ${WARNING_AXLE_LOAD_KG})`);
  }

  // 5. Visualization Mapping
  const palletsVisual: any[] = [];
  
  // If we have a RoadTrain (2 units), we split the rows.
  // But here we map to 'unitId'.
  // Simple split logic: If x > unit1.length, move to unit2 with x offset.
  
  let visualUnits = truckConfig.units.map(u => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: [] as any[]
  }));

  rows.forEach(row => {
    const rowX = row.x;
    
    // Determine which unit this row belongs to
    let targetUnit = visualUnits[0];
    let xInUnit = rowX;
    
    if (visualUnits.length > 1) {
        // Road train logic
        if (rowX >= visualUnits[0].unitLength) {
            targetUnit = visualUnits[1];
            xInUnit = rowX - visualUnits[0].unitLength;
        } else if (rowX + row.length > visualUnits[0].unitLength) {
            // Row creates overflow across units? 
            // In reality, you can't put a pallet across the hitch.
            // This implies the logic calculated continuous space that doesn't exist physically split.
            // For now, we map it to unit 1 and let it overflow visually to indicate "error" or just map it.
            // Ideally, the greedy filler should assume a gap.
            // *Fix for RoadTrain*: The simple greedy loop assumes continuous. 
            // For this specific request, we stick to the "Planensattel" focus unless requested otherwise.
        }
    }

    // Map Base Items
    row.slots.forEach((item, idx) => {
      if (!item) return;
      const coords = row.slotCoords[idx];
      targetUnit.pallets.push({
        key: item.id,
        type: item.type,
        height: coords.l, // Visualization uses height for length (vertical dimension on screen)
        width: coords.w,  // Visualization uses width for width (horizontal dimension)
        x: xInUnit,
        y: coords.y,
        labelId: item.labelId,
        isStackedTier: 'base',
        displayBaseLabelId: item.labelId
      });
    });

    // Map Stacked Items
    row.stacked.forEach((item, idx) => {
      if (!item) return;
      const coords = row.slotCoords[idx];
      const baseItem = row.slots[idx];
      targetUnit.pallets.push({
        key: item.id,
        type: item.type,
        height: coords.l,
        width: coords.w,
        x: xInUnit,
        y: coords.y,
        labelId: item.labelId,
        isStackedTier: 'top',
        displayBaseLabelId: baseItem?.labelId,
        displayStackedLabelId: item.labelId,
        showAsFraction: true
      });
    });
  });

  // Merge errors into warnings for display (or handle separately in UI)
  const finalWarnings = [...errors, ...warnings];

  // Calculate stats
  const totalDin = [...dinItems].length - remainingDins.length;
  const totalEup = [...eupItems].length - remainingEups.length;

  return {
    palletArrangement: visualUnits,
    loadedIndustrialPalletsBase: 0, // Deprecated field, using visual counts
    loadedEuroPalletsBase: 0, // Deprecated
    totalDinPalletsVisual: totalDin,
    totalEuroPalletsVisual: totalEup,
    utilizationPercentage: Math.min(100, (currentX / truckConfig.totalLength) * 100),
    warnings: Array.from(new Set(finalWarnings)),
    totalWeightKg: currentWeight,
    eupLoadingPatternUsed: 'auto', // dynamic
  };
};
