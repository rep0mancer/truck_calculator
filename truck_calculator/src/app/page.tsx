"use client";

import React, { useState, useEffect, useCallback } from 'react';

// Constants for truck types
const TRUCK_TYPES = {
  roadTrain: {
    name: 'Hängerzug (2x 7,2m)',
    units: [
      { id: 'unit1', length: 720, width: 245 },
      { id: 'unit2', length: 720, width: 245 },
    ],
    totalLength: 1440,
    usableLength: 1440,
    maxWidth: 245,
  },
  curtainSider: {
    name: 'Planensattel Standard (13.2m)',
    units: [{ id: 'main', length: 1320, width: 245 }],
    totalLength: 1320,
    usableLength: 1320,
    trueLength: 1360, 
    maxWidth: 245,
  },
  smallTruck: {
    name: 'Motorwagen (7.2m)',
    units: [{ id: 'main', length: 720, width: 245 }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
  },
  Waggon: {
    name: 'Waggon Hbbils (15,2m)',
    units: [{ id: 'main', length: 1520, width: 290 }], 
    totalLength: 1520, 
    usableLength: 1520, 
    maxWidth: 290,
    maxDinPallets: 26, 
  },
};

// Constants for pallet types
const PALLET_TYPES = {
  euro: { name: 'Euro Pallet (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 120 * 80, color: 'bg-blue-500', borderColor: 'border-blue-700' },
  industrial: { name: 'Industrial Pallet (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 120 * 100, color: 'bg-green-500', borderColor: 'border-green-700' },
};

const MAX_GROSS_WEIGHT_KG = 24000; 
const MAX_PALLET_SIMULATION_QUANTITY = 300; // Used for maximization attempts

// Helper function to check for overlaps
const checkOverlap = (rect1, rect2) => {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
};

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState('curtainSider');
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState('auto');
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);

  const [eupWeightPerPallet, setEupWeightPerPallet] = useState('');
  const [dinWeightPerPallet, setDinWeightPerPallet] = useState('');

  const [loadedEuroPalletsBase, setLoadedEuroPalletsBase] = useState(0);
  const [loadedIndustrialPalletsBase, setLoadedIndustrialPalletsBase] = useState(0);
  const [totalEuroPalletsVisual, setTotalEuroPalletsVisual] = useState(0);
  const [totalDinPalletsVisual, setTotalDinPalletsVisual] = useState(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [palletArrangement, setPalletArrangement] = useState([]);
  const [totalWeightKg, setTotalWeightKg] = useState(0);
  
  const [maximizationAction, setMaximizationAction] = useState(null); 
  
  const calculateLoading = useCallback(() => {
    const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[selectedTruck]));
    let tempWarnings = [];
    let finalTotalEuroVisual = 0;
    let finalTotalDinVisual = 0;
    let finalActualEUPBase = 0;
    let finalActualDINBase = 0;
    let finalTotalAreaBase = 0;
    let currentTotalWeight = 0;
    let dinLabelGlobalCounter = 0; 
    let eupLabelGlobalCounter = 0; 

    const eupWeight = parseFloat(eupWeightPerPallet);
    const dinWeight = parseFloat(dinWeightPerPallet);
    const safeEupWeight = !isNaN(eupWeight) && eupWeight > 0 ? eupWeight : 0;
    const safeDinWeight = !isNaN(dinWeight) && dinWeight > 0 ? dinWeight : 0;

    let unitsState = truckConfig.units.map(u => ({
      ...u, occupiedRects: [], palletsVisual: [],
    }));

    let eupQ_input = eupQuantity;
    let dinQ_input = dinQuantity;
    let eupStack_input = isEUPStackable;
    let dinStack_input = isDINStackable;

    let palletsToPlace = [];

    if (maximizationAction) {
      if (maximizationAction.calc_mode === 'fill_din_after_eup') {
        palletsToPlace.push({ type: 'euro', quantity: eupQ_input, stackable: eupStack_input, isFill: false, originalQuantity: eupQ_input });
        palletsToPlace.push({ type: 'industrial', quantity: MAX_PALLET_SIMULATION_QUANTITY, stackable: false, isFill: true, originalQuantity: 0 });
      } else if (maximizationAction.calc_mode === 'fill_eup_after_din') {
        palletsToPlace.push({ type: 'industrial', quantity: dinQ_input, stackable: dinStack_input, isFill: false, originalQuantity: dinQ_input });
        palletsToPlace.push({ type: 'euro', quantity: MAX_PALLET_SIMULATION_QUANTITY, stackable: false, isFill: true, originalQuantity: 0 });
      } else if (maximizationAction.type === 'euro') {
        palletsToPlace.push({ type: 'euro', quantity: MAX_PALLET_SIMULATION_QUANTITY, stackable: false, isFill: false, originalQuantity: 0 });
      } else if (maximizationAction.type === 'industrial') {
        let qty = MAX_PALLET_SIMULATION_QUANTITY;
        if (selectedTruck === 'Waggon' && truckConfig.maxDinPallets !== undefined) {
            qty = Math.min(qty, truckConfig.maxDinPallets);
        }
        palletsToPlace.push({ type: 'industrial', quantity: qty, stackable: false, isFill: false, originalQuantity: 0 });
      }
    } else {
      let currentDinQuantity = dinQ_input;
      if (selectedTruck === 'Waggon' && truckConfig.maxDinPallets !== undefined) {
        if (currentDinQuantity > truckConfig.maxDinPallets) {
            tempWarnings.push(`Waggon DIN capacity is ${truckConfig.maxDinPallets}. Requested ${currentDinQuantity}, placing ${truckConfig.maxDinPallets}.`);
            currentDinQuantity = truckConfig.maxDinPallets;
        }
      }
      palletsToPlace.push({ type: 'industrial', quantity: currentDinQuantity, stackable: dinStack_input, isFill: false, originalQuantity: currentDinQuantity });
      palletsToPlace.push({ type: 'euro', quantity: eupQ_input, stackable: eupStack_input, isFill: false, originalQuantity: eupQ_input });
    }

    let actualPlacedEUPVisual = 0;
    let actualPlacedDINVisual = 0;
    let actualPlacedEUPBase = 0;
    let actualPlacedDINBase = 0;

    for (const { type: palletTypeToPlace, quantity: quantityToPlace, stackable: isStackableForRun, isFill, originalQuantity: currentOriginalQuantity } of palletsToPlace) {
      if (quantityToPlace <= 0 && !isFill) continue;
      if (quantityToPlace <=0 && isFill && currentOriginalQuantity > 0 && palletTypeToPlace === 'euro' && eupQuantity === 0) continue; 
      if (quantityToPlace <=0 && isFill && currentOriginalQuantity > 0 && palletTypeToPlace === 'industrial' && dinQuantity === 0) continue; 

      let placedCountTotalForThisType = 0;

      if (palletTypeToPlace === 'industrial') {
        for (const unit of unitsState) {
          if (placedCountTotalForThisType >= quantityToPlace && !isFill) break;
          if (isFill && placedCountTotalForThisType >= MAX_PALLET_SIMULATION_QUANTITY) break;

          let currentX = 0;
          while (currentX < unit.length) {
            if (placedCountTotalForThisType >= quantityToPlace && !isFill) break;
            if (isFill && placedCountTotalForThisType >= MAX_PALLET_SIMULATION_QUANTITY) break;

            const dinDef = PALLET_TYPES.industrial;
            const orientations = [
                { L: dinDef.width, W: dinDef.length, name: '100L_120W' }, 
                { L: dinDef.length, W: dinDef.width, name: '120L_100W' }
            ];
            let bestChoiceForColumn = { count: 0, widthUsed: 0, palletsToPush: [], chosenOrientationL: Infinity };

            for (const orient of orientations) {
                let currentY = 0; let tempPalletsInColumn = []; let tempDinCountInColumn = 0;
                const pR1 = { x: currentX, y: currentY, width: orient.L, height: orient.W };
                if (currentX + orient.L <= unit.length && currentY + orient.W <= unit.width && !unit.occupiedRects.some(r => checkOverlap(pR1, r))) {
                    tempDinCountInColumn++; tempPalletsInColumn.push({ ...pR1 }); currentY += orient.W;
                    const pR2 = { x: currentX, y: currentY, width: orient.L, height: orient.W };
                    if (currentX + orient.L <= unit.length && currentY + orient.W <= unit.width && !unit.occupiedRects.some(r => checkOverlap(pR2, r))) {
                        tempDinCountInColumn++; tempPalletsInColumn.push({ ...pR2 });
                    }
                }
                if (tempDinCountInColumn > bestChoiceForColumn.count || (tempDinCountInColumn === bestChoiceForColumn.count && tempDinCountInColumn > 0 && orient.L < bestChoiceForColumn.chosenOrientationL)) {
                    bestChoiceForColumn = { count: tempDinCountInColumn, widthUsed: orient.L, palletsToPush: tempPalletsInColumn, chosenOrientationL: orient.L };
                }
            }

            if (bestChoiceForColumn.count > 0) {
                for (const p_rect of bestChoiceForColumn.palletsToPush) {
                    if (placedCountTotalForThisType >= quantityToPlace && !isFill) break;
                    if (isFill && placedCountTotalForThisType >= MAX_PALLET_SIMULATION_QUANTITY) break;
                    
                    if (safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG) {
                        if (!tempWarnings.some(w => w.includes("Weight limit DIN"))) tempWarnings.push(`Weight limit DIN. Max ${MAX_GROSS_WEIGHT_KG / 1000}t.`);
                        currentX = unit.length; break;
                    }
                    const baseDinLabelId = ++dinLabelGlobalCounter;
                    const baseDinPallet = { ...p_rect, type: 'industrial', isStackedTier: null, key: `din_base_${unit.id}_${actualPlacedDINBase}_${p_rect.y}`, unitId: unit.id, labelId: baseDinLabelId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: null, showAsFraction: false, isFillPallet: isFill };
                    unit.palletsVisual.push(baseDinPallet); unit.occupiedRects.push(p_rect);
                    finalTotalAreaBase += dinDef.area; actualPlacedDINBase++; actualPlacedDINVisual++;
                    currentTotalWeight += safeDinWeight; placedCountTotalForThisType++;
                    
                    if (isStackableForRun && !isFill && (placedCountTotalForThisType < quantityToPlace)) {
                        if (!(safeDinWeight > 0 && currentTotalWeight + safeDinWeight > MAX_GROSS_WEIGHT_KG)) {
                            const stackedId = ++dinLabelGlobalCounter;
                            baseDinPallet.showAsFraction = true; baseDinPallet.displayStackedLabelId = stackedId; baseDinPallet.isStackedTier = 'base';
                            unit.palletsVisual.push({ ...baseDinPallet, isStackedTier: 'top', key: `din_stack_${unit.id}_${actualPlacedDINBase-1}_${p_rect.y}`, labelId: stackedId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: stackedId, isFillPallet: isFill });
                            actualPlacedDINVisual++; currentTotalWeight += safeDinWeight; placedCountTotalForThisType++;
                        } else { if (!tempWarnings.some(w => w.includes("stacking DIN"))) tempWarnings.push("Weight limit stacking DIN"); }
                    }
                }
                if (currentX >= unit.length) break; 
                currentX += bestChoiceForColumn.widthUsed;
            } else { currentX = unit.length; }
          }
        }
        if (!isFill && dinQ_input > 0 && actualPlacedDINVisual < dinQ_input && !tempWarnings.some(w => w.includes("Weight limit") || w.includes("Waggon DIN capacity"))) {
            const placedDinForInput = unit.palletsVisual.filter(p => p.type === 'industrial' && !p.isFillPallet && p.isStackedTier !== 'top').length;
            if (placedDinForInput < dinQ_input) tempWarnings.push(`Could not fit all ${dinQ_input} requested DINs. Placed ${placedDinForInput} (base).`);
        }
      } else if (palletTypeToPlace === 'euro') {
        const patternsToTry = eupLoadingPattern === 'auto' ? ['long', 'broad'] : [eupLoadingPattern];
        let bestEUPPatternResultForThisBlock = { visual: 0, base: 0, area: 0, weight: currentTotalWeight, warnings: [], unitsConfig: JSON.parse(JSON.stringify(unitsState)), labelCounter: eupLabelGlobalCounter, placedThisType: 0 };
        let patternHasBeenChosenForThisBlock = false;

        for (const pattern of patternsToTry) {
            let currentUnitsForPattern = JSON.parse(JSON.stringify(unitsState)); 
            let patternVisualEUP = 0, patternBaseEUP = 0, patternAreaEUP = 0;
            let patternWeight = currentTotalWeight; let patternWarnLocal = [];
            let patternRemainingEupNeeded = quantityToPlace;
            let currentPatternEupLabelCounter = eupLabelGlobalCounter;
            let eupPlacedThisPatternAndBlock = 0;

            for (const unit of currentUnitsForPattern) {
                if (patternRemainingEupNeeded <= 0 && !isFill) break;
                if (isFill && eupPlacedThisPatternAndBlock >= MAX_PALLET_SIMULATION_QUANTITY) break;
                
                let currentX = 0; 
                while (currentX < unit.length) {
                    if (patternRemainingEupNeeded <= 0 && !isFill) break;
                    if (isFill && eupPlacedThisPatternAndBlock >= MAX_PALLET_SIMULATION_QUANTITY) break;

                    const eupDef = PALLET_TYPES.euro;
                    const palletsPerRowConfig = pattern === 'long' ? 3 : 2;
                    const eupLengthOrient = pattern === 'long' ? eupDef.length : eupDef.width;
                    const eupWidthOrient = pattern === 'long' ? eupDef.width : eupDef.length;
                    let rowHeight = 0; let currentY = 0; let rowPalletsPlacedCountInColumn = 0;

                    for (let i = 0; i < palletsPerRowConfig; i++) {
                        if (patternRemainingEupNeeded <= 0 && !isFill) break;
                        if (isFill && eupPlacedThisPatternAndBlock >= MAX_PALLET_SIMULATION_QUANTITY) break;

                        const potentialRect = { x: currentX, y: currentY, width: eupLengthOrient, height: eupWidthOrient };
                        if (currentX + eupLengthOrient <= unit.length && currentY + eupWidthOrient <= unit.width && !unit.occupiedRects.some(r => checkOverlap(potentialRect, r))) {
                            if (safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG) {
                                if (!patternWarnLocal.some(w => w.includes("Weight limit EUP"))) patternWarnLocal.push(`Weight limit EUP. Max ${MAX_GROSS_WEIGHT_KG/1000}t.`);
                                currentX = unit.length; break; 
                            }
                            const baseId = ++currentPatternEupLabelCounter;
                            const basePallet = { ...potentialRect, type: 'euro', isStackedTier: null, key: `eup_base_${unit.id}_${actualPlacedEUPBase + patternBaseEUP}_${pattern}_${i}`, unitId: unit.id, labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null, showAsFraction: false, isFillPallet: isFill };
                            unit.palletsVisual.push(basePallet); unit.occupiedRects.push(potentialRect);
                            patternAreaEUP += eupDef.area; patternBaseEUP++; patternVisualEUP++;
                            patternWeight += safeEupWeight; 
                            if (!isFill) patternRemainingEupNeeded--; 
                            eupPlacedThisPatternAndBlock++;
                            rowPalletsPlacedCountInColumn++; 
                            rowHeight = Math.max(rowHeight, eupLengthOrient);

                            if (isStackableForRun && !isFill && (patternRemainingEupNeeded > 0)) {
                                if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > MAX_GROSS_WEIGHT_KG)) {
                                    const stackedId = ++currentPatternEupLabelCounter;
                                    basePallet.showAsFraction = true; basePallet.displayStackedLabelId = stackedId; basePallet.isStackedTier = 'base';
                                    unit.palletsVisual.push({ ...basePallet, isStackedTier: 'top', key: `eup_stack_${unit.id}_${actualPlacedEUPBase + patternBaseEUP-1}_${pattern}_${i}`, labelId: stackedId, displayBaseLabelId: baseId, displayStackedLabelId: stackedId, isFillPallet: isFill });
                                    patternVisualEUP++; patternWeight += safeEupWeight; 
                                    if (!isFill) patternRemainingEupNeeded--;
                                    eupPlacedThisPatternAndBlock++;
                                } else { if (!patternWarnLocal.some(w=>w.includes("stacking EUP"))) patternWarnLocal.push("Weight limit stacking EUP"); }
                            }
                            currentY += eupWidthOrient;
                        } else { break; }
                    }
                    if (currentX >= unit.length) break;
                    if (rowPalletsPlacedCountInColumn > 0) { currentX += rowHeight; } 
                    else { currentX++; }
                }
            }
            if (!patternHasBeenChosenForThisBlock || patternVisualEUP > bestEUPPatternResultForThisBlock.visual) {
                bestEUPPatternResultForThisBlock = { visual: patternVisualEUP, base: patternBaseEUP, area: patternAreaEUP, weight: patternWeight, warnings: patternWarnLocal, unitsConfig: currentUnitsForPattern, labelCounter: currentPatternEupLabelCounter, placedThisType: eupPlacedThisPatternAndBlock };
                patternHasBeenChosenForThisBlock = true;
            }
        }
        actualPlacedEUPBase += bestEUPPatternResultForThisBlock.base;
        actualPlacedEUPVisual += bestEUPPatternResultForThisBlock.visual;
        finalTotalAreaBase += bestEUPPatternResultForThisBlock.area;
        currentTotalWeight = bestEUPPatternResultForThisBlock.weight;
        tempWarnings.push(...bestEUPPatternResultForThisBlock.warnings.filter(w => !tempWarnings.some(existing => existing === w)));
        unitsState = JSON.parse(JSON.stringify(bestEUPPatternResultForThisBlock.unitsConfig)); 
        eupLabelGlobalCounter = bestEUPPatternResultForThisBlock.labelCounter;
        placedCountTotalForThisType = bestEUPPatternResultForThisBlock.placedThisType;

        if (!isFill && eupQ_input > 0 && placedCountTotalForThisType < eupQ_input && !tempWarnings.some(w => w.includes("Weight limit"))) {
            const placedEupForInput = unit.palletsVisual.filter(p => p.type === 'euro' && !p.isFillPallet && p.isStackedTier !== 'top').length;
            if (placedEupForInput < eupQ_input) tempWarnings.push(`Could not fit all ${eupQ_input} requested Euro pallets. Placed ${placedEupForInput} (base).`);
        }
      }
    }
    
    finalTotalEuroVisual = unit.palletsVisual.filter(p => p.type === 'euro').length;
    finalTotalDinVisual = unit.palletsVisual.filter(p => p.type === 'industrial').length;
    finalActualEUPBase = unit.palletsVisual.filter(p => p.type === 'euro' && p.isStackedTier !== 'top').length;
    finalActualDINBase = unit.palletsVisual.filter(p => p.type === 'industrial' && p.isStackedTier !== 'top').length;

    const finalPalletArrangement = unitsState.map(unit => ({
      unitId: unit.id, 
      unitLength: truckConfig.units.find(u => u.id === unit.id)?.length || unit.length, 
      unitWidth: truckConfig.units.find(u => u.id === unit.id)?.width || unit.width,
      pallets: Array.isArray(unit.palletsVisual) ? unit.palletsVisual : []
    }));
    
    setPalletArrangement(finalPalletArrangement);
    setLoadedEuroPalletsBase(finalActualEUPBase);
    setLoadedIndustrialPalletsBase(finalActualDINBase);
    setTotalEuroPalletsVisual(finalTotalEuroVisual);
    setTotalDinPalletsVisual(finalTotalDinVisual);
    setTotalWeightKg(currentTotalWeight);

    const totalTruckArea = truckConfig.units.reduce((sum, u) => sum + (u.length * u.width), 0);
    let newUtilization = totalTruckArea > 0 ? (finalTotalAreaBase / totalTruckArea) * 100 : 0;
    setUtilizationPercentage(parseFloat(newUtilization.toFixed(1)));

    if (currentTotalWeight > MAX_GROSS_WEIGHT_KG && !tempWarnings.some(w => w.includes("Gross vehicle weight"))) {
      tempWarnings.push(`Potential gross vehicle weight overload (${(currentTotalWeight / 1000).toFixed(1)}t > ${(MAX_GROSS_WEIGHT_KG / 1000)}t).`);
    }
    if ((finalActualEUPBase + finalActualDINBase) > 0 && currentTotalWeight > 0 && (currentTotalWeight / (finalActualEUPBase + finalActualDINBase)) > 1500 && !tempWarnings.some(w => w.includes("axle load"))) {
      tempWarnings.push('High average weight per pallet footprint. Check axle load distribution.');
    }
    
    if (maximizationAction) {
        const originalEUPs = palletsToPlace.find(p => p.type === 'euro' && !p.isFill)?.originalQuantity || 0;
        const originalDINs = palletsToPlace.find(p => p.type === 'industrial' && !p.isFill)?.originalQuantity || 0;

        if (maximizationAction.calc_mode === 'fill_din_after_eup') {
            const filledDinCount = finalTotalDinVisual - originalDINs;
            if (filledDinCount > 0) {
                tempWarnings.push(`Filled remaining space with ${filledDinCount} DIN pallet(s) after ${originalEUPs} EUP(s).`);
            } else if (originalEUPs > 0) {
                 tempWarnings.push(`No additional DIN pallets could be placed after ${originalEUPs} EUP(s).`);
            } else { // Should be covered by 'industrial' type maximization
                 tempWarnings.push(`Maximized DINs for empty truck: ${finalTotalDinVisual}.`);
            }
        } else if (maximizationAction.calc_mode === 'fill_eup_after_din') {
            const filledEupCount = finalTotalEuroVisual - originalEUPs;
            if (filledEupCount > 0) {
                tempWarnings.push(`Filled remaining space with ${filledEupCount} EUP pallet(s) after ${originalDINs} DIN(s).`);
            } else if (originalDINs > 0) {
                tempWarnings.push(`No additional EUP pallets could be placed after ${originalDINs} DIN(s).`);
            } else { // Should be covered by 'euro' type maximization
                tempWarnings.push(`Maximized EUPs for empty truck: ${finalTotalEuroVisual}.`);
            }
        } else if (maximizationAction.type === 'euro') {
            tempWarnings.push(`Maximized EUPs: ${finalTotalEuroVisual} (single layer).`);
        } else if (maximizationAction.type === 'industrial') {
            tempWarnings.push(`Maximized DINs: ${finalTotalDinVisual} (single layer).`);
        }
    } else { 
        const allEUPRequestedPlaced = finalTotalEuroVisual >= eupQ_input;
        const originalDinQuantityForCheck = (selectedTruck === 'Waggon' && truckConfig.maxDinPallets !== undefined) ? Math.min(dinQ_input, truckConfig.maxDinPallets) : dinQ_input;
        const allDINRequestedPlaced = finalTotalDinVisual >= originalDinQuantityForCheck;
        if (tempWarnings.length === 0 && (eupQ_input > 0 || dinQ_input > 0) && allEUPRequestedPlaced && allDINRequestedPlaced) {
            tempWarnings.push('All requested pallets placed successfully.');
        } else if (tempWarnings.length === 0 && eupQ_input === 0 && dinQ_input === 0) {
            tempWarnings.push('No pallets requested.');
        }
    }
    setWarnings(Array.from(new Set(tempWarnings)));

  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern, maximizationAction]);

  useEffect(() => {
    calculateLoading();
  }, [calculateLoading]); 

  useEffect(() => {
    if (!maximizationAction) return;

    if (maximizationAction.type === 'euro' && maximizationAction.calc_mode !== 'fill_eup_after_din') { 
        setEupQuantity(totalEuroPalletsVisual);
        if (isEUPStackable !== maximizationAction.originalStackState) {
            setIsEUPStackable(maximizationAction.originalStackState);
        }
    } else if (maximizationAction.type === 'industrial' && maximizationAction.calc_mode !== 'fill_din_after_eup') { 
        setDinQuantity(totalDinPalletsVisual);
        if (isDINStackable !== maximizationAction.originalStackState) {
            setIsDINStackable(maximizationAction.originalStackState);
        }
    }
    setMaximizationAction(null);

  }, [maximizationAction, totalEuroPalletsVisual, totalDinPalletsVisual, isEUPStackable, isDINStackable, eupQuantity, dinQuantity, setEupQuantity, setDinQuantity, setIsEUPStackable, setIsDINStackable]);


  const handleQuantityChange = (type, amount) => {
    if (type === 'eup') {
      setEupQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    } else if (type === 'din') {
      setDinQuantity(prev => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    }
  };

  const handleClearAllPallets = () => {
    setEupQuantity(0); setDinQuantity(0);
    setEupWeightPerPallet(''); setDinWeightPerPallet('');
    setIsEUPStackable(false); setIsDINStackable(false);
    setEupLoadingPattern('auto');
    if (maximizationAction) setMaximizationAction(null); 
  };

  const handleMaximizePallets = (palletTypeToMaximize) => {
    if (palletTypeToMaximize === 'industrial') {
      if (eupQuantity > 0) { 
        setMaximizationAction({
          calc_mode: 'fill_din_after_eup',
        });
      } else {
        setMaximizationAction({ type: 'industrial', originalStackState: isDINStackable });
      }
    } else if (palletTypeToMaximize === 'euro') {
      if (dinQuantity > 0) { 
        setMaximizationAction({
          calc_mode: 'fill_eup_after_din',
        });
      } else {
        setMaximizationAction({ type: 'euro', originalStackState: isEUPStackable });
      }
    }
  };

  const renderPallet = (pallet, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) {
      return null;
    }
    const palletDetails = PALLET_TYPES[pallet.type];
    const displayWidth = pallet.height * displayScale; 
    const displayHeight = pallet.width * displayScale;  
    const displayX = pallet.x * displayScale;
    const displayY = pallet.y * displayScale;

    let displayText = '';
    if (pallet.showAsFraction && pallet.displayStackedLabelId) {
      displayText = `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}`;
    } else {
      displayText = `${pallet.labelId}`; 
    }
    
    let titleText = `${palletDetails.name} #${pallet.labelId}`;
    if (pallet.showAsFraction) {
        titleText = `${palletDetails.name} (Stack: ${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId})`;
    }
    if (pallet.isStackedTier === 'top') titleText += ' - Top';
    if (pallet.isStackedTier === 'base') titleText += ' - Base of Stack';
    if (pallet.isFillPallet) titleText += ' (Filled)';

    return (
      <div
        key={pallet.key}
        className={`absolute ${palletDetails.color} ${palletDetails.borderColor} border flex items-center justify-center rounded-sm shadow-sm ${pallet.isFillPallet ? 'opacity-75' : 'opacity-100'}`}
        style={{
          left: `${displayX}px`, top: `${displayY}px`,
          width: `${displayWidth}px`, height: `${displayHeight}px`,
          opacity: pallet.isStackedTier === 'top' ? 0.7 * (pallet.isFillPallet ? 0.75 : 1) : (pallet.isFillPallet ? 0.75 : 1), 
          zIndex: pallet.isStackedTier === 'top' ? 10 : 5, fontSize: '10px',
        }}
        title={titleText}
      >
        <span className="text-black font-semibold select-none">{displayText}</span>
        {pallet.isStackedTier === 'top' && ( 
          <div className="absolute top-0 left-0 w-full h-full border-t-2 border-l-2 border-black opacity-30 pointer-events-none rounded-sm"></div>
        )}
        {pallet.isFillPallet && (
            <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-bl-full opacity-100" title="Filled Pallet"></div>
        )}
      </div>
    );
  };

  const truckVisualizationScale = 0.3;
  const currentTruckDef = TRUCK_TYPES[selectedTruck]; 

  return (
    <div className="container mx-auto p-4 font-sans bg-gray-50 min-h-screen">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-t-lg shadow-lg mb-6">
        <h1 className="text-3xl font-bold text-center tracking-tight">Truck Loading Space Calculator</h1>
        <p className="text-center text-sm opacity-90">Visualize Pallet Placement (European Standards)</p>
      </header>

      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Input Column */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">Truck Type:</label>
              <select id="truckType" name="truckType" value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {Object.keys(TRUCK_TYPES).map(key => (
                  <option key={key} value={key}>{TRUCK_TYPES[key].name}</option>
                ))}
              </select>
            </div>
            <div className="pt-4">
                <button 
                    onClick={handleClearAllPallets} 
                    className="w-full py-2 px-4 bg-red-500 text-white font-semibold rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
                > Clear All Pallets & Settings </button>
            </div>
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industrial Pallets (DIN - 1.2m x 1.0m)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('din', -1)} className="px-3 py-1 bg-red-600 text-white rounded-l-md hover:bg-red-700 transition duration-150 ease-in-out">-</button>
                <input type="number" min="0" id="dinQuantity" name="dinQuantity" value={dinQuantity} onChange={(e) => setDinQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('din', 1)} className="px-3 py-1 bg-green-600 text-white rounded-r-md hover:bg-green-700 transition duration-150 ease-in-out">+</button>
              </div>
              <button 
                onClick={() => handleMaximizePallets('industrial')}
                className="mt-2 w-full py-1.5 px-3 bg-indigo-500 text-white text-xs font-medium rounded-md shadow-sm hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
              > Max. DIN (or Fill) </button>
              <div className="mt-2">
                <label htmlFor="dinWeightPerPallet" className="text-xs font-medium text-gray-600">Weight/DIN (kg):</label>
                <input type="number" min="0" id="dinWeightPerPallet" name="dinWeightPerPallet" value={dinWeightPerPallet} onChange={(e) => setDinWeightPerPallet(e.target.value)} placeholder="e.g. 500" className="mt-1 block w-full py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input id="dinStackable" name="dinStackable" type="checkbox" checked={isDINStackable} onChange={(e) => setIsDINStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="dinStackable" className="ml-2 block text-sm text-gray-900">Stackable (2 high)</label>
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Euro Pallets (EUP - 1.2m x 0.8m)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange('eup', -1)} className="px-3 py-1 bg-red-600 text-white rounded-l-md hover:bg-red-700 transition duration-150 ease-in-out">-</button>
                <input type="number" min="0" id="eupQuantity" name="eupQuantity" value={eupQuantity} onChange={(e) => setEupQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange('eup', 1)} className="px-3 py-1 bg-green-600 text-white rounded-r-md hover:bg-green-700 transition duration-150 ease-in-out">+</button>
              </div>
              <button 
                onClick={() => handleMaximizePallets('euro')}
                className="mt-2 w-full py-1.5 px-3 bg-indigo-500 text-white text-xs font-medium rounded-md shadow-sm hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
              > Max. EUP (or Fill) </button>
              <div className="mt-2">
                <label htmlFor="eupWeightPerPallet" className="text-xs font-medium text-gray-600">Weight/EUP (kg):</label>
                <input type="number" min="0" id="eupWeightPerPallet" name="eupWeightPerPallet" value={eupWeightPerPallet} onChange={(e) => setEupWeightPerPallet(e.target.value)} placeholder="e.g. 400" className="mt-1 block w-full py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input id="eupStackable" name="eupStackable" type="checkbox" checked={isEUPStackable} onChange={(e) => setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="eupStackable" className="ml-2 block text-sm text-gray-900">Stackable (2 high)</label>
              </div>
            </div>

            {eupQuantity > 0 && (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">EUP Loading Pattern:</label>
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center">
                    <input type="radio" id="eupAuto" name="eupLoadingPatternOption" value="auto" checked={eupLoadingPattern === 'auto'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" />
                    <label htmlFor="eupAuto" className="ml-2 text-sm text-gray-700">Auto-Optimize (Best Fit)</label>
                  </div>
                  <div className="flex items-center">
                    <input type="radio" id="eupLong" name="eupLoadingPatternOption" value="long" checked={eupLoadingPattern === 'long'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" />
                    <label htmlFor="eupLong" className="ml-2 text-sm text-gray-700">Lengthwise (3 across, 0.8m wide each)</label>
                  </div>
                  <div className="flex items-center">
                    <input type="radio" id="eupBroad" name="eupLoadingPatternOption" value="broad" checked={eupLoadingPattern === 'broad'} onChange={(e) => setEupLoadingPattern(e.target.value)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" />
                    <label htmlFor="eupBroad" className="ml-2 text-sm text-gray-700">Widthwise (2 across, 1.2m wide each)</label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visualization Column */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm min-h-[450px] flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Truck Loading Area Visualization</p>
            {Array.isArray(palletArrangement) && palletArrangement.map((unitData, index) => (
              <div key={unitData.unitId} className="mb-4 last:mb-0 w-full flex flex-col items-center">
                {TRUCK_TYPES[selectedTruck].units.length > 1 && <p className="text-sm text-center font-medium text-gray-700 mb-1">Unit {index + 1} ({unitData.unitLength / 100}m x {unitData.unitWidth / 100}m)</p>}
                <div
                  id={`truckVisualization-${unitData.unitId}`}
                  className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner"
                  style={{ width: `${unitData.unitWidth * truckVisualizationScale}px`, height: `${unitData.unitLength * truckVisualizationScale}px` }}
                >
                  {selectedTruck === 'curtainSider' && TRUCK_TYPES.curtainSider.trueLength && TRUCK_TYPES.curtainSider.usableLength < TRUCK_TYPES.curtainSider.trueLength && (
                    <>
                      <div className="absolute top-0 left-0 w-full bg-red-300 opacity-30 pointer-events-none"
                        style={{ height: `${((TRUCK_TYPES.curtainSider.trueLength - TRUCK_TYPES.curtainSider.usableLength)) * truckVisualizationScale}px` }}
                        title={`Unusable Space: ${(TRUCK_TYPES.curtainSider.trueLength - TRUCK_TYPES.curtainSider.usableLength) / 100}m`}
                      />
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[8px] text-red-800 bg-white px-1 py-0.5 rounded opacity-80 pointer-events-none whitespace-nowrap">
                        Usable: {TRUCK_TYPES.curtainSider.usableLength / 100}m
                      </div>
                    </>
                  )}
                  {unitData.pallets?.map(p => renderPallet(p, truckVisualizationScale))}
                </div>
              </div>
            ))}
            {selectedTruck === 'curtainSider' && TRUCK_TYPES.curtainSider.trueLength && TRUCK_TYPES.curtainSider.usableLength < TRUCK_TYPES.curtainSider.trueLength && <p className="text-xs text-gray-500 mt-2 text-center">Note: Shaded area indicates unusable space on a 13.6m trailer (~13.2m effective).</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
            <h3 className="text-md font-semibold text-blue-800 mb-2">Loaded Pallets (Visual)</h3>
            <p className="text-sm">Industrial (DIN): <span id="loadedIndustrial" className="font-bold text-lg">{totalDinPalletsVisual}</span></p>
            <p className="text-sm">Euro (EUP): <span id="loadedEuro" className="font-bold text-lg">{totalEuroPalletsVisual}</span></p>
            <p className="text-xs mt-1">(Base: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
            <h3 className="text-md font-semibold text-green-800 mb-2">Area Utilization</h3>
            <p><span id="utilizationPercentage" className="font-bold text-3xl text-green-700">{utilizationPercentage}</span>%</p>
            <p className="text-xs mt-1">(Based on base pallet footprints)</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="text-md font-semibold text-yellow-800 mb-2">Estimated Weight</h3>
            <p><span id="totalWeight" className="font-bold text-2xl text-yellow-700">{(totalWeightKg / 1000).toFixed(1)}</span> t</p>
            <p className="text-xs mt-1">(Max Payload: {MAX_GROSS_WEIGHT_KG / 1000}t)</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
            <h3 className="text-md font-semibold text-red-800 mb-2">Notifications</h3>
            <ul id="warningsList" className="list-disc list-inside text-sm space-y-1 text-red-700">
              {warnings.length > 0 ? warnings.map((warning, index) => <li key={index}>{warning}</li>) : <li className="text-gray-500">No issues detected.</li>}
            </ul>
          </div>
        </div>

        {((isEUPStackable && totalEuroPalletsVisual > loadedEuroPalletsBase) || (isDINStackable && totalDinPalletsVisual > loadedIndustrialPalletsBase)) && (loadedIndustrialPalletsBase > 0 || loadedEuroPalletsBase > 0) && (
          <div className="mb-8 bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-center items-center">
            <p className="text-gray-600 text-md mb-3 font-semibold">Side View (Conceptual)</p>
            <div id="sideViewVisualization" className="w-full h-auto bg-gray-200 rounded flex justify-center items-end p-4 min-h-[100px] space-x-2">
              {Array.from({ length: Math.min(3, loadedIndustrialPalletsBase) }).map((_, idx) => {
                const palletDetails = PALLET_TYPES.industrial;
                const showStackedDinConcept = isDINStackable && totalDinPalletsVisual > loadedIndustrialPalletsBase; 
                const baseDisplayId = idx * 2 + 1; const stackedDisplayId = baseDisplayId + 1; 
                const labelText = showStackedDinConcept ? `${baseDisplayId}/${stackedDisplayId}` : `${baseDisplayId}`;
                return (
                  <div key={`sideview-din-${idx}`} className="flex flex-col items-center" title={`Industrial Pallet Stack ${baseDisplayId}${showStackedDinConcept ? ` & ${stackedDisplayId}`:''} (Side View)`}>
                    {showStackedDinConcept && <div className={`w-10 h-8 ${palletDetails.color} border ${palletDetails.borderColor} opacity-60 flex justify-center items-center text-xs font-bold rounded-t-sm`}>{labelText}</div>}
                    <div className={`w-10 h-8 ${palletDetails.color} border ${palletDetails.borderColor} ${showStackedDinConcept ? 'rounded-b-sm' : 'rounded-sm'} flex justify-center items-center text-xs font-bold`}>{showStackedDinConcept ? labelText : labelText}</div>
                  </div>
                );
              })}
              {Array.from({ length: Math.min(3, loadedEuroPalletsBase) }).map((_, idx) => {
                const palletDetails = PALLET_TYPES.euro;
                const showStackedEupConcept = isEUPStackable && totalEuroPalletsVisual > loadedEuroPalletsBase;
                const baseDisplayId = idx * 2 + 1 + (isDINStackable ? Math.min(3, loadedIndustrialPalletsBase) * 2 : 0);
                const stackedDisplayId = baseDisplayId + 1;
                const labelText = showStackedEupConcept ? `${baseDisplayId}/${stackedDisplayId}` : `${baseDisplayId}`;
                return (
                  <div key={`sideview-eup-${idx}`} className="flex flex-col items-center" title={`Euro Pallet Stack ${baseDisplayId}${showStackedEupConcept ? ` & ${stackedDisplayId}`:''} (Side View)`}>
                    {showStackedEupConcept && <div className={`w-8 h-8 ${palletDetails.color} border ${palletDetails.borderColor} opacity-60 flex justify-center items-center text-xs font-bold rounded-t-sm`}>{labelText}</div>}
                    <div className={`w-8 h-8 ${palletDetails.color} border ${palletDetails.borderColor} ${showStackedEupConcept ? 'rounded-b-sm' : 'rounded-sm'} flex justify-center items-center text-xs font-bold`}>{showStackedEupConcept ? labelText : labelText}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      <footer className="text-center text-sm text-gray-500 py-6">
        <p>&copy; ${new Date().getFullYear()} Truck Loader App. All rights reserved.</p>
        <p>Pallet dimensions: EUP 1.2m x 0.8m, DIN 1.2m x 1.0m.</p>
      </footer>
    </div>
  );
}

