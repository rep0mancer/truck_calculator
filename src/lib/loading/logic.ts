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

const PALLET_LENGTH_EURO = 120;
const PALLET_WIDTH_EURO = 80;

const PALLET_LENGTH_DIN = 120;
const PALLET_WIDTH_DIN = 100;

// This is a rough heuristic zone in front region where we don't want to stack immediately
const FRONT_SAFE_ZONE_CM = 380;

// --- TYPES ---

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

type TruckUnitConfig = {
  id: string;
  length: number;
  width: number;
  occupiedRects: any[];
};

type TruckConfig = {
  name: string;
  units: TruckUnitConfig[];
  totalLength: number;
  usableLength: number;
  maxWidth: number;
  maxGrossWeightKg: number;
};

type PalletPlacement = {
  palletId: number;
  labelId: number;
  x: number;
  y: number;
  width: number;
  length: number;
  type: 'euro' | 'industrial';
  isStacked: boolean;
  baseIndex: number | null;
};

type UnitPalletResult = {
  unitId: string;
  unitLength: number;
  unitWidth: number;
  pallets: PalletPlacement[];
};

export type LoadingResult = {
  palletArrangement: UnitPalletResult[];
  loadedIndustrialPalletsBase: number;
  loadedEuroPalletsBase: number;
  totalDinPalletsVisual: number;
  totalEuroPalletsVisual: number;
  utilizationPercentage: number;
  warnings: string[];
  totalWeightKg: number;
  eupLoadingPatternUsed: 'long' | 'broad' | 'auto' | 'custom';
};

const KILOGRAM_FORMATTER = new Intl.NumberFormat("de-AT", {
  maximumFractionDigits: 0,
});

