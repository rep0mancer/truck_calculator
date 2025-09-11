"use server";

/**
 * Centralised loading logic and definitions for pallet placement.
 * The heavy calculation is extracted into this server module so the page
 * component can remain lightweight. Portions of the algorithm are broken
 * into smaller helpers for readability and easier testing.
 */

export type Pattern = "auto" | "long" | "broad" | "none";
export type PlacementOrder = "DIN_FIRST" | "EUP_FIRST";
export type TruckKey = keyof typeof TRUCK_TYPES;

export const TRUCK_TYPES: any = {
  roadTrain: {
    name: "Hängerzug (2x 7,2m)",
    units: [
      { id: "unit1", length: 720, width: 245, occupiedRects: [] },
      { id: "unit2", length: 720, width: 245, occupiedRects: [] },
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
    name: "Planensattel Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 245, occupiedRects: [] }],
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
    name: "Frigo (Kühler) Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 245, occupiedRects: [] }],
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
    name: "Motorwagen (7.2m)",
    units: [{ id: "main", length: 720, width: 245, occupiedRects: [] }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    singleLayerEUPCapacityLong: 18,
    singleLayerEUPCapacityBroad: 18,
    singleLayerDINCapacity: 14,
    maxGrossWeightKg: 10000,
  },
  Waggon: {
    name: "Waggon Hbbils (15,2m)",
    units: [{ id: "main", length: 1520, width: 290, occupiedRects: [] }],
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
    name: "Waggon KRM",
    units: [{ id: "main", length: 1600, width: 290, occupiedRects: [] }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    singleLayerEUPCapacityLong: 38,
    singleLayerEUPCapacityBroad: 40,
    singleLayerDINCapacity: 28,
    maxDinPallets: 28,
    maxGrossWeightKg: 24000,
  },
};

export const PALLET_TYPES: any = {
  euro: {
    name: "Euro Palette (1.2m x 0.8m)",
    type: "euro",
    length: 120,
    width: 80,
    area: 120 * 80,
    color: "bg-blue-500",
    borderColor: "border-blue-700",
  },
  industrial: {
    name: "Industrial Palette (1.2m x 1.0m)",
    type: "industrial",
    length: 120,
    width: 100,
    area: 120 * 100,
    color: "bg-green-500",
    borderColor: "border-green-700",
  },
};

export const MAX_PALLET_SIMULATION_QUANTITY = 300;
export const MAX_GROSS_WEIGHT_KG = 24000;
export const STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING = 18;
export const STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING = 16;
export const MAX_WEIGHT_PER_METER_KG = 1800;

function cloneTruckConfig(truckKey: TruckKey) {
  return structuredClone(TRUCK_TYPES[truckKey]);
}

function parseWeights(eupWeightStr: string, dinWeightStr: string) {
  const eupWeight = parseFloat(eupWeightStr) || 0;
  const dinWeight = parseFloat(dinWeightStr) || 0;
  return {
    safeEupWeight: eupWeight > 0 ? eupWeight : 0,
    safeDinWeight: dinWeight > 0 ? dinWeight : 0,
  };
}

function computeAllowedStack(isStackable: boolean, max?: number | string) {
  const n = max !== undefined ? Number(max) : undefined;
  return isStackable ? (n && n > 0 ? Math.floor(n / 2) : Infinity) : 0;
}

function initializeUnits(truckConfig: any) {
  return truckConfig.units.map((u: any) => ({
    ...u,
    occupiedRects: [],
    currentX: 0,
    currentY: 0,
    palletsVisual: [],
    dinEndX: 0,
    dinEndY: 0,
    dinLastRowIncomplete: false,
    eupStartX: 0,
    eupEndX: 0,
    eupEndY: 0,
    eupLastRowIncomplete: false,
    dinStartX: 0,
  }));
}

function enforceDinLimit(
  truckConfig: any,
  requestedDinQuantity: number,
  tempWarnings: string[]
) {
  let dinQuantity = requestedDinQuantity;
  if (
    truckConfig.maxDinPallets !== undefined &&
    dinQuantity > truckConfig.maxDinPallets
  ) {
    if (
      requestedDinQuantity > truckConfig.maxDinPallets &&
      requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY
    ) {
      tempWarnings.push(
        `${truckConfig.name.trim()} maximale DIN-Kapazität ist ${truckConfig.maxDinPallets}. ` +
          `Angeforderte Menge ${requestedDinQuantity}, es werden ${truckConfig.maxDinPallets} platziert.`
      );
    }
    dinQuantity = truckConfig.maxDinPallets;
  }
  return dinQuantity;
}

function finalizeResult(
  unitsState: any[],
  truckConfig: any,
  tempWarnings: string[],
  currentTotalWeight: number,
  finalTotalAreaBase: number,
  finalTotalEuroVisual: number,
  finalTotalDinVisual: number,
  finalActualEUPBase: number,
  finalActualDINBase: number,
  currentEupLoadingPattern: Pattern,
  placementOrder: PlacementOrder,
  bestEUPResultConfig: any,
  bestEUPResultConfig_DIN_FIRST: any
) {
  const finalPalletArrangement = unitsState.map((u: any) => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: u.palletsVisual,
  }));
  const totalPracticalArea = truckConfig.usableLength * truckConfig.maxWidth;
  const util =
    totalPracticalArea > 0
      ? (finalTotalAreaBase / totalPracticalArea) * 100
      : 0;
  const utilizationPercentage = parseFloat(util.toFixed(1));
  const usedLength =
    truckConfig.maxWidth > 0 ? finalTotalAreaBase / truckConfig.maxWidth : 0;
  const usedLengthPercentage =
    truckConfig.usableLength > 0
      ? (usedLength / truckConfig.usableLength) * 100
      : 0;
  const weightPerMeter =
    usedLength > 0 ? currentTotalWeight / (usedLength / 100) : 0;
  if (weightPerMeter >= MAX_WEIGHT_PER_METER_KG) {
    tempWarnings.push(
      `ACHTUNG – mögliche Achslastüberschreitung: ${weightPerMeter.toFixed(1)} kg/m`
    );
  }
  if (currentTotalWeight >= 10500 && usedLengthPercentage <= 40) {
    tempWarnings.push(
      "ACHTUNG – mehr als 11t auf weniger als 40% der Ladefläche"
    );
  }
  const stackedEupPallets = finalTotalEuroVisual - finalActualEUPBase;
  const stackedDinPallets = finalTotalDinVisual - finalActualDINBase;
  if (stackedEupPallets >= STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING) {
    if (!tempWarnings.some((w) => w.includes("ACHSLAST bei EUP"))) {
      tempWarnings.push(
        `ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${stackedEupPallets} gestapelte EUP)`
      );
    }
  }
  if (stackedDinPallets >= STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING) {
    if (!tempWarnings.some((w) => w.includes("ACHSLAST bei DIN"))) {
      tempWarnings.push(
        `ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${stackedDinPallets} gestapelte DIN)`
      );
    }
  }
  const uniqueWarnings = Array.from(new Set(tempWarnings));
  let determinedEupPatternForReturn = currentEupLoadingPattern;
  if (
    placementOrder === "EUP_FIRST" &&
    bestEUPResultConfig &&
    typeof bestEUPResultConfig.chosenPattern !== "undefined"
  ) {
    determinedEupPatternForReturn = bestEUPResultConfig.chosenPattern;
  } else if (
    placementOrder === "DIN_FIRST" &&
    bestEUPResultConfig_DIN_FIRST &&
    typeof bestEUPResultConfig_DIN_FIRST.chosenPattern !== "undefined"
  ) {
    determinedEupPatternForReturn =
      bestEUPResultConfig_DIN_FIRST.chosenPattern;
  }
  return {
    palletArrangement: finalPalletArrangement,
    loadedIndustrialPalletsBase: finalActualDINBase,
    loadedEuroPalletsBase: finalActualEUPBase,
    totalDinPalletsVisual: finalTotalDinVisual,
    totalEuroPalletsVisual: finalTotalEuroVisual,
    utilizationPercentage,
    warnings: uniqueWarnings,
    totalWeightKg: currentTotalWeight,
    eupLoadingPatternUsed: determinedEupPatternForReturn,
  };
}

export const calculateLoadingLogic = (
  truckKey: TruckKey,
  requestedEupQuantity: number,
  requestedDinQuantity: number,
  currentIsEUPStackable: boolean,
  currentIsDINStackable: boolean,
  eupWeightStr: string,
  dinWeightStr: string,
  currentEupLoadingPattern: Pattern,
  placementOrder: PlacementOrder = "DIN_FIRST",
  maxStackedEup?: number | string,
  maxStackedDin?: number | string
) => {
  const truckConfig = cloneTruckConfig(truckKey);
  const weightLimit = truckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;
  let tempWarnings: string[] = [];
  let finalTotalEuroVisual = 0;
  let finalTotalDinVisual = 0;
  let finalActualEUPBase = 0;
  let finalActualDINBase = 0;
  let finalTotalAreaBase = 0;
  let currentTotalWeight = 0;
  let dinLabelGlobalCounter = 0;
  let eupLabelGlobalCounter = 0;

  const { safeEupWeight, safeDinWeight } = parseWeights(
    eupWeightStr,
    dinWeightStr
  );
  const allowedEupStack = computeAllowedStack(
    currentIsEUPStackable,
    maxStackedEup
  );
  const allowedDinStack = computeAllowedStack(
    currentIsDINStackable,
    maxStackedDin
  );
  let eupStacked = 0,
    dinStacked = 0;

  let unitsState = initializeUnits(truckConfig);

  let dinQuantityToPlace = enforceDinLimit(
    truckConfig,
    requestedDinQuantity,
    tempWarnings
  );
  let eupQuantityToPlace = requestedEupQuantity;

  let bestEUPResultConfig: any = undefined;
  let bestEUPResultConfig_DIN_FIRST: any = undefined;

  // -- Placement algorithm --
  if (placementOrder === 'EUP_FIRST') {
    bestEUPResultConfig = {
        unitsConfiguration: JSON.parse(JSON.stringify(unitsState)),
        totalVisualEUPs: 0, baseEUPs: 0, areaEUPs: 0, tempWarnings: [],
        currentWeightAfterEUPs: currentTotalWeight,
        chosenPattern: (currentEupLoadingPattern !== 'auto' ? currentEupLoadingPattern : 'none'),
        finalEupLabelCounter: eupLabelGlobalCounter,
    };

    if (eupQuantityToPlace > 0) {
        const patternsToTry = currentEupLoadingPattern === 'auto' ? ['long', 'broad'] : [currentEupLoadingPattern];
        let aPatternHasBeenSetAsBest = (currentEupLoadingPattern !== 'auto');

        for (const pattern of patternsToTry) {
            let currentUnitsAttempt = JSON.parse(JSON.stringify(unitsState));
            let patternVisualEUP = 0, patternBaseEUP = 0, patternAreaEUP = 0;
            let patternWeight = currentTotalWeight;
            let patternWarnLocal: string[] = [];
            let patternRemainingEup = eupQuantityToPlace;
            let currentPatternEupCounter = eupLabelGlobalCounter;

            for (const unit of currentUnitsAttempt) {
                if (patternRemainingEup <= 0) break;
                unit.currentX = 0; unit.currentY = 0;
                const effectiveLength = unit.length;
                while (unit.currentX < effectiveLength) {
                    if (patternRemainingEup <= 0) break;
                    let rowCount = 0; const eupDef = PALLET_TYPES.euro;
                    const palletsPerRow = (pattern === 'long' ? 3 : 2);
                    const eupLen = pattern === 'long' ? eupDef.length : eupDef.width;
                    const eupWid = pattern === 'long' ? eupDef.width : eupDef.length;
                    let rowHeight = 0; unit.currentY = 0;
                    for (let i = 0; i < palletsPerRow; i++) {
                        if (patternRemainingEup <= 0) break;
                        if (safeEupWeight > 0 && patternWeight + safeEupWeight > weightLimit) {
                            if (!patternWarnLocal.some(w => w.includes('Gewichtslimit für EUP'))) patternWarnLocal.push(`Gewichtslimit für EUP-Paletten erreicht. Max ${weightLimit / 1000}t.`);
                            unit.currentX = effectiveLength; break;
                        }
                        if (unit.currentX + eupLen <= effectiveLength && unit.currentY + eupWid <= unit.width) {
                            const baseEupLabelId = ++currentPatternEupCounter; let stackedEupLabelId = null;
                            const baseEupPallet = {
                                x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid, type: 'euro',
                                isStackedTier: null, key: `eup_base_${unit.id}_${patternBaseEUP}_${pattern}_${i}`, unitId: unit.id,
                                labelId: baseEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: null, showAsFraction: false,
                            };
                            unit.palletsVisual.push(baseEupPallet);
                            unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid });
                            patternAreaEUP += eupDef.area; patternBaseEUP++; patternVisualEUP++;
                            patternWeight += safeEupWeight; patternRemainingEup--; rowCount++;
                            rowHeight = Math.max(rowHeight, eupLen);
                            if (currentIsEUPStackable && patternRemainingEup > 0 && eupStacked < allowedEupStack) {
                                if (!(safeEupWeight > 0 && patternWeight + safeEupWeight > weightLimit)) {
                                    stackedEupLabelId = ++currentPatternEupCounter;
                                    baseEupPallet.showAsFraction = true; baseEupPallet.displayStackedLabelId = stackedEupLabelId; baseEupPallet.isStackedTier = 'base';
                                    unit.palletsVisual.push({
                                       ...baseEupPallet, isStackedTier: 'top', key: `eup_stack_${unit.id}_${patternBaseEUP - 1}_${pattern}_${i}`,
                                        labelId: stackedEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: stackedEupLabelId, showAsFraction: true,
                                    });
                                    patternVisualEUP++; patternWeight += safeEupWeight; patternRemainingEup--; eupStacked++;
                                } else if (!patternWarnLocal.some(w => w.includes('Stapeln von EUP'))) patternWarnLocal.push('Gewichtslimit beim Stapeln von EUP.');
                            }
                            unit.currentY += eupWid;
                        } else break;
                    }
                    if (unit.currentX >= effectiveLength) break;
                    if (rowCount > 0) unit.currentX += rowHeight; else unit.currentX = effectiveLength;
                }
                unit.eupEndX = unit.currentX; unit.eupEndY = unit.currentY;
            }
            let updateBestResult = false;
            if (currentEupLoadingPattern === 'auto') {
                if (!aPatternHasBeenSetAsBest || patternVisualEUP > bestEUPResultConfig.totalVisualEUPs ||
                    (patternVisualEUP === bestEUPResultConfig.totalVisualEUPs && pattern === 'broad' && bestEUPResultConfig.chosenPattern === 'long')) {
                    updateBestResult = true;
                    if (!aPatternHasBeenSetAsBest) aPatternHasBeenSetAsBest = true;
                }
            } else updateBestResult = true;

            if (updateBestResult) {
                bestEUPResultConfig = {
                    unitsConfiguration: JSON.parse(JSON.stringify(currentUnitsAttempt)),
                    totalVisualEUPs: patternVisualEUP, baseEUPs: patternBaseEUP, areaEUPs: patternAreaEUP,
                    tempWarnings: patternWarnLocal, currentWeightAfterEUPs: patternWeight,
                    chosenPattern: pattern, finalEupLabelCounter: currentPatternEupCounter,
                };
            }
        }
        unitsState = bestEUPResultConfig.unitsConfiguration;
        finalActualEUPBase = bestEUPResultConfig.baseEUPs;
        finalTotalEuroVisual = bestEUPResultConfig.totalVisualEUPs;
        finalTotalAreaBase += bestEUPResultConfig.areaEUPs;
        currentTotalWeight = bestEUPResultConfig.currentWeightAfterEUPs;
        tempWarnings.push(...bestEUPResultConfig.tempWarnings.filter(w => !tempWarnings.includes(w)));
        eupLabelGlobalCounter = bestEUPResultConfig.finalEupLabelCounter;

        if (finalTotalEuroVisual < eupQuantityToPlace && !tempWarnings.some(w => w.includes('Gewichtslimit')) && requestedEupQuantity !== MAX_PALLET_SIMULATION_QUANTITY) {
            const message = (eupQuantityToPlace >= MAX_PALLET_SIMULATION_QUANTITY && placementOrder === 'EUP_FIRST')
                ? `Konnte den LKW nicht vollständig mit Europaletten beladen. ${finalTotalEuroVisual} (visuell) platziert mit Muster '${bestEUPResultConfig.chosenPattern}'.`
                : `Konnte nicht alle ${eupQuantityToPlace} Europaletten laden. Nur ${finalTotalEuroVisual} (visuell) platziert mit Muster '${bestEUPResultConfig.chosenPattern}'.`;
            tempWarnings.push(message);
        }
    }
    unitsState.forEach(unit => unit.dinStartX = unit.eupEndX);

    let dinPlacedCountTotalSecondary = 0;
    if (dinQuantityToPlace > 0) {
        for (const unit of unitsState) {
            if (dinPlacedCountTotalSecondary >= dinQuantityToPlace) break;
            unit.currentX = unit.dinStartX; unit.currentY = 0;
            while (unit.currentX < unit.length) {
                if (dinPlacedCountTotalSecondary >= dinQuantityToPlace) break;
                let rowPalletsPlaced = 0; const dinDef = PALLET_TYPES.industrial;
                const dinLength = dinDef.width; const dinWidth = dinDef.length;
                let rowHeight = 0; unit.currentY = 0;
                for (let i = 0; i < 2; i++) {
                    if (dinPlacedCountTotalSecondary >= dinQuantityToPlace) break;
                    if (safeDinWeight > 0 && currentTotalWeight + safeDinWeight > weightLimit) {
                        if (!tempWarnings.some(w => w.includes("Gewichtslimit für DIN"))) tempWarnings.push(`Gewichtslimit für DIN-Paletten erreicht. Max ${weightLimit / 1000}t.`);
                        unit.currentX = unit.length; break;
                    }
                    if (unit.currentX + dinLength <= unit.length && unit.currentY + dinWidth <= unit.width) {
                        const baseDinLabelId = ++dinLabelGlobalCounter; let stackedDinLabelId = null;
                        const baseDinPallet = {
                            x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth, type: 'industrial',
                            isStackedTier: null, key: `din_base_sec_${unit.id}_${finalActualDINBase}_${i}`, unitId: unit.id,
                            labelId: baseDinLabelId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: null, showAsFraction: false,
                        };
                        unit.palletsVisual.push(baseDinPallet);
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth });
                        finalTotalAreaBase += dinDef.area; finalActualDINBase++; finalTotalDinVisual++;
                        currentTotalWeight += safeDinWeight; dinPlacedCountTotalSecondary++; rowPalletsPlaced++;
                        rowHeight = Math.max(rowHeight, dinLength);
                        if (currentIsDINStackable && dinPlacedCountTotalSecondary < dinQuantityToPlace && dinStacked < allowedDinStack) {
                            if (!(safeDinWeight > 0 && currentTotalWeight + safeDinWeight > weightLimit)) {
                                stackedDinLabelId = ++dinLabelGlobalCounter;
                                baseDinPallet.showAsFraction = true; baseDinPallet.displayStackedLabelId = stackedDinLabelId; baseDinPallet.isStackedTier = 'base';
                                unit.palletsVisual.push({
                                   ...baseDinPallet, isStackedTier: 'top', key: `din_stack_sec_${unit.id}_${finalActualDINBase - 1}_${i}`,
                                    labelId: stackedDinLabelId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: stackedDinLabelId, showAsFraction: true,
                                });
                                finalTotalDinVisual++; currentTotalWeight += safeDinWeight; dinPlacedCountTotalSecondary++; dinStacked++;
                            } else if (!tempWarnings.some(w => w.includes("Stapeln von DIN"))) tempWarnings.push('Gewichtslimit beim Stapeln von DIN.');
                        }
                        unit.currentY += dinWidth;
                    } else break;
                }
                if (unit.currentX >= unit.length) break;
                if (rowPalletsPlaced > 0) unit.currentX += rowHeight; else unit.currentX = unit.length;
            }
        }
    }
    if (dinPlacedCountTotalSecondary < dinQuantityToPlace && !tempWarnings.some(w => w.includes("Gewichtslimit") || w.includes("Kapazität ist")) && requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY) {
         const message = (dinQuantityToPlace >= MAX_PALLET_SIMULATION_QUANTITY && placementOrder === 'EUP_FIRST')
            ? `Konnte den LKW nicht vollständig mit Industriepaletten (nach EUPs) auffüllen. Nur ${dinPlacedCountTotalSecondary} platziert.`
            : `Konnte nicht alle ${dinQuantityToPlace} Industriepaletten laden (nach EUPs). Nur ${dinPlacedCountTotalSecondary} platziert.`;
        tempWarnings.push(message);
    }

  } else { // placementOrder === 'DIN_FIRST'
    let dinPlacedCountTotalPrimary = 0;
    if (dinQuantityToPlace > 0) {
        for (const unit of unitsState) {
            if (dinPlacedCountTotalPrimary >= dinQuantityToPlace) break;
            while (unit.currentX < unit.length) {
                if (dinPlacedCountTotalPrimary >= dinQuantityToPlace) break;
                let rowPalletsPlaced = 0; const dinDef = PALLET_TYPES.industrial;
                const dinLength = dinDef.width; const dinWidth = dinDef.length;
                let rowHeight = 0; unit.currentY = 0;
                for (let i = 0; i < 2; i++) {
                    if (dinPlacedCountTotalPrimary >= dinQuantityToPlace) break;
                    if (safeDinWeight > 0 && currentTotalWeight + safeDinWeight > weightLimit) {
                        if (!tempWarnings.some(w => w.includes("Gewichtslimit für DIN"))) tempWarnings.push(`Gewichtslimit für DIN-Paletten erreicht. Max ${weightLimit / 1000}t.`);
                        unit.currentX = unit.length; break;
                    }
                    if (unit.currentX + dinLength <= unit.length && unit.currentY + dinWidth <= unit.width) {
                        const baseDinLabelId = ++dinLabelGlobalCounter; let stackedDinLabelId = null;
                        const baseDinPallet = {
                            x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth, type: 'industrial',
                            isStackedTier: null, key: `din_base_pri_${unit.id}_${finalActualDINBase}_${i}`, unitId: unit.id,
                            labelId: baseDinLabelId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: null, showAsFraction: false,
                        };
                        unit.palletsVisual.push(baseDinPallet);
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth });
                        finalTotalAreaBase += dinDef.area; finalActualDINBase++; finalTotalDinVisual++;
                        currentTotalWeight += safeDinWeight; dinPlacedCountTotalPrimary++; rowPalletsPlaced++;
                        rowHeight = Math.max(rowHeight, dinLength);
                        if (currentIsDINStackable && dinPlacedCountTotalPrimary < dinQuantityToPlace && dinStacked < allowedDinStack) {
                            if (!(safeDinWeight > 0 && currentTotalWeight + safeDinWeight > weightLimit)) {
                                stackedDinLabelId = ++dinLabelGlobalCounter;
                                baseDinPallet.showAsFraction = true; baseDinPallet.displayStackedLabelId = stackedDinLabelId; baseDinPallet.isStackedTier = 'base';
                                unit.palletsVisual.push({
                                   ...baseDinPallet, isStackedTier: 'top', key: `din_stack_pri_${unit.id}_${finalActualDINBase - 1}_${i}`,
                                    labelId: stackedDinLabelId, displayBaseLabelId: baseDinLabelId, displayStackedLabelId: stackedDinLabelId, showAsFraction: true,
                                });
                                finalTotalDinVisual++; currentTotalWeight += safeDinWeight; dinPlacedCountTotalPrimary++; dinStacked++;
                            } else if (!tempWarnings.some(w => w.includes("Stapeln von DIN"))) tempWarnings.push('Gewichtslimit beim Stapeln von DIN.');
                        }
                        unit.currentY += dinWidth;
                    } else break;
                }
                if (unit.currentX >= unit.length) break;
                if (rowPalletsPlaced > 0) unit.currentX += rowHeight; else unit.currentX = unit.length;
            }
            unit.dinEndX = unit.currentX; unit.dinEndY = unit.currentY; unit.dinLastRowIncomplete = (rowPalletsPlaced === 1 && unit.width / PALLET_TYPES.industrial.length >= 2);
        }
    }
    if (dinPlacedCountTotalPrimary < dinQuantityToPlace && !tempWarnings.some(w => w.includes("Gewichtslimit") || w.includes("Kapazität ist")) && requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY) {
        const message = (dinQuantityToPlace >= MAX_PALLET_SIMULATION_QUANTITY && placementOrder === 'DIN_FIRST')
            ? `Konnte den LKW nicht vollständig mit Industriepaletten beladen. ${dinPlacedCountTotalPrimary} platziert.`
            : `Konnte nicht alle ${dinQuantityToPlace} Industriepaletten laden. Nur ${dinPlacedCountTotalPrimary} platziert.`;
        tempWarnings.push(message);
    }

    if (eupQuantityToPlace > 0) {
        const tryLongFirst = true;
        for (const unit of unitsState) {
            unit.eupStartX = unit.currentX; unit.eupEndX = unit.currentX; unit.eupEndY = unit.currentY;
            if (!unit.dinLastRowIncomplete) continue;
            const gapX = unit.dinEndX - PALLET_TYPES.industrial.width; const gapY = PALLET_TYPES.industrial.length;
            const gapWidth = unit.width - gapY; const dinLenInRow = PALLET_TYPES.industrial.width;
            const eupDef = PALLET_TYPES.euro; let placedInGap = false, gapConfig = null as any;
            if (gapWidth >= eupDef.length && dinLenInRow >= eupDef.width && patternRemainingEup > 0) {
                if (!(safeEupWeight > 0 && currentTotalWeight + safeEupWeight > weightLimit)) {
                    gapConfig = { x: gapX, y: gapY, width: eupDef.length, height: eupDef.width, type: 'euro', keySuffix: `_gap_long` }; placedInGap = true;
                } else if (!tempWarnings.some(w => w.includes('EUP Lücke'))) tempWarnings.push('Gewichtslimit für EUP in Lücke.');
            } else if (gapWidth >= eupDef.width && dinLenInRow >= eupDef.length && patternRemainingEup > 0) {
                if (!(safeEupWeight > 0 && currentTotalWeight + safeEupWeight > weightLimit)) {
                    gapConfig = { x: gapX, y: gapY, width: eupDef.width, height: eupDef.length, type: 'euro', keySuffix: `_gap_broad` }; placedInGap = true;
                } else if (!tempWarnings.some(w => w.includes('EUP Lücke'))) tempWarnings.push('Gewichtslimit für EUP in Lücke.');
            }
            if (!placedInGap && eupQuantityToPlace > 0) {
                if (tryLongFirst && gapWidth >= eupDef.length && dinLenInRow >= eupDef.width) {
                    if (!(safeEupWeight > 0 && currentTotalWeight + safeEupWeight > weightLimit)) {
                        gapConfig = { x: gapX, y: gapY, width: eupDef.length, height: eupDef.width, type: 'euro', keySuffix: `_gap_long_fallback` }; placedInGap = true;
                    } else if (!tempWarnings.some(w => w.includes('EUP Lücke'))) tempWarnings.push('Gewichtslimit für EUP in Lücke.');
                } else if (!tryLongFirst && gapWidth >= eupDef.width && dinLenInRow >= eupDef.length && patternRemainingEup > 0) {
                    if (!(safeEupWeight > 0 && currentTotalWeight + safeEupWeight > weightLimit)) {
                        gapConfig = { x: gapX, y: gapY, width: eupDef.width, height: eupDef.length, type: 'euro', keySuffix: `_gap_broad_fallback` }; placedInGap = true;
                    } else if (!tempWarnings.some(w => w.includes('EUP Lücke'))) tempWarnings.push('Gewichtslimit für EUP in Lücke.');
                } else if (!tryLongFirst && gapWidth >= eupDef.length && dinLenInRow >= eupDef.width && patternRemainingEup > 0) {
                    if (!(safeEupWeight > 0 && currentTotalWeight + safeEupWeight > weightLimit)) {
                        gapConfig = { x: gapX, y: gapY, width: eupDef.length, height: eupDef.width, type: 'euro', keySuffix: `_gap_long_fallback` }; placedInGap = true;
                    } else if (!tempWarnings.some(w => w.includes('EUP Lücke'))) tempWarnings.push('Gewichtslimit für EUP in Lücke.');
                }
            }
            if (placedInGap && gapConfig) {
                const baseEupLabelId = ++eupLabelGlobalCounter; let stackedEupLabelId = null;
                const baseGapPallet = {
                   ...gapConfig, isStackedTier: null, key: `eup_gap_base_${finalActualEUPBase}${gapConfig.keySuffix}`, unitId: unit.id,
                    labelId: baseEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: null, showAsFraction: false,
                };
                unit.palletsVisual.push(baseGapPallet);
                unit.occupiedRects.push({ x: gapConfig.x, y: gapConfig.y, width: gapConfig.width, height: gapConfig.height });
                finalTotalAreaBase += eupDef.area; finalActualEUPBase++; finalTotalEuroVisual++;
                currentTotalWeight += safeEupWeight; eupQuantityToPlace--;
                if (currentIsEUPStackable && eupQuantityToPlace > 0 && eupStacked < allowedEupStack) {
                    if (!(safeEupWeight > 0 && currentTotalWeight + safeEupWeight > weightLimit)) {
                        stackedEupLabelId = ++eupLabelGlobalCounter;
                        baseGapPallet.showAsFraction = true; baseGapPallet.displayStackedLabelId = stackedEupLabelId; baseGapPallet.isStackedTier = 'base';
                        unit.palletsVisual.push({
                           ...baseGapPallet, isStackedTier: 'top', key: `eup_gap_stack_${finalActualEUPBase - 1}${gapConfig.keySuffix}`,
                            labelId: stackedEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: stackedEupLabelId, showAsFraction: true,
                        });
                        finalTotalEuroVisual++; currentTotalWeight += safeEupWeight; eupQuantityToPlace--; eupStacked++;
                    } else if (!tempWarnings.some(w => w.includes('Stapeln EUP Lücke'))) tempWarnings.push('Gewichtslimit Stapeln EUP Lücke.');
                }
                unit.eupStartX = unit.dinEndX;
            }
        }
        for (const unit of unitsState) {
            if (eupQuantityToPlace <= 0) break;
            unit.currentX = unit.eupStartX; unit.currentY = 0;
            const effectiveLength = unit.length;
            while (unit.currentX < effectiveLength) {
                if (eupQuantityToPlace <= 0) break;
                let rowCount = 0; const eupDef = PALLET_TYPES.euro;
                const palletsPerRow = (tryLongFirst ? 3 : 2);
                const eupLen = tryLongFirst ? eupDef.length : eupDef.width;
                const eupWid = tryLongFirst ? eupDef.width : eupDef.length;
                let rowHeight = 0; unit.currentY = 0;
                for (let i = 0; i < palletsPerRow; i++) {
                    if (eupQuantityToPlace <= 0) break;
                    if (safeEupWeight > 0 && currentTotalWeight + safeEupWeight > weightLimit) {
                        if (!tempWarnings.some(w => w.includes('Gewichtslimit für EUP'))) tempWarnings.push(`Gewichtslimit für EUP-Paletten erreicht. Max ${weightLimit / 1000}t.`);
                        unit.currentX = effectiveLength; break;
                    }
                    if (unit.currentX + eupLen <= effectiveLength && unit.currentY + eupWid <= unit.width) {
                        const baseEupLabelId = ++eupLabelGlobalCounter; let stackedEupLabelId = null;
                        const baseEupPallet = {
                            x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid, type: 'euro',
                            isStackedTier: null, key: `eup_base_pri_${unit.id}_${finalActualEUPBase}_${i}`, unitId: unit.id,
                            labelId: baseEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: null, showAsFraction: false,
                        };
                        unit.palletsVisual.push(baseEupPallet);
                        unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid });
                        finalTotalAreaBase += eupDef.area; finalActualEUPBase++; finalTotalEuroVisual++;
                        currentTotalWeight += safeEupWeight; eupQuantityToPlace--; rowCount++;
                        rowHeight = Math.max(rowHeight, eupLen);
                        if (currentIsEUPStackable && eupQuantityToPlace > 0 && eupStacked < allowedEupStack) {
                            if (!(safeEupWeight > 0 && currentTotalWeight + safeEupWeight > weightLimit)) {
                                stackedEupLabelId = ++eupLabelGlobalCounter;
                                baseEupPallet.showAsFraction = true; baseEupPallet.displayStackedLabelId = stackedEupLabelId; baseEupPallet.isStackedTier = 'base';
                                unit.palletsVisual.push({
                                   ...baseEupPallet, isStackedTier: 'top', key: `eup_stack_pri_${unit.id}_${finalActualEUPBase - 1}_${i}`,
                                    labelId: stackedEupLabelId, displayBaseLabelId: baseEupLabelId, displayStackedLabelId: stackedEupLabelId, showAsFraction: true,
                                });
                                finalTotalEuroVisual++; currentTotalWeight += safeEupWeight; eupQuantityToPlace--; eupStacked++;
                            } else if (!tempWarnings.some(w => w.includes('Stapeln von EUP'))) tempWarnings.push('Gewichtslimit beim Stapeln von EUP.');
                        }
                        unit.currentY += eupWid;
                    } else break;
                }
                if (unit.currentX >= effectiveLength) break;
                if (rowCount > 0) unit.currentX += rowHeight; else unit.currentX = effectiveLength;
            }
            unit.eupEndX = unit.currentX; unit.eupEndY = unit.currentY;
        }
        let updateBestResult = false;
         if (currentEupLoadingPattern === 'auto') {
             if (!aPatternHasBeenSetAsBest || patternVisualEUP > bestEUPResultConfig_DIN_FIRST.totalVisualEUPs ||
                 (patternVisualEUP === bestEUPResultConfig_DIN_FIRST.totalVisualEUPs && pattern === 'broad' && bestEUPResultConfig_DIN_FIRST.chosenPattern === 'long')) {
                updateBestResult = true;
                if(!aPatternHasBeenSetAsBest) aPatternHasBeenSetAsBest = true;
            }
        } else updateBestResult = true;

        if (updateBestResult) {
             bestEUPResultConfig_DIN_FIRST = {
                unitsConfiguration: JSON.parse(JSON.stringify(currentUnitsAttempt)),
                totalVisualEUPs: patternVisualEUP, baseEUPs: patternBaseEUP, areaEUPs: patternAreaEUP,
                tempWarnings: patternWarnLocal, currentWeightAfterEUPs: patternWeight,
                chosenPattern: pattern, finalEupLabelCounter: currentPatternEupCounter,
            };
        }
        unitsState = bestEUPResultConfig_DIN_FIRST.unitsConfiguration;
        finalActualEUPBase = bestEUPResultConfig_DIN_FIRST.baseEUPs;
        finalTotalEuroVisual = bestEUPResultConfig_DIN_FIRST.totalVisualEUPs;
        finalTotalAreaBase += bestEUPResultConfig_DIN_FIRST.areaEUPs;
        currentTotalWeight = bestEUPResultConfig_DIN_FIRST.currentWeightAfterEUPs;
        tempWarnings.push(...bestEUPResultConfig_DIN_FIRST.tempWarnings.filter(w => !tempWarnings.includes(w)));
        eupLabelGlobalCounter = bestEUPResultConfig_DIN_FIRST.finalEupLabelCounter;

        if (finalTotalEuroVisual < eupQuantityToPlace && !tempWarnings.some(w => w.includes('Gewichtslimit')) && requestedEupQuantity !== MAX_PALLET_SIMULATION_QUANTITY) {
            const message = (eupQuantityToPlace >= MAX_PALLET_SIMULATION_QUANTITY && placementOrder === 'DIN_FIRST')
                ? `Konnte den LKW nicht vollständig mit Europaletten (nach DINs) auffüllen. ${finalTotalEuroVisual} (visuell) platziert mit Muster '${bestEUPResultConfig_DIN_FIRST.chosenPattern}'.`
                : `Konnte nicht alle ${eupQuantityToPlace} Europaletten laden (nach DINs). Nur ${finalTotalEuroVisual} (visuell) platziert mit Muster '${bestEUPResultConfig_DIN_FIRST.chosenPattern}'.`;
            tempWarnings.push(message);
        }
    }
  }

  return finalizeResult(
    unitsState,
    truckConfig,
    tempWarnings,
    currentTotalWeight,
    finalTotalAreaBase,
    finalTotalEuroVisual,
    finalTotalDinVisual,
    finalActualEUPBase,
    finalActualDINBase,
    currentEupLoadingPattern,
    placementOrder,
    bestEUPResultConfig,
    bestEUPResultConfig_DIN_FIRST
  );
};

