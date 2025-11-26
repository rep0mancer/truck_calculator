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
// Warnung bei > 1800 kg pro Lademeter
export const WARNING_AXLE_LOAD_KG = 1800; 

export const KILOGRAM_FORMATTER = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

// Keys must match store.ts exactly
export const TRUCK_TYPES = {
  curtainSider: {
    name: 'Planensattel (13,2m)',
    units: [{ id: 'main', length: 1320, width: 244, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 244,
    maxGrossWeightKg: 24000,
  },
  mega: {
    name: 'Mega (13,6m)',
    units: [{ id: 'main', length: 1360, width: 248, occupiedRects: [] }],
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
  frigo: {
    name: 'Frigo (13,2m)',
    units: [{ id: 'main', length: 1320, width: 246, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 246,
    maxGrossWeightKg: 20000,
  },
  smallTruck: {
    name: 'Motorwagen (7,2m)',
    units: [{ id: 'main', length: 720, width: 245, occupiedRects: [] }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 12000,
  },
  Waggon: {
    name: 'Waggon (16m)',
    units: [{ id: 'main', length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    maxGrossWeightKg: 28000,
  },
  Waggon2: { // Alias kept for safety if used in store
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

// --- INTERNAL TYPES ---
type PalletItem = {
  id: string;
  type: 'euro' | 'industrial';
  weight: number;
  stackable: boolean;
  labelId: number;
};

type RowConfig = {
  type: 'din_row' | 'eup_row_long' | 'eup_row_broad';
  length: number; // LDM used
  capacity: number; // Base pallets in this row
  width: number; // Pallet width (visual width)
  visualLength: number; // Pallet length (visual height)
};

type CalculatedRow = {
  x: number;
  config: RowConfig;
  slots: (PalletItem | null)[];
  stacked: (PalletItem | null)[];
};

// --- HELPER: Expand Inputs ---
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
    // Global switch enables/disables stacking generally. 
    // Individual checkbox (entry.stackable) defaults to true if undefined, unless explicitly false.
    const canStack = globalStackableOverride && (entry.stackable !== false);

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

// --- CORE ALGORITHM ---

export const calculateLoadingLogic = (
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  currentIsEUPStackable: boolean,
  currentIsDINStackable: boolean,
  _ignoredPattern: any, // We decide pattern automatically/smartly
  _ignoredOrder: any,   // Order is fixed: DIN -> EUP
  _maxEupStack: number,
  _maxDinStack: number,
  _strategy: StackingStrategy
) => {
  const truckConfig = TRUCK_TYPES[truckKey] || TRUCK_TYPES.curtainSider;
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Expand and Sort Inputs
  // SORTING RULE: Non-stackable FIRST, Stackable LAST.
  // Why? Because we fill the floor front-to-back. 
  // When we need to stack, we take from the REAR of the floor (which are the stackables).
  
  const dinItemsRaw = expandItems(dinWeights, 'industrial', currentIsDINStackable, 1);
  const eupItemsRaw = expandItems(eupWeights, 'euro', currentIsEUPStackable, 1);

  const dinItems = dinItemsRaw.sort((a, b) => Number(a.stackable) - Number(b.stackable));
  const eupItems = eupItemsRaw.sort((a, b) => Number(a.stackable) - Number(b.stackable));

  // 2. The Compressor (Simulation to determine Stack Count)
  // Goal: Minimize length to <= truckConfig.usableLength
  
  const TRUCK_MAX_LEN = truckConfig.usableLength;

  // We simulate the layout with X DIN stacks and Y EUP stacks.
  // We start with 0 stacks. If it fits -> done.
  // If not, we increment stack count (prioritizing EUP stacks at the very back).
  
  // Helper: Calculate length of a block of pallets given a stack count
  // returns: { length: number, rows: RowConfig[] }
  const calcDinBlock = (totalDins: number, stacks: number) => {
      const floorCount = Math.ceil(totalDins - stacks); // Actually total - stacks = floor items?
      // Correct logic: Each stack consumes 2 items (1 base + 1 top) but only 1 floor slot.
      // Unstacked consume 1 item and 1 floor slot.
      // So: FloorSlots = Unstacked + Stacks.
      // TotalItems = Unstacked + 2 * Stacks.
      // => Unstacked = TotalItems - 2 * Stacks.
      // => FloorSlots = (TotalItems - 2*Stacks) + Stacks = TotalItems - Stacks.
      // Validity Check: Stacks <= TotalItems / 2.
      
      const floorSlots = totalDins - stacks;
      // DIN is always 2 wide. Row Length 100.
      const numRows = Math.ceil(floorSlots / 2);
      const length = numRows * 100;
      return { length, floorSlots };
  };

  const calcEupBlock = (totalEups: number, stacks: number, remainingLength: number) => {
      const floorSlots = totalEups - stacks;
      
      // Smart EUP Layout: Try to fit `floorSlots` into `remainingLength`.
      // Strategies:
      // A: All Long (3 wide, 120cm). Efficient capacity/m (2.5).
      // B: All Broad (2 wide, 80cm). Efficient capacity/m (2.5).
      // We want to find integers i (Long rows) and j (Broad rows) such that:
      // i*120 + j*80 <= remainingLength
      // AND (i*3 + j*2) >= floorSlots
      // AND we minimize (i*120 + j*80) to actually fit? No, we prioritize fitting the count.
      
      // Heuristic: Maximize 3-wide rows (Standard), fall back to 2-wide if it helps fit in the tail.
      
      let bestLayout = { length: Infinity, longRows: 0, broadRows: 0 };
      
      // Iterate possible Long Row counts
      const maxLongRows = Math.floor(floorSlots / 3) + 1;
      
      for (let i = maxLongRows; i >= 0; i--) {
          const coveredByLong = i * 3;
          const remainder = Math.max(0, floorSlots - coveredByLong);
          const j = Math.ceil(remainder / 2); // Broad rows needed for remainder
          
          const totalLen = i * 120 + j * 80;
          const capacity = i * 3 + j * 2;
          
          if (capacity >= floorSlots) {
              // It's a valid packing for the quantity.
              // Is it better than what we found?
              // Better means: Fits in remainingLength (if possible) AND minimizes totalLen.
              // If both fit, pick smaller len.
              // If current fits and best didn't, pick current.
              
              const currentFits = totalLen <= remainingLength + 0.1; // tolerance
              const bestFits = bestLayout.length <= remainingLength + 0.1;
              
              if (currentFits && !bestFits) {
                  bestLayout = { length: totalLen, longRows: i, broadRows: j };
              } else if (currentFits === bestFits) {
                  if (totalLen < bestLayout.length) {
                       bestLayout = { length: totalLen, longRows: i, broadRows: j };
                  }
              }
          }
      }
      
      return bestLayout;
  };

  // Compression Loop
  let dinStackCount = 0;
  let eupStackCount = 0;
  let finalDinLayout = { length: 0, floorSlots: 0 };
  let finalEupLayout = { length: 0, longRows: 0, broadRows: 0 };
  let fitFound = false;

  const maxDinStacks = Math.floor(dinItems.filter(i => i.stackable).length / 2);
  const maxEupStacks = Math.floor(eupItems.filter(i => i.stackable).length / 2);

  // Loop strategy: Increase stacking from rear (EUP) then Front (DIN) until fit.
  // We try all combinations of stacking? No, that's O(N^2).
  // Greedy approach: Stack EUPs until max, then stack DINs.
  
  // Wait, simpler loop:
  // Total Length = DIN_Len + EUP_Len.
  // While (Total > Available):
  //   Can we stack more EUP? Yes -> Stack EUP.
  //   Else, Can we stack more DIN? Yes -> Stack DIN.
  //   Else -> Break (Full).

  // Reset counts
  dinStackCount = 0;
  eupStackCount = 0;

  while (true) {
      // Calculate current lengths
      const dinL = calcDinBlock(dinItems.length, dinStackCount);
      const spaceForEup = TRUCK_MAX_LEN - dinL.length;
      const eupL = calcEupBlock(eupItems.length, eupStackCount, spaceForEup);
      
      const totalLen = dinL.length + eupL.length;
      
      if (totalLen <= TRUCK_MAX_LEN + 0.1) {
          fitFound = true;
          finalDinLayout = dinL;
          finalEupLayout = eupL;
          break;
      }
      
      // Need to compress
      if (eupStackCount < maxEupStacks) {
          eupStackCount++;
      } else if (dinStackCount < maxDinStacks) {
          dinStackCount++;
      } else {
          // Cannot compress further
          finalDinLayout = dinL;
          finalEupLayout = eupL;
          break; 
      }
  }

  // 3. Construct Rows (The Placement)
  const rows: CalculatedRow[] = [];
  let currentX = 0;
  
  // --- DIN ROWS ---
  // Need to define which items are base, which are stack.
  // We sort input arrays: [Unstackable ... Stackable].
  // Stacks come from the END of the array.
  
  // Process DINs
  {
      const dinsToStack = dinStackCount * 2; // Items involved in stacking (Base + Top)
      const dinsFloorOnly = dinItems.length - dinsToStack;
      
      // Pool 1: Singles (Unstackable or left-over stackables)
      const singles = dinItems.slice(0, dinsFloorOnly);
      // Pool 2: Stack Pairs (The tail of the sorted array)
      const pairs = dinItems.slice(dinsFloorOnly); // Length should be 2 * dinStackCount
      
      // We assume DIN rows are simply filled 2 by 2.
      // Sequence on floor: Singles first, then Pair Bases.
      
      const floorSequence: { base: PalletItem, top: PalletItem | null }[] = [];
      singles.forEach(p => floorSequence.push({ base: p, top: null }));
      for (let i = 0; i < pairs.length; i += 2) {
          floorSequence.push({ base: pairs[i], top: pairs[i+1] }); // Stackable base + Stackable top
      }
      
      // Create rows (2 wide)
      for (let i = 0; i < floorSequence.length; i += 2) {
          const slot1 = floorSequence[i];
          const slot2 = floorSequence[i+1]; // might be undefined
          
          rows.push({
              x: currentX,
              config: { type: 'din_row', length: 100, capacity: 2, width: 120, visualLength: 100 }, // visualLength here matches LDM for simplicity in CSS height
              slots: [slot1.base, slot2?.base || null],
              stacked: [slot1.top, slot2?.top || null]
          });
          currentX += 100;
      }
  }
  
  // --- EUP ROWS ---
  {
      const eupsToStack = eupStackCount * 2;
      const eupsFloorOnly = eupItems.length - eupsToStack;
      
      const singles = eupItems.slice(0, eupsFloorOnly);
      const pairs = eupItems.slice(eupsFloorOnly);
      
      const floorSequence: { base: PalletItem, top: PalletItem | null }[] = [];
      singles.forEach(p => floorSequence.push({ base: p, top: null }));
      for (let i = 0; i < pairs.length; i += 2) {
          floorSequence.push({ base: pairs[i], top: pairs[i+1] });
      }
      
      // Fill rows based on calculated layout (longRows then broadRows)
      let seqIdx = 0;
      
      // Long Rows (3 wide)
      for (let r = 0; r < finalEupLayout.longRows; r++) {
          const s1 = floorSequence[seqIdx++];
          const s2 = floorSequence[seqIdx++];
          const s3 = floorSequence[seqIdx++];
          
          rows.push({
              x: currentX,
              config: { type: 'eup_row_long', length: 120, capacity: 3, width: 80, visualLength: 120 },
              slots: [s1?.base||null, s2?.base||null, s3?.base||null],
              stacked: [s1?.top||null, s2?.top||null, s3?.top||null]
          });
          currentX += 120;
      }
      
      // Broad Rows (2 wide)
      for (let r = 0; r < finalEupLayout.broadRows; r++) {
          const s1 = floorSequence[seqIdx++];
          const s2 = floorSequence[seqIdx++];
          
          rows.push({
              x: currentX,
              config: { type: 'eup_row_broad', length: 80, capacity: 2, width: 120, visualLength: 80 },
              slots: [s1?.base||null, s2?.base||null],
              stacked: [s1?.top||null, s2?.top||null]
          });
          currentX += 80;
      }
  }
  
  // 4. Calculations & Warnings
  let totalWeight = 0;
  let loadedCount = 0;
  const totalInputCount = dinItems.length + eupItems.length;
  
  rows.forEach(row => {
      // Sum weight of bases and tops
      [...row.slots, ...row.stacked].forEach(p => {
          if (p) {
              totalWeight += p.weight;
              loadedCount++;
          }
      });
  });
  
  if (!fitFound || loadedCount < totalInputCount) {
      const missing = totalInputCount - loadedCount;
      // Only report error if we actually missed items (fitFound logic might be slightly off due to logic gaps vs physical gaps, trust count)
      if (missing > 0) {
          errors.push(`Platzmangel: ${missing} Paletten konnten nicht geladen werden.`);
      }
  }
  
  if (totalWeight > truckConfig.maxGrossWeightKg) {
      errors.push(`Gewicht überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg > ${KILOGRAM_FORMATTER.format(truckConfig.maxGrossWeightKg)} kg`);
  }
  
  // Axle Load
  const axleLoad = totalWeight / (currentX / 100 || 1);
  if (axleLoad > WARNING_AXLE_LOAD_KG) {
      warnings.push(`Hohe Achslast: ~${KILOGRAM_FORMATTER.format(axleLoad)} kg/ldm (Warnung bei ${WARNING_AXLE_LOAD_KG})`);
  }

  // 5. Build Visualization Data
  // We map the logical rows to the visual coordinates.
  // IMPORTANT: 
  // - The truck visualizer is vertical. Top = Front.
  // - Logic X (0..1320) -> Visual Top (Height from top).
  // - Logic Y (0..244) -> Visual Left (Distance from left).
  // - Pallet Width (visual width) -> CSS Width.
  // - Pallet Length (visual height) -> CSS Height.
  
  const truckWidth = truckConfig.maxWidth;
  
  const visualUnits = truckConfig.units.map(u => ({
      unitId: u.id,
      unitLength: u.length,
      unitWidth: u.width,
      pallets: [] as any[]
  }));
  
  // For simple logic, we assume 1 unit (Planensattel). RoadTrain logic would require splitting `rows` based on `currentX`.
  // Implementation for split units:
  rows.forEach(row => {
      const rowStart = row.x;
      const rowEnd = row.x + row.config.length;
      
      // Find which unit this row belongs to. 
      // Simplified: Only support first unit logic fully or split linearly.
      // For standard13_2 (curtainSider), it's one unit.
      let targetUnit = visualUnits[0];
      let visualYOffset = rowStart; 
      
      if (visualUnits.length > 1 && rowStart >= visualUnits[0].unitLength) {
           targetUnit = visualUnits[1];
           visualYOffset = rowStart - visualUnits[0].unitLength;
      }
      
      // Calculate horizontal positions (centering rows)
      // Row Config has `width` (visual width of one pallet) and `capacity`.
      const pWidth = row.config.width; // Visual width (CSS width)
      const pLength = row.config.visualLength; // Visual height (CSS height)
      
      const totalRowWidth = row.config.capacity * pWidth;
      // Center the block
      const startLeft = (truckWidth - totalRowWidth) / 2;
      
      const placePallet = (p: PalletItem | null, index: number, isStack: boolean, baseLabel?: number) => {
          if (!p) return;
          
          targetUnit.pallets.push({
              key: p.id,
              type: p.type,
              x: visualYOffset,         // Top
              y: startLeft + (index * pWidth), // Left
              width: pWidth,            // CSS Width
              height: pLength,          // CSS Height
              labelId: p.labelId,
              isStackedTier: isStack ? 'top' : 'base',
              displayBaseLabelId: baseLabel || p.labelId,
              displayStackedLabelId: isStack ? p.labelId : undefined,
              showAsFraction: isStack
          });
      };
      
      row.slots.forEach((p, idx) => placePallet(p, idx, false));
      row.stacked.forEach((p, idx) => {
          const base = row.slots[idx];
          placePallet(p, idx, true, base?.labelId);
      });
  });

  return {
    palletArrangement: visualUnits,
    loadedIndustrialPalletsBase: 0, // Legacy
    loadedEuroPalletsBase: 0, // Legacy
    totalDinPalletsVisual: dinItems.length, // This is approximate for the counter badge
    totalEuroPalletsVisual: eupItems.length,
    utilizationPercentage: Math.min(100, (currentX / truckConfig.totalLength) * 100),
    warnings: Array.from(new Set([...errors, ...warnings])),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: 'auto',
  };
};