export const TRUCK_TYPES: Record<string, TruckConfig> = {
  curtainSider: {
    name: 'Planensattel Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 246, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 246,
    maxGrossWeightKg: 24000,
  },
  roadTrain: {
    name: 'Hängerzug (LKW + Anhänger)',
    units: [
      { id: 'truck', length: 720, width: 246, occupiedRects: [] },
      { id: 'trailer', length: 800, width: 246, occupiedRects: [] },
    ],
    totalLength: 1520,
    usableLength: 1520,
    maxWidth: 246,
    maxGrossWeightKg: 24000,
  },
  mega: {
    name: 'Mega-Trailer (13.6m)',
    units: [{ id: 'main', length: 1360, width: 246, occupiedRects: [] }],
    totalLength: 1360,
    usableLength: 1360,
    maxWidth: 246,
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
    name: 'Waggon Standard (16m)',
    units: [{ id: 'main', length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    maxGrossWeightKg: 28000,
  },
};

// --- HELPER: Generate Pallet Items from Weight Entries ---

function generatePalletItems(
  entries: WeightEntry[],
  type: 'euro' | 'industrial',
  isStackableDefault: boolean,
  isWaggon: boolean
): PalletItem[] {
  const items: PalletItem[] = [];
  let labelCounter = 1;

  entries.forEach((e) => {
    const weight = parseFloat(e.weight || '0') || 0;
    const quantity = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);

    for (let i = 0; i < quantity; i++) {
      const stackableFlag = e.stackable !== false;
      const effectiveStackable =
        type === 'euro'
          ? (isWaggon ? false : isStackableDefault) && stackableFlag
          : (isWaggon ? false : isStackableDefault) && stackableFlag;

      items.push({
        id: items.length + 1,
        type,
        weight,
        stackable: effectiveStackable,
        labelId: labelCounter,
      });
    }

    labelCounter++;
  });

  return items;
}

// --- HELPER: Truck Unit splitting for Road Trains (2 units) ---

function splitRowsAcrossUnits(
  rows: Row[],
  truckKey: keyof typeof TRUCK_TYPES
): { unitsRows: Row[][]; warnings: string[] } {
  const truckConfig = TRUCK_TYPES[truckKey];
  const warnings: string[] = [];

  if (truckConfig.units.length === 1) {
    return { unitsRows: [rows], warnings };
  }

  const [front, rear] = truckConfig.units;
  const frontMax = front.length;
  const rearMax = rear.length;

  const frontRows: Row[] = [];
  const rearRows: Row[] = [];

  let current = 0;
  // Fill front unit
  for (const r of rows) {
    if (current + r.length <= frontMax) {
      frontRows.push({ ...r, startX: current });
      current += r.length;
    } else {
      break;
    }
  }

  const remainingRows = rows.slice(frontRows.length);
  let rearCurrent = 0;
  for (const r of remainingRows) {
    if (rearCurrent + r.length <= rearMax) {
      rearRows.push({ ...r, startX: rearCurrent });
      rearCurrent += r.length;
    } else {
      warnings.push(
        'Nicht alle Paletten passen auf den Hängerzug – verbleibende Paletten wurden nicht geladen.'
      );
      break;
    }
  }

  return { unitsRows: [frontRows, rearRows], warnings };
}

// --- MAIN LOGIC ---

export const calculateLoadingLogic = (
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  eupStackable: boolean,
  dinStackable: boolean,
  eupLoadingPattern: 'long' | 'broad' | 'auto' | 'custom',
  stackingStrategy: StackingStrategy,
  isWaggon: boolean = false
): LoadingResult => {
  const truckConfig = TRUCK_TYPES[truckKey];
  const totalTruckLength = truckConfig.usableLength;

  const allEups = generatePalletItems(eupWeights, 'euro', eupStackable, isWaggon);
  const allDins = generatePalletItems(dinWeights, 'industrial', dinStackable, isWaggon);

  const allPallets = [...allDins, ...allEups];

  const totalWeightKg = allPallets.reduce((sum, p) => sum + p.weight, 0);

  const warnings: string[] = [];
  if (totalWeightKg > truckConfig.maxGrossWeightKg) {
    warnings.push(
      `Warnung: Maximales zulässiges Gesamtgewicht von ${KILOGRAM_FORMATTER.format(
        truckConfig.maxGrossWeightKg
      )} kg überschritten (${KILOGRAM_FORMATTER.format(totalWeightKg)} kg geladen).`
    );
  }

  let currentEupLoadingPattern = eupLoadingPattern;

  if (eupLoadingPattern === 'auto' && allEups.length > 0) {
    const possibleLongRows = Math.floor(totalTruckLength / PALLET_LENGTH_EURO);
    const maxEupsLong = possibleLongRows * 3;

    if (allEups.length <= maxEupsLong) {
      currentEupLoadingPattern = 'long';
    } else {
      currentEupLoadingPattern = 'broad';
    }
  }

  function getRowSpec(type: 'euro' | 'industrial', remainingLength: number) {
    if (type === 'industrial') {
      return { length: PALLET_WIDTH_DIN, capacity: 2 };
    }

    if (currentEupLoadingPattern === 'broad') {
      return { length: PALLET_WIDTH_EURO, capacity: 2 };
    }

    if (currentEupLoadingPattern === 'long') {
      return { length: PALLET_LENGTH_EURO, capacity: 3 };
    }

    if (currentEupLoadingPattern === 'auto') {
      if (remainingLength >= PALLET_LENGTH_EURO) {
        return { length: PALLET_LENGTH_EURO, capacity: 3 };
      }
      if (remainingLength >= PALLET_WIDTH_EURO) {
        return { length: PALLET_WIDTH_EURO, capacity: 2 };
      }
      return { length: PALLET_LENGTH_EURO, capacity: 3 };
    }

    return { length: PALLET_LENGTH_EURO, capacity: 3 };
  }

  const rows: Row[] = [];
  let currentRow: Row | null = null;
  const notLoaded: PalletItem[] = [];
  let currentWeight = 0;

  const placementOrder: 'DIN_FIRST' | 'EUP_FIRST' = 'DIN_FIRST';
  const queue = placementOrder === 'DIN_FIRST' ? [...allDins, ...allEups] : [...allEups, ...allDins];

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

    if (
      currentRow &&
      currentRow.type === p.type &&
      currentRow.items.length < currentRow.capacity
    ) {
      currentRow.items.push(p);
      currentWeight += p.weight;
      placed = true;
    } else {
      const usedLength = rows.reduce((acc, r) => acc + r.length, 0);
      const remainingLength = totalTruckLength - usedLength;
      const spec = getRowSpec(p.type, remainingLength);

      if (spec.length <= remainingLength) {
        currentRow = {
          type: p.type,
          length: spec.length,
          capacity: spec.capacity,
          items: [p],
          stackedItems: [],
          stacked: false,
          startX: usedLength,
        };
        rows.push(currentRow);
        currentWeight += p.weight;
        placed = true;
      } else {
        // C. THE SQUEEZE (Compression / Stacking)
        let compressed = false;
        const MAX_COMPRESSION_PASSES = 3;

        for (let attempt = 0; attempt < MAX_COMPRESSION_PASSES && !placed; attempt++) {
          // Candidates rows to receive a stack
          // Candidate must be: matching type (if stacking p) OR matching type of a movable row.

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
            // We found a spot for p!
            placeOnStack(targetRow, p);
            placed = true;
            currentWeight += p.weight;
            break;
          } else {
            // We couldn't stack `p` directly.
            // We need to compress OTHER rows to free up floor length.
            // Look for ANY row that can be compressed (stacked upon).

            const typesToTry: ('euro' | 'industrial')[] =
              p.type === 'industrial' ? ['industrial'] : ['euro', 'industrial'];

            for (const typeToCompress of typesToTry) {
              const sourceIndex = findLastMovableRowIndex(rows, typeToCompress);
              if (sourceIndex === -1) continue;
              const sourceRow = rows[sourceIndex];

              // Find best target for this source
              const compressTarget = findBestStackTarget(
                rows,
                typeToCompress,
                stackingStrategy,
                sourceIndex
              ); // Limit search to before source

              if (compressTarget && compressTarget.items.length >= sourceRow.items.length) {
                // Move all items from source to target
                sourceRow.items.forEach((item) => {
                  item.stackable = true;
                  placeOnStack(compressTarget, item);
                });

                rows.splice(sourceIndex, 1);

                let newUsed = rows.reduce((acc, r) => acc + r.length, 0);
                let runningX = 0;
                rows.forEach((r) => {
                  r.startX = runningX;
                  runningX += r.length;
                });

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
                  placed = true;
                  currentWeight += p.weight;
                  compressed = true;
                  break;
                }
              }
            }
          }
        }

        if (!placed && !compressed) {
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
    // Step 1: candidates by type and base stackability
    const baseCandidates = allRows.slice(0, beforeIndex).filter(
      (r) =>
        r.type === type &&
        r.items.length > 0 &&
        r.items.every((i) => i.stackable) // base pallets must be stackable
    );

    const countNonNullStacked = (r: Row) =>
      r.stackedItems.reduce((sum, s) => sum + (s ? 1 : 0), 0);

    // Step 2:
    //  - For direct stacking (allowPartiallyStacked === true) we allow rows that still have free top slots.
    //  - For compression we only want rows that are completely unstacked.
    const candidates = baseCandidates.filter((r) => {
      const stackedCount = countNonNullStacked(r);
      if (allowPartiallyStacked) {
        return stackedCount < r.items.length; // at least one free stack slot
      } else {
        return stackedCount === 0; // fully unstacked
      }
    });

    if (candidates.length === 0) return null;

    // Step 3: sort by strategy and axle-safety
    candidates.sort((a, b) => {
      const aSafe = a.startX >= FRONT_SAFE_ZONE_CM;
      const bSafe = b.startX >= FRONT_SAFE_ZONE_CM;

      if (strategy === 'axle_safe') {
        // Prefer rows inside the "safe" zone, then more front positions inside that zone
        if (aSafe && !bSafe) return -1;
        if (!aSafe && bSafe) return 1;
        return a.startX - b.startX;
      } else {
        // "max_pairs": pure front-to-back
        return a.startX - b.startX;
      }
    });

    return candidates[0];
  }

  function findLastMovableRowIndex(allRows: Row[], type: string) {
    for (let i = allRows.length - 1; i >= 0; i--) {
      const r = allRows[i];
      if (r.type === type && !r.stacked && r.items.every((item) => item.stackable)) {
        return i;
      }
    }
    return -1;
  }

  function placeOnStack(row: Row, item: PalletItem) {
    // Find first empty slot in stackedItems
    // We must maintain index alignment (stackedItem[0] sits on items[0])
    let slotIdx = -1;
    for (let i = 0; i < row.items.length; i++) {
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
  const unitsState = truckConfig.units.map((u: any) => ({
    ...u,
    palletsVisual: [] as any[],
  }));
  const targetUnit = unitsState[0];
  let totalWeight = 0;
  let visualX = 0;

  rows.forEach((r) => {
    r.startX = visualX;
    visualX += r.length;
  });

  rows.forEach((row) => {
    const visualWidth = row.type === 'industrial' ? PALLET_WIDTH_DIN : PALLET_WIDTH_EURO;
    const visualLength = row.type === 'industrial' ? PALLET_LENGTH_DIN : PALLET_LENGTH_EURO;
    const baseCount = row.items.length;

    const yPositions: number[] = [];
    if (row.type === 'industrial') {
      if (baseCount === 1) {
        yPositions.push((targetUnit.width - visualWidth) / 2);
      } else {
        yPositions.push(0, targetUnit.width - visualWidth);
      }
    } else {
      if (currentEupLoadingPattern === 'broad') {
        if (baseCount === 1) {
          yPositions.push((targetUnit.width - visualWidth) / 2);
        } else if (baseCount === 2) {
          yPositions.push(0, targetUnit.width - visualWidth);
        }
      } else {
        const segmentWidth = targetUnit.width / 3;
        const centerOffset = (segmentWidth - visualWidth) / 2;
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
        width: visualWidth,
        length: visualLength,
        type: row.type,
        isStacked: false,
        baseIndex: null,
      });

      totalWeight += item.weight;
    });

    row.stackedItems.forEach((item, index) => {
      if (!item) return;
      const y = yPositions[index] ?? 0;

      targetUnit.palletsVisual.push({
        palletId: item.id,
        labelId: item.labelId,
        x: row.startX,
        y,
        width: visualWidth,
        length: visualLength,
        type: row.type,
        isStacked: true,
        baseIndex: index,
      });

      totalWeight += item.weight;
    });
  });

  let frontWeight = 0;
  rows.forEach((row) => {
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

  const unitsRowsResult = splitRowsAcrossUnits(rows, truckKey);
  const unitsRows = unitsRowsResult.unitsRows;
  warnings.push(...unitsRowsResult.warnings);

  const unitArrangements: UnitPalletResult[] = [];

  let totalEupVisual = 0;
  let totalDinVisual = 0;

  unitsRows.forEach((unitRows, unitIndex) => {
    const unitConfig = truckConfig.units[unitIndex];
    const unitLength = unitConfig.length;
    const unitWidth = unitConfig.width;

    const placements: PalletPlacement[] = [];
    let xOffset = 0;

    unitRows.forEach((row) => {
      const rowVisualWidth = row.type === 'industrial' ? PALLET_WIDTH_DIN : PALLET_WIDTH_EURO;
      const rowVisualLength = row.type === 'industrial' ? PALLET_LENGTH_DIN : PALLET_LENGTH_EURO;
      const baseCount = row.items.length;

      const yPositions: number[] = [];
      if (row.type === 'industrial') {
        if (baseCount === 1) {
          yPositions.push((unitWidth - rowVisualWidth) / 2);
        } else {
          yPositions.push(0, unitWidth - rowVisualWidth);
        }
      } else {
        if (currentEupLoadingPattern === 'broad') {
          if (baseCount === 1) {
            yPositions.push((unitWidth - rowVisualWidth) / 2);
          } else if (baseCount === 2) {
            yPositions.push(0, unitWidth - rowVisualWidth);
          }
        } else {
          const segmentWidth = unitWidth / 3;
          const centerOffset = (segmentWidth - rowVisualWidth) / 2;
          for (let i = 0; i < baseCount; i++) {
            yPositions.push(i * segmentWidth + centerOffset);
          }
        }
      }

      row.items.forEach((item, index) => {
        const y = yPositions[index] ?? 0;
        placements.push({
          palletId: item.id,
          labelId: item.labelId,
          x: xOffset,
          y,
          width: rowVisualWidth,
          length: rowVisualLength,
          type: row.type,
          isStacked: false,
          baseIndex: null,
        });

        if (row.type === 'euro') totalEupVisual++;
        if (row.type === 'industrial') totalDinVisual++;
      });

      row.stackedItems.forEach((item, index) => {
        if (!item) return;
        const y = yPositions[index] ?? 0;

        placements.push({
          palletId: item.id,
          labelId: item.labelId,
          x: xOffset,
          y,
          width: rowVisualWidth,
          length: rowVisualLength,
          type: row.type,
          isStacked: true,
          baseIndex: index,
        });

        if (row.type === 'euro') totalEupVisual++;
        if (row.type === 'industrial') totalDinVisual++;
      });

      xOffset += row.length;
    });

    unitArrangements.push({
      unitId: unitConfig.id,
      unitLength,
      unitWidth,
      pallets: placements,
    });
  });

  const utilizationPercentage = parseFloat(
    ((rows.reduce((sum, r) => sum + r.length, 0) / truckConfig.usableLength) * 100).toFixed(1)
  );

  return {
    palletArrangement: unitArrangements,
    loadedIndustrialPalletsBase: allDins.length,
    loadedEuroPalletsBase: allEups.length,
    totalDinPalletsVisual: totalDinVisual,
    totalEuroPalletsVisual: totalEupVisual,
    utilizationPercentage,
    warnings: Array.from(new Set(warnings)),
    totalWeightKg,
    eupLoadingPatternUsed: currentEupLoadingPattern,
  };
};
