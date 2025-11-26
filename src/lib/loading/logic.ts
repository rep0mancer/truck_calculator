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

// Safe Zone: legacy constant, no longer used for choosing stack targets
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
  standard13_2: {
    name: 'Planensattel (13,2m)',
    units: [
      { id: 'main', length: 1320, width: 245, occupiedRects: [] },
    ],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  mega13_6: {
    name: 'Mega (13,6m)',
    units: [
      { id: 'main', length: 1360, width: 245, occupiedRects: [] },
    ],
    totalLength: 1360,
    usableLength: 1360,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  frigo13_2: {
    name: 'Frigo (13,2m)',
    units: [
      { id: 'main', length: 1320, width: 245, occupiedRects: [] },
    ],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 20000,
  },
  smallTruck7_2: {
    name: 'Motorwagen (7,2m)',
    units: [
      { id: 'main', length: 720, width: 245, occupiedRects: [] },
    ],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 12000,
  },
  waggon: {
    name: 'Waggon (16m)',
    units: [
      { id: 'main', length: 1600, width: 290, occupiedRects: [] },
    ],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    maxGrossWeightKg: 28000,
  },
};

export const PALLET_TYPES = {
  euro: { name: 'Euro Palette (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80 },
  industrial: { name: 'Industrial Palette (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100 },
};

// --- WAGGON SPECIAL LOGIC (Preserved) ---
export const calculateWaggonEuroLayout = (eupWeights: WeightEntry[], truckConfig: any) => {
  const allEupSingles = eupWeights.flatMap(e => Array(e.quantity).fill({ weight: parseFloat(e.weight) || 0 }));
  const count = Math.min(allEupSingles.length, 38);
  const placements: any[] = [];
  let currentWeight = 0;
  let placed = 0;

  // Row 1 (11 pallets)
  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({
      x: i * 120,
      y: 0,
      width: 120,
      height: 80,
      type: 'euro',
      labelId: ++placed,
      isStackedTier: null,
      unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }
  // Row 2 (11 pallets)
  for (let i = 0; i < 11 && placed < count; i++) {
    placements.push({
      x: i * 120,
      y: 80,
      width: 120,
      height: 80,
      type: 'euro',
      labelId: ++placed,
      isStackedTier: null,
      unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }
  // Row 3 (8 pallets)
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({
      x: i * 120,
      y: 160,
      width: 120,
      height: 80,
      type: 'euro',
      labelId: ++placed,
      isStackedTier: null,
      unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }
  // Row 4 (8 pallets)
  for (let i = 0; i < 8 && placed < count; i++) {
    placements.push({
      x: i * 120,
      y: 240,
      width: 120,
      height: 80,
      type: 'euro',
      labelId: ++placed,
      isStackedTier: null,
      unitId: truckConfig.units[0].id,
    });
    currentWeight += allEupSingles[placed - 1].weight;
  }

  return {
    palletArrangement: [{
      unitId: truckConfig.units[0].id,
      unitLength: 1370,
      unitWidth: 290,
      pallets: placements,
    }],
    loadedIndustrialPalletsBase: 0,
    loadedEuroPalletsBase: placed,
    totalDinPalletsVisual: 0,
    totalEuroPalletsVisual: placed,
    utilizationPercentage: 0,
    warnings: [],
    totalWeightKg: currentWeight,
    eupLoadingPatternUsed: 'custom',
  };
};

// --- TYPES FOR MAIN LOGIC ---

type PalletItem = {
  id: number;
  type: 'euro' | 'industrial';
  weight: number;
  stackable: boolean;
  labelId: number;
};

type Row = {
  type: 'euro' | 'industrial';
  length: number;
  capacity: number;
  items: PalletItem[];
  stackedItems: (PalletItem | null)[];
  stacked: boolean;
  startX: number;
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
  const truckConfig = TRUCK_TYPES[truckKey];
  const totalTruckLength = truckConfig.usableLength;

  // 1. PALLET EXPANSION
  const allEups: PalletItem[] = [];
  const allDins: PalletItem[] = [];
  let labelEuro = 1;
  let labelDin = 1;

  eupWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    for (let i = 0; i < q; i++) {
      allEups.push({
        id: allEups.length + 1,
        type: 'euro',
        weight: w,
        stackable: currentIsEUPStackable && e.stackable !== false,
        labelId: labelEuro,
      });
    }
    labelEuro++;
  });

  dinWeights.forEach(e => {
    const w = parseFloat(e.weight || '0') || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    for (let i = 0; i < q; i++) {
      allDins.push({
        id: allDins.length + 1,
        type: 'industrial',
        weight: w,
        stackable: currentIsDINStackable && e.stackable !== false,
        labelId: labelDin,
      });
    }
    labelDin++;
  });

  const allPallets = [...allDins, ...allEups];
  const totalWeight = allPallets.reduce((sum, p) => sum + p.weight, 0);

  const warnings: string[] = [];
  if (totalWeight > (truckConfig.maxGrossWeightKg || MAX_GROSS_WEIGHT_KG)) {
    warnings.push(
      `Warnung: Maximales zulässiges Gesamtgewicht von ${KILOGRAM_FORMATTER.format(
        truckConfig.maxGrossWeightKg || MAX_GROSS_WEIGHT_KG
      )} kg überschritten (${KILOGRAM_FORMATTER.format(totalWeight)} kg geladen).`
    );
  }

  // Auto pattern for EUPs
  let eupPattern: 'auto' | 'long' | 'broad' = currentEupLoadingPattern;
  if (currentEupLoadingPattern === 'auto') {
    const possibleLongRows = Math.floor(totalTruckLength / 120);
    const maxEupsLong = possibleLongRows * 3;
    if (allEups.length <= maxEupsLong) eupPattern = 'long';
    else eupPattern = 'broad';
  }

  // Priority Queue: DIN -> EUP
  const queue = placementOrder === 'DIN_FIRST' ? [...allDins, ...allEups] : [...allEups, ...allDins];
  const notLoaded: PalletItem[] = [];

  // 2. ROW DEFINITION
  function getRowSpec(type: 'euro' | 'industrial', remaining: number) {
    if (type === 'industrial') {
      return { length: 100, capacity: 2 }; // DIN: 2 pro 1m
    }
    if (eupPattern === 'broad') {
      return { length: 80, capacity: 2 }; // EUP quer: 2 pro 0,8m
    }
    if (eupPattern === 'long') {
      return { length: 120, capacity: 3 }; // EUP längs: 3 pro 1,2m
    }
    // fallback
    if (remaining >= 120) return { length: 120, capacity: 3 };
    if (remaining >= 80) return { length: 80, capacity: 2 };
    return { length: 120, capacity: 3 };
  }

  // 3. GREEDY FLOOR PLACEMENT + STACKING
  const rows: Row[] = [];
  let currentRow: Row | null = null;
  let currentWeight = 0;

  for (const p of queue) {
    if (currentWeight + p.weight > MAX_GROSS_WEIGHT_KG) {
      warnings.push(
        `Weitere Paletten wurden aufgrund des Maximalgewichts von ${KILOGRAM_FORMATTER.format(
          MAX_GROSS_WEIGHT_KG
        )} kg nicht berücksichtigt.`
      );
      notLoaded.push(p);
      continue;
    }

    let placed = false;

    // A) Try same type row, floor
    if (currentRow && currentRow.type === p.type && currentRow.items.length < currentRow.capacity) {
      currentRow.items.push(p);
      currentWeight += p.weight;
      placed = true;
    } else {
      // B) Try new row
      const usedLen = rows.reduce((acc, r) => acc + r.length, 0);
      const remaining = totalTruckLength - usedLen;
      const spec = getRowSpec(p.type, remaining);

      if (spec.length <= remaining) {
        currentRow = {
          type: p.type,
          length: spec.length,
          capacity: spec.capacity,
          items: [p],
          stackedItems: [],
          stacked: false,
          startX: usedLen,
        };
        rows.push(currentRow);
        currentWeight += p.weight;
        placed = true;
      } else {
        // C) THE SQUEEZE: try stacking or compression

        // We iterate a few times to see if compression can free space
        const MAX_COMPRESSION_PASSES = 3;

        for (let attempt = 0; attempt < MAX_COMPRESSION_PASSES && !placed; attempt++) {
          // Let's try to stack `p` directly first.
          // Here we allow partially stacked rows, as long as they still have free top capacity.
          let targetRow = findBestStackTarget(
            rows,
            p.type,
            stackingStrategy,
            rows.length,
            true
          );

          if (targetRow) {
            // We found a spot for p (stacked, from the back)
            placeOnStack(targetRow, p);
            currentWeight += p.weight;
            placed = true;
          } else {
            // We couldn't stack `p` directly.
            // We need to compress OTHER rows to free up floor length.

            const potentialCompressionTypes = ['industrial', 'euro'] as const;

            for (const typeToCompress of potentialCompressionTypes) {
              const sourceIndex = findLastMovableRowIndex(rows, typeToCompress);
              if (sourceIndex === -1) continue;
              const sourceRow = rows[sourceIndex];

              // Find best target for this source (unstacked rows of same type, from the back)
              const compressTarget = findBestStackTarget(
                rows,
                typeToCompress,
                stackingStrategy,
                sourceIndex
              ); // Limit search to before source

              if (compressTarget && compressTarget.items.length >= sourceRow.items.length) {
                // Move all items from source to target as stacked
                sourceRow.items.forEach(item => {
                  item.stackable = true;
                  placeOnStack(compressTarget, item);
                });

                // Remove source row
                rows.splice(sourceIndex, 1);

                // Recalculate startX
                let runningX = 0;
                rows.forEach(r => {
                  r.startX = runningX;
                  runningX += r.length;
                });
                const newUsed = runningX;
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
                    startX: newUsed,
                  };
                  rows.push(currentRow);
                  currentWeight += p.weight;
                  placed = true;
                  break;
                }
              }
            }
          }
        }

        if (!placed) {
          notLoaded.push(p);
        }
      }
    }

    if (!placed) {
      notLoaded.push(p);
    }
  }

  // 4. HELPERS

  function findBestStackTarget(
    allRows: Row[],
    type: string,
    strategy: StackingStrategy,
    beforeIndex: number = allRows.length,
    allowPartiallyStacked: boolean = false
  ) {
    // 1. Candidates by type and base stackability
    const baseCandidates = allRows
      .slice(0, beforeIndex)
      .filter(
        (r) =>
          r.type === type &&
          r.items.length > 0 &&
          r.items.every((i) => i.stackable) // base pallets must be stackable
      );

    const countNonNullStacked = (r: Row) =>
      r.stackedItems.reduce((sum, s) => sum + (s ? 1 : 0), 0);

    // 2. Filter by available top capacity
    const candidates = baseCandidates.filter((r) => {
      const stackedCount = countNonNullStacked(r);
      if (allowPartiallyStacked) {
        // For normal stacking: allow rows that still have a free stack slot
        return stackedCount < r.items.length;
      } else {
        // For compression logic: only rows without stacks
        return stackedCount === 0;
      }
    });

    if (candidates.length === 0) return null;

    // 3. Sort from BACK to FRONT (highest startX = furthest to the rear)
    // This enforces: Stacked DIN and stacked EUP are always at the back.
    candidates.sort((a, b) => b.startX - a.startX);

    return candidates[0];
  }

  function findLastMovableRowIndex(allRows: Row[], type: string) {
    for (let i = allRows.length - 1; i >= 0; i--) {
      const r = allRows[i];
      if (r.type === type && !r.stacked && r.items.every(it => it.stackable)) {
        return i;
      }
    }
    return -1;
  }

  function placeOnStack(row: Row, item: PalletItem) {
    // Safety: do not put non-stackable pallets on top
    if (!item.stackable) return;

    // Find first empty slot in stackedItems starting from the BACK of the row
    // so we stack rearmost ground positions first (26, 25, 24, ...)
    let slotIdx = -1;
    for (let i = row.items.length - 1; i >= 0; i--) {
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
    if (row.stackedItems.some((s) => s)) {
      row.stacked = true;
    }
  }

  // 5. VISUALIZATION MAPPING
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  const targetUnit = unitsState[0];
  let visualX = 0;

  rows.forEach(row => {
    row.startX = visualX;
    visualX += row.length;
  });

  rows.forEach(row => {
    const palletWidth = row.type === 'industrial' ? 100 : 80;
    const palletLength = 120;
    const baseCount = row.items.length;

    const yPositions: number[] = [];
    if (row.type === 'industrial') {
      if (baseCount === 1) {
        yPositions.push((targetUnit.width - palletWidth) / 2);
      } else {
        yPositions.push(0, targetUnit.width - palletWidth);
      }
    } else {
      if (eupPattern === 'broad') {
        if (baseCount === 1) {
          yPositions.push((targetUnit.width - palletWidth) / 2);
        } else if (baseCount === 2) {
          yPositions.push(0, targetUnit.width - palletWidth);
        }
      } else {
        const segmentWidth = targetUnit.width / 3;
        const centerOffset = (segmentWidth - palletWidth) / 2;
        for (let i = 0; i < baseCount; i++) {
          yPositions.push(i * segmentWidth + centerOffset);
        }
      }
    }

    row.items.forEach((item, index) => {
      const y = yPositions[index] ?? 0;
      targetUnit.palletsVisual.push({
        palletId: item.id,
        labelId: item.labelId,
        x: row.startX,
        y,
        width: palletWidth,
        length: palletLength,
        type: row.type,
        isStacked: false,
        baseIndex: null,
      });
    });

    row.stackedItems.forEach((item, index) => {
      if (!item) return;
      const y = yPositions[index] ?? 0;
      targetUnit.palletsVisual.push({
        palletId: item.id,
        labelId: item.labelId,
        x: row.startX,
        y,
        width: palletWidth,
        length: palletLength,
        type: row.type,
        isStacked: true,
        baseIndex: index,
      });
    });
  });

  // 6. FRONT WEIGHT CHECK
  let frontWeight = 0;
  rows.forEach(row => {
    if (row.startX < 400) {
      frontWeight += row.items.reduce((s, i) => s + i.weight, 0);
      frontWeight += row.stackedItems.reduce((s, i) => (i ? s + i.weight : s), 0);
    }
  });

  if (frontWeight > 10000) {
    warnings.push(
      `Warnung: Hohe Last im Stirnwandbereich (${KILOGRAM_FORMATTER.format(
        frontWeight
      )} kg).`
    );
  }

  const totalDinVisual = targetUnit.palletsVisual.filter((p: any) => p.type === 'industrial').length;
  const totalEupVisual = targetUnit.palletsVisual.filter((p: any) => p.type === 'euro').length;

  return {
    palletArrangement: unitsState.map((u: any) => ({
      unitId: u.id,
      unitLength: u.length,
      unitWidth: u.width,
      pallets: u.palletsVisual,
    })),
    loadedIndustrialPalletsBase: 0,
    loadedEuroPalletsBase: 0,
    totalDinPalletsVisual: totalDinVisual,
    totalEuroPalletsVisual: totalEupVisual,
    utilizationPercentage: parseFloat(((visualX / totalTruckLength) * 100).toFixed(1)),
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: eupPattern,
  };
};
