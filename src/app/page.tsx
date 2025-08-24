"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

// Truck and pallet data (unchanged)
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

// Strict visual layering (draw order is spatial now, but z-index still protects overlaps)
const zIndexFor = (p: any) => {
  const isStacked = !!p.showAsFraction;
  const isTop = p.isStackedTier === "top";
  if (p.type === "industrial" && isStacked) return isTop ? 401 : 400; // stacked DIN
  if (p.type === "euro" && isStacked) return isTop ? 301 : 300;      // stacked EUP
  if (p.type === "industrial") return 200;                            // DIN
  return 100;                                                         // EUP
};

/**
 * NEW: single-pass layout that **places pallets along X in this order**:
 * STACKED DIN -> STACKED EUP -> DIN -> EUP
 * with local tops budgets per attempt (no leakage).
 */
const calculateLoadingLogic = (
  truckKey: string,
  requestedEupQuantity: number,
  requestedDinQuantity: number,
  isEUPStackable: boolean,
  isDINStackable: boolean,
  eupWeightStr: string,
  dinWeightStr: string,
  eupPattern: "auto" | "long" | "broad" | "none",
  _placementOrder: "DIN_FIRST" | "EUP_FIRST" = "DIN_FIRST", // kept for API compat; ignored
  maxStackableEupPallets?: number, // TOTAL pallets allowed in stacks (base + top)
  maxStackableDinPallets?: number
) => {
  // clone truck
  const truck = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const weightLimit = truck.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;

  // State / counters
  let tempWarnings: string[] = [];
  let totalEuroVisual = 0;
  let totalDinVisual = 0;
  let totalEuroBase = 0;
  let totalDinBase = 0;
  let totalAreaBase = 0;
  let weight = 0;
  let dinLabel = 0;
  let eupLabel = 0;

  // Parse inputs
  const eupW = Math.max(0, parseFloat(eupWeightStr) || 0);
  const dinW = Math.max(0, parseFloat(dinWeightStr) || 0);

  // Requested (will be decremented)
  let eupLeft = Math.max(0, requestedEupQuantity);
  let dinLeft = Math.max(0, requestedDinQuantity);

  // Max DIN per some rail configs
  if (truck.maxDinPallets !== undefined && dinLeft > truck.maxDinPallets) {
    if (requestedDinQuantity > truck.maxDinPallets && requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY) {
      tempWarnings.push(`${truck.name.trim()} maximale DIN-Kapazität ist ${truck.maxDinPallets}. Angefordert: ${requestedDinQuantity}. Es werden ${truck.maxDinPallets} platziert.`);
    }
    dinLeft = truck.maxDinPallets;
  }

  // Tops budgets (user enters TOTAL pallets involved in stacks -> tops = floor(total/2))
  let eupTopsBudget = isEUPStackable
    ? maxStackableEupPallets && maxStackableEupPallets > 0
      ? Math.floor(maxStackableEupPallets / 2)
      : Number.POSITIVE_INFINITY
    : 0;
  let dinTopsBudget = isDINStackable
    ? maxStackableDinPallets && maxStackableDinPallets > 0
      ? Math.floor(maxStackableDinPallets / 2)
      : Number.POSITIVE_INFINITY
    : 0;

  // Prepare units
  const units = truck.units.map((u: any) => ({
    ...u,
    occupiedRects: [],
    currentX: 0,
    currentY: 0,
    palletsVisual: [] as any[],
  }));

  // Helpers
  const canAddWeight = (add: number) => weightLimit <= 0 || weight + add <= weightLimit;

  const pushPallet = (unit: any, base: any) => {
    unit.palletsVisual.push(base);
    unit.occupiedRects.push({ x: base.x, y: base.y, width: base.width, height: base.height });
  };

  const placeDINPhase = (stacked: boolean) => {
    if (dinLeft <= 0) return;
    const def = PALLET_TYPES.industrial;
    const palLen = def.width; // rotated
    const palWid = def.length;

    for (const unit of units) {
      if (dinLeft <= 0) break;
      while (unit.currentX < unit.length) {
        if (dinLeft <= 0) break;
        unit.currentY = 0;
        let placedInRow = 0;
        let rowHeight = palLen;

        for (let i = 0; i < 2; i++) {
          if (dinLeft <= 0) break;

          if (!canAddWeight(dinW)) {
            if (!tempWarnings.some((w) => w.includes("Gewichtslimit für DIN"))) {
              tempWarnings.push(`Gewichtslimit für DIN-Paletten erreicht. Max ${weightLimit / 1000}t.`);
            }
            unit.currentX = unit.length;
            break;
          }

          if (unit.currentX + palLen <= unit.length && unit.currentY + palWid <= unit.width) {
            const baseId = ++dinLabel;
            const base = {
              x: unit.currentX,
              y: unit.currentY,
              width: palLen,
              height: palWid,
              type: "industrial",
              isStackedTier: null as any,
              key: `din_${stacked ? "stk" : "solo"}_base_${unit.id}_${baseId}_${i}`,
              unitId: unit.id,
              labelId: baseId,
              displayBaseLabelId: baseId,
              displayStackedLabelId: null as any,
              showAsFraction: false,
            };
            pushPallet(unit, base);
            totalAreaBase += def.area;
            totalDinBase++;
            totalDinVisual++;
            weight += dinW;
            dinLeft--;
            placedInRow++;

            if (stacked && dinLeft > 0 && dinTopsBudget > 0 && canAddWeight(dinW)) {
              const topId = ++dinLabel;
              const baseAsStack = {
                ...base,
                isStackedTier: "base" as const,
                showAsFraction: true,
                displayStackedLabelId: topId,
              };
              unit.palletsVisual[unit.palletsVisual.length - 1] = baseAsStack;
              const top = {
                ...base,
                isStackedTier: "top" as const,
                key: `din_${unit.id}_top_${baseId}_${i}`,
                labelId: topId,
                displayBaseLabelId: baseId,
                displayStackedLabelId: topId,
                showAsFraction: true,
              };
              pushPallet(unit, top);
              totalDinVisual++;
              weight += dinW;
              dinLeft--;
              dinTopsBudget--;
            }

            unit.currentY += palWid;
          }
        }

        if (placedInRow > 0) unit.currentX += rowHeight;
        else break;
      }
    }
  };

  // EUP placement in a pattern. Returns a snapshot result (so we can try 'long' vs 'broad' without leaking budgets).
  const tryPlaceEUPPhase = (pattern: "long" | "broad", stacked: boolean, inputUnits: any[], eupQty: number, topsBudget: number, startWeight: number) => {
    const unitsClone = JSON.parse(JSON.stringify(inputUnits));
    let localWeight = startWeight;
    let localTotalVis = 0;
    let localTotalBase = 0;
    let localArea = 0;
    let localEupLeft = eupQty;
    let localTops = topsBudget;
    let localEupLabel = eupLabel;
    const def = PALLET_TYPES.euro;
    const perRow = pattern === "long" ? 3 : 2;
    const palLen = pattern === "long" ? def.length : def.width;
    const palWid = pattern === "long" ? def.width : def.length;

    for (const unit of unitsClone) {
      if (localEupLeft <= 0) break;
      while (unit.currentX < unit.length) {
        if (localEupLeft <= 0) break;
        unit.currentY = 0;
        let placedInRow = 0;
        let rowHeight = palLen;

        for (let i = 0; i < perRow; i++) {
          if (localEupLeft <= 0) break;

          if (!(weightLimit <= 0 || localWeight + eupW <= weightLimit)) {
            unit.currentX = unit.length;
            break;
          }

          if (unit.currentX + palLen <= unit.length && unit.currentY + palWid <= unit.width) {
            const baseId = ++localEupLabel;
            const base = {
              x: unit.currentX,
              y: unit.currentY,
              width: palLen,
              height: palWid,
              type: "euro",
              isStackedTier: null as any,
              key: `eup_${stacked ? "stk" : "solo"}_base_${unit.id}_${baseId}_${i}_${pattern}`,
              unitId: unit.id,
              labelId: baseId,
              displayBaseLabelId: baseId,
              displayStackedLabelId: null as any,
              showAsFraction: false,
            };
            unit.palletsVisual.push(base);
            unit.occupiedRects.push({ x: base.x, y: base.y, width: base.width, height: base.height });
            localArea += def.area;
            localTotalBase++;
            localTotalVis++;
            localWeight += eupW;
            localEupLeft--;
            placedInRow++;

            if (stacked && localEupLeft > 0 && localTops > 0 && (weightLimit <= 0 || localWeight + eupW <= weightLimit)) {
              const topId = ++localEupLabel;
              const baseAsStack = {
                ...base,
                isStackedTier: "base" as const,
                showAsFraction: true,
                displayStackedLabelId: topId,
              };
              unit.palletsVisual[unit.palletsVisual.length - 1] = baseAsStack;
              const top = {
                ...base,
                isStackedTier: "top" as const,
                key: `eup_${unit.id}_top_${baseId}_${i}_${pattern}`,
                labelId: topId,
                displayBaseLabelId: baseId,
                displayStackedLabelId: topId,
                showAsFraction: true,
              };
              unit.palletsVisual.push(top);
              localTotalVis++;
              localWeight += eupW;
              localEupLeft--;
              localTops--;
            }

            unit.currentY += palWid;
          }
        }

        if (placedInRow > 0) unit.currentX += rowHeight;
        else break;
      }
    }

    return {
      units: unitsClone,
      weight: localWeight,
      totalVis: localTotalVis,
      totalBase: localTotalBase,
      area: localArea,
      eupLeft: localEupLeft,
      topsLeft: localTops,
      eupLabel: localEupLabel,
    };
  };

  const commitEUPPhase = (stacked: boolean) => {
    if (eupLeft <= 0) return;

    // decide pattern
    let patternToUse: "long" | "broad";
    if (eupPattern === "auto") {
      const a = tryPlaceEUPPhase("long", stacked, units, eupLeft, eupTopsBudget, weight);
      const b = tryPlaceEUPPhase("broad", stacked, units, eupLeft, eupTopsBudget, weight);
      const pick = b.totalVis > a.totalVis ? b : a; // prefer more visual pallets
      // commit
      units.splice(0, units.length, ...pick.units);
      weight = pick.weight;
      eupLeft = pick.eupLeft;
      eupTopsBudget = pick.topsLeft;
      eupLabel = pick.eupLabel;
      totalEuroVisual += pick.totalVis;
      totalEuroBase += pick.totalBase;
      totalAreaBase += pick.area;
      patternToUse = pick === b ? "broad" : "long";
    } else if (eupPattern === "long" || eupPattern === "broad") {
      const pick = tryPlaceEUPPhase(eupPattern, stacked, units, eupLeft, eupTopsBudget, weight);
      units.splice(0, units.length, ...pick.units);
      weight = pick.weight;
      eupLeft = pick.eupLeft;
      eupTopsBudget = pick.topsLeft;
      eupLabel = pick.eupLabel;
      totalEuroVisual += pick.totalVis;
      totalEuroBase += pick.totalBase;
      totalAreaBase += pick.area;
      patternToUse = eupPattern;
    } else {
      // none -> no placement for EUP
      patternToUse = "long";
    }
    // nothing to return; all committed to outer state
  };

  // --------- THE ORDERED LAYOUT PIPELINE ----------
  // 1) STACKED DIN
  placeDINPhase(true);
  // 2) STACKED EUP
  commitEUPPhase(true);
  // 3) DIN (unstacked)
  placeDINPhase(false);
  // 4) EUP (unstacked)
  commitEUPPhase(false);

  // Build return arrangement
  const palletArrangement = units.map((u: any) => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: u.palletsVisual,
  }));

  // Utilization & warnings
  const totalPracticalArea = truck.usableLength * truck.maxWidth;
  const utilizationPercentage = parseFloat(((totalAreaBase / totalPracticalArea) * 100).toFixed(1));

  const usedLength = truck.maxWidth > 0 ? totalAreaBase / truck.maxWidth : 0;
  const usedLengthPercentage = truck.usableLength > 0 ? (usedLength / truck.usableLength) * 100 : 0;

  const weightPerMeter = usedLength > 0 ? weight / (usedLength / 100) : 0;
  if (weightPerMeter >= MAX_WEIGHT_PER_METER_KG) {
    tempWarnings.push(`ACHTUNG – mögliche Achslastüberschreitung: ${weightPerMeter.toFixed(1)} kg/m`);
  }
  if (weight >= 10500 && usedLengthPercentage <= 40) {
    tempWarnings.push("ACHTUNG – mehr als 11t auf weniger als 40% der Ladefläche");
  }

  const stackedEup = totalEuroVisual - totalEuroBase;
  const stackedDin = totalDinVisual - totalDinBase;
  if (stackedEup >= STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING && !tempWarnings.some((w) => w.includes("EUP"))) {
    tempWarnings.push(`ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${stackedEup} gestapelte EUP)`);
  }
  if (stackedDin >= STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING && !tempWarnings.some((w) => w.includes("DIN"))) {
    tempWarnings.push(`ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${stackedDin} gestapelte DIN)`);
  }

  return {
    palletArrangement,
    loadedIndustrialPalletsBase: totalDinBase,
    loadedEuroPalletsBase: totalEuroBase,
    totalDinPalletsVisual: totalDinVisual,
    totalEuroPalletsVisual: totalEuroVisual,
    utilizationPercentage,
    warnings: Array.from(new Set(tempWarnings)),
    totalWeightKg: weight,
    eupLoadingPatternUsed: eupPattern,
  };
};

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
      const primary = calculateLoadingLogic(
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

      // quick capacity messages (keep from previous logic but simplified)
      const capEup = calculateLoadingLogic(
        selectedTruck,
        MAX_PALLET_SIMULATION_QUANTITY,
        primary.totalDinPalletsVisual,
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        eupLoadingPattern,
        "DIN_FIRST",
        eupStackLimit,
        dinStackLimit
      );
      const addEup = Math.max(0, capEup.totalEuroPalletsVisual - primary.totalEuroPalletsVisual);

      const capDin = calculateLoadingLogic(
        selectedTruck,
        primary.totalEuroPalletsVisual,
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
      const addDin = Math.max(0, capDin.totalDinPalletsVisual - primary.totalDinPalletsVisual);

      const finalWarnings = [...primary.warnings];
      if (addEup > 0 && addDin > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${addEup} EUP oder ${addDin} DIN Paletten.`);
      } else if (addEup > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${addEup} EUP.`);
      } else if (addDin > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${addDin} DIN Paletten.`);
      }

      setPalletArrangement(primary.palletArrangement);
      setLoadedIndustrialPalletsBase(primary.loadedIndustrialPalletsBase);
      setLoadedEuroPalletsBase(primary.loadedEuroPalletsBase);
      setTotalDinPalletsVisual(primary.totalDinPalletsVisual);
      setTotalEuroPalletsVisual(primary.totalEuroPalletsVisual);
      setUtilizationPercentage(primary.utilizationPercentage);
      setWarnings(finalWarnings);
      setTotalWeightKg(primary.totalWeightKg);
      setActualEupLoadingPattern(primary.eupLoadingPatternUsed);
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

    const sim = calculateLoadingLogic(
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
      setDinQuantity(sim.totalDinPalletsVisual);
      setEupQuantity(0);
    } else {
      setEupQuantity(sim.totalEuroPalletsVisual);
      setDinQuantity(0);
    }
    if (eupLoadingPattern === "auto" && sim.eupLoadingPatternUsed !== "auto" && sim.eupLoadingPatternUsed !== "none" && palletTypeToMax === "euro") {
      setEupLoadingPattern(sim.eupLoadingPatternUsed as any);
    }
  };

  const handleFillRemainingWithEUP = () => {
    const res = calculateLoadingLogic(
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
    setEupQuantity(res.totalEuroPalletsVisual);
    setDinQuantity(res.totalDinPalletsVisual);
  };

  const handleFillRemainingWithDIN = () => {
    const currentEupQty = eupQuantity;
    let best: any = null;

    const info = TRUCK_TYPES[selectedTruck];
    let theoreticalDIN =
      info.singleLayerDINCapacity ||
      (info.singleLayerDINCapacityPerUnit && info.units.length > 0
        ? info.singleLayerDINCapacityPerUnit * info.units.length
        : info.units.length > 0
        ? Math.floor(info.units[0].length / PALLET_TYPES.industrial.width) * 2 * info.units.length
        : 30);

    const iterationMaxDin = theoreticalDIN * (isDINStackable ? 2 : 1);

    for (let d = iterationMaxDin; d >= 0; d--) {
      const sim = calculateLoadingLogic(
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
      if (sim.totalEuroPalletsVisual >= currentEupQty && sim.totalDinPalletsVisual === d) {
        best = sim; break;
      }
    }

    if (best) {
      setDinQuantity(best.totalDinPalletsVisual);
      setEupQuantity(currentEupQty);
    } else {
      const sim = calculateLoadingLogic(
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
      setDinQuantity(sim.totalDinPalletsVisual);
      setEupQuantity(sim.totalEuroPalletsVisual);
    }
  };

  const suggestFeasibleLoad = () => {
    let bestE = 0, bestD = 0; let bestRes: any = null;
    for (let d = dinQuantity; d >= 0; d--) {
      for (let e = eupQuantity; e >= 0; e--) {
        const r = calculateLoadingLogic(
          selectedTruck, e, d, isEUPStackable, isDINStackable,
          eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern, "DIN_FIRST",
          eupStackLimit, dinStackLimit
        );
        const bad = r.warnings.some((w: string) => w.toLowerCase().includes("gewichtslimit") || w.toLowerCase().includes("konnte nicht"));
        if (!bad && r.totalEuroPalletsVisual === e && r.totalDinPalletsVisual === d) {
          if (e + d > bestE + bestD) { bestE = e; bestD = d; bestRes = r; }
        }
      }
    }
    setEupQuantity(bestE);
    setDinQuantity(bestD);
    if (bestRes && eupLoadingPattern === "auto" && bestRes.eupLoadingPatternUsed !== "auto" && bestRes.eupLoadingPatternUsed !== "none") {
      setEupLoadingPattern(bestRes.eupLoadingPatternUsed);
    }
    toast({ title: "Vorschlag übernommen", description: `${bestD} DIN / ${bestE} EUP geladen` });
  };

  const renderPallet = (pallet: any, scale = 0.3) => {
    if (!pallet || !pallet.type || !PALLET_TYPES[pallet.type]) return null;
    const d = PALLET_TYPES[pallet.type];
    const w = pallet.height * scale;
    const h = pallet.width * scale;
    const x = pallet.y * scale;
    const y = pallet.x * scale;

    let txt = pallet.showAsFraction && pallet.displayStackedLabelId
      ? `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}`
      : `${pallet.labelId}`;
    if (pallet.labelId === 0) txt = "?";

    let title = `${d.name} #${pallet.labelId}`;
    if (pallet.showAsFraction) title = `${d.name} (Stapel: ${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId})`;
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
          width: `${w}px}`,
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
  }: { onPick: (v: number | "") => void; options?: number[]; }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {options.map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)} className="px-2 py-[3px] text-xs border rounded-md hover:bg-slate-100">
          {v}
        </button>
      ))}
      <button type="button" onClick={() => onPick("")} className="px-2 py-[3px] text-xs border rounded-md hover:bg-slate-100" title="Alle stapelbar">
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
          {/* Left column: inputs */}
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
              <button onClick={handleClearAllPallets}
                className="w-full py-2 px-4 bg-[#00906c] text-white font-semibold rounded-md shadow-sm hover:bg-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50 transition">
                Alles zurücksetzen
              </button>
            </div>

            <div>
              <button onClick={suggestFeasibleLoad}
                className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 transition">
                Automatisch anpassen
              </button>
            </div>

            {/* DIN */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industriepaletten (DIN)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange("din", -1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input type="number" min={0} value={dinQuantity}
                  onChange={(e) => setDinQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                <button onClick={() => handleQuantityChange("din", 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => {
                const res = calculateLoadingLogic(selectedTruck, 0, MAX_PALLET_SIMULATION_QUANTITY, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern, "DIN_FIRST", eupStackLimit, dinStackLimit);
                setDinQuantity(res.totalDinPalletsVisual); setEupQuantity(0);
              }} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e]">
                Max. DIN
              </button>
              <button onClick={handleFillRemainingWithDIN}
                className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49]">
                Rest mit max. DIN füllen
              </button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/DIN (kg):</label>
                <input type="number" min={0} value={dinWeightPerPallet} onChange={(e) => setDinWeightPerPallet(e.target.value)}
                  placeholder="z.B. 500"
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"/>
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="dinStackable" checked={isDINStackable} onChange={(e) => setIsDINStackable(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                <label htmlFor="dinStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {isDINStackable && (
                <>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={dinStackLimitInput}
                    onChange={(e) => setDinStackLimitInput(e.target.value.replace(/\D+/g, ""))}
                    className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                    placeholder="Stapelbare Paletten gesamt (0 = alle)"/>
                  <QuickPick onPick={(v) => setDinStackLimitInput(v === "" ? "" : String(v))}/>
                </>
              )}
            </div>

            {/* EUP */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Europaletten (EUP)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange("eup", -1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input type="number" min={0} value={eupQuantity}
                  onChange={(e) => setEupQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                <button onClick={() => handleQuantityChange("eup", 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => {
                const res = calculateLoadingLogic(selectedTruck, MAX_PALLET_SIMULATION_QUANTITY, 0, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern, "EUP_FIRST", eupStackLimit, dinStackLimit);
                setEupQuantity(res.totalEuroPalletsVisual); setDinQuantity(0);
              }} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e]">
                Max. EUP
              </button>
              <button onClick={handleFillRemainingWithEUP}
                className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49]">
                Rest mit max. EUP füllen
              </button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/EUP (kg):</label>
                <input type="number" min={0} value={eupWeightPerPallet} onChange={(e) => setEupWeightPerPallet(e.target.value)}
                  placeholder="z.B. 400"
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"/>
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="eupStackable" checked={isEUPStackable} onChange={(e) => setIsEUPStackable(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                <label htmlFor="eupStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {isEUPStackable && (
                <>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={eupStackLimitInput}
                    onChange={(e) => setEupStackLimitInput(e.target.value.replace(/\D+/g, ""))}
                    className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                    placeholder="Stapelbare Paletten gesamt (0 = alle)"/>
                  <QuickPick onPick={(v) => setEupStackLimitInput(v === "" ? "" : String(v))}/>
                </>
              )}
            </div>

            {(eupQuantity > 0 || totalEuroPalletsVisual > 0 || actualEupLoadingPattern !== "auto" || eupLoadingPattern !== "auto") && (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  EUP Lade-Pattern:
                  <span className="text-xs text-gray-500"> (Gewählt: {actualEupLoadingPattern === "none" ? "Keines" : actualEupLoadingPattern})</span>
                </label>
                <div className="flex flex-col space-y-1">
                  <label className="flex items-center">
                    <input type="radio" name="eupLoadingPattern" value="auto" checked={eupLoadingPattern === "auto"}
                      onChange={(e) => setEupLoadingPattern(e.target.value as any)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                    <span className="ml-2 text-sm text-gray-700">Auto-Optimieren</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="eupLoadingPattern" value="long" checked={eupLoadingPattern === "long"}
                      onChange={(e) => setEupLoadingPattern(e.target.value as any)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                    <span className="ml-2 text-sm text-gray-700">Längs (3 nebeneinander)</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="eupLoadingPattern" value="broad" checked={eupLoadingPattern === "broad"}
                      onChange={(e) => setEupLoadingPattern(e.target.value as any)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                    <span className="ml-2 text-sm text-gray-700">Quer (2 nebeneinander)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Right column: visualization */}
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
                  style={{ width: `${unit.unitWidth * truckVisualizationScale}px`, height: `${unit.unitLength * truckVisualizationScale}px` }}
                >
                  {unit.pallets.map((p: any) => renderPallet(p, truckVisualizationScale))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
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
        <p>by Andreas Steiner</p>
      </footer>

      <Toaster />
    </div>
  );
}
