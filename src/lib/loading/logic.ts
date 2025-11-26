"use client";

export type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
  stackable?: boolean;
};

export type StackingStrategy = "axle_safe" | "max_pairs";

// --- CONSTANTS ---
export const MAX_GROSS_WEIGHT_KG = 24000;
export const MAX_PALLET_SIMULATION_QUANTITY = 300;
export const MAX_WEIGHT_PER_METER_KG = 1800;

const PALLET_LENGTH_EURO = 120;
const PALLET_WIDTH_EURO = 80;

const PALLET_LENGTH_DIN = 120;
const PALLET_WIDTH_DIN = 100;

export const KILOGRAM_FORMATTER = new Intl.NumberFormat("de-AT", {
  maximumFractionDigits: 0,
});

// --- TRUCK CONFIG ---

type TruckUnitConfig = {
  id: string;
  length: number; // cm
  width: number;  // cm
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

export const TRUCK_TYPES: Record<string, TruckConfig> = {
  curtainSider: {
    name: "Planensattel Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 246, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 246,
    maxGrossWeightKg: 24000,
  },
  roadTrain: {
    name: "Hängerzug (LKW + Anhänger)",
    units: [
      { id: "truck", length: 720, width: 246, occupiedRects: [] },
      { id: "trailer", length: 800, width: 246, occupiedRects: [] },
    ],
    totalLength: 1520,
    usableLength: 1520,
    maxWidth: 246,
    maxGrossWeightKg: 24000,
  },
  mega: {
    name: "Mega-Trailer (13.6m)",
    units: [{ id: "main", length: 1360, width: 246, occupiedRects: [] }],
    totalLength: 1360,
    usableLength: 1360,
    maxWidth: 246,
    maxGrossWeightKg: 24000,
  },
  frigo: {
    name: "Frigo (Kühler) Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 246, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 246,
    maxGrossWeightKg: 18300,
  },
  smallTruck: {
    name: "Motorwagen (7.2m)",
    units: [{ id: "main", length: 720, width: 245, occupiedRects: [] }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 10000,
  },
  Waggon: {
    name: "Waggon Standard (16m)",
    units: [{ id: "main", length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    maxGrossWeightKg: 28000,
  },
};

// --- INTERNAL TYPES ---

type PalletType = "euro" | "industrial";

type PalletItem = {
  id: number;
  type: PalletType;
  weight: number;
  stackable: boolean;
  labelId: number;
};

type Row = {
  type: PalletType;
  length: number;   // row length along x
  capacity: number; // max floor pallets in this row
  items: PalletItem[];
  stackedItems: (PalletItem | null)[];
  stacked: boolean;
  startX: number;   // x-position of row start
};

export type PalletPlacement = {
  palletId: number;
  labelId: number;
  x: number;
  y: number;
  width: number;
  length: number;
  type: PalletType;
  isStacked: boolean;
  baseIndex: number | null;
};

export type UnitPalletResult = {
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
  eupLoadingPatternUsed: "long" | "broad" | "auto" | "custom";
};

// --- WAGGON SPECIAL (simple 38-EUP grid) ---

export function calculateWaggonEuroLayout(
  eupWeights: WeightEntry[],
  truckConfig: TruckConfig
): LoadingResult {
  const singles: { weight: number }[] = [];
  eupWeights.forEach((e) => {
    const w = parseFloat(e.weight || "0") || 0;
    const q = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);
    for (let i = 0; i < q; i++) singles.push({ weight: w });
  });

  const maxEups = 38;
  const count = Math.min(singles.length, maxEups);

  const placements: PalletPlacement[] = [];
  let placed = 0;
  let totalWeight = 0;

  function placeRow(rowIndex: number, countInRow: number) {
    const y = rowIndex * PALLET_WIDTH_EURO;
    for (let i = 0; i < countInRow && placed < count; i++) {
      const x = i * PALLET_LENGTH_EURO;
      placements.push({
        palletId: placed + 1,
        labelId: placed + 1,
        x,
        y,
        width: PALLET_WIDTH_EURO,
        length: PALLET_LENGTH_EURO,
        type: "euro",
        isStacked: false,
        baseIndex: null,
      });
      totalWeight += singles[placed].weight;
      placed++;
    }
  }

  placeRow(0, 11);
  placeRow(1, 11);
  placeRow(2, 8);
  placeRow(3, 8);

  const unit = truckConfig.units[0];

  return {
    palletArrangement: [
      {
        unitId: unit.id,
        unitLength: unit.length,
        unitWidth: unit.width,
        pallets: placements,
      },
    ],
    loadedIndustrialPalletsBase: 0,
    loadedEuroPalletsBase: placed,
    totalDinPalletsVisual: 0,
    totalEuroPalletsVisual: placed,
    utilizationPercentage: 0,
    warnings: [],
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: "custom",
  };
}

// --- HELPERS ---

function generatePalletItems(
  entries: WeightEntry[],
  type: PalletType,
  isStackableDefault: boolean,
  isWaggon: boolean
): PalletItem[] {
  const items: PalletItem[] = [];
  let labelCounter = 1;

  entries.forEach((e) => {
    const weight = parseFloat(e.weight || "0") || 0;
    const quantity = Math.min(e.quantity || 0, MAX_PALLET_SIMULATION_QUANTITY);

    for (let i = 0; i < quantity; i++) {
      const stackableFlag = e.stackable !== false;
      const effectiveStackable =
        !isWaggon && isStackableDefault && stackableFlag;

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

type EupPattern = "long" | "broad" | "auto";

function resolveEupPattern(
  eupPattern: EupPattern,
  eupCount: number,
  totalTruckLength: number
): EupPattern {
  if (eupPattern !== "auto") return eupPattern;

  const possibleLongRows = Math.floor(totalTruckLength / PALLET_LENGTH_EURO);
  const maxEupsLong = possibleLongRows * 3;

  if (eupCount <= maxEupsLong) return "long";
  return "broad";
}

function getRowSpec(
  type: PalletType,
  eupPattern: EupPattern,
  remainingLength: number
): { length: number; capacity: number } {
  if (type === "industrial") {
    return { length: PALLET_WIDTH_DIN, capacity: 2 };
  }

  if (eupPattern === "broad") {
    return { length: PALLET_WIDTH_EURO, capacity: 2 };
  }

  if (eupPattern === "long") {
    return { length: PALLET_LENGTH_EURO, capacity: 3 };
  }

  // auto fallback (should be resolved beforehand)
  if (remainingLength >= PALLET_LENGTH_EURO) {
    return { length: PALLET_LENGTH_EURO, capacity: 3 };
  }
  if (remainingLength >= PALLET_WIDTH_EURO) {
    return { length: PALLET_WIDTH_EURO, capacity: 2 };
  }
  return { length: PALLET_LENGTH_EURO, capacity: 3 };
}

// --- MAIN LOGIC ---

export function calculateLoadingLogic(
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  eupStackable: boolean,
  dinStackable: boolean,
  eupLoadingPattern: EupPattern,
  stackingStrategy: StackingStrategy,
  isWaggon: boolean = false
): LoadingResult {
  const truckConfig = TRUCK_TYPES[truckKey];
  const totalTruckLength = truckConfig.usableLength;

  // Waggon special: use fixed 38-EUP layout if only EUPs and no DINs
  if (truckKey === "Waggon" && dinWeights.length === 0) {
    return calculateWaggonEuroLayout(eupWeights, truckConfig);
  }

  const allEups = generatePalletItems(
    eupWeights,
    "euro",
    eupStackable,
    isWaggon
  );
  const allDins = generatePalletItems(
    dinWeights,
    "industrial",
    dinStackable,
    isWaggon
  );

  const allPallets = [...allDins, ...allEups];
  const totalWeightKg = allPallets.reduce((sum, p) => sum + p.weight, 0);

  const warnings: string[] = [];
  if (totalWeightKg > truckConfig.maxGrossWeightKg) {
    warnings.push(
      `Warnung: Maximales zulässiges Gesamtgewicht von ${KILOGRAM_FORMATTER.format(
        truckConfig.maxGrossWeightKg
      )} kg überschritten (${KILOGRAM_FORMATTER.format(
        totalWeightKg
      )} kg geladen).`
    );
  }

  const eupPatternUsed = resolveEupPattern(
    eupLoadingPattern,
    allEups.length,
    totalTruckLength
  );

  // Phase 1: floor placement only, no stacking/compression
  const rows: Row[] = [];
  let currentRow: Row | null = null;
  let currentWeight = 0;

  const overflowDins: PalletItem[] = [];
  const overflowEups: PalletItem[] = [];
  const notLoaded: PalletItem[] = [];

  // DIN floor first, then EUP floor  → spatial order DIN → EUP
  const floorQueue: PalletItem[] = [...allDins, ...allEups];

  for (const p of floorQueue) {
    if (currentWeight + p.weight > MAX_GROSS_WEIGHT_KG) {
      warnings.push(
        `Weitere Paletten wurden aufgrund des Maximalgewichts von ${KILOGRAM_FORMATTER.format(
          MAX_GROSS_WEIGHT_KG
        )} kg nicht berücksichtigt.`
      );
      notLoaded.push(p);
      continue;
    }

    const usedLength = rows.reduce((acc, r) => acc + r.length, 0);
    const remainingLength = totalTruckLength - usedLength;

    // Try to put on current row
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
      // Try to open new row
      const spec = getRowSpec(p.type, eupPatternUsed, remainingLength);
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
      }
    }

    if (!placed) {
      if (p.stackable) {
        if (p.type === "industrial") overflowDins.push(p);
        else overflowEups.push(p);
      } else {
        notLoaded.push(p);
      }
    }
  }

  // Assign startX sequentially front -> back
  let runningX = 0;
  rows.forEach((r) => {
    r.startX = runningX;
    runningX += r.length;
  });

  // Phase 2: stacking from the back, DIN stacks first, then EUP stacks
  function buildStackSlots(type: PalletType): { row: Row; index: number }[] {
    const candidates = rows.filter(
      (r) => r.type === type && r.items.length > 0
    );

    // sort rows by startX DESC (rear to front)
    candidates.sort((a, b) => b.startX - a.startX);

    const slots: { row: Row; index: number }[] = [];

    for (const row of candidates) {
      // within a row: fill from "right" to "left" → higher index first
      for (let i = row.items.length - 1; i >= 0; i--) {
        const base = row.items[i];
        if (base.stackable) {
          slots.push({ row, index: i });
        }
      }
    }

    return slots;
  }

  function stackOverflow(
    overflow: PalletItem[],
    type: PalletType
  ): void {
    if (overflow.length === 0) return;

    const slots = buildStackSlots(type);
    let slotPos = 0;

    for (const p of overflow) {
      if (currentWeight + p.weight > MAX_GROSS_WEIGHT_KG) {
        warnings.push(
          `Weitere Paletten wurden aufgrund des Maximalgewichts von ${KILOGRAM_FORMATTER.format(
            MAX_GROSS_WEIGHT_KG
          )} kg nicht berücksichtigt.`
        );
        notLoaded.push(p);
        continue;
      }

      while (
        slotPos < slots.length &&
        slots[slotPos].row.stackedItems[slots[slotPos].index]
      ) {
        slotPos++;
      }

      if (slotPos >= slots.length) {
        notLoaded.push(p);
        continue;
      }

      const { row, index } = slots[slotPos];
      if (!row.stackedItems[index]) {
        row.stackedItems[index] = p;
        row.stacked = true;
        currentWeight += p.weight;
      } else {
        notLoaded.push(p);
      }
    }
  }

  // DIN stacks first, then EUP stacks  → logical order DIN → EUP → stacked DIN → stacked EUP
  stackOverflow(overflowDins, "industrial");
  stackOverflow(overflowEups, "euro");

  // Phase 3: visualization mapping (currently: everything into first unit)
  const unitsState = truckConfig.units.map((u) => ({
    ...u,
    palletsVisual: [] as PalletPlacement[],
  }));

  const unit = unitsState[0];

  rows.forEach((row) => {
    const palletWidth =
      row.type === "industrial" ? PALLET_WIDTH_DIN : PALLET_WIDTH_EURO;
    const palletLength =
      row.type === "industrial" ? PALLET_LENGTH_DIN : PALLET_LENGTH_EURO;
    const baseCount = row.items.length;

    const yPositions: number[] = [];
    if (row.type === "industrial") {
      if (baseCount === 1) {
        yPositions.push((unit.width - palletWidth) / 2);
      } else {
        yPositions.push(0, unit.width - palletWidth);
      }
    } else {
      if (eupPatternUsed === "broad") {
        if (baseCount === 1) {
          yPositions.push((unit.width - palletWidth) / 2);
        } else if (baseCount === 2) {
          yPositions.push(0, unit.width - palletWidth);
        } else {
          const segmentWidth = unit.width / 3;
          const centerOffset = (segmentWidth - palletWidth) / 2;
          for (let i = 0; i < baseCount; i++) {
            yPositions.push(i * segmentWidth + centerOffset);
          }
        }
      } else {
        const segmentWidth = unit.width / 3;
        const centerOffset = (segmentWidth - palletWidth) / 2;
        for (let i = 0; i < baseCount; i++) {
          yPositions.push(i * segmentWidth + centerOffset);
        }
      }
    }

    row.items.forEach((item, index) => {
      const y = yPositions[index] ?? 0;
      unit.palletsVisual.push({
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
      unit.palletsVisual.push({
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

  // front weight check (approximate)
  let frontWeight = 0;
  rows.forEach((row) => {
    if (row.startX < 400) {
      frontWeight += row.items.reduce((s, i) => s + i.weight, 0);
      frontWeight += row.stackedItems.reduce(
        (s, i) => (i ? s + i.weight : s),
        0
      );
    }
  });

  if (frontWeight > 10000) {
    warnings.push(
      `Warnung: Hohe Last im Stirnwandbereich (${KILOGRAM_FORMATTER.format(
        frontWeight
      )} kg).`
    );
  }

  const totalDinVisual = unit.palletsVisual.filter(
    (p) => p.type === "industrial"
  ).length;
  const totalEupVisual = unit.palletsVisual.filter(
    (p) => p.type === "euro"
  ).length;

  const utilizationPercentage = parseFloat(
    ((rows.reduce((sum, r) => sum + r.length, 0) / totalTruckLength) * 100)
      .toFixed(1)
  );

  return {
    palletArrangement: unitsState.map((u) => ({
      unitId: u.id,
      unitLength: u.length,
      unitWidth: u.width,
      pallets: u.palletsVisual,
    })),
    loadedIndustrialPalletsBase: allDins.length,
    loadedEuroPalletsBase: allEups.length,
    totalDinPalletsVisual: totalDinVisual,
    totalEuroPalletsVisual: totalEupVisual,
    utilizationPercentage,
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: currentWeight,
    eupLoadingPatternUsed: eupPatternUsed,
  };
}
