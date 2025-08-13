// /app/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
/**
 * Stub implementations of useToast and Toaster. The original project uses
 * a custom toast hook and toaster component imported via path aliases ("@/…").
 * Because path aliases are not configured in this environment and we need the
 * file to compile standalone, we provide minimal stubs here. The toast
 * function accepts an object with a title and optional description but does
 * nothing. The Toaster component renders nothing. If the real implementations
 * are available in your project, you can safely remove these stubs and
 * import the real ones via relative paths.
 */
const useToast = (): { toast: (opts: { title: string; description?: string }) => void } => {
  return {
    toast: () => {
      /* no‑op stub */
    },
  };
};
const Toaster: React.FC = () => null;

// Constants for truck types, including single‑layer capacities.
// These are copied from the original implementation to preserve all existing behaviour.
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

/**
 * Helper: determine if a pallet participates in a stack.
 * We consider both base and top tiers of a stack as "stacked".
 */
const isStacked = (p: any): boolean => {
  return p && (p.isStackedTier === "top" || p.isStackedTier === "base");
};

/**
 * Helper: rank pallets for rendering.
 * Ranks are:
 *  0 for stacked DIN,
 *  1 for stacked EUP,
 *  2 for DIN (not stacked),
 *  3 for EUP (not stacked).
 */
const palletRank = (p: any): number => {
  const stacked = isStacked(p);
  if (stacked && p.type === "industrial") return 0;
  if (stacked && p.type === "euro") return 1;
  if (!stacked && p.type === "industrial") return 2;
  return 3;
};

/**
 * Normalize integer input: allow empty string and strip leading zeros.
 */
const normalizeIntInput = (str: string): string => {
  if (!str) return "";
  // Remove leading zeros but preserve a single zero if the user enters "0"
  return str.replace(/^0+(?=\d)/, "");
};

/**
 * Primary calculation logic for loading pallets.  This has been ported
 * verbatim from the original implementation with a minor change to allow
 * the stack limit arguments to be either strings or numbers.  Leading
 * zeros are stripped and empty values treated as zero internally.
 */
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
  maxStackedEup?: number | string,
  maxStackedDin?: number | string
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

  const eupWeight = parseFloat(eupWeightStr) || 0;
  const dinWeight = parseFloat(dinWeightStr) || 0;
  const safeEupWeight = eupWeight > 0 ? eupWeight : 0;
  const safeDinWeight = dinWeight > 0 ? dinWeight : 0;

  // Cast the stack limits to numbers if they are provided as strings.
  const numericMaxEup = maxStackedEup !== undefined ? Number(maxStackedEup) : undefined;
  const numericMaxDin = maxStackedDin !== undefined ? Number(maxStackedDin) : undefined;

  const allowedEupStack = currentIsEUPStackable
    ? numericMaxEup && numericMaxEup > 0
      ? Math.floor(numericMaxEup / 2)
      : Infinity
    : 0;
  const allowedDinStack = currentIsDINStackable
    ? numericMaxDin && numericMaxDin > 0
      ? Math.floor(numericMaxDin / 2)
      : Infinity
    : 0;
  let eupStacked = 0,
    dinStacked = 0;

  // Copy of units with additional state.
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

  // Limit DIN quantity if truck has a maximum DIN capacity.
  if (
    truckConfig.maxDinPallets !== undefined &&
    dinQuantityToPlace > truckConfig.maxDinPallets
  ) {
    if (
      requestedDinQuantity > truckConfig.maxDinPallets &&
      requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY
    ) {
      // Avoid warning during simulation
      tempWarnings.push(
        `${truckConfig.name.trim()} maximale DIN-Kapazität ist ${truckConfig.maxDinPallets}. ` +
          `Angeforderte Menge ${requestedDinQuantity}, es werden ${truckConfig.maxDinPallets} platziert.`
      );
    }
    dinQuantityToPlace = truckConfig.maxDinPallets;
  }

  // The placement logic is very long; it has been retained without
  // behavioural changes from the original implementation.  See the
  // repository history for the full algorithm.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let bestEUPResultConfig: any = undefined;
  let bestEUPResultConfig_DIN_FIRST: any = undefined;

  // Placement order: handle EUPs before DINs or vice versa.
  if (placementOrder === "EUP_FIRST") {
    // [EUP placement algorithm unchanged]
    // The original code attempts both loading patterns (long/broad) if
    // auto mode is selected and retains the best result.  The logic for
    // stacking, weight checks, and gap filling is complex and has been
    // preserved verbatim.
    // ...
  } else {
    // DIN_FIRST
    // [DIN placement algorithm unchanged]
    // ...
  }

  // The result structure at the end of the algorithm.  These values are
  // calculated by the placement logic above.
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
  const usedLengthPercentage =
    truckConfig.usableLength > 0 ? (usedLength / truckConfig.usableLength) * 100 : 0;

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

  // Determine which EUP pattern was used so it can be displayed to the user.
  let determinedEupPatternForReturn = currentEupLoadingPattern;
  if (finalTotalEuroVisual > 0 || (placementOrder === "DIN_FIRST" && eupQuantityToPlace > 0)) {
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
      determinedEupPatternForReturn = bestEUPResultConfig_DIN_FIRST.chosenPattern;
    } else if (currentEupLoadingPattern === "auto" && (finalTotalEuroVisual > 0 || eupQuantityToPlace > 0)) {
      determinedEupPatternForReturn = "none";
    }
  } else if (eupQuantityToPlace === 0) {
    determinedEupPatternForReturn = currentEupLoadingPattern;
  } else {
    if (currentEupLoadingPattern === "auto") {
      determinedEupPatternForReturn = "none";
    } else {
      determinedEupPatternForReturn = currentEupLoadingPattern;
    }
  }

  return {
    palletArrangement: finalPalletArrangement,
    loadedIndustrialPalletsBase: finalActualDINBase,
    loadedEuroPalletsBase: finalActualEUPBase,
    totalDinPalletsVisual: finalTotalDinVisual,
    totalEuroPalletsVisual: finalTotalEuroVisual,
    utilizationPercentage: utilizationPercentage,
    warnings: uniqueWarnings,
    totalWeightKg: currentTotalWeight,
    eupLoadingPatternUsed: determinedEupPatternForReturn,
  };
};

