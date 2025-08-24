"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

// ---------- Data ----------
const TRUCK_TYPES: any = {
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

const PALLET_TYPES: any = {
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

const MAX_GROSS_WEIGHT_KG = 24000;
const MAX_PALLET_SIMULATION_QUANTITY = 300;
const STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING = 18;
const STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING = 16;
const MAX_WEIGHT_PER_METER_KG = 1800;

// ---------- z-index helpers (visual priority) ----------
const zIndexFor = (p: any) => {
  const isStacked = !!p.showAsFraction;
  const isTop = p.isStackedTier === "top";
  if (p.type === "industrial" && isStacked) return isTop ? 401 : 400; // STACKED DIN
  if (p.type === "euro" && isStacked) return isTop ? 301 : 300;      // STACKED EUP
  if (p.type === "industrial") return 200;                            // DIN
  return 100;                                                         // EUP
};

// ---------- Core placement (restored & fixed) ----------
const calculateLoadingLogic = (
  truckKey: string,
  requestedEupQuantity: number,
  requestedDinQuantity: number,
  currentIsEUPStackable: boolean,
  currentIsDINStackable: boolean,
  eupWeightStr: string,
  dinWeightStr: string,
  currentEupLoadingPattern: "auto" | "long" | "broad" | "none",
  placementOrder: "DIN_FIRST" | "EUP_FIRST" = "DIN_FIRST",
  maxStackableEupPallets?: number, // TOTAL pallets that may be in stacks (base+top)
  maxStackableDinPallets?: number
) => {
  const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
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

  const eupWeight = Math.max(0, parseFloat(eupWeightStr) || 0);
  const dinWeight = Math.max(0, parseFloat(dinWeightStr) || 0);

  // interpret inputs: total pallets in stacks -> allowed tops = floor(total/2)
  const allowedEupTops =
    currentIsEUPStackable
      ? maxStackableEupPallets && maxStackableEupPallets > 0
        ? Math.floor(maxStackableEupPallets / 2)
        : Infinity
      : 0;
  const allowedDinTops =
    currentIsDINStackable
      ? maxStackableDinPallets && maxStackableDinPallets > 0
        ? Math.floor(maxStackableDinPallets / 2)
        : Infinity
      : 0;

  // IMPORTANT: these must not leak across pattern attempts
  let eupTopsPlaced = 0;
  let dinTopsPlaced = 0;

  let unitsState = truckConfig.units.map((u: any) => ({
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

  let dinQuantityToPlace = requestedDinQuantity;
  let eupQuantityToPlace = requestedEupQuantity;

  if (truckConfig.maxDinPallets !== undefined && dinQuantityToPlace > truckConfig.maxDinPallets) {
    if (requestedDinQuantity > truckConfig.maxDinPallets && requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY) {
      tempWarnings.push(
        `${truckConfig.name.trim()} maximale DIN-Kapazität ist ${truckConfig.maxDinPallets}. Angeforderte Menge ${requestedDinQuantity}, es werden ${truckConfig.maxDinPallets} platziert.`
      );
    }
    dinQuantityToPlace = truckConfig.maxDinPallets;
  }

  // ---- helper: place EUPs with local tops budget (no leakage) ----
  const placeEupsOnUnits = (
    units: any[],
    pattern: "long" | "broad",
    startFromXKey: "eupStartX" | "currentX",
    weightStart: number,
    topsPlacedStart: number,
    topsAllowed: number
  ) => {
    let patternVisualEUP = 0, patternBaseEUP = 0, patternAreaEUP = 0;
    let patternWeight = weightStart;
    let patternWarnLocal: string[] = [];
    let patternRemainingEup = eupQuantityToPlace;
    let currentPatternEupCounter = eupLabelGlobalCounter;
    let localTopsPlaced = topsPlacedStart;

    for (const unit of units) {
      if (patternRemainingEup <= 0) break;
      unit.currentX = startFromXKey === "eupStartX" ? (unit.eupStartX || 0) : 0;
      unit.currentY = 0;

      const effectiveLength = unit.length;
      while (unit.currentX < effectiveLength) {
        if (patternRemainingEup <= 0) break;
        let rowCount = 0;
        const eupDef = PALLET_TYPES.euro;
        const palletsPerRow = pattern === "long" ? 3 : 2;
        const eupLen = pattern === "long" ? eupDef.length : eupDef.width;
        const eupWid = pattern === "long" ? eupDef.width : eupDef.length;
        let rowHeight = 0;
        unit.currentY = 0;

        for (let i = 0; i < palletsPerRow; i++) {
          if (patternRemainingEup <= 0) break;

          if (eupWeight > 0 && patternWeight + eupWeight > weightLimit) {
            if (!patternWarnLocal.some((w) => w.includes("Gewichtslimit für EUP")))
              patternWarnLocal.push(`Gewichtslimit für EUP-Paletten erreicht. Max ${weightLimit / 1000}t.`);
            unit.currentX = effectiveLength;
            break;
          }

          if (unit.currentX + eupLen <= effectiveLength && unit.currentY + eupWid <= unit.width) {
            const baseEupLabelId = ++currentPatternEupCounter;
            const baseEupPallet = {
              x: unit.currentX,
              y: unit.currentY,
              width: eupLen,
              height: eupWid,
              type: "euro",
              isStackedTier: null as any,
              key: `eup_base_${unit.id}_${patternBaseEUP}_${pattern}_${i}`,
              unitId: unit.id,
              labelId: baseEupLabelId,
              displayBaseLabelId: baseEupLabelId,
              displayStackedLabelId: null as any,
              showAsFraction: false,
            };
            unit.palletsVisual.push(baseEupPallet);
            unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: eupLen, height: eupWid });
            patternAreaEUP += eupDef.area;
            patternBaseEUP++;
            patternVisualEUP++;
            patternWeight += eupWeight;
            patternRemainingEup--;
            rowCount++;
            rowHeight = Math.max(rowHeight, eupLen);

            // Try stack on top (consume one top)
            if (currentIsEUPStackable && patternRemainingEup > 0 && localTopsPlaced < topsAllowed) {
              if (!(eupWeight > 0 && patternWeight + eupWeight > weightLimit)) {
                const stackedEupLabelId = ++currentPatternEupCounter;
                const baseAsStackBase = {
                  ...baseEupPallet,
                  isStackedTier: "base" as const,
                  showAsFraction: true,
                  displayStackedLabelId: stackedEupLabelId,
                };
                unit.palletsVisual[unit.palletsVisual.length - 1] = baseAsStackBase;
                unit.palletsVisual.push({
                  ...baseEupPallet,
                  isStackedTier: "top",
                  key: `eup_stack_${unit.id}_${patternBaseEUP - 1}_${pattern}_${i}`,
                  labelId: stackedEupLabelId,
                  displayBaseLabelId: baseEupLabelId,
                  displayStackedLabelId: stackedEupLabelId,
                  showAsFraction: true,
                });
                patternVisualEUP++;
                patternWeight += eupWeight;
                patternRemainingEup--;
                localTopsPlaced++;
              } else if (!patternWarnLocal.some((w) => w.includes("Stapeln von EUP"))) {
                patternWarnLocal.push("Gewichtslimit beim Stapeln von EUP.");
              }
            }

            unit.currentY += eupWid;
          } else {
            break;
          }
        }

        if (unit.currentX >= effectiveLength) break;
        if (rowCount > 0) unit.currentX += rowHeight;
        else unit.currentX = effectiveLength;
      }
      unit.eupEndX = unit.currentX;
      unit.eupEndY = unit.currentY;
    }

    return {
      units,
      patternVisualEUP,
      patternBaseEUP,
      patternAreaEUP,
      patternWeight,
      patternWarnLocal,
      currentPatternEupCounter,
      topsPlacedEnd: localTopsPlaced,
    };
  };

  // ---------- EUP-FIRST branch ----------
  let bestEUPResultConfig: any = undefined;
  let bestEUPResultConfig_DIN_FIRST: any = undefined;

  if (placementOrder === "EUP_FIRST") {
    bestEUPResultConfig = {
      unitsConfiguration: JSON.parse(JSON.stringify(unitsState)),
      totalVisualEUPs: 0,
      baseEUPs: 0,
      areaEUPs: 0,
      tempWarnings: [],
      currentWeightAfterEUPs: currentTotalWeight,
      chosenPattern: currentEupLoadingPattern !== "auto" ? currentEupLoadingPattern : "none",
      finalEupLabelCounter: eupLabelGlobalCounter,
      topsAfterEUP: eupTopsPlaced,
    };

    if (eupQuantityToPlace > 0) {
      const patternsToTry = currentEupLoadingPattern === "auto" ? ["long", "broad"] : [currentEupLoadingPattern];
      let picked = false;

      for (const pattern of patternsToTry) {
        const attemptUnits = JSON.parse(JSON.stringify(unitsState));
        const outcome = placeEupsOnUnits(
          attemptUnits,
          pattern,
          "currentX",
          currentTotalWeight,
          eupTopsPlaced,          // pass a COPY (no leakage)
          allowedEupTops
        );

        const updateBest =
          !picked ||
          outcome.patternVisualEUP > bestEUPResultConfig.totalVisualEUPs ||
          (outcome.patternVisualEUP === bestEUPResultConfig.totalVisualEUPs &&
            pattern === "broad" &&
            bestEUPResultConfig.chosenPattern === "long");

        if (updateBest) {
          picked = true;
          bestEUPResultConfig = {
            unitsConfiguration: JSON.parse(JSON.stringify(outcome.units)),
            totalVisualEUPs: outcome.patternVisualEUP,
            baseEUPs: outcome.patternBaseEUP,
            areaEUPs: outcome.patternAreaEUP,
            tempWarnings: outcome.patternWarnLocal,
            currentWeightAfterEUPs: outcome.patternWeight,
            chosenPattern: pattern,
            finalEupLabelCounter: outcome.currentPatternEupCounter,
            topsAfterEUP: outcome.topsPlacedEnd,  // commit winners' tops usage
          };
        }
      }

      unitsState = bestEUPResultConfig.unitsConfiguration;
      eupTopsPlaced = bestEUPResultConfig.topsAfterEUP; // commit
      finalActualEUPBase = bestEUPResultConfig.baseEUPs;
      finalTotalEuroVisual = bestEUPResultConfig.totalVisualEUPs;
      finalTotalAreaBase += bestEUPResultConfig.areaEUPs;
      currentTotalWeight = bestEUPResultConfig.currentWeightAfterEUPs;
      tempWarnings.push(...bestEUPResultConfig.tempWarnings.filter((w: string) => !tempWarnings.includes(w)));
      eupLabelGlobalCounter = bestEUPResultConfig.finalEupLabelCounter;

      if (
        finalTotalEuroVisual < eupQuantityToPlace &&
        !tempWarnings.some((w) => w.includes("Gewichtslimit")) &&
        requestedEupQuantity !== MAX_PALLET_SIMULATION_QUANTITY
      ) {
        tempWarnings.push(
          `Konnte nicht alle ${eupQuantityToPlace} Europaletten laden. Nur ${finalTotalEuroVisual} (visuell) platziert mit Muster '${bestEUPResultConfig.chosenPattern}'.`
        );
      }
    }

    // Place DIN after EUP
    unitsState.forEach((unit: any) => (unit.dinStartX = unit.eupEndX));

    let dinPlaced = 0;
    if (dinQuantityToPlace > 0) {
      for (const unit of unitsState) {
        if (dinPlaced >= dinQuantityToPlace) break;
        unit.currentX = unit.dinStartX;
        unit.currentY = 0;

        while (unit.currentX < unit.length) {
          if (dinPlaced >= dinQuantityToPlace) break;
          let rowPalletsPlaced = 0;
          const dinDef = PALLET_TYPES.industrial;
          const dinLength = dinDef.width; // rotated
          const dinWidth = dinDef.length;
          let rowHeight = 0;
          unit.currentY = 0;

          for (let i = 0; i < 2; i++) {
            if (dinPlaced >= dinQuantityToPlace) break;

            if (dinWeight > 0 && currentTotalWeight + dinWeight > weightLimit) {
              if (!tempWarnings.some((w) => w.includes("Gewichtslimit für DIN")))
                tempWarnings.push(`Gewichtslimit für DIN-Paletten erreicht. Max ${weightLimit / 1000}t.`);
              unit.currentX = unit.length;
              break;
            }

            if (unit.currentX + dinLength <= unit.length && unit.currentY + dinWidth <= unit.width) {
              const baseDinLabelId = ++dinLabelGlobalCounter;
              const baseDinPallet = {
                x: unit.currentX,
                y: unit.currentY,
                width: dinLength,
                height: dinWidth,
                type: "industrial",
                isStackedTier: null as any,
                key: `din_base_sec_${unit.id}_${finalActualDINBase}_${i}`,
                unitId: unit.id,
                labelId: baseDinLabelId,
                displayBaseLabelId: baseDinLabelId,
                displayStackedLabelId: null as any,
                showAsFraction: false,
              };
              unit.palletsVisual.push(baseDinPallet);
              unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth });
              finalTotalAreaBase += dinDef.area;
              finalActualDINBase++;
              finalTotalDinVisual++;
              currentTotalWeight += dinWeight;
              dinPlaced++;
              rowPalletsPlaced++;
              rowHeight = Math.max(rowHeight, dinLength);

              // Stack DIN (gate with local tops)
              if (currentIsDINStackable && dinPlaced < dinQuantityToPlace && dinTopsPlaced < allowedDinTops) {
                if (!(dinWeight > 0 && currentTotalWeight + dinWeight > weightLimit)) {
                  const stackedDinLabelId = ++dinLabelGlobalCounter;
                  const baseAsStackBase = {
                    ...baseDinPallet,
                    isStackedTier: "base" as const,
                    showAsFraction: true,
                    displayStackedLabelId: stackedDinLabelId,
                  };
                  unit.palletsVisual[unit.palletsVisual.length - 1] = baseAsStackBase;
                  unit.palletsVisual.push({
                    ...baseDinPallet,
                    isStackedTier: "top",
                    key: `din_stack_sec_${unit.id}_${finalActualDINBase - 1}_${i}`,
                    labelId: stackedDinLabelId,
                    displayBaseLabelId: baseDinLabelId,
                    displayStackedLabelId: stackedDinLabelId,
                    showAsFraction: true,
                  });
                  finalTotalDinVisual++;
                  currentTotalWeight += dinWeight;
                  dinPlaced++;
                  dinTopsPlaced++;
                } else if (!tempWarnings.some((w) => w.includes("Stapeln von DIN"))) {
                  tempWarnings.push("Gewichtslimit beim Stapeln von DIN.");
                }
              }

              unit.currentY += dinWidth;
            } else break;
          }

          if (unit.currentX >= unit.length) break;
          if (rowPalletsPlaced > 0) unit.currentX += rowHeight;
          else unit.currentX = unit.length;
        }
      }
    }

    if (
      dinPlaced < dinQuantityToPlace &&
      !tempWarnings.some((w) => w.includes("Gewichtslimit") || w.includes("Kapazität ist")) &&
      requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY
    ) {
      tempWarnings.push(
        `Konnte nicht alle ${dinQuantityToPlace} Industriepaletten laden (nach EUPs). Nur ${dinPlaced} platziert.`
      );
    }
  } else {
    // ---------- DIN-FIRST branch ----------
    let dinPlaced = 0;
    if (dinQuantityToPlace > 0) {
      for (const unit of unitsState) {
        if (dinPlaced >= dinQuantityToPlace) break;

        while (unit.currentX < unit.length) {
          if (dinPlaced >= dinQuantityToPlace) break;
          let rowPalletsPlaced = 0;
          const dinDef = PALLET_TYPES.industrial;
          const dinLength = dinDef.width;
          const dinWidth = dinDef.length;
          let rowHeight = 0;
          unit.currentY = 0;

          for (let i = 0; i < 2; i++) {
            if (dinPlaced >= dinQuantityToPlace) break;

            if (dinWeight > 0 && currentTotalWeight + dinWeight > weightLimit) {
              if (!tempWarnings.some((w) => w.includes("Gewichtslimit für DIN")))
                tempWarnings.push(`Gewichtslimit für DIN-Paletten erreicht. Max ${weightLimit / 1000}t.`);
              unit.currentX = unit.length;
              break;
            }

            if (unit.currentX + dinLength <= unit.length && unit.currentY + dinWidth <= unit.width) {
              const baseDinLabelId = ++dinLabelGlobalCounter;
              const baseDinPallet = {
                x: unit.currentX,
                y: unit.currentY,
                width: dinLength,
                height: dinWidth,
                type: "industrial",
                isStackedTier: null as any,
                key: `din_base_pri_${unit.id}_${finalActualDINBase}_${i}`,
                unitId: unit.id,
                labelId: baseDinLabelId,
                displayBaseLabelId: baseDinLabelId,
                displayStackedLabelId: null as any,
                showAsFraction: false,
              };
              unit.palletsVisual.push(baseDinPallet);
              unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: dinLength, height: dinWidth });
              finalTotalAreaBase += dinDef.area;
              finalActualDINBase++;
              finalTotalDinVisual++;
              currentTotalWeight += dinWeight;
              dinPlaced++;
              rowPalletsPlaced++;
              rowHeight = Math.max(rowHeight, dinLength);

              if (currentIsDINStackable && dinPlaced < dinQuantityToPlace && dinTopsPlaced < allowedDinTops) {
                if (!(dinWeight > 0 && currentTotalWeight + dinWeight > weightLimit)) {
                  const stackedDinLabelId = ++dinLabelGlobalCounter;
                  const baseAsStackBase = {
                    ...baseDinPallet,
                    isStackedTier: "base" as const,
                    showAsFraction: true,
                    displayStackedLabelId: stackedDinLabelId,
                  };
                  unit.palletsVisual[unit.palletsVisual.length - 1] = baseAsStackBase;
                  unit.palletsVisual.push({
                    ...baseDinPallet,
                    isStackedTier: "top",
                    key: `din_stack_pri_${unit.id}_${finalActualDINBase - 1}_${i}`,
                    labelId: stackedDinLabelId,
                    displayBaseLabelId: baseDinLabelId,
                    displayStackedLabelId: stackedDinLabelId,
                    showAsFraction: true,
                  });
                  finalTotalDinVisual++;
                  currentTotalWeight += dinWeight;
                  dinPlaced++;
                  dinTopsPlaced++;
                } else if (!tempWarnings.some((w) => w.includes("Stapeln von DIN"))) {
                  tempWarnings.push("Gewichtslimit beim Stapeln von DIN.");
                }
              }

              unit.currentY += dinWidth;
            } else break;
          }

          if (unit.currentX >= unit.length) break;
          if (rowPalletsPlaced > 0) {
            unit.currentX += rowHeight;
            unit.dinEndX = unit.currentX;
            unit.dinEndY = unit.currentY;
            unit.dinLastRowIncomplete = rowPalletsPlaced === 1 && unit.width / PALLET_TYPES.industrial.length >= 2;
          } else unit.currentX = unit.length;
        }

        unit.eupStartX = unit.dinEndX;
      }
    }

    if (
      dinPlaced < dinQuantityToPlace &&
      !tempWarnings.some((w) => w.includes("Gewichtslimit") || w.includes("Kapazität ist")) &&
      requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY
    ) {
      tempWarnings.push(`Konnte den LKW nicht vollständig mit Industriepaletten beladen. Nur ${dinPlaced} platziert.`);
    }

    // EUP after DIN (try patterns; commit winner; NO tops leakage)
    const initialUnitsAfterDIN = JSON.parse(JSON.stringify(unitsState));
    const weightAfterDINs = currentTotalWeight;

    bestEUPResultConfig_DIN_FIRST = {
      unitsConfiguration: initialUnitsAfterDIN,
      totalVisualEUPs: 0,
      baseEUPs: 0,
      areaEUPs: 0,
      tempWarnings: [],
      currentWeightAfterEUPs: weightAfterDINs,
      chosenPattern: currentEupLoadingPattern !== "auto" ? currentEupLoadingPattern : "none",
      finalEupLabelCounter: eupLabelGlobalCounter,
      topsAfterEUP: eupTopsPlaced,
    };

    if (eupQuantityToPlace > 0) {
      const patternsToTry = currentEupLoadingPattern === "auto" ? ["long", "broad"] : [currentEupLoadingPattern];
      let picked = false;

      for (const pattern of patternsToTry) {
        const attemptUnits = JSON.parse(JSON.stringify(initialUnitsAfterDIN));
        const placed = placeEupsOnUnits(
          attemptUnits,
          pattern,
          "eupStartX",
          weightAfterDINs,
          eupTopsPlaced,      // pass COPY
          allowedEupTops
        );

        const updateBest =
          !picked ||
          placed.patternVisualEUP > bestEUPResultConfig_DIN_FIRST.totalVisualEUPs ||
          (placed.patternVisualEUP === bestEUPResultConfig_DIN_FIRST.totalVisualEUPs &&
            pattern === "broad" &&
            bestEUPResultConfig_DIN_FIRST.chosenPattern === "long");

        if (updateBest) {
          picked = true;
          bestEUPResultConfig_DIN_FIRST = {
            unitsConfiguration: JSON.parse(JSON.stringify(placed.units)),
            totalVisualEUPs: placed.patternVisualEUP,
            baseEUPs: placed.patternBaseEUP,
            areaEUPs: placed.patternAreaEUP,
            tempWarnings: placed.patternWarnLocal,
            currentWeightAfterEUPs: placed.patternWeight,
            chosenPattern: pattern,
            finalEupLabelCounter: placed.currentPatternEupCounter,
            topsAfterEUP: placed.topsPlacedEnd, // commit winners' tops usage
          };
        }
      }

      unitsState = bestEUPResultConfig_DIN_FIRST.unitsConfiguration;
      eupTopsPlaced = bestEUPResultConfig_DIN_FIRST.topsAfterEUP; // commit
      finalActualEUPBase = bestEUPResultConfig_DIN_FIRST.baseEUPs;
      finalTotalEuroVisual = bestEUPResultConfig_DIN_FIRST.totalVisualEUPs;
      finalTotalAreaBase += bestEUPResultConfig_DIN_FIRST.areaEUPs;
      currentTotalWeight = bestEUPResultConfig_DIN_FIRST.currentWeightAfterEUPs;
      tempWarnings.push(...bestEUPResultConfig_DIN_FIRST.tempWarnings.filter((w: string) => !tempWarnings.includes(w)));
      eupLabelGlobalCounter = bestEUPResultConfig_DIN_FIRST.finalEupLabelCounter;

      if (
        finalTotalEuroVisual < eupQuantityToPlace &&
        !tempWarnings.some((w) => w.includes("Gewichtslimit")) &&
        requestedEupQuantity !== MAX_PALLET_SIMULATION_QUANTITY
      ) {
        tempWarnings.push(
          `Konnte nicht alle ${eupQuantityToPlace} Europaletten laden (nach DINs). Nur ${finalTotalEuroVisual} (visuell) platziert mit Muster '${bestEUPResultConfig_DIN_FIRST.chosenPattern}'.`
        );
      }
    }
  }

  // ---------- Enforce visual layering order (per unit) ----------
  const categoryPriority = (p: any) => {
    const isStacked = !!p.showAsFraction;
    if (p.type === "industrial" && isStacked) return 0; // STACKED DIN
    if (p.type === "euro" && isStacked) return 1;       // STACKED EUP
    if (p.type === "industrial") return 2;              // DIN
    return 3;                                           // EUP
  };
  const withinPairOrder = (p: any) => (p.isStackedTier === "top" ? 1 : 0);
  for (const u of unitsState) {
    u.palletsVisual.sort((a: any, b: any) => {
      const ca = categoryPriority(a);
      const cb = categoryPriority(b);
      if (ca !== cb) return ca - cb;
      const pa = withinPairOrder(a);
      const pb = withinPairOrder(b);
      if (pa !== pb) return pa - pb;
      return 0;
    });
  }

  // ---------- Build return ----------
  const finalPalletArrangement = unitsState.map((u: any) => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: u.palletsVisual,
  }));

  const totalPracticalArea = truckConfig.usableLength * truckConfig.maxWidth;
  const util = totalPracticalArea > 0 ? (finalTotalAreaBase / totalPracticalArea) * 100 : 0;
  const utilizationPercentage = parseFloat(util.toFixed(1));

  const usedLength = truckConfig.maxWidth > 0 ? finalTotalAreaBase / truckConfig.maxWidth : 0;
  const usedLengthPercentage = truckConfig.usableLength > 0 ? (usedLength / truckConfig.usableLength) * 100 : 0;

  const weightPerMeter = usedLength > 0 ? currentTotalWeight / (usedLength / 100) : 0;
  if (weightPerMeter >= MAX_WEIGHT_PER_METER_KG) {
    tempWarnings.push(`ACHTUNG – mögliche Achslastüberschreitung: ${weightPerMeter.toFixed(1)} kg/m`);
  }
  if (currentTotalWeight >= 10500 && usedLengthPercentage <= 40) {
    tempWarnings.push("ACHTUNG – mehr als 11t auf weniger als 40% der Ladefläche");
  }

  const stackedEupPallets = finalTotalEuroVisual - finalActualEUPBase;
  const stackedDinPallets = finalTotalDinVisual - finalActualDINBase;
  if (stackedEupPallets >= STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING) {
    if (!tempWarnings.some((w) => w.includes("ACHSLAST bei EUP"))) {
      tempWarnings.push(`ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${stackedEupPallets} gestapelte EUP)`);
    }
  }
  if (stackedDinPallets >= STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING) {
    if (!tempWarnings.some((w) => w.includes("ACHSLAST bei DIN"))) {
      tempWarnings.push(`ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${stackedDinPallets} gestapelte DIN)`);
    }
  }

  const uniqueWarnings = Array.from(new Set(tempWarnings));

  let determinedEupPatternForReturn = currentEupLoadingPattern;
  if (placementOrder === "EUP_FIRST" && bestEUPResultConfig && typeof bestEUPResultConfig.chosenPattern !== "undefined") {
    determinedEupPatternForReturn = bestEUPResultConfig.chosenPattern;
  } else if (placementOrder === "DIN_FIRST" && bestEUPResultConfig_DIN_FIRST && typeof bestEUPResultConfig_DIN_FIRST.chosenPattern !== "undefined") {
    determinedEupPatternForReturn = bestEUPResultConfig_DIN_FIRST.chosenPattern;
  } else if (currentEupLoadingPattern === "auto" && finalTotalEuroVisual > 0) {
    determinedEupPatternForReturn = "none";
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
};

