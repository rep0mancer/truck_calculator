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

// ... (TRUCK_TYPES and PALLET_TYPES constants remain the same)
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
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  frigo: {
    name: 'Frigo (Kühler) Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
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

export const MAX_GROSS_WEIGHT_KG = 24000;
export const MAX_PALLET_SIMULATION_QUANTITY = 300;
export const STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING = 18;
export const STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING = 16;
export const MAX_WEIGHT_PER_METER_KG = 1800;

export const STACKING_RULES = {
  industrial: { slotLengthCm: 50, stackZoneSlots: 9, frontBufferSlots: 8 },
  euro: { slotLengthCm: 40, stackZoneSlots: 9, frontBufferSlots: 9 },
} as const;

export const KILOGRAM_FORMATTER = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

interface TruckConfig {
  units: { id: string; length: number; width: number }[];
  usableLength: number;
  maxWidth: number;
}

interface EupPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'euro';
  key: string;
  labelId: number;
}

export const calculateWaggonEuroLayout = (
  eupWeights: WeightEntry[],
  truckConfig: TruckConfig
) => {
  const allEupSingles = (eupWeights || [])
    .flatMap(entry =>
      Array.from({ length: entry.quantity }, () => ({
        weight: parseFloat(entry.weight) || 0,
      }))
    );
  const requestedEupQuantity = allEupSingles.length;

  const placements: EupPlacement[] = [];
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
    eupLoadingPatternUsed: 'custom', // Indicate a special pattern was used
  };
};

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

  // --- START: WAGGON-SPECIFIC LOGIC ---
  const isWaggon = ['Waggon', 'Waggon2'].includes(truckKey);
  const isEUPStackable = isWaggon ? false : currentIsEUPStackable;
  const isDINStackable = isWaggon ? false : currentIsDINStackable;

  const isDinEmpty = dinWeights.every(entry => entry.quantity === 0);
  const isEupPresent = eupWeights.some(entry => entry.quantity > 0);

  // Special layout for EUP-only on a Waggon.
  if (isWaggon && isDinEmpty && isEupPresent) {
    const result = calculateWaggonEuroLayout(eupWeights, truckConfig);
    if (currentIsEUPStackable) {
      result.warnings.push("Info: Stapeln ist auf dem Waggon nicht möglich und wurde deaktiviert.");
    }
    return result;
  }
  // --- END: WAGGON-SPECIFIC LOGIC ---

  const weightLimit = truckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;
  const usableLength = truckConfig.usableLength ?? truckConfig.totalLength ?? 1320;
  const truckWidth = truckConfig.maxWidth ?? 245;
  const warnings: string[] = [];

  if (isWaggon && (currentIsDINStackable || currentIsEUPStackable)) {
    warnings.push("Info: Stapeln ist auf dem Waggon nicht möglich und wurde deaktiviert.");
  }

  // ============================================================================
  // SETUP: Create flat list of individual pallets from user inputs
  // ============================================================================
  interface PalletItem {
    id: number;
    type: 'euro' | 'industrial';
    weight: number;
    stackable: boolean;
    sourceId: number;
  }

  let palletIdSeed = 1;
  const flattenToSingles = (entries: WeightEntry[], type: 'euro' | 'industrial'): PalletItem[] => {
    const result: PalletItem[] = [];
    for (const entry of entries) {
      const qty = Math.max(0, Number(entry.quantity) || 0);
      const parsedWeight = parseFloat(entry.weight as unknown as string) || 0;
      for (let i = 0; i < qty; i++) {
        result.push({
          id: palletIdSeed++,
          type,
          weight: parsedWeight,
          stackable: Boolean(entry.stackable),
          sourceId: entry.id,
        });
      }
    }
    return result;
  };

  const allEupSingles = flattenToSingles(eupWeights, 'euro');
  const allDinSingles = flattenToSingles(dinWeights, 'industrial');

  // Create flat queue based on placement order
  let palletQueue: PalletItem[] = [];
  if (placementOrder === 'DIN_FIRST') {
    palletQueue = [...allDinSingles, ...allEupSingles];
  } else {
    palletQueue = [...allEupSingles, ...allDinSingles];
  }

  // Track stacking limits
  const numericMaxStackedEup = typeof maxStackedEup === 'string' ? parseInt(maxStackedEup, 10) : (maxStackedEup ?? Infinity);
  const numericMaxStackedDin = typeof maxStackedDin === 'string' ? parseInt(maxStackedDin, 10) : (maxStackedDin ?? Infinity);

  // ============================================================================
  // CONSTANTS: Row dimensions
  // ============================================================================
  // DIN (Industrial): 120cm x 100cm pallet
  // - DIN Row: 100cm length (pallets oriented with 100cm along truck), 2 pallets wide (2 × 120cm = 240cm ≤ 245cm)
  const DIN_ROW_LENGTH = 100;
  const DIN_PALLETS_PER_ROW = 2;
  const DIN_VISUAL_WIDTH = 120; // perpendicular dimension

  // EUP (Euro): 120cm x 80cm pallet
  // - EUP Row (long/3-wide): 120cm length, 3 pallets wide (3 × 80cm = 240cm)
  // - EUP Row (broad/2-wide): 80cm length, 2 pallets wide (2 × 120cm = 240cm)
  const EUP_LONG_ROW_LENGTH = 120;
  const EUP_LONG_PALLETS_PER_ROW = 3;
  const EUP_LONG_VISUAL_WIDTH = 80;

  const EUP_BROAD_ROW_LENGTH = 80;
  const EUP_BROAD_PALLETS_PER_ROW = 2;
  const EUP_BROAD_VISUAL_WIDTH = 120;

  // Safe zone boundary: > 380cm from front is "Safe Zone" (rear)
  const SAFE_ZONE_BOUNDARY = 380;

  // Max DIN pallets for Waggon types
  const maxDinBase = typeof truckConfig.maxDinPallets === 'number' ? truckConfig.maxDinPallets : undefined;

  // ============================================================================
  // PASS 1: LINEAR FLOOR FILL
  // Place pallets linearly into "Logical Rows" along the truck length
  // ============================================================================
  interface LogicalRow {
    type: 'euro' | 'industrial';
    startX: number;           // Distance from front (cm)
    length: number;           // Row length along truck (cm)
    palletsPerRow: number;    // Number of pallets per row width
    visualWidth: number;      // Visual width of each pallet (perpendicular)
    basePallets: PalletItem[];
    stackedPallets: PalletItem[];
    isStackable: boolean;     // All base pallets are stackable
  }

  const rows: LogicalRow[] = [];
  const overflowQueue: PalletItem[] = [];
  let currentX = 0;
  let currentWeight = 0;
  let queueIndex = 0;
  let dinBaseCount = 0;

  // Determine EUP pattern at the start
  let activeEupPattern: 'long' | 'broad' = currentEupLoadingPattern === 'broad' ? 'broad' : 'long';

  while (queueIndex < palletQueue.length) {
    const pallet = palletQueue[queueIndex];
    const palletType = pallet.type;

    // Determine row dimensions based on pallet type
    let rowLength: number;
    let palletsPerRow: number;
    let visualWidth: number;

    if (palletType === 'industrial') {
      rowLength = DIN_ROW_LENGTH;
      palletsPerRow = DIN_PALLETS_PER_ROW;
      visualWidth = DIN_VISUAL_WIDTH;
    } else {
      // EUP: Check for auto-rotation near end of truck
      if (currentEupLoadingPattern === 'auto') {
        const remainingLength = usableLength - currentX;
        // If 120cm (long) doesn't fit but 80cm (broad) does, switch to broad
        if (remainingLength < EUP_LONG_ROW_LENGTH && remainingLength >= EUP_BROAD_ROW_LENGTH) {
          activeEupPattern = 'broad';
        }
      }

      if (activeEupPattern === 'broad') {
        rowLength = EUP_BROAD_ROW_LENGTH;
        palletsPerRow = EUP_BROAD_PALLETS_PER_ROW;
        visualWidth = EUP_BROAD_VISUAL_WIDTH;
      } else {
        rowLength = EUP_LONG_ROW_LENGTH;
        palletsPerRow = EUP_LONG_PALLETS_PER_ROW;
        visualWidth = EUP_LONG_VISUAL_WIDTH;
      }
    }

    // Check if this row fits in the truck
    if (currentX + rowLength > usableLength) {
      // This pallet and all remaining go to overflow
      overflowQueue.push(pallet);
      queueIndex++;
      continue;
    }

    // Check DIN limit for Waggon
    if (palletType === 'industrial' && maxDinBase !== undefined) {
      if (dinBaseCount + palletsPerRow > maxDinBase) {
        // Partial fill or overflow
        const remaining = maxDinBase - dinBaseCount;
        if (remaining <= 0) {
          overflowQueue.push(pallet);
          queueIndex++;
          continue;
        }
        palletsPerRow = remaining;
      }
    }

    // Collect pallets for this row
    const rowPallets: PalletItem[] = [];
    let rowWeight = 0;
    let allStackable = true;

    for (let slot = 0; slot < palletsPerRow && queueIndex < palletQueue.length; slot++) {
      const nextPallet = palletQueue[queueIndex];

      // Only same type pallets in a row
      if (nextPallet.type !== palletType) {
        break;
      }

      // Check weight limit
      if (weightLimit > 0 && currentWeight + rowWeight + nextPallet.weight > weightLimit) {
        if (!warnings.some(w => w.includes('Gewichtslimit'))) {
          warnings.push('Gewichtslimit erreicht.');
        }
        overflowQueue.push(nextPallet);
        queueIndex++;
        slot--; // Don't count this slot
        continue;
      }

      rowPallets.push(nextPallet);
      rowWeight += nextPallet.weight;
      if (!nextPallet.stackable) {
        allStackable = false;
      }
      queueIndex++;
    }

    if (rowPallets.length === 0) {
      continue;
    }

    // Create the logical row
    const row: LogicalRow = {
      type: palletType,
      startX: currentX,
      length: rowLength,
      palletsPerRow: rowPallets.length,
      visualWidth,
      basePallets: rowPallets,
      stackedPallets: [],
      isStackable: allStackable && (palletType === 'euro' ? isEUPStackable : isDINStackable),
    };

    rows.push(row);
    currentX += rowLength;
    currentWeight += rowWeight;

    if (palletType === 'industrial') {
      dinBaseCount += rowPallets.length;
    }
  }

  // ============================================================================
  // PASS 2: COMPRESSION (STACKING)
  // Process overflow pallets by stacking them onto valid base rows
  // ============================================================================
  let stackedEupCount = 0;
  let stackedDinCount = 0;

  // Sort overflow by type to match with appropriate rows
  const eupOverflow = overflowQueue.filter(p => p.type === 'euro');
  const dinOverflow = overflowQueue.filter(p => p.type === 'industrial');

  const processOverflow = (overflow: PalletItem[], palletType: 'euro' | 'industrial') => {
    const isStackingEnabled = palletType === 'euro' ? isEUPStackable : isDINStackable;
    const maxStacked = palletType === 'euro' ? numericMaxStackedEup : numericMaxStackedDin;
    let currentStackedCount = palletType === 'euro' ? stackedEupCount : stackedDinCount;

    if (!isStackingEnabled) {
      return overflow; // Return unprocessed overflow
    }

    // Filter valid base rows for this type
    const validRows = rows.filter(r =>
      r.type === palletType &&
      r.isStackable &&
      r.stackedPallets.length === 0 // Not already stacked
    );

    // Sort by stacking strategy
    if (stackingStrategy === 'axle_safe') {
      // Prioritize Safe Zone (rear, > 380cm) first, then Front Zone
      validRows.sort((a, b) => {
        const aInSafeZone = a.startX >= SAFE_ZONE_BOUNDARY;
        const bInSafeZone = b.startX >= SAFE_ZONE_BOUNDARY;

        if (aInSafeZone && !bInSafeZone) return -1;
        if (!aInSafeZone && bInSafeZone) return 1;

        // Within same zone, sort by position (rear first for safe zone)
        if (aInSafeZone) {
          return b.startX - a.startX; // Rear-most first in safe zone
        }
        return a.startX - b.startX; // Front-most first in front zone
      });
    } else {
      // max_pairs: Prioritize from Front (0cm) to Back
      validRows.sort((a, b) => a.startX - b.startX);
    }

    const remainingOverflow: PalletItem[] = [];
    let overflowIndex = 0;
    let rowIndex = 0;

    while (overflowIndex < overflow.length) {
      const overflowPallet = overflow[overflowIndex];

      // Check if we can stack more
      if (currentStackedCount >= maxStacked) {
        remainingOverflow.push(overflowPallet);
        overflowIndex++;
        continue;
      }

      // Check if overflow pallet is stackable
      if (!overflowPallet.stackable) {
        remainingOverflow.push(overflowPallet);
        overflowIndex++;
        continue;
      }

      // Find a valid row to stack onto
      let foundRow = false;
      while (rowIndex < validRows.length) {
        const row = validRows[rowIndex];

        // Check if this row can accept more stacked pallets
        if (row.stackedPallets.length < row.basePallets.length) {
          // Check weight limit
          if (weightLimit > 0 && currentWeight + overflowPallet.weight > weightLimit) {
            if (!warnings.some(w => w.includes('Gewichtslimit'))) {
              warnings.push('Gewichtslimit erreicht.');
            }
            remainingOverflow.push(overflowPallet);
            overflowIndex++;
            foundRow = true;
            break;
          }

          // Stack the pallet
          row.stackedPallets.push(overflowPallet);
          currentWeight += overflowPallet.weight;
          currentStackedCount++;
          overflowIndex++;
          foundRow = true;
          break;
        }

        rowIndex++;
      }

      if (!foundRow) {
        // No more valid rows, all remaining overflow stays
        remainingOverflow.push(overflowPallet);
        overflowIndex++;
      }
    }

    // Update global stacked count
    if (palletType === 'euro') {
      stackedEupCount = currentStackedCount;
    } else {
      stackedDinCount = currentStackedCount;
    }

    return remainingOverflow;
  };

  // Process overflow based on placement order (to maintain type priority)
  // Note: The return values represent pallets that couldn't be stacked
  if (placementOrder === 'DIN_FIRST') {
    processOverflow(dinOverflow, 'industrial');
    processOverflow(eupOverflow, 'euro');
  } else {
    processOverflow(eupOverflow, 'euro');
    processOverflow(dinOverflow, 'industrial');
  }

  // ============================================================================
  // PASS 3: VISUALIZATION MAPPING
  // Convert Logical Rows (Base + Stacked) into explicit visual objects
  // ============================================================================
  interface PalletVisual {
    key: string;
    type: 'euro' | 'industrial';
    x: number;      // Distance from front (cm)
    y: number;      // Distance from left wall (cm)
    width: number;  // Dimension along truck length (cm)
    height: number; // Dimension along truck width (cm)
    labelId: number;
    isStackedTier: 'base' | 'top' | null;
    showAsFraction: boolean;
    displayBaseLabelId: number;
    displayStackedLabelId: number | undefined;
    unitId: string;
  }

  const palletsVisual: PalletVisual[] = [];
  let dinLabelCounter = 0;
  let eupLabelCounter = 0;
  let totalBaseArea = 0;

  // For multi-unit trucks (road trains), we need to assign rows to units
  const units = truckConfig.units;
  let currentUnitIndex = 0;
  let unitXOffset = 0;
  let unitStartX = 0;

  for (const row of rows) {
    // Find which unit this row belongs to
    while (currentUnitIndex < units.length) {
      const unit = units[currentUnitIndex];
      const unitEndX = unitStartX + unit.length;

      if (row.startX < unitEndX) {
        break;
      }

      unitXOffset = unitEndX;
      unitStartX = unitEndX;
      currentUnitIndex++;
    }

    if (currentUnitIndex >= units.length) {
      break; // No more units
    }

    const unit = units[currentUnitIndex];
    const localX = row.startX - unitXOffset;

    // Calculate Y positions for pallets in the row
    const palletHeight = row.visualWidth;
    const rowWidth = row.basePallets.length * palletHeight;
    const startY = Math.floor((truckWidth - rowWidth) / 2); // Center pallets

    for (let slotIndex = 0; slotIndex < row.basePallets.length; slotIndex++) {
      const basePallet = row.basePallets[slotIndex];
      const stackedPallet = row.stackedPallets[slotIndex];
      const hasStacked = stackedPallet !== undefined;

      const baseLabelId = basePallet.type === 'euro' ? ++eupLabelCounter : ++dinLabelCounter;
      const y = startY + slotIndex * palletHeight;

      // Add base area
      totalBaseArea += row.length * palletHeight;

      // Create base visual
      const baseVisual: PalletVisual = {
        key: `${basePallet.type}_${basePallet.id}`,
        type: basePallet.type,
        x: localX,
        y,
        width: row.length,
        height: palletHeight,
        labelId: baseLabelId,
        isStackedTier: hasStacked ? 'base' : null,
        showAsFraction: hasStacked,
        displayBaseLabelId: baseLabelId,
        displayStackedLabelId: undefined,
        unitId: unit.id,
      };

      if (hasStacked) {
        const stackedLabelId = stackedPallet.type === 'euro' ? ++eupLabelCounter : ++dinLabelCounter;
        baseVisual.displayStackedLabelId = stackedLabelId;

        palletsVisual.push(baseVisual);

        // Create stacked visual
        const stackedVisual: PalletVisual = {
          key: `${stackedPallet.type}_${stackedPallet.id}_stack`,
          type: stackedPallet.type,
          x: localX,
          y,
          width: row.length,
          height: palletHeight,
          labelId: stackedLabelId,
          isStackedTier: 'top',
          showAsFraction: true,
          displayBaseLabelId: baseLabelId,
          displayStackedLabelId: stackedLabelId,
          unitId: unit.id,
        };

        palletsVisual.push(stackedVisual);
      } else {
        palletsVisual.push(baseVisual);
      }
    }
  }

  // ============================================================================
  // METRICS AND WARNINGS
  // ============================================================================
  const totalDinRequested = allDinSingles.length;
  const totalEupRequested = allEupSingles.length;

  // Count loaded pallets
  const loadedDinBase = rows.filter(r => r.type === 'industrial').reduce((sum, r) => sum + r.basePallets.length, 0);
  const loadedEupBase = rows.filter(r => r.type === 'euro').reduce((sum, r) => sum + r.basePallets.length, 0);
  const loadedDinStacked = rows.filter(r => r.type === 'industrial').reduce((sum, r) => sum + r.stackedPallets.length, 0);
  const loadedEupStacked = rows.filter(r => r.type === 'euro').reduce((sum, r) => sum + r.stackedPallets.length, 0);

  const totalDinLoaded = loadedDinBase + loadedDinStacked;
  const totalEupLoaded = loadedEupBase + loadedEupStacked;

  // Visual counts (base + stacked, each stacked pair shows as 2 visuals)
  const totalDinPalletsVisual = palletsVisual.filter(p => p.type === 'industrial').length;
  const totalEuroPalletsVisual = palletsVisual.filter(p => p.type === 'euro').length;

  // Leftover warning
  const remainingDin = Math.max(0, totalDinRequested - totalDinLoaded);
  const remainingEup = Math.max(0, totalEupRequested - totalEupLoaded);
  const leftoverParts: string[] = [];
  if (remainingDin > 0) leftoverParts.push(`${remainingDin} DIN`);
  if (remainingEup > 0) leftoverParts.push(`${remainingEup} EUP`);
  if (leftoverParts.length > 0) {
    warnings.push(`Konnte nicht alle Paletten laden. Übrig: ${leftoverParts.join(' und ')}.`);
  }

  // Waggon DIN limit warning
  if (maxDinBase !== undefined && totalDinRequested > maxDinBase && totalDinRequested !== MAX_PALLET_SIMULATION_QUANTITY) {
    warnings.push(`${truckConfig.name.trim()} maximale DIN-Kapazität ist ${maxDinBase}. Angeforderte Menge ${totalDinRequested}, es werden ${Math.min(maxDinBase, loadedDinBase)} platziert.`);
  }

  // Calculate utilization
  const totalTruckArea = usableLength * truckWidth;
  const utilizationPercentage = totalTruckArea > 0 ? parseFloat(((totalBaseArea / totalTruckArea) * 100).toFixed(1)) : 0;

  // Weight-based warnings
  const usedLength = truckWidth > 0 ? totalBaseArea / truckWidth : 0;
  if (usedLength > 0) {
    const weightPerMeter = currentWeight / (usedLength / 100);
    if (weightPerMeter >= MAX_WEIGHT_PER_METER_KG) {
      warnings.push(`ACHTUNG – mögliche Achslastüberschreitung: ${weightPerMeter.toFixed(1)} kg/m`);
    }
  }

  if (usableLength > 0) {
    const usedLengthPercentage = (usedLength / usableLength) * 100;
    if (currentWeight >= 10500 && usedLengthPercentage <= 40) {
      warnings.push('ACHTUNG – mehr als 10.5t auf weniger als 40% der Ladefläche');
    }
  }

  // Axle warnings for stacking
  if (loadedDinStacked >= STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING) {
    warnings.push(`ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${loadedDinStacked} gestapelte DIN)`);
  }
  if (loadedEupStacked >= STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING) {
    warnings.push(`ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${loadedEupStacked} gestapelte EUP)`);
  }

  // Build final pallet arrangement by unit
  const palletArrangement = units.map((unit: { id: string; length: number; width: number }) => ({
    unitId: unit.id,
    unitLength: unit.length,
    unitWidth: unit.width,
    pallets: palletsVisual.filter(p => p.unitId === unit.id),
  }));

  return {
    palletArrangement,
    loadedIndustrialPalletsBase: loadedDinBase,
    loadedEuroPalletsBase: loadedEupBase,
    totalDinPalletsVisual,
    totalEuroPalletsVisual,
    utilizationPercentage,
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: currentWeight,
    eupLoadingPatternUsed: currentEupLoadingPattern === 'auto' ? 'auto' : (currentEupLoadingPattern || 'none'),
  };
};
