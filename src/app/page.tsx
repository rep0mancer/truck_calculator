"use client";

import React, { useEffect, useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

// Constants for truck types, including single-layer capacities
// These definitions mirror the original configuration used by the application.
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
    singleLayerEUPCapacityLongPerUnit: 18,
    singleLayerEUPCapacityBroadPerUnit: 18,
    singleLayerDINCapacityPerUnit: 14,
    maxGrossWeightKg: 24000,
  },
  curtainSider: {
    name: 'Planensattel Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    trueLength: 1360,
    maxWidth: 245,
    singleLayerEUPCapacityLong: 33,
    singleLayerEUPCapacityBroad: 32,
    singleLayerDINCapacity: 26,
    maxGrossWeightKg: 24000,
  },
  frigo: {
    name: 'Frigo (Kühler) Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    trueLength: 1360,
    maxWidth: 245,
    singleLayerEUPCapacityLong: 33,
    singleLayerEUPCapacityBroad: 32,
    singleLayerDINCapacity: 26,
    maxGrossWeightKg: 18300,
  },
  smallTruck: {
    name: 'Motorwagen (7.2m)',
    units: [{ id: 'main', length: 720, width: 245, occupiedRects: [] }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    singleLayerEUPCapacityLong: 18,
    singleLayerEUPCapacityBroad: 18,
    singleLayerDINCapacity: 14,
    maxGrossWeightKg: 10000,
  },
  Waggon: {
    name: 'Waggon Hbbils (15,2m)',
    units: [{ id: 'main', length: 1520, width: 290, occupiedRects: [] }],
    totalLength: 1520,
    usableLength: 1520,
    maxWidth: 290,
    singleLayerEUPCapacityLong: 38,
    singleLayerEUPCapacityBroad: 38,
    singleLayerDINCapacity: 26,
    maxDinPallets: 26,
    maxGrossWeightKg: 24000,
  },
  Waggon2: {
    name: 'Waggon KRM',
    units: [{ id: 'main', length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    singleLayerEUPCapacityLong: 38,
    singleLayerEUPCapacityBroad: 40,
    singleLayerDINCapacity: 28,
    maxDinPallets: 28,
    maxGrossWeightKg: 24000,
  },
} as const;

// Pallet type definitions. These remain unchanged from the original application.
const PALLET_TYPES = {
  euro: { name: 'Euro Palette (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700' },
  industrial: { name: 'Industrial Palette (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700' },
} as const;

// Other constants controlling weight limits and thresholds.
const MAX_GROSS_WEIGHT_KG = 24000;
const MAX_PALLET_SIMULATION_QUANTITY = 300;
const STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING = 18;
const STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING = 16;
const MAX_WEIGHT_PER_METER_KG = 1800;

/*
 * Core calculation logic for placing pallets.  This function calculates how many
 * pallets (both DIN and EUP) can fit into a given truck configuration and
 * produces an array of visual pallet placement information.  It accepts a
 * parameter `placementOrder` that controls the order in which pallets are
 * placed along the length of the truck.  The default is 'STACKED_FIRST' which
 * enforces the ordering: stacked DIN → stacked EUP → single DIN → single EUP.
 */
// Core calculation logic (REFACTORED for correct stacking order)
// Core calculation logic (REVISED to correctly sequence stacked/single pallets)
// Core calculation logic (FINAL REVISION for state management)
// Core calculation logic (FINAL VERSION using a Pallet Queue Algorithm)
// Core calculation logic (FINAL VERSION + Rotation Heuristic)
// Core calculation logic (FINAL VERSION + Dynamic Row Optimization)
// Core calculation logic (FINAL VERSION with true Auto-Optimization)
// Core calculation logic (FINAL VERSION with true Auto-Optimization + Tactical Rotation)
const calculateLoadingLogic = (
  truckKey,
  requestedEupQuantity,
  requestedDinQuantity,
  currentIsEUPStackable,
  currentIsDINStackable,
  eupWeightStr,
  dinWeightStr,
  currentEupLoadingPattern,
  placementOrder = 'DIN_FIRST',
  maxStackedEup,
  maxStackedDin
) => {
  const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const weightLimit = truckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;
  const eupWeight = parseFloat(eupWeightStr) || 0;
  const dinWeight = parseFloat(dinWeightStr) || 0;
  const safeEupWeight = eupWeight > 0 ? eupWeight : 0;
  const safeDinWeight = dinWeight > 0 ? dinWeight : 0;
  
  const patternsToTry = currentEupLoadingPattern === 'auto' ? ['broad', 'long'] : [currentEupLoadingPattern];
  let bestOverallResult = null;

  for (const eupPattern of patternsToTry) {
    // 1. Reset all states for this pattern simulation
    let unitsState = truckConfig.units.map(u => ({
      ...u, occupiedRects: [], palletsVisual: [],
    }));
    let tempWarnings = [];
    let currentTotalWeight = 0;
    let dinLabelCounter = 0;
    let eupLabelCounter = 0;
    let finalActualDINBase = 0;
    let finalActualEUPBase = 0;
    let finalTotalAreaBase = 0;

    // 2. Build the prioritized queue of pallets to place
    const palletQueue = [];
    
    let dinQuantityToPlace = requestedDinQuantity;
    if (truckConfig.maxDinPallets !== undefined && dinQuantityToPlace > truckConfig.maxDinPallets) {
      if (requestedDinQuantity > truckConfig.maxDinPallets && requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY) {
        tempWarnings.push(
          `${truckConfig.name.trim()} maximale DIN-Kapazität ist ${truckConfig.maxDinPallets}. ` +
          `Angeforderte Menge ${requestedDinQuantity}, es werden ${truckConfig.maxDinPallets} platziert.`
        );
      }
      dinQuantityToPlace = truckConfig.maxDinPallets;
    }

    const dinToStack = [], dinSingle = [], eupToStack = [], eupSingle = [];
    
    let tempDinQty = dinQuantityToPlace;
    if (currentIsDINStackable) {
        const allowedStackBases = (maxStackedDin === 0) ? Infinity : (maxStackedDin && maxStackedDin > 0) ? Math.floor(maxStackedDin / 2) : 0;
        const basesToStack = Math.min(allowedStackBases, Math.floor(tempDinQty / 2));
        for (let i = 0; i < basesToStack; i++) dinToStack.push({ type: 'industrial', stacked: true });
        tempDinQty -= basesToStack * 2;
    }
    for (let i = 0; i < tempDinQty; i++) dinSingle.push({ type: 'industrial', stacked: false });

    let tempEupQty = requestedEupQuantity;
    if (currentIsEUPStackable) {
        const allowedStackBases = (maxStackedEup === 0) ? Infinity : (maxStackedEup && maxStackedEup > 0) ? Math.floor(maxStackedEup / 2) : 0;
        const basesToStack = Math.min(allowedStackBases, Math.floor(tempEupQty / 2));
        for (let i = 0; i < basesToStack; i++) eupToStack.push({ type: 'euro', stacked: true });
        tempEupQty -= basesToStack * 2;
    }
    for (let i = 0; i < tempEupQty; i++) eupSingle.push({ type: 'euro', stacked: false });
    
    if (placementOrder === 'EUP_FIRST') {
        palletQueue.push(...eupToStack, ...dinToStack, ...eupSingle, ...dinSingle);
    } else {
        palletQueue.push(...dinToStack, ...eupToStack, ...dinSingle, ...eupSingle);
    }
    

    // 3. Process the queue using the pattern for this simulation run
    let stopPlacement = false;
    for (const unit of unitsState) {
      if (stopPlacement) break;
      let currentX = 0, currentY = 0, currentRowHeight = 0;

      while (palletQueue.length > 0) {
        const nextPallet = palletQueue[0];
        const isEuro = nextPallet.type === 'euro';
        const palletDef = isEuro ? PALLET_TYPES.euro : PALLET_TYPES.industrial;

        let palletLen, palletWid;
        let finalLen, finalWid;

        // Determine primary dimensions from the global pattern
        if (isEuro) {
          palletLen = eupPattern === 'long' ? palletDef.length : palletDef.width;
          palletWid = eupPattern === 'long' ? palletDef.width : palletDef.length;
        } else {
          palletLen = palletDef.width;
          palletWid = palletDef.length;
        }

        // --- NEW TACTICAL PLACEMENT LOGIC ---
        let placeable = false;

        // Step 1: Check if pallet fits in the current row.
        if (currentY + palletWid <= unit.width && currentX + palletLen <= unit.length) {
            finalLen = palletLen;
            finalWid = palletWid;
            placeable = true;
        }
        // Step 2: If not, and it's an EUP in auto mode, try rotating it.
        else if (isEuro && currentEupLoadingPattern === 'auto') {
            const rotatedLen = palletWid;
            const rotatedWid = palletLen;
            if (currentY + rotatedWid <= unit.width && currentX + rotatedLen <= unit.length) {
                finalLen = rotatedLen;
                finalWid = rotatedWid;
                placeable = true;
            }
        }

        // Step 3: If it's still not placeable, try starting a new row.
        if (!placeable) {
            currentX += currentRowHeight;
            currentY = 0;
            currentRowHeight = 0;

            // After starting new row, re-check primary and rotated fit.
            if (currentY + palletWid <= unit.width && currentX + palletLen <= unit.length) {
                finalLen = palletLen;
                finalWid = palletWid;
                placeable = true;
            } else if (isEuro && currentEupLoadingPattern === 'auto') {
                const rotatedLen = palletWid;
                const rotatedWid = palletLen;
                if (currentY + rotatedWid <= unit.width && currentX + rotatedLen <= unit.length) {
                    finalLen = rotatedLen;
                    finalWid = rotatedWid;
                    placeable = true;
                }
            }
        }

        // Step 4: If it's still not placeable, we're out of options for this unit.
        if (!placeable) {
            break;
        }

        const palletWeight = nextPallet.stacked ? (isEuro ? safeEupWeight : safeDinWeight) * 2 : (isEuro ? safeEupWeight : safeDinWeight);
        if (palletWeight > 0 && currentTotalWeight + palletWeight > weightLimit) {
          if(!tempWarnings.some(w => w.includes('Gewichtslimit'))) tempWarnings.push('Gewichtslimit erreicht.');
          stopPlacement = true;
          break;
        }

        const palletToPlace = palletQueue.shift();
        
        const baseLabelId = isEuro ? ++eupLabelCounter : ++dinLabelCounter;
        const basePallet = {
            x: currentX, y: currentY, width: finalLen, height: finalWid, // Use final dimensions
            type: palletToPlace.type, isStackedTier: null, unitId: unit.id,
            labelId: baseLabelId, displayBaseLabelId: baseLabelId, displayStackedLabelId: null, showAsFraction: false,
            key: `${palletToPlace.type}_${(isEuro ? finalActualEUPBase:finalActualDINBase)}`
        };

        if (isEuro) finalActualEUPBase++; else finalActualDINBase++;
        finalTotalAreaBase += palletDef.area;
        currentTotalWeight += isEuro ? safeEupWeight : safeDinWeight;

        if (palletToPlace.stacked) {
            currentTotalWeight += isEuro ? safeEupWeight : safeDinWeight;
            const stackedLabelId = isEuro ? ++eupLabelCounter : ++dinLabelCounter;
            basePallet.isStackedTier = 'base';
            basePallet.showAsFraction = true;
            basePallet.displayStackedLabelId = stackedLabelId;
            const stackPallet = { ...basePallet, isStackedTier: 'top', labelId: stackedLabelId, key: basePallet.key + '_stack' };
            unit.palletsVisual.push(basePallet);
            unit.palletsVisual.push(stackPallet);
        } else {
            unit.palletsVisual.push(basePallet);
        }
        
        currentY += finalWid; // Use final width
        currentRowHeight = Math.max(currentRowHeight, finalLen); // Use final length
      }
    }
    
    if (palletQueue.length > 0 && !stopPlacement) {
        tempWarnings.push(`Konnte nicht alle Paletten laden. ${palletQueue.length} Stk. übrig.`);
    }

    // 4. Evaluate this pattern's result and store it if it's the best so far
    const totalVisualForAttempt = unitsState.flatMap(u => u.palletsVisual).length;
    const currentDinVisual = unitsState.flatMap(u => u.palletsVisual).filter(p => p.type === 'industrial').length;
    const currentEupVisual = unitsState.flatMap(u => u.palletsVisual).filter(p => p.type === 'euro').length;

    if (!bestOverallResult || totalVisualForAttempt > bestOverallResult.totalVisual) {
        bestOverallResult = {
            unitsState, totalVisual: totalVisualForAttempt,
            loadedIndustrialPalletsBase: finalActualDINBase,
            loadedEuroPalletsBase: finalActualEUPBase,
            totalDinPalletsVisual: currentDinVisual,
            totalEuroPalletsVisual: currentEupVisual,
            totalAreaBase: finalTotalAreaBase, warnings: tempWarnings,
            totalWeightKg: currentTotalWeight, chosenPattern: eupPattern,
        };
    }
  }

  // 5. Finalize and return the best result found across all simulations
  const finalResult = bestOverallResult;
  if (!finalResult) { 
      return { 
          palletArrangement: [], loadedIndustrialPalletsBase: 0, loadedEuroPalletsBase: 0,
          totalDinPalletsVisual: 0, totalEuroPalletsVisual: 0, utilizationPercentage: 0,
          warnings: [], totalWeightKg: 0, eupLoadingPatternUsed: 'none'
      }; 
  }

  const finalPalletArrangement = finalResult.unitsState.map(u => ({
    unitId: u.id, unitLength: u.length, unitWidth: u.width, pallets: u.palletsVisual
  }));
  const totalPracticalArea = truckConfig.usableLength * truckConfig.maxWidth;
  const util = totalPracticalArea > 0 ? (finalResult.totalAreaBase / totalPracticalArea) * 100 : 0;
  const utilizationPercentage = parseFloat(util.toFixed(1));
  
  let finalWarnings = [...finalResult.warnings];

  return {
    palletArrangement: finalPalletArrangement,
    loadedIndustrialPalletsBase: finalResult.loadedIndustrialPalletsBase,
    loadedEuroPalletsBase: finalResult.loadedEuroPalletsBase,
    totalDinPalletsVisual: finalResult.totalDinPalletsVisual,
    totalEuroPalletsVisual: finalResult.totalEuroPalletsVisual,
    utilizationPercentage: utilizationPercentage,
    warnings: Array.from(new Set(finalWarnings)),
    totalWeightKg: finalResult.totalWeightKg,
    eupLoadingPatternUsed: finalResult.totalEuroPalletsVisual > 0 ? finalResult.chosenPattern : 'none',
  };
};

/*
 * React component representing the home page of the loading space calculator.
 * This component maintains user input state, calls the loading logic, and renders
 * the resulting visualization along with summary information and warnings.
 */
export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState<keyof typeof TRUCK_TYPES>('curtainSider');
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState<'auto' | 'long' | 'broad'>('auto');
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);
  const [eupStackLimit, setEupStackLimit] = useState(0);
  const [dinStackLimit, setDinStackLimit] = useState(0);
  const [eupWeightPerPallet, setEupWeightPerPallet] = useState('');
  const [dinWeightPerPallet, setDinWeightPerPallet] = useState('');
  const [loadedEuroPalletsBase, setLoadedEuroPalletsBase] = useState(0);
  const [loadedIndustrialPalletsBase, setLoadedIndustrialPalletsBase] = useState(0);
  const [totalEuroPalletsVisual, setTotalEuroPalletsVisual] = useState(0);
  const [totalDinPalletsVisual, setTotalDinPalletsVisual] = useState(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [palletArrangement, setPalletArrangement] = useState<any[]>([]);
  const [totalWeightKg, setTotalWeightKg] = useState(0);
  const [actualEupLoadingPattern, setActualEupLoadingPattern] = useState<'auto' | 'long' | 'broad' | 'none'>('auto');
  const { toast } = useToast();
  // Calculation handler that can be invoked manually or from useEffect.
  const calculateAndSetState = useCallback((order: 'DIN_FIRST' | 'EUP_FIRST' | 'STACKED_FIRST' = 'STACKED_FIRST', currentEup = eupQuantity, currentDin = dinQuantity) => {
    // Primary calculation based on current inputs or function call parameters.
    const primaryResults = calculateLoadingLogic(
      selectedTruck,
      currentEup,
      currentDin,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      order,
      eupStackLimit,
      dinStackLimit
    );
    // --- Calculate remaining EUP capacity ---
    const eupCapacityCheckResults = calculateLoadingLogic(
      selectedTruck,
      MAX_PALLET_SIMULATION_QUANTITY,
      primaryResults.totalDinPalletsVisual,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      'DIN_FIRST',
      eupStackLimit,
      dinStackLimit
    );
    const additionalEupPossible = Math.max(0, eupCapacityCheckResults.totalEuroPalletsVisual - primaryResults.totalEuroPalletsVisual);
    // --- Calculate remaining DIN capacity ---
    const dinCapacityCheckResults = calculateLoadingLogic(
      selectedTruck,
      primaryResults.totalEuroPalletsVisual,
      MAX_PALLET_SIMULATION_QUANTITY,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      'EUP_FIRST',
      eupStackLimit,
      dinStackLimit
    );
    const additionalDinPossible = Math.max(0, dinCapacityCheckResults.totalDinPalletsVisual - primaryResults.totalDinPalletsVisual);
    let finalWarnings = [...primaryResults.warnings];
    if (additionalEupPossible > 0 && additionalDinPossible > 0) {
      finalWarnings.push(`Es ist jetzt noch Platz für ${additionalEupPossible} EUP oder ${additionalDinPossible} DIN Paletten.`);
    } else if (additionalEupPossible > 0) {
      finalWarnings.push(`Es ist jetzt noch Platz für ${additionalEupPossible} EUP.`);
    } else if (additionalDinPossible > 0) {
      finalWarnings.push(`Es ist jetzt noch Platz für ${additionalDinPossible} DIN Paletten.`);
    }
    // Check theoretical maximum capacities for full truck calculations.
    const truckCapEuro = calculateLoadingLogic(
      selectedTruck,
      MAX_PALLET_SIMULATION_QUANTITY,
      0,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      'DIN_FIRST',
      eupStackLimit,
      dinStackLimit
    ).totalEuroPalletsVisual;
    const truckCapDin = calculateLoadingLogic(
      selectedTruck,
      0,
      MAX_PALLET_SIMULATION_QUANTITY,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      'DIN_FIRST',
      eupStackLimit,
      dinStackLimit
    ).totalDinPalletsVisual;
    if (eupQuantity > truckCapEuro && truckCapEuro > 0 && dinQuantity === 0) {
      const fullTrucks = Math.floor(eupQuantity / truckCapEuro);
      const rest = eupQuantity % truckCapEuro;
      if (rest > 0) {
        finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt und ${rest} Paletten bleiben rest am ${fullTrucks + 1}. LKW`);
      } else {
        finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt`);
      }
    } else if (dinQuantity > truckCapDin && truckCapDin > 0 && eupQuantity === 0) {
      const fullTrucks = Math.floor(dinQuantity / truckCapDin);
      const rest = dinQuantity % truckCapDin;
      if (rest > 0) {
        finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt und ${rest} Paletten bleiben rest am ${fullTrucks + 1}. LKW`);
      } else {
        finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt`);
      }
    }
    const noWeightWarning = !finalWarnings.some(w => w.toLowerCase().includes('gewichtslimit'));
    const isFull = additionalEupPossible === 0 && additionalDinPossible === 0 &&
                   (primaryResults.totalEuroPalletsVisual + primaryResults.totalDinPalletsVisual > 0) &&
                   noWeightWarning;
    const finalUtilization = isFull ? 100 : primaryResults.utilizationPercentage;
    setPalletArrangement(primaryResults.palletArrangement);
    setLoadedIndustrialPalletsBase(primaryResults.loadedIndustrialPalletsBase);
    setLoadedEuroPalletsBase(primaryResults.loadedEuroPalletsBase);
    setTotalDinPalletsVisual(primaryResults.totalDinPalletsVisual);
    setTotalEuroPalletsVisual(primaryResults.totalEuroPalletsVisual);
    setUtilizationPercentage(finalUtilization);
    setWarnings(finalWarnings);
    setTotalWeightKg(primaryResults.totalWeightKg);
    setActualEupLoadingPattern(primaryResults.eupLoadingPatternUsed as any);
  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern, eupStackLimit, dinStackLimit]);
  // Recalculate whenever quantities or stack limits change so the visualization stays in sync.
  useEffect(() => {
    calculateAndSetState('STACKED_FIRST', eupQuantity, dinQuantity);
  }, [calculateAndSetState, eupQuantity, dinQuantity, eupStackLimit, dinStackLimit]);
  // Handlers for input changes.
  const handleQuantityChange = (type: 'eup' | 'din', amount: number) => {
    if (type === 'eup') setEupQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    else if (type === 'din') setDinQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
  };
  const handleClearAllPallets = () => {
    setEupQuantity(0);
    setDinQuantity(0);
    setEupWeightPerPallet('');
    setDinWeightPerPallet('');
    setIsEUPStackable(false);
    setIsDINStackable(false);
    setEupStackLimit(0);
    setDinStackLimit(0);
    setEupLoadingPattern('auto');
  };
  const handleMaximizePallets = (palletTypeToMax: 'industrial' | 'euro') => {
    let targetEupQty = 0;
    let targetDinQty = 0;
    let order: 'DIN_FIRST' | 'EUP_FIRST' | 'STACKED_FIRST' = 'DIN_FIRST';
    let eupStackForCalc = isEUPStackable;
    let dinStackForCalc = isDINStackable;
    if (palletTypeToMax === 'industrial') {
      targetDinQty = MAX_PALLET_SIMULATION_QUANTITY;
      targetEupQty = 0;
      order = 'DIN_FIRST';
    } else if (palletTypeToMax === 'euro') {
      targetEupQty = MAX_PALLET_SIMULATION_QUANTITY;
      targetDinQty = 0;
      order = 'EUP_FIRST';
    }
    const simResults = calculateLoadingLogic(
      selectedTruck,
      targetEupQty,
      targetDinQty,
      eupStackForCalc,
      dinStackForCalc,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      order,
      eupStackLimit,
      dinStackLimit
    );
    if (palletTypeToMax === 'industrial') {
      setDinQuantity(simResults.totalDinPalletsVisual);
      setEupQuantity(0);
    } else if (palletTypeToMax === 'euro') {
      setEupQuantity(simResults.totalEuroPalletsVisual);
      setDinQuantity(0);
    }
    if (eupLoadingPattern === 'auto' && simResults.eupLoadingPatternUsed !== 'auto' && simResults.eupLoadingPatternUsed !== 'none' && palletTypeToMax === 'euro') {
      setEupLoadingPattern(simResults.eupLoadingPatternUsed as any);
    }
  };
  const handleFillRemainingWithEUP = () => {
    const fillResults = calculateLoadingLogic(
      selectedTruck,
      MAX_PALLET_SIMULATION_QUANTITY,
      dinQuantity,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      'auto',
      'DIN_FIRST',
      eupStackLimit,
      dinStackLimit
    );
    setEupQuantity(fillResults.totalEuroPalletsVisual);
    setDinQuantity(fillResults.totalDinPalletsVisual);
  };
  const handleFillRemainingWithDIN = () => {
    const currentEupQty = eupQuantity;
    let bestSimResults: any = null;
    const currentTruckInfo = TRUCK_TYPES[selectedTruck];
    let truckTheoreticalMaxDin = currentTruckInfo.singleLayerDINCapacity ||
      (currentTruckInfo.singleLayerDINCapacityPerUnit && currentTruckInfo.units.length > 0 ?
       currentTruckInfo.singleLayerDINCapacityPerUnit * currentTruckInfo.units.length :
       (currentTruckInfo.units.length > 0 ? Math.floor(currentTruckInfo.units[0].length / PALLET_TYPES.industrial.width) * 2 * currentTruckInfo.units.length : 30));
    const iterationMaxDin = truckTheoreticalMaxDin * (isDINStackable ? 2 : 1);
    for (let d = iterationMaxDin; d >= 0; d--) {
      const simResults = calculateLoadingLogic(
        selectedTruck,
        currentEupQty,
        d,
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        'auto',
        'DIN_FIRST',
        eupStackLimit,
        dinStackLimit
      );
      if (simResults.totalEuroPalletsVisual >= currentEupQty && simResults.totalDinPalletsVisual === d) {
        bestSimResults = simResults;
        break;
      }
    }
    if (bestSimResults) {
      setDinQuantity(bestSimResults.totalDinPalletsVisual);
      setEupQuantity(currentEupQty);
    } else {
      const eupFirstSimResults = calculateLoadingLogic(
        selectedTruck,
        currentEupQty,
        MAX_PALLET_SIMULATION_QUANTITY,
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        'auto',
        'EUP_FIRST',
        eupStackLimit,
        dinStackLimit
      );
      setDinQuantity(eupFirstSimResults.totalDinPalletsVisual);
      setEupQuantity(eupFirstSimResults.totalEuroPalletsVisual);
    }
  };
  const suggestFeasibleLoad = () => {
    let bestEup = 0;
    let bestDin = 0;
    let bestResult: any = null;
    for (let d = dinQuantity; d >= 0; d--) {
      for (let e = eupQuantity; e >= 0; e--) {
        const res = calculateLoadingLogic(
          selectedTruck,
          e,
          d,
          isEUPStackable,
          isDINStackable,
          eupWeightPerPallet,
          dinWeightPerPallet,
          eupLoadingPattern,
          'DIN_FIRST',
          eupStackLimit,
          dinStackLimit
        );
        const badWarning = res.warnings.some((w: string) =>
          w.toLowerCase().includes('gewichtslimit') ||
          w.toLowerCase().includes('konnte nicht')
        );
        if (!badWarning && res.totalEuroPalletsVisual === e && res.totalDinPalletsVisual === d) {
          if (e + d > bestEup + bestDin) {
            bestEup = e;
            bestDin = d;
            bestResult = res;
          }
        }
      }
    }
    setEupQuantity(bestEup);
    setDinQuantity(bestDin);
    if (
      bestResult &&
      eupLoadingPattern === 'auto' &&
      bestResult.eupLoadingPatternUsed !== 'auto' &&
      bestResult.eupLoadingPatternUsed !== 'none'
    ) {
      setEupLoadingPattern(bestResult.eupLoadingPatternUsed as any);
    }
    toast({ title: 'Vorschlag übernommen', description: `${bestDin} DIN / ${bestEup} EUP geladen` });
  };
  // Utility for rendering an individual pallet.
  const renderPallet = (pallet: any, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !(pallet.type in PALLET_TYPES)) return null;
    const d = PALLET_TYPES[pallet.type as keyof typeof PALLET_TYPES];
    const w = pallet.height * displayScale;
    const h = pallet.width * displayScale;
    const x = pallet.y * displayScale;
    const y = pallet.x * displayScale;
    let txt: string = pallet.showAsFraction && pallet.displayStackedLabelId ? `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}` : `${pallet.labelId}`;
    if (pallet.labelId === 0) txt = '?';
    let title = `${d.name} #${pallet.labelId}`;
    if (pallet.showAsFraction) title = `${d.name} (Stapel: ${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId})`;
    if (pallet.isStackedTier === 'top') title += ' - Oben';
    if (pallet.isStackedTier === 'base') title += ' - Basis des Stapels';
    return (
      <div key={pallet.key} title={title}
        className={`absolute ${d.color} ${d.borderColor} border flex items-center justify-center rounded-sm shadow-sm`}
        style={{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, opacity: pallet.isStackedTier === 'top' ? 0.7 : 1, zIndex: pallet.isStackedTier === 'top' ? 10 : 5, fontSize: '10px' }}>
        <span className="text-black font-semibold select-none">{txt}</span>
        {pallet.isStackedTier === 'top' && <div className="absolute top-0 left-0 w-full h-full border-t-2 border-l-2 border-black opacity-30 pointer-events-none rounded-sm" />}
      </div>
    );
  };
  const truckVisualizationScale = 0.3;
  const warningsWithoutInfo = warnings.filter(w => !w.toLowerCase().includes('platz'));
  let meldungenStyle = {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    header: 'text-gray-800',
    list: 'text-gray-700'
  };
  if (eupQuantity === 0 && dinQuantity === 0 && totalEuroPalletsVisual === 0 && totalDinPalletsVisual === 0) {
    meldungenStyle = { bg: 'bg-gray-50', border: 'border-gray-200', header: 'text-gray-800', list: 'text-gray-700' };
  } else if (warningsWithoutInfo.length === 0) {
    meldungenStyle = { bg: 'bg-green-50', border: 'border-green-200', header: 'text-green-800', list: 'text-green-700' };
  } else if (warningsWithoutInfo.every(w => w.toLowerCase().includes('achslast'))) {
    meldungenStyle = { bg: 'bg-yellow-50', border: 'border-yellow-200', header: 'text-yellow-800', list: 'text-yellow-700' };
  } else {
    meldungenStyle = { bg: 'bg-red-50', border: 'border-red-200', header: 'text-red-800', list: 'text-red-700' };
  }
  return (
    <div className="container mx-auto p-4 font-sans bg-gray-50">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-t-lg shadow-lg mb-6">
        <h1 className="text-3xl font-bold text-center tracking-tight">Laderaumrechner</h1>
        <p className="text-center text-sm opacity-90">Visualisierung der Palettenplatzierung (Europäische Standards)</p>
      </header>
      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Input Column */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">LKW-Typ:</label>
              <select id="truckType" value={selectedTruck} onChange={e => { setSelectedTruck(e.target.value as keyof typeof TRUCK_TYPES); }} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {Object.keys(TRUCK_TYPES).map(key => <option key={key} value={key}>{TRUCK_TYPES[key as keyof typeof TRUCK_TYPES].name}</option>)}
              </select>
            </div>
            <div className="pt-4">
              <button onClick={handleClearAllPallets} className="w-full py-2 px-4 bg-[#00906c] text-white font-semibold rounded-md shadow-sm hover:bg-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50 transition duration-150 ease-in-out">Alles zurücksetzen</button>
            </div>
            <div>
              <button onClick={suggestFeasibleLoad} className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 transition duration-150 ease-in-out">Automatisch anpassen</button>
            </div>
            {/* DIN Paletten Sektion */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industriepaletten (DIN)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('din', -1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input type="number" min="0" value={dinQuantity} onChange={e => setDinQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('din', 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => handleMaximizePallets('industrial')} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50">Max. DIN</button>
              <button onClick={handleFillRemainingWithDIN} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50">Rest mit max. DIN füllen</button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/DIN (kg):</label>
                <input type="number" min="0" value={dinWeightPerPallet} onChange={e => setDinWeightPerPallet(e.target.value)} placeholder="z.B. 500" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="dinStackable" checked={isDINStackable} onChange={e => setIsDINStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="dinStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {isDINStackable && (
                <input
                  type="number"
                  min="0"
                  value={dinStackLimit}
                  onChange={e => setDinStackLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                  placeholder="Stapelbare Paletten (0 = alle)"
                />
              )}
            </div>
            {/* EUP Paletten Sektion */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Europaletten (EUP)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('eup', -1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input type="number" min="0" value={eupQuantity} onChange={e => setEupQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('eup', 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => handleMaximizePallets('euro')} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50">Max. EUP</button>
              <button onClick={handleFillRemainingWithEUP} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50">Rest mit max. EUP füllen</button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/EUP (kg):</label>
                <input type="number" min="0" value={eupWeightPerPallet} onChange={e => setEupWeightPerPallet(e.target.value)} placeholder="z.B. 400" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="eupStackable" checked={isEUPStackable} onChange={e => setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="eupStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {isEUPStackable && (
                <input
                  type="number"
                  min="0"
                  value={eupStackLimit}
                  onChange={e => setEupStackLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                  placeholder="Stapelbare Paletten (0 = alle)"
                />
              )}
            </div>
            {(eupQuantity > 0 || totalEuroPalletsVisual > 0 || actualEupLoadingPattern !== 'auto' || eupLoadingPattern !== 'auto' || (TRUCK_TYPES[selectedTruck].singleLayerEUPCapacityLong || 0) > 0) && (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">EUP Lade-Pattern:
                  <span className="text-xs text-gray-500"> (Gewählt: {actualEupLoadingPattern === 'none' ? 'Keines' : actualEupLoadingPattern})</span>
                </label>
                <div className="flex flex-col space-y-1">
                  <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="auto" checked={eupLoadingPattern === 'auto'} onChange={e => setEupLoadingPattern(e.target.value as any)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" /><span className="ml-2 text-sm text-gray-700">Auto-Optimieren</span></label>
                  <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="long" checked={eupLoadingPattern === 'long'} onChange={e => setEupLoadingPattern(e.target.value as any)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" /><span className="ml-2 text-sm text-gray-700">Längs (3 nebeneinander)</span></label>
                  <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="broad" checked={eupLoadingPattern === 'broad'} onChange={e => setEupLoadingPattern(e.target.value as any)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" /><span className="ml-2 text-sm text-gray-700">Quer (2 nebeneinander)</span></label>
                </div>
              </div>
            )}
          </div>
          {/* Visualization Column */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Ladefläche Visualisierung</p>
            {palletArrangement.map((unit: any, index: number) => (
              <div key={unit.unitId} className="mb-4 w-full flex flex-col items-center">
                {TRUCK_TYPES[selectedTruck].units.length > 1 && <p className="text-sm text-gray-700 mb-1">Einheit {index + 1} ({unit.unitLength / 100}m x {unit.unitWidth / 100}m)</p>}
                <div className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner" style={{ width: `${unit.unitWidth * truckVisualizationScale}px`, height: `${unit.unitLength * truckVisualizationScale}px` }}>
                  {unit.pallets.map((p: any) => renderPallet(p, truckVisualizationScale))}
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
            <h3 className="font-semibold text-green-800 mb-2">Flächenausnutzung</h3>
            <p className="font-bold text-3xl text-green-700">{utilizationPercentage}%</p>
            <p className="text-xs mt-1">(Grundfläche)</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="font-semibold text-yellow-800 mb-2">Geschätztes Gewicht</h3>
            <p className="font-bold text-2xl text-yellow-700">{(totalWeightKg / 1000).toFixed(1)} t</p>
            <p className="text-xs mt-1">(Max: {(TRUCK_TYPES[selectedTruck].maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG) / 1000}t)</p>
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
        <p>Laderaumrechner © {new Date().getFullYear()}</p>
        <p>by Andreas Steiner </p>
      </footer>
      <Toaster />
    </div>
  );
}
