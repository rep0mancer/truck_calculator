"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { WeightInputs } from '@/components/WeightInputs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

// Define the type for a single weight entry
type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
};

// ... (TRUCK_TYPES and PALLET_TYPES constants remain the same)
const TRUCK_TYPES = {
  roadTrain: {
    name: 'Hängerzug (2x 7,2m)',
    units: [
      { id: 'unit1', length: 720, width: 245, occupiedRects: [] },
      { id: 'unit2', length: 720, width: 245, occupiedRects: [] },
    ],
    axles: [
      [100, 600],
      [140, 520, 600, 680],
    ],
    totalLength: 1440,
    usableLength: 1440,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  curtainSider: {
    name: 'Planensattel Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    axles: [[750, 1050, 1130, 1210]],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  frigo: {
    name: 'Frigo (Kühler) Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    axles: [[750, 1050, 1130, 1210]],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 18300,
  },
  smallTruck: {
    name: 'Motorwagen (7.2m)',
    units: [{ id: 'main', length: 720, width: 245, occupiedRects: [] }],
    axles: [[100, 600]],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 10000,
  },
  Waggon: {
    name: 'Waggon POE',
    units: [{ id: 'main', length: 1370, width: 290, occupiedRects: [] }],
    axles: [[320, 860, 1280]],
    totalLength: 1370,
    usableLength: 1370,
    maxWidth: 290,
    maxDinPallets: 26,
    maxGrossWeightKg: 24000,
  },
  Waggon2: {
    name: 'Waggon KRM',
    units: [{ id: 'main', length: 1600, width: 290, occupiedRects: [] }],
    axles: [[360, 980, 1420]],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    maxDinPallets: 28,
    maxGrossWeightKg: 24000,
  },
};

const PALLET_TYPES = {
  euro: { name: 'Euro Palette (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700' },
  industrial: { name: 'Industrial Palette (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700' },
};


const MAX_GROSS_WEIGHT_KG = 24000;
const MAX_PALLET_SIMULATION_QUANTITY = 300;
const STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING = 18;
const STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING = 16;
const MAX_WEIGHT_PER_METER_KG = 1800;
type StackBand = 'front' | 'stack' | 'rear';
type StackingStrategy = 'axle_safe' | 'max_pairs';

const STACKING_RULES = {
  industrial: { slotLengthCm: 50, stackZoneSlots: 9, frontBufferSlots: 8 },
  euro: { slotLengthCm: 40, stackZoneSlots: 9, frontBufferSlots: 9 },
} as const;

const KILOGRAM_FORMATTER = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

const calculateWaggonEuroLayout = (
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

const calculateLoadingLogic = (
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
          activeEupPatternForRow = 'none';
        }
        if (activeEupPatternForRow === 'none') break; // No more EUPs fit
      }

      const palletDef = type === 'euro' ? PALLET_TYPES.euro : PALLET_TYPES.industrial;
      let palletLen: number, palletWid: number;
      if (type === 'euro') {
        palletLen = activeEupPatternForRow === 'long' ? palletDef.length : palletDef.width;
        palletWid = activeEupPatternForRow === 'long' ? palletDef.width : palletDef.length;
      } else {
        palletLen = palletDef.width;  // 100cm
        palletWid = palletDef.length; // 120cm
      }

      if (currentY + palletWid > unit.width) {
        currentX += currentRowHeight;
        currentY = 0;
        currentRowHeight = 0;
        continue; // Re-evaluate this same pallet in the new row
      }
      if (currentX + palletLen > unit.length) {
        break; // No more space in this unit
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

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupWeights, setEupWeights] = useState<WeightEntry[]>([{ id: Date.now(), weight: '', quantity: 0 }]);
  const [dinWeights, setDinWeights] = useState<WeightEntry[]>([{ id: Date.now() + 1, weight: '', quantity: 0 }]);
  const [eupLoadingPattern, setEupLoadingPattern] = useState('auto');
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);
  const [eupStackLimit, setEupStackLimit] = useState(0);
  const [dinStackLimit, setDinStackLimit] = useState(0);
  const [stackingStrategy, setStackingStrategy] = useState<StackingStrategy>('axle_safe');
  const [loadedEuroPalletsBase, setLoadedEuroPalletsBase] = useState(0);
  const [loadedIndustrialPalletsBase, setLoadedIndustrialPalletsBase] = useState(0);
  const [totalEuroPalletsVisual, setTotalEuroPalletsVisual] = useState(0);
  const [totalDinPalletsVisual, setTotalDinPalletsVisual] = useState(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [palletArrangement, setPalletArrangement] = useState([]);
  const [totalWeightKg, setTotalWeightKg] = useState(0);
  const [actualEupLoadingPattern, setActualEupLoadingPattern] = useState('auto');
  const [remainingCapacity, setRemainingCapacity] = useState<{ eup: number, din: number }>({ eup: 0, din: 0 });
  const [lastEdited, setLastEdited] = useState<'eup' | 'din'>('eup');
  const [showStackingInfo, setShowStackingInfo] = useState(false);
  const [skipStackingInfo, setSkipStackingInfo] = useState(false);
  const { toast } = useToast();
  const isWaggonSelected = ['Waggon', 'Waggon2'].includes(selectedTruck);
  const selectedTruckConfig = TRUCK_TYPES[selectedTruck as keyof typeof TRUCK_TYPES];
  const maxGrossWeightKg = selectedTruckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;

  useEffect(() => {
    const hasSeen = typeof window !== 'undefined' ? localStorage.getItem('hasSeenStackingInfo') : 'true';
    if (hasSeen) {
      setSkipStackingInfo(true);
      return;
    }
    setShowStackingInfo(true);
  }, []);

  const closeStackingInfo = () => {
    if (skipStackingInfo && typeof window !== 'undefined') {
      localStorage.setItem('hasSeenStackingInfo', 'true');
    }
    setShowStackingInfo(false);
  };

  const calculateAndSetState = useCallback(() => {
    const eupQuantity = eupWeights.reduce((sum, entry) => sum + entry.quantity, 0);
    const dinQuantity = dinWeights.reduce((sum, entry) => sum + entry.quantity, 0);

    const primaryResults = calculateLoadingLogic(
      selectedTruck as keyof typeof TRUCK_TYPES,
      eupWeights,
      dinWeights,
      isEUPStackable, isDINStackable,
      eupLoadingPattern as 'auto' | 'long' | 'broad',
      'DIN_FIRST',
      eupStackLimit,
    dinStackLimit,
    stackingStrategy
    );
    
    let multiTruckWarnings = [];
    
    if (dinQuantity > 0 && eupQuantity === 0) {
        const dinCapacityResult = calculateLoadingLogic(selectedTruck as keyof typeof TRUCK_TYPES, [], [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}], isEUPStackable, isDINStackable, eupLoadingPattern as 'auto' | 'long' | 'broad', 'DIN_FIRST', eupStackLimit, dinStackLimit, stackingStrategy);
        const maxDinCapacity = dinCapacityResult.totalDinPalletsVisual;

        if (maxDinCapacity > 0 && dinQuantity > maxDinCapacity) {
            const totalTrucks = Math.ceil(dinQuantity / maxDinCapacity);
            const fullTrucks = Math.floor(dinQuantity / maxDinCapacity);
            const remainingPallets = dinQuantity % maxDinCapacity;
            
            if (remainingPallets === 0) {
                multiTruckWarnings.push(`Für diesen Auftrag werden ${fullTrucks} volle LKWs benötigt.`);
            } else {
                multiTruckWarnings.push(`Benötigt ${totalTrucks} LKWs: ${fullTrucks} volle LKW(s) und 1 LKW mit ${remainingPallets} Paletten.`);
            }
        }
    } else if (eupQuantity > 0 && dinQuantity === 0) {
        const eupCapacityResult = calculateLoadingLogic(selectedTruck as keyof typeof TRUCK_TYPES, [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}], [], isEUPStackable, isDINStackable, eupLoadingPattern as 'auto' | 'long' | 'broad', 'EUP_FIRST', eupStackLimit, dinStackLimit, stackingStrategy);
        const maxEupCapacity = eupCapacityResult.totalEuroPalletsVisual;

        if (maxEupCapacity > 0 && eupQuantity > maxEupCapacity) {
            const totalTrucks = Math.ceil(eupQuantity / maxEupCapacity);
            const fullTrucks = Math.floor(eupQuantity / maxEupCapacity);
            const remainingPallets = eupQuantity % maxEupCapacity;
            
            if (remainingPallets === 0) {
                multiTruckWarnings.push(`Für diesen Auftrag werden ${fullTrucks} volle LKWs benötigt.`);
            } else {
                multiTruckWarnings.push(`Benötigt ${totalTrucks} LKWs: ${fullTrucks} volle LKW(s) und 1 LKW mit ${remainingPallets} Paletten.`);
            }
        }
    }
    
    setPalletArrangement(primaryResults.palletArrangement);
    setLoadedIndustrialPalletsBase(primaryResults.loadedIndustrialPalletsBase);
    setLoadedEuroPalletsBase(primaryResults.loadedEuroPalletsBase);
    setTotalDinPalletsVisual(primaryResults.totalDinPalletsVisual);
    setTotalEuroPalletsVisual(primaryResults.totalEuroPalletsVisual);
    setUtilizationPercentage(primaryResults.utilizationPercentage);
    setWarnings(Array.from(new Set([...primaryResults.warnings, ...multiTruckWarnings])));
    setTotalWeightKg(primaryResults.totalWeightKg);
    setActualEupLoadingPattern(primaryResults.eupLoadingPatternUsed);
    
    // Compute remaining capacity using simulation to account for repooling
    const truckConfig = TRUCK_TYPES[selectedTruck as keyof typeof TRUCK_TYPES];
    const weightLimit = truckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;
    const remainingWeightKg = Math.max(0, weightLimit - primaryResults.totalWeightKg);
    
    // For remaining EUP
    const weightToFillEup = eupWeights.length > 0 ? eupWeights[eupWeights.length - 1].weight || '0' : '0';
    const eupCapacityResult = calculateLoadingLogic(
      selectedTruck as keyof typeof TRUCK_TYPES,
      [{ id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFillEup }],
      dinWeights,
      isEUPStackable,
      isDINStackable,
      eupLoadingPattern as 'auto' | 'long' | 'broad',
      'DIN_FIRST',
      eupStackLimit,
    dinStackLimit,
    stackingStrategy
    );
    const maxEup = eupCapacityResult.totalEuroPalletsVisual;
    const remainingEup = Math.max(0, maxEup - eupQuantity);
    
    // For remaining DIN
    const weightToFillDin = dinWeights.length > 0 ? dinWeights[dinWeights.length - 1].weight || '0' : '0';
    const dinCapacityResult = calculateLoadingLogic(
      selectedTruck as keyof typeof TRUCK_TYPES,
      eupWeights,
      [{ id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFillDin }],
      isEUPStackable,
      isDINStackable,
      eupLoadingPattern as 'auto' | 'long' | 'broad',
      'EUP_FIRST',
      eupStackLimit,
    dinStackLimit,
    stackingStrategy
    );
    const maxDin = dinCapacityResult.totalDinPalletsVisual;
    const remainingDin = Math.max(0, maxDin - dinQuantity);
    
    setRemainingCapacity({ eup: remainingEup, din: remainingDin });
    
  }, [selectedTruck, eupWeights, dinWeights, isEUPStackable, isDINStackable, eupLoadingPattern, eupStackLimit, dinStackLimit, stackingStrategy]);

  useEffect(() => {
    calculateAndSetState();
  }, [calculateAndSetState]);

  const handleClearAllPallets = () => {
    setEupWeights([{ id: Date.now(), weight: '', quantity: 0 }]);
    setDinWeights([{ id: Date.now() + 1, weight: '', quantity: 0 }]);
    setIsEUPStackable(false);
    setIsDINStackable(false);
    setEupStackLimit(0);
    setDinStackLimit(0);
    setEupLoadingPattern('auto');
  };

  const handleMaximizePallets = (palletTypeToMax: 'euro' | 'industrial') => {
    const simResults = calculateLoadingLogic(
        selectedTruck as keyof typeof TRUCK_TYPES,
        palletTypeToMax === 'euro' ? [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}] : [],
        palletTypeToMax === 'industrial' ? [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}] : [],
        isEUPStackable, isDINStackable,
        'auto',
        palletTypeToMax === 'euro' ? 'EUP_FIRST' : 'DIN_FIRST',
      eupStackLimit, dinStackLimit, stackingStrategy
    );
    if (palletTypeToMax === 'industrial') {
        setDinWeights([{ id: Date.now(), weight: '', quantity: simResults.totalDinPalletsVisual }]);
        setEupWeights([{ id: Date.now() + 1, weight: '', quantity: 0 }]);
    } else if (palletTypeToMax === 'euro') {
        setEupWeights([{ id: Date.now(), weight: '', quantity: simResults.totalEuroPalletsVisual }]);
        setDinWeights([{ id: Date.now() + 1, weight: '', quantity: 0 }]);
    }
  };
 
  const handleFillRemaining = (typeToFill: 'euro' | 'industrial') => {
    const weightEntryToUse = typeToFill === 'euro' ? eupWeights[eupWeights.length - 1] : dinWeights[dinWeights.length - 1];
    const weightToFill = weightEntryToUse?.weight || '0';

    const eupSim = typeToFill === 'euro' 
        ? [...eupWeights, { id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFill }]
        : [...eupWeights];
    const dinSim = typeToFill === 'industrial'
        ? [...dinWeights, { id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFill }]
        : [...dinWeights];

    const order = typeToFill === 'euro' ? 'DIN_FIRST' : 'EUP_FIRST';

    const res = calculateLoadingLogic(
        selectedTruck as keyof typeof TRUCK_TYPES, eupSim, dinSim,
      isEUPStackable, isDINStackable, 'auto', order,
      eupStackLimit, dinStackLimit, stackingStrategy
    );

    const currentEups = eupWeights.reduce((s, e) => s + e.quantity, 0);
    const currentDins = dinWeights.reduce((s, e) => s + e.quantity, 0);

    const addedEups = res.totalEuroPalletsVisual - currentEups;
    const addedDins = res.totalDinPalletsVisual - currentDins;

    if (typeToFill === 'euro' && addedEups > 0) {
        setEupWeights(weights => {
            const newWeights = [...weights];
            const lastEntryIndex = newWeights.length - 1;
            // Create a new object for the last entry to avoid direct state mutation
            const updatedLastEntry = { 
                ...newWeights[lastEntryIndex], 
                quantity: newWeights[lastEntryIndex].quantity + addedEups 
            };
            newWeights[lastEntryIndex] = updatedLastEntry;
            return newWeights;
        });
    } else if (typeToFill === 'industrial' && addedDins > 0) {
        setDinWeights(weights => {
            const newWeights = [...weights];
            const lastEntryIndex = newWeights.length - 1;
            // Create a new object for the last entry to avoid direct state mutation
            const updatedLastEntry = { 
                ...newWeights[lastEntryIndex], 
                quantity: newWeights[lastEntryIndex].quantity + addedDins 
            };
            newWeights[lastEntryIndex] = updatedLastEntry;
            return newWeights;
        });
    }
    toast({ title: 'LKW aufgefüllt', description: `Freier Platz wurde mit ${typeToFill.toUpperCase()} Paletten gefüllt.` });
  };
 
  // ... (renderPallet function and style calculations remain the same)
  const palletVisualPalette: Record<string, {
    background: string;
    borderColor: string;
    textColor: string;
    highlightBorder: string;
    shadow: string;
  }> = {
    euro: {
      background: 'linear-gradient(135deg, hsla(217, 100%, 68%, 0.92), hsla(217, 98%, 56%, 0.98))',
      borderColor: 'hsla(218, 96%, 52%, 0.9)',
      textColor: 'rgba(15, 23, 42, 0.95)',
      highlightBorder: 'hsla(217, 96%, 80%, 0.65)',
      shadow: '0 16px 32px -22px rgba(37, 99, 235, 0.85)'
    },
    industrial: {
      background: 'linear-gradient(135deg, hsla(142, 82%, 64%, 0.88), hsla(142, 84%, 48%, 0.95))',
      borderColor: 'hsla(142, 78%, 42%, 0.88)',
      textColor: 'rgba(15, 23, 42, 0.9)',
      highlightBorder: 'hsla(142, 80%, 76%, 0.55)',
      shadow: '0 16px 32px -24px rgba(22, 163, 74, 0.75)'
    }
  };

  const CAPACITY_ACCENT_STYLES: Record<'DIN' | 'EUP', { color: string; textShadow: string }> = {
    DIN: { color: 'hsl(142, 78%, 38%)', textShadow: '0 1px 3px rgba(15, 23, 42, 0.4)' },
    EUP: { color: 'hsl(217, 96%, 52%)', textShadow: '0 1px 3px rgba(15, 23, 42, 0.35)' }
  };

  const renderPallet = (pallet: any, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) return null;
    const palette = palletVisualPalette[pallet.type] ?? palletVisualPalette.euro;
    const d = PALLET_TYPES[pallet.type];
    const w = pallet.height * displayScale; const h = pallet.width * displayScale;
    const x = pallet.y * displayScale; const y = pallet.x * displayScale;
    let txt = pallet.showAsFraction && pallet.displayStackedLabelId ? `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}` : `${pallet.labelId}`;
    if (pallet.labelId === 0) txt = "?";
    let title = `${d.name} #${pallet.labelId}`;
    if (pallet.showAsFraction) title = `${d.name} (Stapel: ${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId})`;
    if (pallet.isStackedTier === 'top') title += ' - Oben';
    if (pallet.isStackedTier === 'base') title += ' - Basis des Stapels';
    return (
      <div
        key={pallet.key}
        title={title}
        className="absolute border flex items-center justify-center rounded-sm"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${w}px`,
          height: `${h}px`,
          opacity: pallet.isStackedTier === 'top' ? 0.72 : 1,
          zIndex: pallet.isStackedTier === 'top' ? 10 : 5,
          fontSize: '10px',
          background: palette.background,
          borderColor: palette.borderColor,
          boxShadow: palette.shadow,
          color: palette.textColor,
          filter: 'saturate(1.3)'
        }}
      >
        <span
          className="font-semibold select-none"
          style={{
            color: palette.textColor,
            textShadow: '0 1px 3px rgba(15, 23, 42, 0.45)'
          }}
        >
          {txt}
        </span>
        {pallet.isStackedTier === 'top' && (
          <div
            className="absolute inset-0 pointer-events-none rounded-sm"
            style={{
              borderTop: `1.5px solid ${palette.highlightBorder}`,
              borderLeft: `1.5px solid ${palette.highlightBorder}`,
              borderRadius: '0.2rem'
            }}
          />
        )}
      </div>
    );
  };

  const getAxlePositions = (truckKey: keyof typeof TRUCK_TYPES, unitIndex: number) => {
    const truck = TRUCK_TYPES[truckKey];
    const axles = truck?.axles as number[][] | undefined;
    if (Array.isArray(axles)) {
      if (Array.isArray(axles[unitIndex])) {
        return axles[unitIndex];
      }
      if (Array.isArray(axles[0])) {
        return axles[0];
      }
    }
    return [] as number[];
  };

  const truckVisualizationScale = 0.35;

  const warningsWithoutInfo = warnings.filter(w => !w.toLowerCase().includes('platz') && !w.toLowerCase().includes('benötigt'));
  let meldungenStyle = {
    bg: 'bg-gray-50', border: 'border-gray-200',
    header: 'text-gray-800', list: 'text-gray-700'
  };

  if (warningsWithoutInfo.length === 0 && (totalDinPalletsVisual > 0 || totalEuroPalletsVisual > 0)) {
    meldungenStyle = { bg: 'bg-green-50', border: 'border-green-200', header: 'text-green-800', list: 'text-green-700' };
  } else if (warningsWithoutInfo.some(w => w.toLowerCase().includes('konnte nicht'))) {
    meldungenStyle = { bg: 'bg-red-50', border: 'border-red-200', header: 'text-red-800', list: 'text-red-700' };
  } else if (warningsWithoutInfo.length > 0) {
    meldungenStyle = { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'text-yellow-800', list: 'text-yellow-700' };
  }

  return (
    <div className="container mx-auto p-4 font-sans space-y-6">
      <header className="relative bg-gradient-to-r from-blue-700 to-blue-900 p-5 rounded-t-lg shadow-lg mb-6 text-slate-100">
        <div className="absolute top-2 right-4 text-right text-xs text-slate-100/80 drop-shadow">
          <p>Laderaumrechner © {new Date().getFullYear()}</p>
          <p>by Andreas Steiner</p>
        </div>
        <h1 className="text-3xl font-bold text-center tracking-tight drop-shadow-sm">Laderaumrechner</h1>
        <p className="text-center text-sm text-slate-100/90 drop-shadow">Visualisierung der Palettenplatzierung (Europäische Standards)</p>
      </header>
      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-semibold text-slate-800 mb-1 drop-shadow-sm">LKW-Typ:</label>
              <select
                id="truckType"
                value={selectedTruck} 
                onChange={e => {
                  const newTruck = e.target.value;
                  setSelectedTruck(newTruck);
                  if (['Waggon', 'Waggon2'].includes(newTruck)) {
                    setIsEUPStackable(false);
                    setIsDINStackable(false);
                  }
                }} 
                className="mt-1 block w-full py-2 px-3 text-sm font-medium focus:outline-none focus:ring-0 focus-visible:ring-0"
              >
                {Object.keys(TRUCK_TYPES).map(key=><option key={key} value={key}>{TRUCK_TYPES[key as keyof typeof TRUCK_TYPES].name}</option>)}
              </select>
            </div>
            <div className="pt-4">
              <button
                onClick={handleClearAllPallets}
                className="w-full py-2.5 px-4 font-semibold tracking-wide text-emerald-950/90 rounded-2xl"
              >
                Alles zurücksetzen
              </button>
            </div>
           
            <div className="border-t pt-4">
                <label className="block text-sm font-semibold text-slate-800 mb-2 drop-shadow-sm">Industriepaletten (DIN)</label>
                <WeightInputs entries={dinWeights} onChange={(entries)=>{ setLastEdited('din'); setDinWeights(entries); }} palletType="DIN" />
                <button onClick={() => handleMaximizePallets('industrial')} className="mt-2 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">Max. DIN</button>
                <button onClick={() => handleFillRemaining('industrial')} className="mt-1 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">Rest mit max. DIN füllen</button>
                <div className="flex items-center mt-2">
                    <input type="checkbox" id="dinStackable" checked={isDINStackable} onChange={e=>setIsDINStackable(e.target.checked)} disabled={isWaggonSelected} className="h-5 w-5 disabled:cursor-not-allowed"/>
                    <label htmlFor="dinStackable" className={`ml-2 text-sm text-slate-800 ${isWaggonSelected ? 'text-slate-400' : ''}`}>Stapelbar (2-fach)</label>
                </div>
                {isDINStackable && !isWaggonSelected && (
                    <input type="number" min="0" value={dinStackLimit} onChange={e=>setDinStackLimit(Math.max(0, parseInt(e.target.value,10)||0))} className="mt-1 block w-full py-1 px-2 sm:text-xs" placeholder="Stapelbare Paletten (0 = alle)"/>
                )}
            </div>

            <div className="border-t pt-4">
                <label className="block text-sm font-semibold text-slate-800 mb-2 drop-shadow-sm">Europaletten (EUP)</label>
                <WeightInputs entries={eupWeights} onChange={(entries)=>{ setLastEdited('eup'); setEupWeights(entries); }} palletType="EUP" />
                <button onClick={() => handleMaximizePallets('euro')} className="mt-2 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">Max. EUP</button>
                <button onClick={() => handleFillRemaining('euro')} className="mt-1 w-full py-1.5 px-3 text-xs font-semibold tracking-wide rounded-2xl">Rest mit max. EUP füllen</button>
                <div className="flex items-center mt-2">
                    <input type="checkbox" id="eupStackable" checked={isEUPStackable} onChange={e=>setIsEUPStackable(e.target.checked)} disabled={isWaggonSelected} className="h-5 w-5 disabled:cursor-not-allowed"/>
                    <label htmlFor="eupStackable" className={`ml-2 text-sm text-slate-800 ${isWaggonSelected ? 'text-slate-400' : ''}`}>Stapelbar (2-fach)</label>
                </div>
                {isEUPStackable && !isWaggonSelected && (
                    <input type="number" min="0" value={eupStackLimit} onChange={e=>setEupStackLimit(Math.max(0, parseInt(e.target.value,10)||0))} className="mt-1 block w-full py-1 px-2 sm:text-xs" placeholder="Stapelbare Paletten (0 = alle)"/>
                )}
            </div>

          <div className="border-t pt-4">
              <label className="block text-sm font-semibold text-slate-800 mb-1 drop-shadow-sm">Stacking-Modus</label>
              <p className="text-xs text-slate-600 mb-2">Steuert, ob gestapelte Paletten bevorzugt in der Achszone bleiben oder maximal ausgenutzt werden.</p>
              <div className="flex flex-col space-y-1">
                  <label className="flex items-start text-sm text-slate-800">
                      <input type="radio" name="stackingStrategy" value="axle_safe" checked={stackingStrategy==='axle_safe'} onChange={e=>setStackingStrategy(e.target.value as StackingStrategy)} className="h-5 w-5 mt-0.5"/>
                      <span className="ml-2">Achslast-optimiert (Stacks starten in der Mitte, Bodenplätze bleiben frei)</span>
                  </label>
                  <label className="flex items-start text-sm text-slate-800">
                      <input type="radio" name="stackingStrategy" value="max_pairs" checked={stackingStrategy==='max_pairs'} onChange={e=>setStackingStrategy(e.target.value as StackingStrategy)} className="h-5 w-5 mt-0.5"/>
                      <span className="ml-2">Maximale Stapelanzahl (klassische Variante, stapelt so früh wie möglich)</span>
                  </label>
              </div>
          </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                EUP Lade-Pattern:
                <span className="text-xs text-slate-600"> (Gewählt: {actualEupLoadingPattern === 'none' ? 'Keines' : actualEupLoadingPattern})</span>
              </label>
              <div className="flex flex-col space-y-1">
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="auto" checked={eupLoadingPattern==='auto'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-5 w-5"/><span className="ml-2 text-sm text-slate-800">Auto-Optimieren</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="long" checked={eupLoadingPattern==='long'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-5 w-5"/><span className="ml-2 text-sm text-slate-800">Längs (3 nebeneinander)</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="broad" checked={eupLoadingPattern==='broad'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-5 w-5"/><span className="ml-2 text-sm text-slate-800">Quer (2 nebeneinander)</span></label>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gray-100 p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center">
            <p className="text-slate-100 text-lg mb-4 font-semibold drop-shadow">Ladefläche Visualisierung</p>
            {palletArrangement.map((unit: any,index: number)=>{
              const axlePositions = getAxlePositions(selectedTruck as keyof typeof TRUCK_TYPES, index) || [];
              const axleWidth = unit.unitWidth * truckVisualizationScale * 0.7;
              const axleLeft = unit.unitWidth * truckVisualizationScale * 0.15;
              const axleThickness = 8;

              return (
                <div key={unit.unitId} className="mb-6 w-full flex flex-col items-center">
                  {TRUCK_TYPES[selectedTruck as keyof typeof TRUCK_TYPES].units.length>1&&<p className="text-sm text-slate-200 mb-2 drop-shadow-sm">Einheit {index+1} ({unit.unitLength/100}m x {unit.unitWidth/100}m)</p>}
                  {index === 0 && (
                    <svg
                      aria-hidden
                      role="presentation"
                      className="block"
                      width={unit.unitWidth*truckVisualizationScale}
                      height={24}
                      viewBox={`0 0 ${unit.unitWidth*truckVisualizationScale} 24`}
                    >
                      {/* Cab base */}
                      <rect
                        x="0"
                        y="6"
                        width={unit.unitWidth*truckVisualizationScale}
                        height="16"
                        rx="6"
                        fill="rgba(59,130,246,0.4)"
                        stroke="rgba(96,165,250,0.65)"
                      />
                      {/* Nose to indicate forward direction */}
                      <path
                        d={`M ${(unit.unitWidth*truckVisualizationScale)/2 - 12} 6 L ${(unit.unitWidth*truckVisualizationScale)/2} 0 L ${(unit.unitWidth*truckVisualizationScale)/2 + 12} 6 Z`}
                        fill="rgba(59,130,246,0.55)"
                      />
                      {/* Label */}
                      <text x={(unit.unitWidth*truckVisualizationScale)/2} y={20} textAnchor="middle" fontSize="10" fontWeight={700} fill="rgba(15,23,42,0.85)">Front</text>
                    </svg>
                  )}
                  <div
                    className="relative overflow-hidden rounded-2xl border border-white/40 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.55)]"
                    style={{
                      width:`${unit.unitWidth*truckVisualizationScale}px`,
                      height:`${unit.unitLength*truckVisualizationScale}px`,
                      background:'linear-gradient(160deg, rgba(148, 163, 184, 0.25), rgba(226, 232, 240, 0.18))',
                      backdropFilter:'blur(26px)',
                      WebkitBackdropFilter:'blur(26px)'
                    }}
                  >
                    <div className="absolute inset-0 pointer-events-none" aria-hidden>
                      {axlePositions.map((axlePos: number, axleIndex: number) => (
                        <div
                          key={`${unit.unitId}-axle-${axleIndex}`}
                          className="rounded-full"
                          style={{
                            position: 'absolute',
                            left: `${axleLeft}px`,
                            top: `${axlePos*truckVisualizationScale - axleThickness / 2}px`,
                            width: `${axleWidth}px`,
                            height: `${axleThickness}px`,
                            background: 'rgba(15,23,42,0.2)',
                            boxShadow: '0 20px 42px -30px rgba(15, 23, 42, 0.65)',
                            zIndex: 1,
                            border: '1px solid rgba(255,255,255,0.35)'
                          }}
                        />
                      ))}
                    </div>
                    {unit.pallets.map((p: any)=>renderPallet(p,truckVisualizationScale))}
                  </div>
                </div>
              );
            })}
             {palletArrangement.length === 0 && <p className="text-slate-200/80">Keine Paletten zum Anzeigen.</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
            <h3 className="font-semibold text-slate-900 mb-2 drop-shadow-sm">Geladene Paletten (Visuell)</h3>
            <p className="text-slate-900/85">Industrie (DIN): <span className="font-bold text-lg text-slate-900">{totalDinPalletsVisual}</span></p>
            <p className="text-slate-900/85">Euro (EUP): <span className="font-bold text-lg text-slate-900">{totalEuroPalletsVisual}</span></p>
            <p className="text-xs mt-1 text-slate-900/70">(Basis: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
            <h3 className="font-semibold text-slate-900 mb-2 drop-shadow-sm">Verbleibende Kapazität</h3>
            {(() => {
                const firstType: 'DIN' | 'EUP' = lastEdited === 'din' ? 'DIN' : 'EUP';
                const secondType: 'DIN' | 'EUP' = lastEdited === 'din' ? 'EUP' : 'DIN';
                const firstValue = lastEdited === 'din' ? remainingCapacity.din : remainingCapacity.eup;
                const secondValue = lastEdited === 'din' ? remainingCapacity.eup : remainingCapacity.din;
                const firstAccent = CAPACITY_ACCENT_STYLES[firstType];
                const secondAccent = CAPACITY_ACCENT_STYLES[secondType];
                return (
                  <>
                    <p className="font-bold text-2xl text-slate-900/90 drop-shadow-sm">Platz für:</p>
                    <p className="font-bold text-2xl text-slate-900/90 space-x-1">
                      <span style={firstAccent}>{firstValue}</span>
                      <span className="text-slate-900/80">weitere</span>
                      <span style={firstAccent}>{firstType}</span>
                      <span className="text-slate-900/80">{firstValue === 1 ? 'Palette' : 'Paletten'}</span>
                    </p>
                    <p className="text-slate-900/80">oder</p>
                    <p className="font-bold text-xl text-slate-900/85 space-x-1">
                      <span style={secondAccent}>{secondValue}</span>
                      <span className="text-slate-900/70">weitere</span>
                      <span style={secondAccent}>{secondType}</span>
                      <span className="text-slate-900/70">{secondValue === 1 ? 'Palette' : 'Paletten'}</span>
                    </p>
                  </>
                );
            })()}
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="font-semibold text-slate-900 mb-2 drop-shadow-sm">Geschätztes Gewicht</h3>
            <p className="font-bold text-2xl text-slate-900/90">
              {KILOGRAM_FORMATTER.format(totalWeightKg)} kg
            </p>
            <p className="text-xs mt-1 text-slate-900/70">
              (Max: {KILOGRAM_FORMATTER.format(maxGrossWeightKg)} kg)
            </p>
          </div>
          <div className={`${meldungenStyle.bg} p-4 rounded-lg border ${meldungenStyle.border} shadow-sm`}>
            <h3 className={`font-semibold mb-2 ${meldungenStyle.header} drop-shadow-sm`}>Meldungen</h3>
            {warnings.length > 0 ? (
                <ul className={`list-disc list-inside text-sm space-y-1 ${meldungenStyle.list}`}>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
            ) : (
                <p className={`text-sm ${meldungenStyle.list}`}>Keine Probleme erkannt.</p>
            )}
          </div>
        </div>
      </main>
      <footer className="text-center py-4 mt-8 text-sm text-slate-100/80 border-t border-gray-200">
        <p className="drop-shadow">Laderaumrechner © {new Date().getFullYear()} by Andreas Steiner</p>
      </footer>
      <Dialog
        open={showStackingInfo}
        onOpenChange={(open) => {
          if (!open) {
            closeStackingInfo();
            return;
          }
          setShowStackingInfo(true);
        }}
      >
        <DialogContent className="sm:max-w-lg bg-white/60 backdrop-blur-2xl border border-white/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Hinweis zur Lastverteilung</DialogTitle>
            <DialogDescription className="text-slate-800 leading-relaxed">
              Hinweis zur Lastverteilung: Aus Gründen der optimalen Achslastverteilung beginnt die Stapelung standardmäßig erst ab Stellplatz 9 (DIN) bzw. 10 (EUP). Eine durchgehende Stapelung erfolgt nur, wenn die Lademenge dies erfordert.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start space-x-3 py-2">
            <Checkbox
              id="stacking-info-ack"
              checked={skipStackingInfo}
              onCheckedChange={(value) => setSkipStackingInfo(Boolean(value))}
            />
            <label htmlFor="stacking-info-ack" className="text-sm text-slate-800 leading-snug">
              Ich habe verstanden, nicht mehr anzeigen
            </label>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="ghost" className="backdrop-blur-sm" onClick={closeStackingInfo}>
              Schließen
            </Button>
            <Button
              className="backdrop-blur-sm"
              onClick={() => {
                setSkipStackingInfo(true);
                closeStackingInfo();
              }}
            >
              Verstanden
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}