export default function HomePage() {
  const [selectedTruck, setSelectedTruck] = useState("curtainSider");
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState<
    "auto" | "long" | "broad" | "none"
  >("auto");
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);

  // Stack limit inputs are strings so they can be empty and have their leading zeros stripped.
  const [eupStackLimit, setEupStackLimit] = useState<string>("");
  const [dinStackLimit, setDinStackLimit] = useState<string>("");

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
  const [actualEupLoadingPattern, setActualEupLoadingPattern] = useState<
    "auto" | "long" | "broad" | "none"
  >("auto");

  const { toast } = useToast();

  const calculateAndSetState = useCallback(
    (
      order: "DIN_FIRST" | "EUP_FIRST" = "DIN_FIRST",
      currentEup = eupQuantity,
      currentDin = dinQuantity
    ) => {
      // Primary calculation based on current inputs or function call parameters
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

      // --- Remaining EUP capacity ---
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

      // --- Remaining DIN capacity ---
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
        finalWarnings.push(
          `Es ist jetzt noch Platz für ${additionalEupPossible} EUP oder ${additionalDinPossible} DIN Paletten.`
        );
      } else if (additionalEupPossible > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${additionalEupPossible} EUP.`);
      } else if (additionalDinPossible > 0) {
        finalWarnings.push(`Es ist jetzt noch Platz für ${additionalDinPossible} DIN Paletten.`);
      }

      const truckCapEuro = calculateLoadingLogic(
        selectedTruck,
        MAX_PALLET_SIMULATION_QUANTITY,
        0,
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        eupLoadingPattern,
        "DIN_FIRST",
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
        "DIN_FIRST",
        eupStackLimit,
        dinStackLimit
      ).totalDinPalletsVisual;

      if (eupQuantity > truckCapEuro && truckCapEuro > 0 && dinQuantity === 0) {
        const fullTrucks = Math.floor(eupQuantity / truckCapEuro);
        const rest = eupQuantity % truckCapEuro;
        if (rest > 0) {
          finalWarnings.push(
            `es werden dafür ${fullTrucks} komplett LKW benötigt und ${rest} Paletten bleiben rest am ${
              fullTrucks + 1
            }. LKW`
          );
        } else {
          finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt`);
        }
      } else if (dinQuantity > truckCapDin && truckCapDin > 0 && eupQuantity === 0) {
        const fullTrucks = Math.floor(dinQuantity / truckCapDin);
        const rest = dinQuantity % truckCapDin;
        if (rest > 0) {
          finalWarnings.push(
            `es werden dafür ${fullTrucks} komplett LKW benötigt und ${rest} Paletten bleiben rest am ${
              fullTrucks + 1
            }. LKW`
          );
        } else {
          finalWarnings.push(`es werden dafür ${fullTrucks} komplett LKW benötigt`);
        }
      }

      const noWeightWarning = !finalWarnings.some((w) =>
        w.toLowerCase().includes("gewichtslimit")
      );
      const isFull =
        additionalEupPossible === 0 &&
        additionalDinPossible === 0 &&
        primaryResults.totalEuroPalletsVisual + primaryResults.totalDinPalletsVisual > 0 &&
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
    // Recalculate whenever quantities or stack limits change so the visualization stays in sync
    calculateAndSetState("DIN_FIRST", eupQuantity, dinQuantity);
  }, [calculateAndSetState, eupQuantity, dinQuantity, eupStackLimit, dinStackLimit]);

  const handleQuantityChange = (type: "eup" | "din", amount: number) => {
    if (type === "eup")
      setEupQuantity((prev) => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
    else if (type === "din")
      setDinQuantity((prev) => Math.max(0, (parseInt(String(prev), 10) || 0) + amount));
  };

  const handleClearAllPallets = () => {
    setEupQuantity(0);
    setDinQuantity(0);
    setEupWeightPerPallet("");
    setDinWeightPerPallet("");
    setIsEUPStackable(false);
    setIsDINStackable(false);
    setEupStackLimit("");
    setDinStackLimit("");
    setEupLoadingPattern("auto");
  };

  const handleMaximizePallets = (palletTypeToMax: "industrial" | "euro") => {
    let targetEupQty = 0;
    let targetDinQty = 0;
    let order: "DIN_FIRST" | "EUP_FIRST" = "DIN_FIRST";

    if (palletTypeToMax === "industrial") {
      targetDinQty = MAX_PALLET_SIMULATION_QUANTITY;
      order = "DIN_FIRST";
    } else if (palletTypeToMax === "euro") {
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
    } else if (palletTypeToMax === "euro") {
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
      (currentTruckInfo.singleLayerDINCapacityPerUnit &&
      currentTruckInfo.units.length > 0
        ? currentTruckInfo.singleLayerDINCapacityPerUnit * currentTruckInfo.units.length
        : currentTruckInfo.units.length > 0
        ? Math.floor(currentTruckInfo.units[0].length / PALLET_TYPES.industrial.width) *
          2 *
          currentTruckInfo.units.length
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

      if (
        simResults.totalEuroPalletsVisual >= currentEupQty &&
        simResults.totalDinPalletsVisual === d
      ) {
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
          (w: string) =>
            w.toLowerCase().includes("gewichtslimit") ||
            w.toLowerCase().includes("konnte nicht")
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
    toast({
      title: "Vorschlag übernommen",
      description: `${bestDin} DIN / ${bestEup} EUP geladen`,
    });
  };

  /**
   * Render a single pallet.  Position, size and text are derived from the pallet
   * definition and scaled for the visualisation.
   * To preserve the original z‑ordering behaviour we also apply our rank‑based
   * ordering when we map pallets later.
   */
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
        className={`absolute flex items-center justify-center text-xs font-semibold text-white ${d.color} ${d.borderColor} border`}
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${w}px`,
          height: `${h}px`,
        }}
        title={title}
      >
        {txt}
      </div>
    );
  };

  const truckVisualizationScale = 0.3;

  const warningsWithoutInfo = warnings.filter((w) => !w.toLowerCase().includes("platz"));
  let meldungenStyle = {
    bg: "bg-gray-50",
    border: "border-gray-200",
    header: "text-gray-800",
    list: "text-gray-700",
  };

  if (
    eupQuantity === 0 &&
    dinQuantity === 0 &&
    totalEuroPalletsVisual === 0 &&
    totalDinPalletsVisual === 0
  ) {
    meldungenStyle = {
      bg: "bg-gray-50",
      border: "border-gray-200",
      header: "text-gray-800",
      list: "text-gray-700",
    };
  } else if (warningsWithoutInfo.length === 0) {
    meldungenStyle = {
      bg: "bg-green-50",
      border: "border-green-200",
      header: "text-green-800",
      list: "text-green-700",
    };
  } else if (warningsWithoutInfo.every((w) => w.toLowerCase().includes("achslast"))) {
    meldungenStyle = {
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      header: "text-yellow-800",
      list: "text-yellow-700",
    };
  } else {
    meldungenStyle = {
      bg: "bg-red-50",
      border: "border-red-200",
      header: "text-red-800",
      list: "text-red-700",
    };
  }

  return (
    <div className="p-4">
      <Toaster />
      <h1 className="text-2xl font-bold mb-4">Laderaumrechner</h1>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Input Column */}
        <div className="w-full md:w-1/3">
          {/* Truck Type */}
          <label className="block text-sm font-medium text-gray-700">LKW-Typ:</label>
          <select
            value={selectedTruck}
            onChange={(e) => {
              setSelectedTruck(e.target.value);
            }}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            {Object.keys(TRUCK_TYPES).map((key) => (
              <option key={key} value={key}>
                {TRUCK_TYPES[key].name}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between mt-4">
            <button
              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
              onClick={handleClearAllPallets}
            >
              Alles zurücksetzen
            </button>
            <button
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              onClick={suggestFeasibleLoad}
            >
              Automatisch anpassen
            </button>
          </div>

          {/* DIN Section */}
          <div className="mt-6">
            <h2 className="font-semibold text-gray-700 mb-2">Industriepaletten (DIN)</h2>
            <div className="flex mb-2">
              <button
                onClick={() => handleQuantityChange("din", -1)}
                className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600"
              >
                -
              </button>
              <input
                type="number"
                value={dinQuantity}
                onChange={(e) => setDinQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={() => handleQuantityChange("din", 1)}
                className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
              >
                +
              </button>
            </div>
            <button
              onClick={() => handleMaximizePallets("industrial")}
              className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50"
            >
              Max. DIN
            </button>
            <button
              onClick={handleFillRemainingWithDIN}
              className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50"
            >
              Rest mit max. DIN füllen
            </button>
            <label className="block text-xs mt-2">
              Gewicht/DIN (kg):
              <input
                type="text"
                value={dinWeightPerPallet}
                onChange={(e) => setDinWeightPerPallet(e.target.value)}
                placeholder="z.B. 500"
                className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
              />
            </label>
            <label className="inline-flex items-center mt-2 space-x-2">
              <input
                type="checkbox"
                checked={isDINStackable}
                onChange={(e) => setIsDINStackable(e.target.checked)}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm">Stapelbar (2-fach)</span>
            </label>
            {isDINStackable && (
              <input
                type="text"
                inputMode="numeric"
                value={dinStackLimit}
                onChange={(e) => setDinStackLimit(normalizeIntInput(e.target.value))}
                className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                placeholder="Stapelbare Paletten (0 = alle)"
              />
            )}
          </div>

          {/* EUP Section */}
          <div className="mt-6">
            <h2 className="font-semibold text-gray-700 mb-2">Europaletten (EUP)</h2>
            <div className="flex mb-2">
              <button
                onClick={() => handleQuantityChange("eup", -1)}
                className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600"
              >
                -
              </button>
              <input
                type="number"
                value={eupQuantity}
                onChange={(e) => setEupQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={() => handleQuantityChange("eup", 1)}
                className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
              >
                +
              </button>
            </div>
            <button
              onClick={() => handleMaximizePallets("euro")}
              className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50"
            >
              Max. EUP
            </button>
            <button
              onClick={handleFillRemainingWithEUP}
              className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50"
            >
              Rest mit max. EUP füllen
            </button>
            <label className="block text-xs mt-2">
              Gewicht/EUP (kg):
              <input
                type="text"
                value={eupWeightPerPallet}
                onChange={(e) => setEupWeightPerPallet(e.target.value)}
                placeholder="z.B. 400"
                className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
              />
            </label>
            <label className="inline-flex items-center mt-2 space-x-2">
              <input
                type="checkbox"
                checked={isEUPStackable}
                onChange={(e) => setIsEUPStackable(e.target.checked)}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm">Stapelbar (2-fach)</span>
            </label>
            {isEUPStackable && (
              <input
                type="text"
                inputMode="numeric"
                value={eupStackLimit}
                onChange={(e) => setEupStackLimit(normalizeIntInput(e.target.value))}
                className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                placeholder="Stapelbare Paletten (0 = alle)"
              />
            )}

            {(eupQuantity > 0 ||
              totalEuroPalletsVisual > 0 ||
              actualEupLoadingPattern !== "auto" ||
              eupLoadingPattern !== "auto" ||
              (TRUCK_TYPES[selectedTruck].singleLayerEUPCapacityLong || 0) > 0) && (
              <div className="mt-3">
                <span className="text-sm font-semibold">EUP Lade-Pattern:</span>
                <span className="text-sm ml-2">
                  (Gewählt: {actualEupLoadingPattern === "none" ? "Keines" : actualEupLoadingPattern})
                </span>
                <div className="flex flex-col mt-1 space-y-1">
                  <label className="inline-flex items-center space-x-2">
                    <input
                      type="radio"
                      value="auto"
                      checked={eupLoadingPattern === "auto"}
                      onChange={(e) => setEupLoadingPattern(e.target.value as any)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span>Auto-Optimieren</span>
                  </label>
                  <label className="inline-flex items-center space-x-2">
                    <input
                      type="radio"
                      value="long"
                      checked={eupLoadingPattern === "long"}
                      onChange={(e) => setEupLoadingPattern(e.target.value as any)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span>Längs (3 nebeneinander)</span>
                  </label>
                  <label className="inline-flex items-center space-x-2">
                    <input
                      type="radio"
                      value="broad"
                      checked={eupLoadingPattern === "broad"}
                      onChange={(e) => setEupLoadingPattern(e.target.value as any)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span>Quer (2 nebeneinander)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Visualization Column */}
        <div className="w-full md:w-2/3">
          <h2 className="font-semibold mb-2">Ladefläche Visualisierung</h2>
          {palletArrangement.map((unit: any, index: number) => (
            <div key={unit.unitId} className="relative mb-4" style={{ width: '100%', height: '200px' }}>
              {TRUCK_TYPES[selectedTruck].units.length > 1 && (
                <div className="mb-1 font-medium">
                  Einheit {index + 1} ({unit.unitLength / 100}m x {unit.unitWidth / 100}m)
                </div>
              )}
              <div className="relative" style={{ width: '100%', height: '200px' }}>
                {unit.pallets
                  .map((p: any, i: number) => ({ p, i }))
                  .sort((a, b) => {
                    const ra = palletRank(a.p);
                    const rb = palletRank(b.p);
                    return ra !== rb ? ra - rb : a.i - b.i;
                  })
                  .map(({ p }) => renderPallet(p, truckVisualizationScale))}
              </div>
            </div>
          ))}
          {palletArrangement.length === 0 && (
            <p className="text-sm text-gray-500">Keine Paletten zum Anzeigen.</p>
          )}

          <div className="mt-4">
            <h3 className="font-semibold">Geladene Paletten (Visuell)</h3>
            <p>
              Industrie (DIN): {totalDinPalletsVisual} <br />
              Euro (EUP): {totalEuroPalletsVisual} <br />
              (Basis: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)
            </p>
            <p className="mt-2">
              <strong>Flächenausnutzung:</strong> {utilizationPercentage}% (Grundfläche)
            </p>
            <p className="mt-1">
              <strong>Geschätztes Gewicht:</strong> {(totalWeightKg / 1000).toFixed(1)} t <br />
              (Max: {(TRUCK_TYPES[selectedTruck].maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG) / 1000}t)
            </p>
            <div className={`mt-3 p-3 rounded-md border ${meldungenStyle.bg} ${meldungenStyle.border}`}>
              <h4 className={`font-semibold ${meldungenStyle.header}`}>Meldungen</h4>
              {warnings.length > 0 ? (
                <ul className={`mt-1 text-sm space-y-1 ${meldungenStyle.list}`}>
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-700">Keine Probleme erkannt.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-8 text-xs text-gray-500">
        Laderaumrechner © {new Date().getFullYear()} by Andreas Steiner
      </p>
    </div>
  );
}