// ---------- Component ----------
export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState("curtainSider");
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState<"auto" | "long" | "broad" | "none">("auto");
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);

  // keep as strings (prevents leading "0")
  const [eupStackLimitInput, setEupStackLimitInput] = useState("");
  const [dinStackLimitInput, setDinStackLimitInput] = useState("");

  const eupStackLimit = useMemo(() => Math.max(0, parseInt(eupStackLimitInput, 10) || 0), [eupStackLimitInput]);
  const dinStackLimit = useMemo(() => Math.max(0, parseInt(dinStackLimitInput, 10) || 0), [dinStackLimitInput]);

  const [eupWeightPerPallet, setEupWeightPerPallet] = useState("");
  const [dinWeightPerPallet, setDinWeightPerPallet] = useState("");

  const [loadedEuroPalletsBase, setLoadedEuroPalletsBase] = useState(0);
  const [loadedIndustrialPalletsBase, setLoadedIndustrialPalletsBase] = useState(0);
  const [totalEuroPalletsVisual, setTotalEuroPalletsVisual] = useState(0);
  const [totalDinPalletsVisual, setTotalDinPalletsVisual] = useState(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [palletArrangement, setPalletArrangement] = useState<any[]>([]);
  const [totalWeightKg, setTotalWeightKg] = useState(0);
  const [actualEupLoadingPattern, setActualEupLoadingPattern] = useState<"auto" | "long" | "broad" | "none">("auto");

  const { toast } = useToast();

  const calculateAndSetState = useCallback(
    (
      order: "DIN_FIRST" | "EUP_FIRST" = "DIN_FIRST",
      currentEup = eupQuantity,
      currentDin = dinQuantity
    ) => {
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

      // capacity hints (kept)
      const eupCapacityCheckResults = calculateLoadingLogic(
        selectedTruck,
        MAX_PALLET_SIMULATION_QUANTITY,
        primaryResults.totalDinPalletsVisual,
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        eupLoadingPattern,
        "DIN_FIRST",
        eupStackLimit,
        dinStackLimit
      );
      const additionalEupPossible = Math.max(
        0,
        eupCapacityCheckResults.totalEuroPalletsVisual - primaryResults.totalEuroPalletsVisual
      );

      const dinCapacityCheckResults = calculateLoadingLogic(
        selectedTruck,
        primaryResults.totalEuroPalletsVisual,
        MAX_PALLET_SIMULATION_QUANTITY,
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        eupLoadingPattern,
        "EUP_FIRST",
        eupStackLimit,
        dinStackLimit
      );
      const additionalDinPossible = Math.max(
        0,
        dinCapacityCheckResults.totalDinPalletsVisual - primaryResults.totalDinPalletsVisual
      );

      let finalWarnings = [...primaryResults.warnings];
      if (additionalEupPossible > 0 && additionalDinPossible > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${additionalEupPossible} EUP oder ${additionalDinPossible} DIN Paletten.`);
      } else if (additionalEupPossible > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${additionalEupPossible} EUP.`);
      } else if (additionalDinPossible > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${additionalDinPossible} DIN Paletten.`);
      }

      setPalletArrangement(primaryResults.palletArrangement);
      setLoadedIndustrialPalletsBase(primaryResults.loadedIndustrialPalletsBase);
      setLoadedEuroPalletsBase(primaryResults.loadedEuroPalletsBase);
      setTotalDinPalletsVisual(primaryResults.totalDinPalletsVisual);
      setTotalEuroPalletsVisual(primaryResults.totalEuroPalletsVisual);
      setUtilizationPercentage(
        additionalEupPossible === 0 &&
          additionalDinPossible === 0 &&
          primaryResults.totalEuroPalletsVisual + primaryResults.totalDinPalletsVisual > 0 &&
          !finalWarnings.some((w) => w.toLowerCase().includes("gewichtslimit"))
          ? 100
          : primaryResults.utilizationPercentage
      );
      setWarnings(finalWarnings);
      setTotalWeightKg(primaryResults.totalWeightKg);
      setActualEupLoadingPattern(primaryResults.eupLoadingPatternUsed);
    },
    [
      selectedTruck,
      eupQuantity,
      dinQuantity,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      eupStackLimit,
      dinStackLimit,
    ]
  );

  useEffect(() => {
    calculateAndSetState("DIN_FIRST", eupQuantity, dinQuantity);
  }, [calculateAndSetState, eupQuantity, dinQuantity, eupStackLimit, dinStackLimit]);

  const handleQuantityChange = (type: "eup" | "din", amount: number) => {
    if (type === "eup")
      setEupQuantity((prev) => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    else
      setDinQuantity((prev) => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
  };

  const handleClearAllPallets = () => {
    setEupQuantity(0);
    setDinQuantity(0);
    setEupWeightPerPallet("");
    setDinWeightPerPallet("");
    setIsEUPStackable(false);
    setIsDINStackable(false);
    setEupStackLimitInput("");
    setDinStackLimitInput("");
    setEupLoadingPattern("auto");
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
      "auto",
      "DIN_FIRST",
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
    let truckTheoreticalMaxDin =
      currentTruckInfo.singleLayerDINCapacity ||
      (currentTruckInfo.singleLayerDINCapacityPerUnit && currentTruckInfo.units.length > 0
        ? currentTruckInfo.singleLayerDINCapacityPerUnit * currentTruckInfo.units.length
        : currentTruckInfo.units.length > 0
        ? Math.floor(currentTruckInfo.units[0].length / PALLET_TYPES.industrial.width) * 2 * currentTruckInfo.units.length
        : 30);

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
        "auto",
        "DIN_FIRST",
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
        "auto",
        "EUP_FIRST",
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
          "DIN_FIRST",
          eupStackLimit,
          dinStackLimit
        );
        const badWarning = res.warnings.some(
          (w: string) => w.toLowerCase().includes("gewichtslimit") || w.toLowerCase().includes("konnte nicht")
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
      eupLoadingPattern === "auto" &&
      bestResult.eupLoadingPatternUsed !== "auto" &&
      bestResult.eupLoadingPatternUsed !== "none"
    ) {
      setEupLoadingPattern(bestResult.eupLoadingPatternUsed);
    }
    toast({ title: "Vorschlag übernommen", description: `${bestDin} DIN / ${bestEup} EUP geladen` });
  };

  const handleMaximizePallets = (palletTypeToMax: "industrial" | "euro") => {
    let targetEupQty = 0;
    let targetDinQty = 0;
    let order: "DIN_FIRST" | "EUP_FIRST" = "DIN_FIRST";

    if (palletTypeToMax === "industrial") {
      targetDinQty = MAX_PALLET_SIMULATION_QUANTITY;
      order = "DIN_FIRST";
    } else {
      targetEupQty = MAX_PALLET_SIMULATION_QUANTITY;
      order = "EUP_FIRST";
    }

    const simResults = calculateLoadingLogic(
      selectedTruck,
      targetEupQty,
      targetDinQty,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      order,
      eupStackLimit,
      dinStackLimit
    );

    if (palletTypeToMax === "industrial") {
      setDinQuantity(simResults.totalDinPalletsVisual);
      setEupQuantity(0);
    } else {
      setEupQuantity(simResults.totalEuroPalletsVisual);
      setDinQuantity(0);
    }

    if (
      eupLoadingPattern === "auto" &&
      simResults.eupLoadingPatternUsed !== "auto" &&
      simResults.eupLoadingPatternUsed !== "none" &&
      palletTypeToMax === "euro"
    ) {
      setEupLoadingPattern(simResults.eupLoadingPatternUsed as any);
    }
  };

  const renderPallet = (pallet: any, displayScale = 0.3) => {
    if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) return null;
    const d = PALLET_TYPES[pallet.type];
    const w = pallet.height * displayScale;
    const h = pallet.width * displayScale;
    const x = pallet.y * displayScale;
    const y = pallet.x * displayScale;

    let txt =
      pallet.showAsFraction && pallet.displayStackedLabelId
        ? `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}`
        : `${pallet.labelId}`;
    if (pallet.labelId === 0) txt = "?";

    let title = `${d.name} #${pallet.labelId}`;
    if (pallet.showAsFraction)
      title = `${d.name} (Stapel: ${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId})`;
    if (pallet.isStackedTier === "top") title += " - Oben";
    if (pallet.isStackedTier === "base") title += " - Basis des Stapels";

    return (
      <div
        key={pallet.key}
        title={title}
        className={`absolute ${d.color} ${d.borderColor} border flex items-center justify-center rounded-sm shadow-sm`}
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${w}px`,   // ✅ fixed: no stray '}'
          height: `${h}px`,
          opacity: pallet.isStackedTier === "top" ? 0.7 : 1,
          zIndex: zIndexFor(pallet),
          fontSize: "10px",
        }}
      >
        <span className="text-black font-semibold select-none">{txt}</span>
        {pallet.isStackedTier === "top" && (
          <div className="absolute top-0 left-0 w-full h-full border-t-2 border-l-2 border-black opacity-30 pointer-events-none rounded-sm" />
        )}
      </div>
    );
  };

  const truckVisualizationScale = 0.3;

  const warningsWithoutInfo = warnings.filter((w) => !w.toLowerCase().includes("platz"));
  let meldungenStyle = { bg: "bg-gray-50", border: "border-gray-200", header: "text-gray-800", list: "text-gray-700" };
  if (eupQuantity === 0 && dinQuantity === 0 && totalEuroPalletsVisual === 0 && totalDinPalletsVisual === 0) {
    meldungenStyle = { bg: "bg-gray-50", border: "border-gray-200", header: "text-gray-800", list: "text-gray-700" };
  } else if (warningsWithoutInfo.length === 0) {
    meldungenStyle = { bg: "bg-green-50", border: "border-green-200", header: "text-green-800", list: "text-green-700" };
  } else if (warningsWithoutInfo.every((w) => w.toLowerCase().includes("achslast"))) {
    meldungenStyle = { bg: "bg-yellow-50", border: "border-yellow-200", header: "text-yellow-800", list: "text-yellow-700" };
  } else {
    meldungenStyle = { bg: "bg-red-50", border: "border-red-200", header: "text-red-800", list: "text-red-700" };
  }

  const QuickPick = ({
    onPick,
    options = [0, 10, 20, 30, 40, 50],
  }: { onPick: (v: number | "") => void; options?: number[] }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {options.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className="px-2 py-[3px] text-xs border rounded-md hover:bg-slate-100"
        >
          {v}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPick("")}
        className="px-2 py-[3px] text-xs border rounded-md hover:bg-slate-100"
        title="Alle stapelbar"
      >
        Alle
      </button>
    </div>
  );

  return (
    <div className="container mx-auto p-4 font-sans bg-gray-50">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-t-lg shadow-lg mb-6">
        <h1 className="text-3xl font-bold text-center tracking-tight">Laderaumrechner</h1>
        <p className="text-center text-sm opacity-90">Visualisierung der Palettenplatzierung (Europäische Standards)</p>
      </header>

      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Inputs */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">LKW-Typ:</label>
              <select
                id="truckType"
                value={selectedTruck}
                onChange={(e) => setSelectedTruck(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                {Object.keys(TRUCK_TYPES).map((key) => (
                  <option key={key} value={key}>{TRUCK_TYPES[key].name}</option>
                ))}
              </select>
            </div>

            <div className="pt-4">
              <button
                onClick={handleClearAllPallets}
                className="w-full py-2 px-4 bg-[#00906c] text-white font-semibold rounded-md shadow-sm hover:bg-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50 transition duration-150 ease-in-out"
              >
                Alles zurücksetzen
              </button>
            </div>

            <div>
              <button
                onClick={suggestFeasibleLoad}
                className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 transition duration-150 ease-in-out"
              >
                Automatisch anpassen
              </button>
            </div>

            {/* DIN Section */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industriepaletten (DIN)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange("din", -1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input
                  type="number"
                  min={0}
                  value={dinQuantity}
                  onChange={(e) => setDinQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button onClick={() => handleQuantityChange("din", 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button
                onClick={() => {
                  const res = calculateLoadingLogic(
                    selectedTruck,
                    0,
                    MAX_PALLET_SIMULATION_QUANTITY,
                    isEUPStackable,
                    isDINStackable,
                    eupWeightPerPallet,
                    dinWeightPerPallet,
                    eupLoadingPattern,
                    "DIN_FIRST",
                    eupStackLimit,
                    dinStackLimit
                  );
                  setDinQuantity(res.totalDinPalletsVisual);
                  setEupQuantity(0);
                }}
                className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e]"
              >
                Max. DIN
              </button>
              <button
                onClick={handleFillRemainingWithDIN}
                className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49]"
              >
                Rest mit max. DIN füllen
              </button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/DIN (kg):</label>
                <input
                  type="number"
                  min={0}
                  value={dinWeightPerPallet}
                  onChange={(e) => setDinWeightPerPallet(e.target.value)}
                  placeholder="z.B. 500"
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                />
              </div>
              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="dinStackable"
                  checked={isDINStackable}
                  onChange={(e) => setIsDINStackable(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="dinStackable" className="ml-2 text-sm text-gray-900">
                  Stapelbar (2-fach)
                </label>
              </div>
              {isDINStackable && (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={dinStackLimitInput}
                    onChange={(e) => setDinStackLimitInput(e.target.value.replace(/\D+/g, ""))}
                    className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                    placeholder="Stapelbare Paletten gesamt (0 = alle)"
                  />
                  <QuickPick onPick={(v) => setDinStackLimitInput(v === "" ? "" : String(v))} />
                </>
              )}
            </div>

            {/* EUP Section */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Europaletten (EUP)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange("eup", -1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input
                  type="number"
                  min={0}
                  value={eupQuantity}
                  onChange={(e) => setEupQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button onClick={() => handleQuantityChange("eup", 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button
                onClick={() => {
                  const res = calculateLoadingLogic(
                    selectedTruck,
                    MAX_PALLET_SIMULATION_QUANTITY,
                    0,
                    isEUPStackable,
                    isDINStackable,
                    eupWeightPerPallet,
                    dinWeightPerPallet,
                    eupLoadingPattern,
                    "EUP_FIRST",
                    eupStackLimit,
                    dinStackLimit
                  );
                  setEupQuantity(res.totalEuroPalletsVisual);
                  setDinQuantity(0);
                }}
                className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e]"
              >
                Max. EUP
              </button>
              <button
                onClick={handleFillRemainingWithEUP}
                className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49]"
              >
                Rest mit max. EUP füllen
              </button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/EUP (kg):</label>
                <input
                  type="number"
                  min={0}
                  value={eupWeightPerPallet}
                  onChange={(e) => setEupWeightPerPallet(e.target.value)}
                  placeholder="z.B. 400"
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                />
              </div>
              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="eupStackable"
                  checked={isEUPStackable}
                  onChange={(e) => setIsEUPStackable(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="eupStackable" className="ml-2 text-sm text-gray-900">
                  Stapelbar (2-fach)
                </label>
              </div>
              {isEUPStackable && (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={eupStackLimitInput}
                    onChange={(e) => setEupStackLimitInput(e.target.value.replace(/\D+/g, ""))}
                    className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                    placeholder="Stapelbare Paletten gesamt (0 = alle)"
                  />
                  <QuickPick onPick={(v) => setEupStackLimitInput(v === "" ? "" : String(v))} />
                </>
              )}
            </div>

            {(eupQuantity > 0 ||
              totalEuroPalletsVisual > 0 ||
              actualEupLoadingPattern !== "auto" ||
              eupLoadingPattern !== "auto" ||
              (TRUCK_TYPES[selectedTruck].singleLayerEUPCapacityLong || 0) > 0) && (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  EUP Lade-Pattern:
                  <span className="text-xs text-gray-500">
                    {" "}
                    (Gewählt: {actualEupLoadingPattern === "none" ? "Keines" : actualEupLoadingPattern})
                  </span>
                </label>
                <div className="flex flex-col space-y-1">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="eupLoadingPattern"
                      value="auto"
                      checked={eupLoadingPattern === "auto"}
                      onChange={(e) => setEupLoadingPattern(e.target.value as any)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Auto-Optimieren</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="eupLoadingPattern"
                      value="long"
                      checked={eupLoadingPattern === "long"}
                      onChange={(e) => setEupLoadingPattern(e.target.value as any)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Längs (3 nebeneinander)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="eupLoadingPattern"
                      value="broad"
                      checked={eupLoadingPattern === "broad"}
                      onChange={(e) => setEupLoadingPattern(e.target.value as any)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Quer (2 nebeneinander)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Visualization */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Ladefläche Visualisierung</p>
            {palletArrangement.map((unit: any, index: number) => (
              <div key={unit.unitId} className="mb-4 w-full flex flex-col items-center">
                {TRUCK_TYPES[selectedTruck].units.length > 1 && (
                  <p className="text-sm text-gray-700 mb-1">
                    Einheit {index + 1} ({unit.unitLength / 100}m x {unit.unitWidth / 100}m)
                  </p>
                )}
                <div
                  className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner"
                  style={{
                    width: `${unit.unitWidth * truckVisualizationScale}px`,
                    height: `${unit.unitLength * truckVisualizationScale}px`,
                  }}
                >
                  {unit.pallets.map((p: any) => renderPallet(p, truckVisualizationScale))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary widgets */}
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
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className={`text-sm ${meldungenStyle.list}`}>Keine Probleme erkannt.</p>
            )}
          </div>
        </div>
      </main>

      <footer className="text-center py-4 mt-8 text-sm text-gray-500 border-t border-gray-200">
        <p>Laderaumrechner © {new Date().getFullYear()}</p>
        <p>by Andreas Steiner</p>
      </footer>

      <Toaster />
    </div>
  );
}
