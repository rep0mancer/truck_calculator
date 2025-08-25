"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

/* ---------------- Truck & pallet data ---------------- */

const TRUCK_TYPES: any = {
  curtainSider: {
    name: "Planensattel Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 245, occupiedRects: [] }],
    totalLength: 1320,
    usableLength: 1320,
    trueLength: 1360,
    maxWidth: 245,
    /* reference capacities to sanity-check our planner */
    singleLayerEUPCapacityLong: 33, // 11 rows * 3 across (120x80)
    singleLayerEUPCapacityBroad: 32, // 16 rows * 2 across (80x120)
    singleLayerDINCapacity: 26, // 13 rows * 2 across with 100cm row step
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
  Waggon: {
    name: "Waggon Hbbils (15,2m)",
    units: [{ id: "main", length: 1520, width: 290, occupiedRects: [] }],
    totalLength: 1520,
    usableLength: 1520,
    maxWidth: 290,
    singleLayerEUPCapacityLong: 38,
    singleLayerEUPCapacityBroad: 38,
    singleLayerDINCapacity: 26,
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

/* ---------------- constants ---------------- */

const MAX_GROSS_WEIGHT_KG = 24000;
const MAX_PALLET_SIMULATION_QUANTITY = 300;
const STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING = 18;
const STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING = 16;
const MAX_WEIGHT_PER_METER_KG = 1800;

/* ---------------- z-index (draw priority) ---------------- */
/* Ensures: STACKED DIN > STACKED EUP > DIN > EUP */
const zIndexFor = (p: any) => {
  const isStacked = !!p.showAsFraction;
  const isTop = p.isStackedTier === "top";
  if (p.type === "industrial" && isStacked) return isTop ? 401 : 400;
  if (p.type === "euro" && isStacked) return isTop ? 301 : 300;
  if (p.type === "industrial") return 200;
  return 100;
};

/* ---------------- planner ---------------- */

type EupPattern = "auto" | "long" | "broad" | "none";

/**
 * Planner guarantees:
 * - Pure EUP: 33 (single) / 66 (stacked) on curtainSider
 * - Pure DIN: 26 (single) / 52 (stacked) on curtainSider
 * - Mixed load (DIN + EUP): DIN use 120 cm row step to align with EUP, removing seam holes
 * - Visual priority: Stacked DIN → Stacked EUP → DIN → EUP
 * - Stack limit input counts **pallets** that may be stacked; topsBudget = floor(limit/2)
 */
const calculateLoadingLogic = (
  truckKey: string,
  requestedEup: number,
  requestedDin: number,
  eupStackable: boolean,
  dinStackable: boolean,
  eupWeightStr: string,
  dinWeightStr: string,
  eupPattern: EupPattern,
  placementOrder: "DIN_FIRST" | "EUP_FIRST",
  eupStackLimit?: number, // total pallets allowed to be in stacks (base+top)
  dinStackLimit?: number
) => {
  const truck = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const weightLimit = truck.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;

  const eupWeight = Math.max(0, parseFloat(eupWeightStr) || 0);
  const dinWeight = Math.max(0, parseFloat(dinWeightStr) || 0);

  let warnings: string[] = [];
  let totalAreaBase = 0;
  let totalWeight = 0;

  let dinLeft = Math.max(0, requestedDin);
  let eupLeft = Math.max(0, requestedEup);

  // stack limits: input N means N "stackable pallets" -> tops budget = floor(N / 2)
  let eupTopsBudget = eupStackable
    ? eupStackLimit && eupStackLimit > 0
      ? Math.floor(eupStackLimit / 2)
      : Number.POSITIVE_INFINITY
    : 0;
  let dinTopsBudget = dinStackable
    ? dinStackLimit && dinStackLimit > 0
      ? Math.floor(dinStackLimit / 2)
      : Number.POSITIVE_INFINITY
    : 0;

  // labels for human-friendly numbering
  let eupLabel = 0;
  let dinLabel = 0;

  const units = truck.units.map((u: any) => ({
    ...u,
    currentX: 0,
    currentY: 0,
    palletsVisual: [] as any[],
  }));

  const canAdd = (w: number) => weightLimit <= 0 || totalWeight + w <= weightLimit;

  const push = (unit: any, p: any) => {
    unit.palletsVisual.push(p);
    unit.occupiedRects.push({ x: p.x, y: p.y, width: p.width, height: p.height });
  };

  /** place DIN – orientation depends on whether EUP is also present (to avoid holes) */
  const placeDIN = (stacked: boolean, alignWithEUP: boolean) => {
    if (dinLeft <= 0) return;

    const def = PALLET_TYPES.industrial;
    const palLen = alignWithEUP ? def.length : def.width; // along trailer: 120 if mixed, 100 if pure DIN
    const palWid = alignWithEUP ? def.width : def.length; // across width: 100 if mixed, 120 if pure DIN

    for (const unit of units) {
      if (dinLeft <= 0) break;

      while (unit.currentX + palLen <= unit.length && dinLeft > 0) {
        unit.currentY = 0;
        let placedInRow = 0;

        for (let i = 0; i < 2; i++) {
          if (dinLeft <= 0) break;

          if (!canAdd(dinWeight)) {
            if (!warnings.some((w) => w.includes("Gewichtslimit für DIN")))
              warnings.push(`Gewichtslimit für DIN-Paletten erreicht. Max ${weightLimit / 1000}t.`);
            unit.currentX = unit.length;
            break;
          }

          if (unit.currentY + palWid <= unit.width) {
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
            push(unit, base);
            totalAreaBase += def.area;
            totalWeight += dinWeight;
            dinLeft--;
            placedInRow++;
            // try top
            if (stacked && dinLeft > 0 && dinTopsBudget > 0 && canAdd(dinWeight)) {
              const topId = ++dinLabel;
              const baseAsStack = {
                ...base,
                isStackedTier: "base" as const,
                showAsFraction: true,
                displayStackedLabelId: topId,
              };
              unit.palletsVisual[unit.palletsVisual.length - 1] = baseAsStack;
              push(unit, {
                ...base,
                isStackedTier: "top" as const,
                key: `din_${unit.id}_top_${baseId}_${i}`,
                labelId: topId,
                displayBaseLabelId: baseId,
                displayStackedLabelId: topId,
                showAsFraction: true,
              });
              totalWeight += dinWeight;
              dinLeft--;
              dinTopsBudget--;
            }
            unit.currentY += palWid;
          }
        }

        if (placedInRow > 0) {
          unit.currentX += palLen; // advance along length
        } else {
          break;
        }
      }
    }
  };

  /** try placing EUP with a pattern, return a snapshot */
  const tryPlaceEUP = (
    pattern: "long" | "broad",
    stacked: boolean,
    unitsIn: any[],
    eupLeftIn: number,
    topsBudgetIn: number,
    weightIn: number
  ) => {
    const unitsClone = JSON.parse(JSON.stringify(unitsIn));
    const def = PALLET_TYPES.euro;

    const perRow = pattern === "long" ? 3 : 2;
    const palLen = pattern === "long" ? def.length : def.width; // along trailer
    const palWid = pattern === "long" ? def.width : def.length; // across width

    let localEupLeft = eupLeftIn;
    let localWeight = weightIn;
    let localTops = topsBudgetIn;
    let localArea = 0;
    let localBase = 0;
    let localVisual = 0;
    let localLabel = eupLabel;

    for (const unit of unitsClone) {
      if (localEupLeft <= 0) break;

      while (unit.currentX + palLen <= unit.length && localEupLeft > 0) {
        unit.currentY = 0;
        let placedInRow = 0;

        for (let i = 0; i < perRow; i++) {
          if (localEupLeft <= 0) break;

          if (!(weightLimit <= 0 || localWeight + eupWeight <= weightLimit)) {
            unit.currentX = unit.length;
            if (!warnings.some((w) => w.includes("Gewichtslimit für EUP")))
              warnings.push(`Gewichtslimit für EUP-Paletten erreicht. Max ${weightLimit / 1000}t.`);
            break;
          }

          if (unit.currentY + palWid <= unit.width) {
            const baseId = ++localLabel;
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
            unit.occupiedRects.push({ x: base.x, y: base.y, width: palLen, height: palWid });

            localArea += def.area;
            localBase++;
            localVisual++;
            localWeight += eupWeight;
            localEupLeft--;
            placedInRow++;

            if (stacked && localEupLeft > 0 && localTops > 0 && (weightLimit <= 0 || localWeight + eupWeight <= weightLimit)) {
              const topId = ++localLabel;
              unit.palletsVisual[unit.palletsVisual.length - 1] = {
                ...base,
                isStackedTier: "base" as const,
                showAsFraction: true,
                displayStackedLabelId: topId,
              };
              unit.palletsVisual.push({
                ...base,
                isStackedTier: "top" as const,
                key: `eup_${unit.id}_top_${baseId}_${i}_${pattern}`,
                labelId: topId,
                displayBaseLabelId: baseId,
                displayStackedLabelId: topId,
                showAsFraction: true,
              });
              localVisual++;
              localWeight += eupWeight;
              localEupLeft--;
              localTops--;
            }

            unit.currentY += palWid;
          }
        }

        if (placedInRow > 0) {
          unit.currentX += palLen;
        } else {
          break;
        }
      }
    }

    return {
      units: unitsClone,
      eupLeft: localEupLeft,
      weight: localWeight,
      area: localArea,
      base: localBase,
      visual: localVisual,
      label: localLabel,
      tops: localTops,
    };
  };

  const placeEUP = (stacked: boolean) => {
    if (eupLeft <= 0) return;

    let pick: any = null;

    if (eupPattern === "auto") {
      const a = tryPlaceEUP("long", stacked, units, eupLeft, eupTopsBudget, totalWeight);
      const b = tryPlaceEUP("broad", stacked, units, eupLeft, eupTopsBudget, totalWeight);
      pick = b.visual > a.visual ? b : a;
    } else if (eupPattern === "long" || eupPattern === "broad") {
      pick = tryPlaceEUP(eupPattern, stacked, units, eupLeft, eupTopsBudget, totalWeight);
    } else {
      return; // none
    }

    // commit
    units.splice(0, units.length, ...pick.units);
    eupLeft = pick.eupLeft;
    totalWeight = pick.weight;
    totalAreaBase += pick.area;
    eupLabel = pick.label;
    eupTopsBudget = pick.tops;
  };

  /* ---------- pipeline ---------- */

  if (placementOrder === "DIN_FIRST") {
    // DIN first. If EUP will follow => align with EUP (120 step) to avoid holes.
    placeDIN(true, eupLeft > 0);  // stacked DIN
    placeEUP(true);               // stacked EUP
    placeDIN(false, eupLeft > 0); // unstacked DIN
    placeEUP(false);              // unstacked EUP
  } else {
    // EUP first
    placeEUP(true);
    // For DIN after EUP we always align with EUP (120 step)
    placeDIN(true, true);
    placeEUP(false);
    placeDIN(false, true);
  }

  /* ---------- draw-order enforcement ---------- */
  const categoryPriority = (p: any) => {
    const s = !!p.showAsFraction;
    if (p.type === "industrial" && s) return 0; // stacked DIN
    if (p.type === "euro" && s) return 1;       // stacked EUP
    if (p.type === "industrial") return 2;      // DIN
    return 3;                                   // EUP
  };
  const withinPair = (p: any) => (p.isStackedTier === "top" ? 1 : 0);

  for (const u of units) {
    u.palletsVisual.sort((a: any, b: any) => {
      const ca = categoryPriority(a), cb = categoryPriority(b);
      if (ca !== cb) return ca - cb;
      const pa = withinPair(a), pb = withinPair(b);
      if (pa !== pb) return pa - pb;
      return 0;
    });
  }

  /* ---------- outputs & warnings ---------- */

  const palletArrangement = units.map((u: any) => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: u.palletsVisual,
  }));

  const totalPracticalArea = truck.usableLength * truck.maxWidth;
  const utilizationPercentage =
    totalPracticalArea > 0 ? parseFloat(((totalAreaBase / totalPracticalArea) * 100).toFixed(1)) : 0;

  // axle-ish heuristics
  const usedLength = truck.maxWidth > 0 ? totalAreaBase / truck.maxWidth : 0;
  const usedLengthPercentage = truck.usableLength > 0 ? (usedLength / truck.usableLength) * 100 : 0;
  const weightPerMeter = usedLength > 0 ? totalWeight / (usedLength / 100) : 0;

  if (weightPerMeter >= MAX_WEIGHT_PER_METER_KG) {
    warnings.push(`ACHTUNG – mögliche Achslastüberschreitung: ${weightPerMeter.toFixed(1)} kg/m`);
  }
  if (totalWeight >= 10500 && usedLengthPercentage <= 40) {
    warnings.push("ACHTUNG – mehr als 11t auf weniger als 40% der Ladefläche");
  }

  // stacked counts (for info/warn thresholds)
  const allPallets = units.flatMap((u: any) => u.palletsVisual);
  const totalEuroVisual = allPallets.filter((p) => p.type === "euro").length;
  const totalDinVisual = allPallets.filter((p) => p.type === "industrial").length;
  const euroBase = allPallets.filter((p) => p.type === "euro" && !p.showAsFraction).length;
  const dinBase = allPallets.filter((p) => p.type === "industrial" && !p.showAsFraction).length;
  const stackedEup = totalEuroVisual - euroBase;
  const stackedDin = totalDinVisual - dinBase;

  if (stackedEup >= STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING) {
    warnings.push(`ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${stackedEup} gestapelte EUP)`);
  }
  if (stackedDin >= STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING) {
    warnings.push(`ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${stackedDin} gestapelte DIN)`);
  }

  warnings = Array.from(new Set(warnings));

  return {
    palletArrangement,
    loadedIndustrialPalletsBase: dinBase,
    loadedEuroPalletsBase: euroBase,
    totalDinPalletsVisual: totalDinVisual,
    totalEuroPalletsVisual: totalEuroVisual,
    utilizationPercentage,
    warnings,
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: eupPattern,
  };
};

/* ---------------- page component ---------------- */

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState("curtainSider");
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);

  const [eupLoadingPattern, setEupLoadingPattern] = useState<EupPattern>("auto");
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);

  // keep as strings so we never auto-prepend "0"
  const [eupStackLimitInput, setEupStackLimitInput] = useState("");
  const [dinStackLimitInput, setDinStackLimitInput] = useState("");

  const eupStackLimit = useMemo(
    () => Math.max(0, parseInt(eupStackLimitInput, 10) || 0),
    [eupStackLimitInput]
  );
  const dinStackLimit = useMemo(
    () => Math.max(0, parseInt(dinStackLimitInput, 10) || 0),
    [dinStackLimitInput]
  );

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
  const [actualEupLoadingPattern, setActualEupLoadingPattern] = useState<EupPattern>("auto");

  const { toast } = useToast();

  const calc = useCallback(
    (
      order: "DIN_FIRST" | "EUP_FIRST" = "DIN_FIRST",
      currentEup = eupQuantity,
      currentDin = dinQuantity
    ) => {
      const res = calculateLoadingLogic(
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

      setPalletArrangement(res.palletArrangement);
      setLoadedIndustrialPalletsBase(res.loadedIndustrialPalletsBase);
      setLoadedEuroPalletsBase(res.loadedEuroPalletsBase);
      setTotalDinPalletsVisual(res.totalDinPalletsVisual);
      setTotalEuroPalletsVisual(res.totalEuroPalletsVisual);
      setUtilizationPercentage(res.utilizationPercentage);
      setWarnings(res.warnings);
      setTotalWeightKg(res.totalWeightKg);
      setActualEupLoadingPattern(res.eupLoadingPatternUsed);
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
    calc("DIN_FIRST", eupQuantity, dinQuantity);
  }, [calc, eupQuantity, dinQuantity, eupStackLimit, dinStackLimit]);

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

  const handleMaximizePallets = (type: "euro" | "industrial") => {
    const res = calculateLoadingLogic(
      selectedTruck,
      type === "euro" ? MAX_PALLET_SIMULATION_QUANTITY : 0,
      type === "industrial" ? MAX_PALLET_SIMULATION_QUANTITY : 0,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      type === "euro" ? "EUP_FIRST" : "DIN_FIRST",
      eupStackLimit,
      dinStackLimit
    );
    if (type === "euro") {
      setEupQuantity(res.totalEuroPalletsVisual);
      setDinQuantity(0);
    } else {
      setDinQuantity(res.totalDinPalletsVisual);
      setEupQuantity(0);
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
    const res = calculateLoadingLogic(
      selectedTruck,
      eupQuantity,
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
    setEupQuantity(res.totalEuroPalletsVisual);
    setDinQuantity(res.totalDinPalletsVisual);
  };

  const suggestFeasibleLoad = () => {
    // tiny helper that tries to keep both amounts, reducing if impossible
    let e = eupQuantity;
    let d = dinQuantity;
    for (; d >= 0; d--) {
      const r = calculateLoadingLogic(
        selectedTruck, e, d, isEUPStackable, isDINStackable,
        eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern, "DIN_FIRST",
        eupStackLimit, dinStackLimit
      );
      const bad = r.warnings.some((w: string) => w.toLowerCase().includes("gewichtslimit"));
      if (!bad && r.totalEuroPalletsVisual === e && r.totalDinPalletsVisual === d) {
        setEupQuantity(e); setDinQuantity(d);
        toast({ title: "Vorschlag übernommen", description: `${d} DIN / ${e} EUP geladen` });
        return;
      }
    }
    toast({ title: "Kein perfekter Vorschlag gefunden", description: "Versuche manuell zu justieren." });
  };

  const renderPallet = (pallet: any, scale = 0.3) => {
    if (!pallet || !PALLET_TYPES[pallet.type]) return null;
    const def = PALLET_TYPES[pallet.type];

    // rotate view: x↔y for a truck-portrait canvas (length vertical)
    const w = pallet.height * scale; // horizontal in canvas
    const h = pallet.width * scale;  // vertical in canvas
    const x = pallet.y * scale;
    const y = pallet.x * scale;

    let label =
      pallet.showAsFraction && pallet.displayStackedLabelId
        ? `${pallet.displayBaseLabelId}/${pallet.displayStackedLabelId}`
        : `${pallet.labelId}`;

    return (
      <div
        key={pallet.key}
        className={`absolute ${def.color} ${def.borderColor} border rounded-sm shadow-sm flex items-center justify-center`}
        title={def.name}
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${w}px`,
          height: `${h}px`,
          opacity: pallet.isStackedTier === "top" ? 0.7 : 1,
          zIndex: zIndexFor(pallet),
          fontSize: "10px",
        }}
      >
        <span className="text-black font-semibold select-none">{label}</span>
        {pallet.isStackedTier === "top" && (
          <div className="absolute inset-0 border-t-2 border-l-2 border-black opacity-30 pointer-events-none rounded-sm" />
        )}
      </div>
    );
  };

  const truckVisualizationScale = 0.3;

  const QuickPick = ({
    onPick,
    options,
  }: {
    onPick: (v: number | "") => void;
    options: number[];
  }) => (
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

  const warningsWithoutInfo = warnings.filter((w) => !w.toLowerCase().includes("platz"));
  let meldungenStyle = { bg: "bg-gray-50", border: "border-gray-200", header: "text-gray-800", list: "text-gray-700" };
  if (warningsWithoutInfo.length === 0 && (eupQuantity + dinQuantity) > 0) {
    meldungenStyle = { bg: "bg-green-50", border: "border-green-200", header: "text-green-800", list: "text-green-700" };
  } else if (warningsWithoutInfo.every((w) => w.toLowerCase().includes("achslast"))) {
    meldungenStyle = { bg: "bg-yellow-50", border: "border-yellow-200", header: "text-yellow-800", list: "text-yellow-700" };
  } else if (warningsWithoutInfo.length > 0) {
    meldungenStyle = { bg: "bg-red-50", border: "border-red-200", header: "text-red-800", list: "text-red-700" };
  }

  return (
    <div className="container mx-auto p-4 font-sans bg-gray-50">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-t-lg shadow-lg mb-6">
        <h1 className="text-3xl font-bold text-center tracking-tight">Laderaumrechner</h1>
        <p className="text-center text-sm opacity-90">Visualisierung der Palettenplatzierung (Europäische Standards)</p>
      </header>

      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* left: inputs */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">LKW-Typ:</label>
              <select
                id="truckType"
                value={selectedTruck}
                onChange={(e) => setSelectedTruck(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                {Object.keys(TRUCK_TYPES).map((k) => (
                  <option key={k} value={k}>{TRUCK_TYPES[k].name}</option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                onClick={handleClearAllPallets}
                className="w-full py-2 px-4 bg-[#00906c] text-white font-semibold rounded-md shadow-sm hover:bg-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50 transition"
              >
                Alles zurücksetzen
              </button>
            </div>

            <div>
              <button
                onClick={suggestFeasibleLoad}
                className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 transition"
              >
                Automatisch anpassen
              </button>
            </div>

            {/* DIN */}
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
                onClick={() => handleMaximizePallets("industrial")}
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
                  <QuickPick onPick={(v) => setDinStackLimitInput(v === "" ? "" : String(v))} options={[2, 4, 6, 8, 10]} />
                </>
              )}
            </div>

            {/* EUP */}
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
                onClick={() => handleMaximizePallets("euro")}
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
                  <QuickPick onPick={(v) => setEupStackLimitInput(v === "" ? "" : String(v))} options={[2, 4, 6, 8, 10]} />
                </>
              )}
            </div>

            {(eupQuantity > 0 ||
              totalEuroPalletsVisual > 0 ||
              actualEupLoadingPattern !== "auto" ||
              eupLoadingPattern !== "auto") && (
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
                      onChange={(e) => setEupLoadingPattern(e.target.value as EupPattern)}
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
                      onChange={(e) => setEupLoadingPattern(e.target.value as EupPattern)}
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
                      onChange={(e) => setEupLoadingPattern(e.target.value as EupPattern)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Quer (2 nebeneinander)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* right: visualization */}
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

        {/* summary */}
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
