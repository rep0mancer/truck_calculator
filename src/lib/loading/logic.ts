"use client";

// Define the type for a single weight entry
export type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
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
  let isEUPStackable = isWaggon ? false : currentIsEUPStackable;
  let isDINStackable = isWaggon ? false : currentIsDINStackable;

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
  const lengthLimitCm = truckConfig.usableLength ?? truckConfig.totalLength ?? 1320;

  // Helper to create individual pallets from user inputs
  let uniqueIdSeed = 1;
  const flattenToSingles = (entries: WeightEntry[], type: 'euro' | 'industrial') => {
    const result: Array<any> = [];
    for (const entry of entries) {
      const qty = Math.max(0, Number(entry.quantity) || 0);
      const parsedWeight = parseFloat(entry.weight as unknown as string) || 0;
      for (let i = 0; i < qty; i++) {
        result.push({ type, weight: parsedWeight, isStacked: false, id: uniqueIdSeed++, sourceId: entry.id });
      }
    }
    return result;
  };

  // Create base single lists
  const allEupSingles = flattenToSingles(eupWeights, 'euro');
  const allDinSingles = flattenToSingles(dinWeights, 'industrial');
  const requestedEupQuantity = allEupSingles.length;
  const requestedDinQuantity = allDinSingles.length;

  // Build stacked candidate pairs according to flags/limits
  let stackGroupSeed = 1;
  const buildStackedPairs = (
    singles: Array<any>,
    isStackable: boolean,
    limit: number | string | undefined,
    type: 'euro' | 'industrial',
    lengthLimitCm: number,
    stackingStrategy: StackingStrategy
  ) => {
    const working = singles.map(single => single);
    const numericLimit = (typeof limit === 'string' ? parseInt(limit, 10) : limit) || 0;

    if (!isStackable || working.length === 0) {
      return { pairs: [] as Array<any>, frontSingles: [] as Array<any>, tailSingles: working };
    }

    if (stackingStrategy === 'max_pairs') {
      const pairs: Array<any> = [];
      const remaining = [...working];
      const allowedStackableCount = numericLimit > 0 ? Math.min(numericLimit, remaining.length) : remaining.length;
      const pairCount = Math.floor(allowedStackableCount / 2);
      for (let i = 0; i < pairCount; i++) {
        const first = remaining.shift();
        const second = remaining.shift();
        if (!first || !second) break;
        const groupId = `grp_${type}_${stackGroupSeed++}`;
        first.isStacked = true;
        first.stackGroupId = groupId;
        second.isStacked = true;
        second.stackGroupId = groupId;
        pairs.push({
          type,
          weight: (first.weight || 0) + (second.weight || 0),
          isStacked: true,
          id: uniqueIdSeed++,
          pair: [first, second],
          stackGroupId: groupId,
        });
      }
      return { pairs, frontSingles: [] as Array<any>, tailSingles: remaining };
    }

    const stackingRule = STACKING_RULES[type];
    const slotLength = stackingRule.slotLengthCm;
    const baseCapacity = slotLength > 0 ? Math.floor(lengthLimitCm / slotLength) : 0;
    if (baseCapacity <= 0) {
      return { pairs: [] as Array<any>, frontSingles: [] as Array<any>, tailSingles: working };
    }

    const baseSingles = working.slice(0, baseCapacity);
    const overflowSingles = working.slice(baseCapacity);
    const frontSingles: Array<any> = [];
    const tailSingles: Array<any> = [];
    const pairs: Array<any> = [];

    const frontCount = Math.min(stackingRule.frontBufferSlots, baseSingles.length);
    const remainingAfterFront = Math.max(0, baseSingles.length - frontCount);
    const stackZoneCount = Math.min(stackingRule.stackZoneSlots, remainingAfterFront);
    type Zone = StackBand;
    const baseRecords = baseSingles.map((single, idx) => {
      let zone: Zone = 'rear';
      if (idx < frontCount) zone = 'front';
      else if (idx < frontCount + stackZoneCount) zone = 'stack';
      single.stackPlacementBand = zone;
      return { single, zone, paired: false };
    });

    const maxPairsByLimit =
      numericLimit > 0 ? Math.floor(Math.min(numericLimit, working.length) / 2) : Number.POSITIVE_INFINITY;
    const maxPairsByAvailability = Math.min(baseRecords.length, overflowSingles.length);
    const totalPairsAllowed = Math.min(maxPairsByLimit, maxPairsByAvailability);

    const stackPriorityRecords = [
      ...baseRecords.filter(r => r.zone === 'stack'),
      ...baseRecords.filter(r => r.zone === 'rear'),
      ...baseRecords.filter(r => r.zone === 'front'),
    ];

    let pairsFormed = 0;
    for (const record of stackPriorityRecords) {
      if (pairsFormed >= totalPairsAllowed) break;
      const top = overflowSingles.shift();
      if (!top) break;
      const base = record.single;
      const groupId = `grp_${type}_${stackGroupSeed++}`;
      base.isStacked = true;
      base.stackGroupId = groupId;
      top.isStacked = true;
      top.stackGroupId = groupId;
      top.stackPlacementBand = base.stackPlacementBand;
      pairs.push({
        type,
        weight: (base.weight || 0) + (top.weight || 0),
        isStacked: true,
        id: uniqueIdSeed++,
        pair: [base, top],
        stackGroupId: groupId,
      });
      record.paired = true;
      pairsFormed++;
    }

    for (const record of baseRecords) {
      if (record.paired) continue;
      if (record.zone === 'front') frontSingles.push(record.single);
      else tailSingles.push(record.single);
    }

    overflowSingles.forEach(single => {
      single.stackPlacementBand = 'rear';
      tailSingles.push(single);
    });

    return { pairs, frontSingles, tailSingles };
  };

    const dinStackBuild = buildStackedPairs(allDinSingles, isDINStackable, maxStackedDin, 'industrial', lengthLimitCm, stackingStrategy);
    const eupStackBuild = buildStackedPairs(allEupSingles, isEUPStackable, maxStackedEup, 'euro', lengthLimitCm, stackingStrategy);

    const stackedDinCandidates = dinStackBuild.pairs; // array of pair-candidates
    const stackedEupCandidates = eupStackBuild.pairs; // array of pair-candidates
    const dinFrontSingles = dinStackBuild.frontSingles;
    const dinTailSingles = dinStackBuild.tailSingles;
    const eupFrontSingles = eupStackBuild.frontSingles;
    const eupTailSingles = eupStackBuild.tailSingles;

  // STAGE 1: SELECTION - Determine Final Pallet Manifest by master priority
  let finalPalletManifest: Array<any> = [];
  let usedLoadingCm = 0;
  let currentWeight = 0;
  let finalActualDINBase = 0;
  let finalActualEUPBase = 0;
  const maxDinBase = typeof truckConfig.maxDinPallets === 'number' ? truckConfig.maxDinPallets : undefined;
  let usedDinBasePositions = 0;
  let warnings: string[] = [];

  if (isWaggon && (currentIsDINStackable || currentIsEUPStackable)) {
      warnings.push("Info: Stapeln ist auf dem Waggon nicht möglich und wurde deaktiviert.");
  }


  const lengthPerPosition = (type: 'euro' | 'industrial') => (type === 'euro' ? 40 : 50);
  const attemptAdd = (type: 'euro' | 'industrial', addWeight: number, singlesToAdd: Array<any>) => {
    const addLen = lengthPerPosition(type);
    const wouldUseCm = usedLoadingCm + addLen;
    const wouldWeigh = currentWeight + (addWeight || 0);
    if (wouldUseCm > lengthLimitCm) return false;
    if (weightLimit > 0 && wouldWeigh > weightLimit) {
      if (!warnings.some(w => w.includes('Gewichtslimit'))) warnings.push('Gewichtslimit erreicht.');
      return false;
    }
    if (type === 'industrial' && typeof maxDinBase === 'number' && usedDinBasePositions + 1 > maxDinBase) return false;
    // Accept
    finalPalletManifest.push(...singlesToAdd);
    usedLoadingCm = wouldUseCm;
    currentWeight = wouldWeigh;
    if (type === 'industrial') { usedDinBasePositions += 1; finalActualDINBase += 1; } else { finalActualEUPBase += 1; }
    return true;
  };

  // Master priority depending on placementOrder
  const selectionStop = { stopped: false };
  const tryPairs = (pairs: Array<any>, type: 'euro' | 'industrial') => {
    for (const pair of pairs) {
      if (selectionStop.stopped) break;
      const singles = pair.pair as Array<any>;
      const addWeight = pair.weight || singles.reduce((s, p) => s + (p.weight || 0), 0);
      const added = attemptAdd(type, addWeight, singles);
      if (!added) { selectionStop.stopped = true; break; }
    }
  };
  const trySingles = (singles: Array<any>, type: 'euro' | 'industrial') => {
    for (const single of singles) {
      if (selectionStop.stopped) break;
      const added = attemptAdd(type, single.weight || 0, [single]);
      if (!added) { selectionStop.stopped = true; break; }
    }
  };

    const processStackPlan = (build: { frontSingles: Array<any>; pairs: Array<any>; tailSingles: Array<any>; }, type: 'industrial' | 'euro') => {
      if (!selectionStop.stopped && build.frontSingles.length > 0) trySingles(build.frontSingles, type);
      if (!selectionStop.stopped && build.pairs.length > 0) tryPairs(build.pairs, type);
      if (!selectionStop.stopped && build.tailSingles.length > 0) trySingles(build.tailSingles, type);
    };

    if (placementOrder === 'DIN_FIRST') {
      processStackPlan({ frontSingles: dinFrontSingles, pairs: stackedDinCandidates, tailSingles: dinTailSingles }, 'industrial');
      if (!selectionStop.stopped) processStackPlan({ frontSingles: eupFrontSingles, pairs: stackedEupCandidates, tailSingles: eupTailSingles }, 'euro');
    } else {
      processStackPlan({ frontSingles: eupFrontSingles, pairs: stackedEupCandidates, tailSingles: eupTailSingles }, 'euro');
      if (!selectionStop.stopped) processStackPlan({ frontSingles: dinFrontSingles, pairs: stackedDinCandidates, tailSingles: dinTailSingles }, 'industrial');
    }

  // Leftover warning
  const totalDinRequested = requestedDinQuantity;
  const totalEupRequested = requestedEupQuantity;
  const totalDinLoaded = finalPalletManifest.filter(p => p.type === 'industrial').length;
  const totalEupLoaded = finalPalletManifest.filter(p => p.type === 'euro').length;
  const remainingDin = Math.max(0, totalDinRequested - totalDinLoaded);
  const remainingEup = Math.max(0, totalEupRequested - totalEupLoaded);
  const leftoverParts: string[] = [];
  if (remainingDin > 0) leftoverParts.push(`${remainingDin} DIN`);
  if (remainingEup > 0) leftoverParts.push(`${remainingEup} EUP`);
  if (leftoverParts.length > 0) warnings.push(`Konnte nicht alle Paletten laden. Übrig: ${leftoverParts.join(' und ')}.`);

  // Additional capacity warning for max DIN on wagons
  if (typeof maxDinBase === 'number' && totalDinRequested > maxDinBase && totalDinRequested !== MAX_PALLET_SIMULATION_QUANTITY) {
    warnings.push(`${truckConfig.name.trim()} maximale DIN-Kapazität ist ${maxDinBase}. Angeforderte Menge ${totalDinRequested}, es werden ${Math.min(maxDinBase, usedDinBasePositions)} platziert.`);
  }

  // STAGE 2: PLACEMENT - Arrange the Manifest for Visualization
    const getPlacementPriority = (pallet: any) => {
      const band = pallet.stackPlacementBand as StackBand | undefined;
      if (pallet.type === 'industrial') {
        if (band === 'front') return 1;
        if (band === 'stack') return 2;
        if (band === 'rear') return 3;
        return pallet.isStacked ? 2 : 3;
      }
      if (band === 'front') return 4;
      if (band === 'stack') return 5;
      if (band === 'rear') return 6;
      return pallet.isStacked ? 5 : 6;
    };
  finalPalletManifest.sort((a, b) => {
    const ap = getPlacementPriority(a);
    const bp = getPlacementPriority(b);
    if (ap !== bp) return ap - bp;
    // Keep stack pairs together and stable order otherwise
    if (a.stackGroupId && b.stackGroupId) return String(a.stackGroupId).localeCompare(String(b.stackGroupId));
    return 0;
  });

  // STAGE 2: PLACEMENT (This is the new, correct implementation)
  const unitsState = truckConfig.units.map((u: any) => ({ ...u, palletsVisual: [] as any[] }));
  let placementQueue = [...finalPalletManifest];
  let dinLabelCounter = 0;
  let eupLabelCounter = 0;
  let placedDinBaseIndex = 0;
  let placedEupBaseIndex = 0;
  let totalAreaBase = 0;
  for (const unit of unitsState) {
    if (placementQueue.length === 0) break;
    let currentX = 0;
    let currentY = 0;
    let currentRowHeight = 0;
    let activeEupPatternForRow = currentEupLoadingPattern;
    // Use a traditional for loop for stability, as we manually advance the index
    for (let i = 0; i < placementQueue.length; /* no increment */) {
      const palletToPlace = placementQueue[i];
      const { type, isStacked } = palletToPlace;
      if (currentY === 0 && type === 'euro' && currentEupLoadingPattern === 'auto') {
        const remainingLength = unit.length - currentX;
        // Count consecutive euro bases ahead
        let countBases = 0;
        let j = i;
        while (j < placementQueue.length) {
          if (placementQueue[j].type !== 'euro') break;
          if (placementQueue[j].isStacked) {
            countBases++;
            j += 2;
          } else {
            countBases++;
            j++;
          }
        }
        if (countBases >= 3 && remainingLength >= PALLET_TYPES.euro.length) {
          activeEupPatternForRow = 'long';
        } else if (countBases >= 2 && remainingLength >= PALLET_TYPES.euro.width) {
          activeEupPatternForRow = 'broad';
        } else if (countBases >= 1 && remainingLength >= PALLET_TYPES.euro.width) {
          activeEupPatternForRow = 'broad';
        } else {
          activeEupPatternForRow = 'long';
        }
      }

      const palletDef = type === 'euro' ? PALLET_TYPES.euro : PALLET_TYPES.industrial;
      const palletLen = activeEupPatternForRow === 'broad' && type === 'euro' ? palletDef.width : palletDef.length;
      const palletWid = activeEupPatternForRow === 'broad' && type === 'euro' ? palletDef.length : palletDef.width;

      // Line wrap
      if (currentY + palletWid > unit.width) {
        currentX += currentRowHeight;
        currentY = 0;
        currentRowHeight = 0;
        if (type === 'euro' && currentEupLoadingPattern === 'auto') {
          activeEupPatternForRow = activeEupPatternForRow === 'long' ? 'broad' : 'long';
        }
        continue;
      }

      // Place the Pallet(s)
      const itemsInThisPosition = isStacked ? [placementQueue[i], placementQueue[i + 1]] : [placementQueue[i]];

      // Create visual(s)
      const nextLabelId = type === 'euro' ? (++eupLabelCounter) : (++dinLabelCounter);
      const baseKeySuffix = type === 'euro' ? placedEupBaseIndex : placedDinBaseIndex;
      const baseVisual: any = {
        x: currentX, y: currentY, width: palletLen, height: palletWid,
        type, isStackedTier: null, unitId: unit.id,
        labelId: nextLabelId, displayBaseLabelId: nextLabelId, displayStackedLabelId: null,
        showAsFraction: false, key: `${type}_${baseKeySuffix}`
      };

      totalAreaBase += (type === 'euro' ? PALLET_TYPES.euro.area : PALLET_TYPES.industrial.area);

      if (isStacked) {
        baseVisual.isStackedTier = 'base';
        baseVisual.showAsFraction = true;
        const stackedLabelId = type === 'euro' ? (++eupLabelCounter) : (++dinLabelCounter);
        baseVisual.displayStackedLabelId = stackedLabelId;
        unit.palletsVisual.push(baseVisual);
        const topVisual = { ...baseVisual, isStackedTier: 'top', labelId: stackedLabelId, key: `${baseVisual.key}_stack` };
        unit.palletsVisual.push(topVisual);
      } else {
        unit.palletsVisual.push(baseVisual);
      }

      if (type === 'euro') placedEupBaseIndex++; else placedDinBaseIndex++;

      // Update cursors for the next pallet in the row
      currentY += palletWid;
      currentRowHeight = Math.max(currentRowHeight, palletLen);
      i += itemsInThisPosition.length; // Advance index by 1 for singles, 2 for stacked
    }
    // Remove the placed pallets from the main queue
    placementQueue.splice(0, unit.palletsVisual.length);
  }

  // Compute metrics for return
  const totalVisual = unitsState.flatMap((u: any) => u.palletsVisual).length;
  const totalDinPalletsVisual = unitsState.flatMap((u: any) => u.palletsVisual).filter((p: any) => p.type === 'industrial').length;
  const totalEuroPalletsVisual = unitsState.flatMap((u: any) => u.palletsVisual).filter((p: any) => p.type === 'euro').length;
  const palletArrangement = unitsState.map((u: any) => ({ unitId: u.id, unitLength: u.length, unitWidth: u.width, pallets: u.palletsVisual }));

  // Utilization and weight-derived warnings
  const totalPracticalArea = (truckConfig.usableLength || 0) * (truckConfig.maxWidth || 0);
  const util = totalPracticalArea > 0 ? (totalAreaBase / totalPracticalArea) * 100 : 0;
  const utilizationPercentage = parseFloat(util.toFixed(1));
  const usedLength = (truckConfig.maxWidth || 0) > 0 ? (totalAreaBase / (truckConfig.maxWidth || 1)) : 0;
  if (usedLength > 0) {
    const weightPerMeter = currentWeight / (usedLength / 100);
    if (weightPerMeter >= MAX_WEIGHT_PER_METER_KG) warnings.push(`ACHTUNG – mögliche Achslastüberschreitung: ${weightPerMeter.toFixed(1)} kg/m`);
  }
  if ((truckConfig.usableLength || 0) > 0) {
    const usedLengthPercentage = (usedLength / (truckConfig.usableLength || 1)) * 100;
    if (currentWeight >= 10500 && usedLengthPercentage <= 40) warnings.push('ACHTUNG – mehr als 10.5t auf weniger als 40% der Ladefläche');
  }
  const stackedDinPallets = totalDinPalletsVisual - placedDinBaseIndex;
  const stackedEupPallets = totalEuroPalletsVisual - placedEupBaseIndex;
  if (stackedDinPallets >= STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING) warnings.push(`ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${stackedDinPallets} gestapelte DIN)`);
  if (stackedEupPallets >= STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING) warnings.push(`ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${stackedEupPallets} gestapelte EUP)`);

  return {
    palletArrangement,
    loadedIndustrialPalletsBase: placedDinBaseIndex,
    loadedEuroPalletsBase: placedEupBaseIndex,
    totalDinPalletsVisual,
    totalEuroPalletsVisual,
    utilizationPercentage,
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: currentWeight,
    eupLoadingPatternUsed: currentEupLoadingPattern === 'auto' ? 'auto' : (currentEupLoadingPattern || 'none'),
  };
};
