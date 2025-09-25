
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { WeightInputs } from '@/components/WeightInputs';

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
    name: 'Waggon Hbbils (15,2m)',
    units: [{ id: 'main', length: 1520, width: 290, occupiedRects: [] }],
    totalLength: 1520,
    usableLength: 1520,
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

const PALLET_TYPES = {
  euro: { name: 'Euro Palette (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700' },
  industrial: { name: 'Industrial Palette (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700' },
};


const MAX_GROSS_WEIGHT_KG = 24000;
const MAX_PALLET_SIMULATION_QUANTITY = 300;
const STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING = 18;
const STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING = 16;
const MAX_WEIGHT_PER_METER_KG = 1800;

const calculateLoadingLogic = (
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  currentIsEUPStackable: boolean,
  currentIsDINStackable: boolean,
  currentEupLoadingPattern: 'auto' | 'long' | 'broad',
  placementOrder: 'DIN_FIRST' | 'EUP_FIRST' = 'DIN_FIRST',
  maxStackedEup?: number | string,
  maxStackedDin?: number | string
) => {
  const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const weightLimit = truckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;
  const lengthLimitMeters = (truckConfig.usableLength ?? truckConfig.totalLength ?? 1320) / 100;

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
    type: 'euro' | 'industrial'
  ) => {
    const pairs: Array<any> = [];
    if (!isStackable) return { pairs, remaining: [...singles] };
    const numericLimit = (typeof limit === 'string' ? parseInt(limit, 10) : limit) || 0; // 0 means unlimited
    const allowedStackableCount = numericLimit > 0 ? Math.min(numericLimit, singles.length) : singles.length;
    const pairCount = Math.floor(allowedStackableCount / 2);
    const working = [...singles];
    for (let i = 0; i < pairCount; i++) {
      const first = working.shift();
      const second = working.shift();
      if (!first || !second) break;
      const groupId = `grp_${type}_${stackGroupSeed++}`;
      first.isStacked = true; first.stackGroupId = groupId;
      second.isStacked = true; second.stackGroupId = groupId;
      pairs.push({ type, weight: (first.weight || 0) + (second.weight || 0), isStacked: true, id: uniqueIdSeed++, pair: [first, second], stackGroupId: groupId });
    }
    return { pairs, remaining: working };
  };

  const dinStackBuild = buildStackedPairs(allDinSingles, currentIsDINStackable, maxStackedDin, 'industrial');
  const eupStackBuild = buildStackedPairs(allEupSingles, currentIsEUPStackable, maxStackedEup, 'euro');

  const stackedDinCandidates = dinStackBuild.pairs; // array of pair-candidates
  const stackedEupCandidates = eupStackBuild.pairs; // array of pair-candidates
  const dinSingleCandidates = dinStackBuild.remaining; // singles not used in stacks
  const eupSingleCandidates = eupStackBuild.remaining; // singles not used in stacks

  // STAGE 1: SELECTION - Determine Final Pallet Manifest by master priority
  let finalPalletManifest: Array<any> = [];
  let usedLoadingMeters = 0;
  let currentWeight = 0;
  let finalActualDINBase = 0;
  let finalActualEUPBase = 0;
  const maxDinBase = typeof truckConfig.maxDinPallets === 'number' ? truckConfig.maxDinPallets : undefined;
  let usedDinBasePositions = 0;
  let warnings: string[] = [];

  const lengthPerPosition = (type: 'euro' | 'industrial') => (type === 'euro' ? 0.4 : 0.5);
  const attemptAdd = (type: 'euro' | 'industrial', addWeight: number, singlesToAdd: Array<any>) => {
    const addLen = lengthPerPosition(type);
    const wouldUseMeters = usedLoadingMeters + addLen;
    const wouldWeigh = currentWeight + (addWeight || 0);
    if (wouldUseMeters - 1e-9 > lengthLimitMeters) return false;
    if (weightLimit > 0 && wouldWeigh > weightLimit) {
      if (!warnings.some(w => w.includes('Gewichtslimit'))) warnings.push('Gewichtslimit erreicht.');
      return false;
    }
    if (type === 'industrial' && typeof maxDinBase === 'number' && usedDinBasePositions + 1 > maxDinBase) return false;
    // Accept
    finalPalletManifest.push(...singlesToAdd);
    usedLoadingMeters = wouldUseMeters;
    currentWeight = wouldWeigh;
    if (type === 'industrial') { usedDinBasePositions += 1; finalActualDINBase += 1; } else { finalActualEUPBase += 1; }
    return true;
  };

  // Master priority: Stacked DINs -> Stacked EUPs -> DINs -> EUPs
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

  tryPairs(stackedDinCandidates, 'industrial');
  tryPairs(stackedEupCandidates, 'euro');
  if (!selectionStop.stopped) trySingles(dinSingleCandidates, 'industrial');
  if (!selectionStop.stopped) trySingles(eupSingleCandidates, 'euro');

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

  // STAGE 2: PLACEMENT - Arrange for visualization
  const getPlacementPriority = (pallet: any) => {
    if (pallet.isStacked && pallet.type === 'euro') return 1;
    if (pallet.isStacked && pallet.type === 'industrial') return 2;
    if (!pallet.isStacked && pallet.type === 'industrial') return 3;
    if (!pallet.isStacked && pallet.type === 'euro') return 4;
    return 5;
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
    let activeEupPatternForRow: 'auto' | 'long' | 'broad' = currentEupLoadingPattern;
    // Use a traditional for loop for stability, as we manually advance the index
    for (let i = 0; i < placementQueue.length; /* no increment */) {
      const palletToPlace = placementQueue[i];
      const { type, isStacked } = palletToPlace;

      // --- Dynamic EUP Pattern Logic at the start of a new row ---
      if (currentY === 0 && type === 'euro' && currentEupLoadingPattern === 'auto') {
        const remainingLength = unit.length - currentX;
        activeEupPatternForRow = (remainingLength >= PALLET_TYPES.euro.length) ? 'long' : (remainingLength >= PALLET_TYPES.euro.width ? 'broad' : 'none');
        if (activeEupPatternForRow === 'none') break; // No more EUP rows fit in this unit
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

      // --- Boundary Checks ---
      if (currentY + palletWid > unit.width) {
        currentX += currentRowHeight;
        currentY = 0;
        currentRowHeight = 0;
        continue; // Re-evaluate this same pallet in the new row
      }
      if (currentX + palletLen > unit.length) {
        break; // No more space in this unit
      }

      // Safety check for stacked pairs
      let itemsInThisPosition: any[] = [palletToPlace];
      if (isStacked) {
        if (i + 1 >= placementQueue.length) {
          i++;
          continue;
        }
        if (placementQueue[i + 1].stackGroupId !== palletToPlace.stackGroupId) {
          i++;
          continue;
        }
        itemsInThisPosition = [placementQueue[i], placementQueue[i + 1]];
      }

      // --- Place the Pallet(s) ---
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

  if (placementQueue.length > 0) {
    warnings.push(`Konnte nicht alle ausgewählten Paletten platzieren. Übrig: ${placementQueue.length}`);
  }

  // Compute metrics for return
  const palletArrangement = unitsState.map((u: any) => ({ unitId: u.id, unitLength: u.length, unitWidth: u.width, pallets: u.palletsVisual }));
  const totalDinPalletsVisual = unitsState.flatMap((u: any) => u.palletsVisual).filter((p: any) => p.type === 'industrial').length;
  const totalEuroPalletsVisual = unitsState.flatMap((u: any) => u.palletsVisual).filter((p: any) => p.type === 'euro').length;
  const loadedIndustrialPalletsBase = unitsState.flatMap((u: any) => u.palletsVisual).filter((p: any) => p.type === 'industrial' && p.isStackedTier !== 'top').length;
  const loadedEuroPalletsBase = unitsState.flatMap((u: any) => u.palletsVisual).filter((p: any) => p.type === 'euro' && p.isStackedTier !== 'top').length;

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
  const stackedDinPallets = totalDinPalletsVisual - loadedIndustrialPalletsBase;
  const stackedEupPallets = totalEuroPalletsVisual - loadedEuroPalletsBase;
  if (stackedDinPallets >= STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING) warnings.push(`ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${stackedDinPallets} gestapelte DIN)`);
  if (stackedEupPallets >= STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING) warnings.push(`ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${stackedEupPallets} gestapelte EUP)`);

  return {
    palletArrangement,
    loadedIndustrialPalletsBase,
    loadedEuroPalletsBase,
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

  const { toast } = useToast();

  const calculateAndSetState = useCallback(() => {
    const eupQuantity = eupWeights.reduce((sum, entry) => sum + entry.quantity, 0);
    const dinQuantity = dinWeights.reduce((sum, entry) => sum + entry.quantity, 0);

    const primaryResults = calculateLoadingLogic(
      selectedTruck,
      eupWeights,
      dinWeights,
      isEUPStackable, isDINStackable,
      eupLoadingPattern,
      'DIN_FIRST',
      eupStackLimit,
      dinStackLimit
    );
    
    let multiTruckWarnings = [];
    
    if (dinQuantity > 0 && eupQuantity === 0) {
        const dinCapacityResult = calculateLoadingLogic(selectedTruck, [], [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}], isEUPStackable, isDINStackable, eupLoadingPattern, 'DIN_FIRST', eupStackLimit, dinStackLimit);
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
        const eupCapacityResult = calculateLoadingLogic(selectedTruck, [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}], [], isEUPStackable, isDINStackable, eupLoadingPattern, 'EUP_FIRST', eupStackLimit, dinStackLimit);
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
    
    // Compute remaining capacity using specified length-per-pallet model based on entered counts and stacking limits
    const usableLengthM = (TRUCK_TYPES[selectedTruck].usableLength || 0) / 100;
    const getFloorPositions = (totalCount: number, isStackableFlag: boolean, stackableLimit: number): number => {
      if (!isStackableFlag) return totalCount;
      const limit = typeof stackableLimit === 'number' ? stackableLimit : 0;
      const actualStackableCount = limit > 0 ? Math.min(totalCount, limit) : totalCount;
      const nonStackableCount = totalCount - actualStackableCount;
      const stackablePositions = Math.ceil(actualStackableCount / 2);
      const nonStackablePositions = nonStackableCount;
      return stackablePositions + nonStackablePositions;
    };
    const eupFloorPositions = getFloorPositions(eupQuantity, isEUPStackable, eupStackLimit);
    const dinFloorPositions = getFloorPositions(dinQuantity, isDINStackable, dinStackLimit);
    const usedLengthM = (eupFloorPositions * 0.4) + (dinFloorPositions * 0.5);
    const remainingLengthM = Math.max(0, usableLengthM - usedLengthM);
    const safeFloor = (n: number) => Math.floor(n + 1e-9);
    const availableDinPositions = Math.max(0, safeFloor(remainingLengthM / 0.5));
    const availableEupPositions = Math.max(0, safeFloor(remainingLengthM / 0.4));
    const remainingDin = isDINStackable ? availableDinPositions * 2 : availableDinPositions;
    const remainingEup = isEUPStackable ? availableEupPositions * 2 : availableEupPositions;
    setRemainingCapacity({ eup: remainingEup, din: remainingDin });
    
  }, [selectedTruck, eupWeights, dinWeights, isEUPStackable, isDINStackable, eupLoadingPattern, eupStackLimit, dinStackLimit]);


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

  const handleMaximizePallets = (palletTypeToMax) => {
    const simResults = calculateLoadingLogic(
        selectedTruck,
        palletTypeToMax === 'euro' ? [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}] : [],
        palletTypeToMax === 'industrial' ? [{id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0'}] : [],
        isEUPStackable, isDINStackable,
        'auto',
        palletTypeToMax === 'euro' ? 'EUP_FIRST' : 'DIN_FIRST',
        eupStackLimit, dinStackLimit
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

      const res = calculateLoadingLogic(
          selectedTruck, eupSim, dinSim,
          isEUPStackable, isDINStackable, 'auto', 'DIN_FIRST',
          eupStackLimit, dinStackLimit
      );

      const currentEups = eupWeights.reduce((s, e) => s + e.quantity, 0);
      const currentDins = dinWeights.reduce((s, e) => s + e.quantity, 0);

      const addedEups = res.totalEuroPalletsVisual - currentEups;
      const addedDins = res.totalDinPalletsVisual - currentDins;

      if (typeToFill === 'euro' && addedEups > 0) {
          setEupWeights(weights => {
              const newWeights = [...weights];
              const lastEntry = newWeights[newWeights.length - 1];
              lastEntry.quantity += addedEups;
              return newWeights;
          });
      } else if (typeToFill === 'industrial' && addedDins > 0) {
          setDinWeights(weights => {
              const newWeights = [...weights];
              const lastEntry = newWeights[newWeights.length - 1];
              lastEntry.quantity += addedDins;
              return newWeights;
          });
      }
      toast({ title: 'LKW aufgefüllt', description: `Freier Platz wurde mit ${typeToFill.toUpperCase()} Paletten gefüllt.` });
  };
  
  // ... (renderPallet function and style calculations remain the same)
  const renderPallet = (pallet, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) return null;
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
      <div key={pallet.key} title={title}
        className={`absolute ${d.color} ${d.borderColor} border flex items-center justify-center rounded-sm shadow-sm`}
        style={{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, opacity: pallet.isStackedTier==='top'?0.7:1, zIndex: pallet.isStackedTier==='top'?10:5,fontSize:'10px' }}>
        <span className="text-black font-semibold select-none">{txt}</span>
        {pallet.isStackedTier==='top'&&<div className="absolute top-0 left-0 w-full h-full border-t-2 border-l-2 border-black opacity-30 pointer-events-none rounded-sm"/>}
      </div>
    );
  };

  const truckVisualizationScale = 0.3;

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
    <div className="container mx-auto p-4 font-sans bg-gray-50">
      <header className="relative bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-t-lg shadow-lg mb-6">
        <div className="absolute top-2 right-4 text-right text-xs opacity-75">
          <p>Laderaumrechner © {new Date().getFullYear()}</p>
          <p>by Andreas Steiner</p>
        </div>
        <h1 className="text-3xl font-bold text-center tracking-tight">Laderaumrechner</h1>
        <p className="text-center text-sm opacity-90">Visualisierung der Palettenplatzierung (Europäische Standards)</p>
      </header>
      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">LKW-Typ:</label>
              <select id="truckType" value={selectedTruck} onChange={e=>{setSelectedTruck(e.target.value);}} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {Object.keys(TRUCK_TYPES).map(key=><option key={key} value={key}>{TRUCK_TYPES[key].name}</option>)}
              </select>
            </div>
            <div className="pt-4">
              <button onClick={handleClearAllPallets} className="w-full py-2 px-4 bg-[#00906c] text-white font-semibold rounded-md shadow-sm hover:bg-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50 transition duration-150 ease-in-out">Alles zurücksetzen</button>
            </div>
            
            <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Industriepaletten (DIN)</label>
                <WeightInputs entries={dinWeights} onChange={(entries)=>{ setLastEdited('din'); setDinWeights(entries); }} palletType="DIN" />
                <button onClick={() => handleMaximizePallets('industrial')} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50">Max. DIN</button>
                <button onClick={() => handleFillRemaining('industrial')} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50">Rest mit max. DIN füllen</button>
                <div className="flex items-center mt-2">
                    <input type="checkbox" id="dinStackable" checked={isDINStackable} onChange={e=>setIsDINStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                    <label htmlFor="dinStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
                </div>
                {isDINStackable && (
                    <input type="number" min="0" value={dinStackLimit} onChange={e=>setDinStackLimit(Math.max(0, parseInt(e.target.value,10)||0))} className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" placeholder="Stapelbare Paletten (0 = alle)"/>
                )}
            </div>

            <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Europaletten (EUP)</label>
                <WeightInputs entries={eupWeights} onChange={(entries)=>{ setLastEdited('eup'); setEupWeights(entries); }} palletType="EUP" />
                <button onClick={() => handleMaximizePallets('euro')} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50">Max. EUP</button>
                <button onClick={() => handleFillRemaining('euro')} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50">Rest mit max. EUP füllen</button>
                <div className="flex items-center mt-2">
                    <input type="checkbox" id="eupStackable" checked={isEUPStackable} onChange={e=>setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                    <label htmlFor="eupStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
                </div>
                {isEUPStackable && (
                    <input type="number" min="0" value={eupStackLimit} onChange={e=>setEupStackLimit(Math.max(0, parseInt(e.target.value,10)||0))} className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" placeholder="Stapelbare Paletten (0 = alle)"/>
                )}
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">EUP Lade-Pattern:
                <span className="text-xs text-gray-500"> (Gewählt: {actualEupLoadingPattern === 'none' ? 'Keines' : actualEupLoadingPattern})</span>
              </label>
              <div className="flex flex-col space-y-1">
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="auto" checked={eupLoadingPattern==='auto'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/><span className="ml-2 text-sm text-gray-700">Auto-Optimieren</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="long" checked={eupLoadingPattern==='long'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/><span className="ml-2 text-sm text-gray-700">Längs (3 nebeneinander)</span></label>
                <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="broad" checked={eupLoadingPattern==='broad'} onChange={e=>setEupLoadingPattern(e.target.value)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/><span className="ml-2 text-sm text-gray-700">Quer (2 nebeneinander)</span></label>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gray-100 p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-4 font-semibold">Ladefläche Visualisierung</p>
            {palletArrangement.map((unit,index)=>(
              <div key={unit.unitId} className="mb-6 w-full flex flex-col items-center">
                {TRUCK_TYPES[selectedTruck].units.length>1&&<p className="text-sm text-gray-700 mb-2">Einheit {index+1} ({unit.unitLength/100}m x {unit.unitWidth/100}m)</p>}
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
                    <rect x="0" y="6" width={unit.unitWidth*truckVisualizationScale} height="16" rx="6" fill="#93c5fd" stroke="#60a5fa" />
                    {/* Nose to indicate forward direction */}
                    <path d={`M ${(unit.unitWidth*truckVisualizationScale)/2 - 12} 6 L ${(unit.unitWidth*truckVisualizationScale)/2} 0 L ${(unit.unitWidth*truckVisualizationScale)/2 + 12} 6 Z`} fill="#60a5fa" />
                    {/* Label */}
                    <text x={(unit.unitWidth*truckVisualizationScale)/2} y={20} textAnchor="middle" fontSize="10" fontWeight={700} fill="#1f2937">Front</text>
                  </svg>
                )}
                <div className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner" style={{width:`${unit.unitWidth*truckVisualizationScale}px`,height:`${unit.unitLength*truckVisualizationScale}px`}}>
                  {unit.pallets.map(p=>renderPallet(p,truckVisualizationScale))}
                </div>
              </div>
            ))}
             {palletArrangement.length === 0 && <p className="text-gray-500">Keine Paletten zum Anzeigen.</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
            <h3 className="font-semibold text-blue-800 mb-2">Geladene Paletten (Visuell)</h3>
            <p>Industrie (DIN): <span className="font-bold text-lg">{totalDinPalletsVisual}</span></p>
            <p>Euro (EUP): <span className="font-bold text-lg">{totalEuroPalletsVisual}</span></p>
            <p className="text-xs mt-1">(Basis: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
            <h3 className="font-semibold text-green-800 mb-2">Verbleibende Kapazität</h3>
            {(() => {
              const firstType = lastEdited === 'din' ? 'DIN' : 'EUP';
              const secondType = lastEdited === 'din' ? 'EUP' : 'DIN';
              const firstValue = lastEdited === 'din' ? remainingCapacity.din : remainingCapacity.eup;
              const secondValue = lastEdited === 'din' ? remainingCapacity.eup : remainingCapacity.din;
              return (
                <>
                  <p className="font-bold text-2xl text-green-700">Platz für:</p>
                  <p className="font-bold text-2xl text-green-700">
                    {firstValue} weitere {firstType} {firstValue === 1 ? 'Palette' : 'Paletten'}
                  </p>
                  <p className="text-green-700">oder</p>
                  <p className="font-bold text-xl text-green-700">
                    {secondValue} weitere {secondType} {secondValue === 1 ? 'Palette' : 'Paletten'}
                  </p>
                </>
              );
            })()}
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="font-semibold text-yellow-800 mb-2">Geschätztes Gewicht</h3>
            <p className="font-bold text-2xl text-yellow-700">{(totalWeightKg/1000).toFixed(1)} t</p>
            <p className="text-xs mt-1">(Max: {(TRUCK_TYPES[selectedTruck].maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG)/1000}t)</p>
          </div>
          <div className={`${meldungenStyle.bg} p-4 rounded-lg border ${meldungenStyle.border} shadow-sm`}>
            <h3 className={`font-semibold mb-2 ${meldungenStyle.header}`}>Meldungen</h3>
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
      <footer className="text-center py-4 mt-8 text-sm text-gray-500 border-t border-gray-200">
        <p>Laderaumrechner © {new Date().getFullYear()} by Andreas Steiner</p>
      </footer>
      <Toaster />
    </div>
  );
}
```
