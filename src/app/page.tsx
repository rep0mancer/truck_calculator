"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

// Interfaces for type safety
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PalletType {
  name: string;
  type: "euro" | "industrial";
  length: number;
  width: number;
  area: number;
  color: string;
  borderColor: string;
}

interface TruckConfig {
  name: string;
  units: { id: string; length: number; width: number; occupiedRects: Rect[] }[];
  totalLength: number;
  usableLength: number;
  maxWidth: number;
  maxGrossWeightKg: number;
  singleLayerEUPCapacityLong?: number;
  singleLayerEUPCapacityBroad?: number;
  singleLayerEUPCapacityLongPerUnit?: number;
  singleLayerEUPCapacityBroadPerUnit?: number;
  singleLayerDINCapacity?: number;
  singleLayerDINCapacityPerUnit?: number;
  maxDinPallets?: number;
  trueLength?: number;
  wheelbase: number; // Added for axle calc (cm)
  axlePositions: number[]; // Added: positions from front (cm)
  maxAxleLoads: number[]; // Added: max kg per axle
}

interface UnitState {
  id: string;
  length: number;
  width: number;
  occupiedRects: Rect[];
  currentX: number;
  currentY: number;
  palletsVisual: PalletVisual[];
  dinEndX: number;
  dinEndY: number;
  dinLastRowIncomplete: boolean;
  eupStartX: number;
  eupEndX: number;
  eupEndY: number;
  eupLastRowIncomplete: boolean;
  dinStartX: number;
}

interface PalletVisual {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "euro" | "industrial";
  isStackedTier: "base" | "top" | null;
  key: string;
  unitId: string;
  labelId: number;
  displayBaseLabelId: number;
  displayStackedLabelId: number | null;
  showAsFraction: boolean;
  weight: number; // Added for axle calc
}

interface PlacementResult {
  unitsConfiguration: UnitState[];
  totalVisual: number;
  baseCount: number;
  area: number;
  warnings: string[];
  weight: number;
  chosenPattern: "long" | "broad" | "none";
  finalLabelCounter: number;
}

interface AxleInfo {
  front: number;
  rear: number;
  warnings: string[];
}

// Constants for truck types, including single-layer capacities and axle data
const TRUCK_TYPES: Record<string, TruckConfig> = {
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
    wheelbase: 1200, // Example; adjust based on real specs
    axlePositions: [200, 1400],
    maxAxleLoads: [7100, 11500],
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
    wheelbase: 1000,
    axlePositions: [200, 1200],
    maxAxleLoads: [7100, 11500],
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
    wheelbase: 1000,
    axlePositions: [200, 1200],
    maxAxleLoads: [7100, 11500],
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
    wheelbase: 500,
    axlePositions: [100, 600],
    maxAxleLoads: [5000, 8000],
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
    wheelbase: 1200,
    axlePositions: [200, 1400],
    maxAxleLoads: [7100, 11500],
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
    wheelbase: 1300,
    axlePositions: [200, 1500],
    maxAxleLoads: [7100, 11500],
  },
};

const PALLET_TYPES: Record<string, PalletType> = {
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

// Helper function for placing pallets in a unit (refactored for both pallet types)
const placePalletsInUnit = (
  unit: UnitState,
  palletDef: PalletType,
  quantityToPlace: number,
  pattern: "long" | "broad",
  isStackable: boolean,
  allowedStack: number,
  weightPerPallet: number,
  weightLimit: number,
  currentWeight: number,
  labelCounter: number,
  palletType: "euro" | "industrial"
): {
  placedVisual: number;
  basePlaced: number;
  areaPlaced: number;
  weightAdded: number;
  warnings: string[];
  newLabelCounter: number;
  newUnit: UnitState;
} => {
  let placedVisual = 0;
  let basePlaced = 0;
  let areaPlaced = 0;
  let weightAdded = 0;
  let stacked = 0;
  let localWarnings: string[] = [];
  let currentLabel = labelCounter;
  const newUnit = { ...unit, palletsVisual: [...unit.palletsVisual], occupiedRects: [...unit.occupiedRects] };
  let currentX = newUnit.currentX;
  let currentY = newUnit.currentY;

  const effectiveLength = unit.length;
  const palletsPerRow = pattern === "long" ? 3 : 2;
  const len = pattern === "long" ? palletDef.length : palletDef.width;
  const wid = pattern === "long" ? palletDef.width : palletDef.length;

  while (currentX < effectiveLength && quantityToPlace > 0) {
    currentY = 0;
    let rowCount = 0;
    let rowHeight = 0;

    for (let i = 0; i < palletsPerRow; i++) {
      if (quantityToPlace <= 0) break;
      if (weightPerPallet > 0 && currentWeight + weightAdded + weightPerPallet > weightLimit) {
        if (!localWarnings.some((w) => w.includes(`Gewichtslimit für ${palletType.toUpperCase()}`))) {
          localWarnings.push(`Gewichtslimit für ${palletType.toUpperCase()}-Paletten erreicht. Max ${weightLimit / 1000}t.`);
        }
        currentX = effectiveLength;
        break;
      }

      if (currentX + len <= effectiveLength && currentY + wid <= unit.width) {
        const baseLabelId = ++currentLabel;
        let stackedLabelId: number | null = null;
        const basePallet: PalletVisual = {
          x: currentX,
          y: currentY,
          width: len,
          height: wid,
          type: palletType,
          isStackedTier: null,
          key: `${palletType}_base_${unit.id}_${basePlaced}_${pattern}_${i}`,
          unitId: unit.id,
          labelId: baseLabelId,
          displayBaseLabelId: baseLabelId,
          displayStackedLabelId: null,
          showAsFraction: false,
          weight: weightPerPallet,
        };
        newUnit.palletsVisual.push(basePallet);
        newUnit.occupiedRects.push({ x: currentX, y: currentY, width: len, height: wid });
        areaPlaced += palletDef.area;
        basePlaced++;
        placedVisual++;
        weightAdded += weightPerPallet;
        quantityToPlace--;

        if (isStackable && quantityToPlace > 0 && stacked < allowedStack) {
          if (!(weightPerPallet > 0 && currentWeight + weightAdded + weightPerPallet > weightLimit)) {
            stackedLabelId = ++currentLabel;
            basePallet.showAsFraction = true;
            basePallet.displayStackedLabelId = stackedLabelId;
            basePallet.isStackedTier = "base";
            newUnit.palletsVisual.push({
              ...basePallet,
              isStackedTier: "top",
              key: `${palletType}_stack_${unit.id}_${basePlaced - 1}_${pattern}_${i}`,
              labelId: stackedLabelId,
              displayBaseLabelId: baseLabelId,
              displayStackedLabelId: stackedLabelId,
              showAsFraction: true,
              weight: weightPerPallet,
            });
            placedVisual++;
            weightAdded += weightPerPallet;
            quantityToPlace--;
            stacked++;
          } else if (!localWarnings.some((w) => w.includes(`Stapeln von ${palletType.toUpperCase()}`))) {
            localWarnings.push(`Gewichtslimit beim Stapeln von ${palletType.toUpperCase()}.`);
          }
        }
        currentY += wid;
        rowCount++;
        rowHeight = Math.max(rowHeight, len);
      } else break;
    }
    if (rowCount > 0) {
      currentX += rowHeight;
    } else {
      currentX = effectiveLength;
    }
  }

  newUnit.currentX = currentX;
  newUnit.currentY = currentY;
  if (palletType === "euro") {
    newUnit.eupEndX = currentX;
    newUnit.eupEndY = currentY;
  } else {
    newUnit.dinEndX = currentX;
    newUnit.dinEndY = currentY;
  }

  return { placedVisual, basePlaced, areaPlaced, weightAdded, warnings: localWarnings, newLabelCounter: currentLabel, newUnit };
};

// Helper for trying patterns for EUP
const tryPatternsForPallet = (
  units: UnitState[],
  palletQuantity: number,
  patternToTry: "auto" | "long" | "broad" | "none",
  isStackable: boolean,
  allowedStack: number,
  weightPerPallet: number,
  weightLimit: number,
  currentWeight: number,
  labelCounter: number,
  palletType: "euro" | "industrial"
): PlacementResult => {
  let bestResult: PlacementResult = {
    unitsConfiguration: JSON.parse(JSON.stringify(units)),
    totalVisual: 0,
    baseCount: 0,
    area: 0,
    warnings: [],
    weight: currentWeight,
    chosenPattern: "none",
    finalLabelCounter: labelCounter,
  };

  if (palletQuantity <= 0 || patternToTry === "none") return bestResult;

  const patterns = patternToTry === "auto" ? ["long", "broad"] : [patternToTry];
  let aPatternHasBeenSetAsBest = patternToTry !== "auto";

  for (const pattern of patterns) {
    let currentUnits = JSON.parse(JSON.stringify(units));
    let visual = 0, base = 0, area = 0;
    let tempWeight = currentWeight;
    let tempWarnings: string[] = [];
    let tempLabel = labelCounter;
    let remaining = palletQuantity;

    for (let j = 0; j < currentUnits.length; j++) {
      if (remaining <= 0) break;
      const result = placePalletsInUnit(
        currentUnits[j],
        PALLET_TYPES[palletType],
        remaining,
        pattern,
        isStackable,
        allowedStack,
        weightPerPallet,
        weightLimit,
        tempWeight,
        tempLabel,
        palletType
      );
      currentUnits[j] = result.newUnit;
      visual += result.placedVisual;
      base += result.basePlaced;
      area += result.areaPlaced;
      tempWeight += result.weightAdded;
      tempWarnings.push(...result.warnings);
      tempLabel = result.newLabelCounter;
      remaining -= result.placedVisual;
    }

    let updateBestResult = false;
    if (patternToTry === "auto") {
      if (
        !aPatternHasBeenSetAsBest ||
        visual > bestResult.totalVisual ||
        (visual === bestResult.totalVisual &&
          pattern === "broad" &&
          bestResult.chosenPattern === "long")
      ) {
        updateBestResult = true;
        aPatternHasBeenSetAsBest = true;
      }
    } else updateBestResult = true;

    if (updateBestResult) {
      bestResult = {
        unitsConfiguration: currentUnits,
        totalVisual: visual,
        baseCount: base,
        area,
        warnings: tempWarnings,
        weight: tempWeight,
        chosenPattern: pattern,
        finalLabelCounter: tempLabel,
      };
    }
  }

  return bestResult;
};

// New helper for axle load calculation (assuming 2 axles)
const calculateAxleLoads = (
  units: UnitState[],
  truck: TruckConfig,
  totalWeight: number
): AxleInfo => {
  if (!truck.wheelbase || truck.axlePositions.length < 2 || truck.maxAxleLoads.length < 2) {
    return { front: 0, rear: 0, warnings: ["Axle data not available for this truck."] };
  }

  let totalMoment = 0;
  let unitOffset = 0; // For multi-unit, accumulate lengths
  units.forEach((unit) => {
    unit.palletsVisual.forEach((pallet) => {
      const palletCenter = unitOffset + pallet.x + pallet.width / 2;
      totalMoment += pallet.weight * palletCenter;
    });
    unitOffset += unit.length;
  });

  const com = totalWeight > 0 ? totalMoment / totalWeight : 0;
  const frontLoad = totalWeight * (truck.wheelbase - com) / truck.wheelbase;
  const rearLoad = totalWeight - frontLoad;
  let warnings: string[] = [];
  if (frontLoad > truck.maxAxleLoads[0]) {
    warnings.push(`ACHTUNG – Frontachse Überlastung: ${frontLoad.toFixed(2)} kg > ${truck.maxAxleLoads[0]} kg`);
  }
  if (rearLoad > truck.maxAxleLoads[1]) {
    warnings.push(`ACHTUNG – Hinterachse Überlastung: ${rearLoad.toFixed(2)} kg > ${truck.maxAxleLoads[1]} kg`);
  }

  return { front: frontLoad, rear: rearLoad, warnings };
};

// Core calculation logic (refactored to use helpers)
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
  maxStackedEup?: number,
  maxStackedDin?: number
) => {
  const truckConfig: TruckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const weightLimit = truckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;
  let tempWarnings: string[] = [];
  let totalEuroVisual = 0;
  let totalDinVisual = 0;
  let actualEUPBase = 0;
  let actualDINBase = 0;
  let totalAreaBase = 0;
  let totalWeight = 0;
  let dinLabelCounter = 0;
  let eupLabelCounter = 0;

  const eupWeight = parseFloat(eupWeightStr) || 0;
  const dinWeight = parseFloat(dinWeightStr) || 0;
  const safeEupWeight = eupWeight > 0 ? eupWeight : 0;
  const safeDinWeight = dinWeight > 0 ? dinWeight : 0;

  const allowedEupStack = currentIsEUPStackable
    ? maxStackedEup && maxStackedEup > 0 ? Math.floor(maxStackedEup / 2) : Infinity
    : 0;
  const allowedDinStack = currentIsDINStackable
    ? maxStackedDin && maxStackedDin > 0 ? Math.floor(maxStackedDin / 2) : Infinity
    : 0;

  let unitsState: UnitState[] = truckConfig.units.map((u) => ({
    id: u.id,
    length: u.length,
    width: u.width,
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
  if (truckConfig.maxDinPallets !== undefined && dinQuantityToPlace > truckConfig.maxDinPallets) {
    if (requestedDinQuantity > truckConfig.maxDinPallets && requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY) {
      tempWarnings.push(`${truckConfig.name.trim()} maximale DIN-Kapazität ist ${truckConfig.maxDinPallets}. Angeforderte Menge ${requestedDinQuantity}, es werden ${truckConfig.maxDinPallets} platziert.`);
    }
    dinQuantityToPlace = truckConfig.maxDinPallets;
  }

  let eupQuantityToPlace = requestedEupQuantity;

  if (placementOrder === "EUP_FIRST") {
    const eupResult = tryPatternsForPallet(
      unitsState,
      eupQuantityToPlace,
      currentEupLoadingPattern,
      currentIsEUPStackable,
      allowedEupStack,
      safeEupWeight,
      weightLimit,
      totalWeight,
      eupLabelCounter,
      "euro"
    );
    unitsState = eupResult.unitsConfiguration;
    actualEUPBase = eupResult.baseCount;
    totalEuroVisual = eupResult.totalVisual;
    totalAreaBase += eupResult.area;
    totalWeight = eupResult.weight;
    tempWarnings.push(...eupResult.warnings);
    eupLabelCounter = eupResult.finalLabelCounter;

    // Now place DIN
    const dinResult = tryPatternsForPallet(
      unitsState,
      dinQuantityToPlace,
      "long", // Assume "long" for DIN; adjust if needed
      currentIsDINStackable,
      allowedDinStack,
      safeDinWeight,
      weightLimit,
      totalWeight,
      dinLabelCounter,
      "industrial"
    );
    unitsState = dinResult.unitsConfiguration;
    actualDINBase = dinResult.baseCount;
    totalDinVisual = dinResult.totalVisual;
    totalAreaBase += dinResult.area;
    totalWeight = dinResult.weight;
    tempWarnings.push(...dinResult.warnings);
    dinLabelCounter = dinResult.finalLabelCounter;
  } else { // DIN_FIRST
    const dinResult = tryPatternsForPallet(
      unitsState,
      dinQuantityToPlace,
      "long", // Assume "long" for DIN
      currentIsDINStackable,
      allowedDinStack,
      safeDinWeight,
      weightLimit,
      totalWeight,
      dinLabelCounter,
      "industrial"
    );
    unitsState = dinResult.unitsConfiguration;
    actualDINBase = dinResult.baseCount;
    totalDinVisual = dinResult.totalVisual;
    totalAreaBase += dinResult.area;
    totalWeight = dinResult.weight;
    tempWarnings.push(...dinResult.warnings);
    dinLabelCounter = dinResult.finalLabelCounter;

    const eupResult = tryPatternsForPallet(
      unitsState,
      eupQuantityToPlace,
      currentEupLoadingPattern,
      currentIsEUPStackable,
      allowedEupStack,
      safeEupWeight,
      weightLimit,
      totalWeight,
      eupLabelCounter,
      "euro"
    );
    unitsState = eupResult.unitsConfiguration;
    actualEUPBase = eupResult.baseCount;
    totalEuroVisual = eupResult.totalVisual;
    totalAreaBase += eupResult.area;
    totalWeight = eupResult.weight;
    tempWarnings.push(...eupResult.warnings);
    eupLabelCounter = eupResult.finalLabelCounter;
  }

  // Weight per meter approximation
  const kgPerM = truckConfig.usableLength > 0 ? totalWeight / (truckConfig.usableLength / 100) : 0;
  if (kgPerM > MAX_WEIGHT_PER_METER_KG) {
    tempWarnings.push(`ACHTUNG – mögliche Achslastüberschreitung: ${kgPerM.toFixed(2)} kg/m`);
  }

  // Advanced axle load calculation
  const axleInfo = calculateAxleLoads(unitsState, truckConfig, totalWeight);
  tempWarnings.push(...axleInfo.warnings);

  return {
    unitsState,
    totalEuroPalletsVisual: totalEuroVisual,
    totalDinPalletsVisual: totalDinVisual,
    loadedEuroPalletsBase: actualEUPBase,
    loadedIndustrialPalletsBase: actualDINBase,
    utilizationArea: totalAreaBase,
    totalWeightKg: totalWeight,
    warnings: tempWarnings,
    actualEupLoadingPattern: (placementOrder === "EUP_FIRST" || currentEupLoadingPattern !== "auto") ? currentEupLoadingPattern : "none", // Adjust as needed
    // Add axleInfo if you want to display it
    axleInfo,
  };
};

// Render pallet function (assumed from context)
const renderPallet = (p: PalletVisual, scale: number) => {
  const palletDef = PALLET_TYPES[p.type];
  return (
    <div
      key={p.key}
      className={`absolute ${palletDef.color} ${palletDef.borderColor} border-2 text-white text-xs flex items-center justify-center font-bold`}
      style={{
        left: `${p.y * scale}px`, // Note: y as left for horizontal flip if needed
        top: `${p.x * scale}px`,
        width: `${p.height * scale}px`,
        height: `${p.width * scale}px`,
      }}
    >
      {p.showAsFraction ? `${p.displayBaseLabelId}/${p.displayStackedLabelId}` : p.labelId}
    </div>
  );
};

export default function TruckCalculatorPage() {
  const { toast } = useToast();

  // State definitions
  const [selectedTruck, setSelectedTruck] = useState<string>("curtainSider");
  const [eupQuantity, setEupQuantity] = useState<number>(0);
  const [dinQuantity, setDinQuantity] = useState<number>(0);
  const [eupWeightPerPallet, setEupWeightPerPallet] = useState<string>("");
  const [dinWeightPerPallet, setDinWeightPerPallet] = useState<string>("");
  const [isEUPStackable, setIsEUPStackable] = useState<boolean>(false);
  const [isDINStackable, setIsDINStackable] = useState<boolean>(false);
  const [eupStackLimit, setEupStackLimit] = useState<number>(0);
  const [dinStackLimit, setDinStackLimit] = useState<number>(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState<"auto" | "long" | "broad" | "none">("auto");
  const [placementOrder, setPlacementOrder] = useState<"DIN_FIRST" | "EUP_FIRST">("DIN_FIRST");
  const [palletArrangement, setPalletArrangement] = useState<any[]>([]);
  const [totalEuroPalletsVisual, setTotalEuroPalletsVisual] = useState<number>(0);
  const [totalDinPalletsVisual, setTotalDinPalletsVisual] = useState<number>(0);
  const [loadedEuroPalletsBase, setLoadedEuroPalletsBase] = useState<number>(0);
  const [loadedIndustrialPalletsBase, setLoadedIndustrialPalletsBase] = useState<number>(0);
  const [utilizationPercentage, setUtilizationPercentage] = useState<number>(0);
  const [totalWeightKg, setTotalWeightKg] = useState<number>(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [actualEupLoadingPattern, setActualEupLoadingPattern] = useState<"auto" | "long" | "broad" | "none">("auto");
  const [axleFront, setAxleFront] = useState<number>(0);
  const [axleRear, setAxleRear] = useState<number>(0);
  const [truckVisualizationScale] = useState<number>(0.5); // Adjust as needed

  // Meldungen style (assumed)
  const meldungenStyle = {
    bg: "bg-red-50",
    border: "border-red-200",
    header: "text-red-800",
    list: "text-red-700",
  };

  const recalculate = useCallback(() => {
    const result = calculateLoadingLogic(
      selectedTruck,
      eupQuantity,
      dinQuantity,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      placementOrder,
      eupStackLimit * 2, // Since stackable is 2-fach
      dinStackLimit * 2
    );
    setPalletArrangement(result.unitsState.map((u) => ({
      unitId: u.id,
      unitLength: u.length,
      unitWidth: u.width,
      pallets: u.palletsVisual,
    })));
    setTotalEuroPalletsVisual(result.totalEuroPalletsVisual);
    setTotalDinPalletsVisual(result.totalDinPalletsVisual);
    setLoadedEuroPalletsBase(result.loadedEuroPalletsBase);
    setLoadedIndustrialPalletsBase(result.loadedIndustrialPalletsBase);
    const totalTruckArea = TRUCK_TYPES[selectedTruck].units.reduce((acc, u) => acc + u.length * u.width, 0);
    setUtilizationPercentage(totalTruckArea > 0 ? Math.round((result.utilizationArea / totalTruckArea) * 100) : 0);
    setTotalWeightKg(result.totalWeightKg);
    setWarnings(result.warnings);
    setActualEupLoadingPattern(result.actualEupLoadingPattern);
    setAxleFront(result.axleInfo.front);
    setAxleRear(result.axleInfo.rear);
  }, [selectedTruck, eupQuantity, dinQuantity, isEUPStackable, isDINStackable, eupWeightPerPallet, dinWeightPerPallet, eupLoadingPattern, placementOrder, eupStackLimit, dinStackLimit]);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  const handleQuantityChange = (type: "eup" | "din", delta: number) => {
    if (type === "eup") {
      setEupQuantity(Math.max(0, eupQuantity + delta));
    } else {
      setDinQuantity(Math.max(0, dinQuantity + delta));
    }
  };

  const handleMaximizePallets = (type: "euro" | "industrial") => {
    const truck = TRUCK_TYPES[selectedTruck];
    if (type === "euro") {
      const max = truck.singleLayerEUPCapacityLong || truck.singleLayerEUPCapacityLongPerUnit * truck.units.length || 0;
      setEupQuantity(max);
    } else {
      const max = truck.singleLayerDINCapacity || truck.singleLayerDINCapacityPerUnit * truck.units.length || 0;
      setDinQuantity(max);
    }
  };

  const handleFillRemainingWithEUP = () => {
    toast({ title: "Funktion nicht implementiert", description: "Rest mit EUP füllen ist noch nicht verfügbar." });
  };

  const handleFillRemainingWithDIN = () => {
    toast({ title: "Funktion nicht implementiert", description: "Rest mit DIN füllen ist noch nicht verfügbar." });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="bg-indigo-600 text-white py-4 px-6">
        <h1 className="text-2xl font-bold">Laderaumrechner</h1>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Column */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">Lade-Typ:</label>
            <select
              value={selectedTruck}
              onChange={(e) => setSelectedTruck(e.target.value)}
              className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {Object.keys(TRUCK_TYPES).map((key) => (
                <option key={key} value={key}>
                  {TRUCK_TYPES[key].name}
                </option>
              ))}
            </select>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Platziere zuerst:</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="DIN_FIRST"
                    checked={placementOrder === "DIN_FIRST"}
                    onChange={(e) => setPlacementOrder(e.target.value as "DIN_FIRST" | "EUP_FIRST")}
                    className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">DIN zuerst</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="EUP_FIRST"
                    checked={placementOrder === "EUP_FIRST"}
                    onChange={(e) => setPlacementOrder(e.target.value as "DIN_FIRST" | "EUP_FIRST")}
                    className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">EUP zuerst</span>
                </label>
              </div>
            </div>

            {/* DIN Section */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industriepaletten (DIN)
              </label>
              <div className="flex items-center mt-1">
                <button
                  onClick={() => handleQuantityChange("din", -1)}
                  className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={dinQuantity}
                  onChange={(e) => setDinQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={() => handleQuantityChange("din", 1)}
                  className="px-3 py-1 bg-green-500 text-white rounded-r-md hover:bg-green-600"
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
                className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50"
              >
                Rest mit max. DIN füllen
              </button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/DIN (kg):</label>
                <input
                  type="number"
                  min="0"
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
                <input
                  type="number"
                  min="0"
                  value={dinStackLimit}
                  onChange={(e) => setDinStackLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                  placeholder="Stapelbare Paletten (0 = alle)"
                />
              )}
            </div>

            {/* EUP Section */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Europaletten (EUP)
              </label>
              <div className="flex items-center mt-1">
                <button
                  onClick={() => handleQuantityChange("eup", -1)}
                  className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
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
                className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50"
              >
                Rest mit max. EUP füllen
              </button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/EUP (kg):</label>
                <input
                  type="number"
                  min="0"
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
                <input
                  type="number"
                  min="0"
                  value={eupStackLimit}
                  onChange={(e) => setEupStackLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                  placeholder="Stapelbare Paletten (0 = alle)"
                />
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
                      onChange={(e) => setEupLoadingPattern(e.target.value as "auto" | "long" | "broad" | "none")}
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
                      onChange={(e) => setEupLoadingPattern(e.target.value as "auto" | "long" | "broad" | "none")}
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
                      onChange={(e) => setEupLoadingPattern(e.target.value as "auto" | "long" | "broad" | "none")}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Quer (2 nebeneinander)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Visualization Column */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Ladefläche Visualisierung</p>
            {palletArrangement.map((unit, index) => (
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
                  {unit.pallets.map((p: PalletVisual) => renderPallet(p, truckVisualizationScale))}
                </div>
              </div>
            ))}
            {palletArrangement.length === 0 && (
              <p className="text-gray-500">Keine Paletten zum Anzeigen.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
            <h3 className="font-semibold text-blue-800 mb-2">Geladene Paletten (Visuell)</h3>
            <p>
              Industrie (DIN): <span className="font-bold text-lg">{totalDinPalletsVisual}</span>
            </p>
            <p>
              Euro (EUP): <span className="font-bold text-lg">{totalEuroPalletsVisual}</span>
            </p>
            <p className="text-xs mt-1">
              (Basis: {loadedIndustrialPalletsBase} DIN, {loadedEuroPalletsBase} EUP)
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
            <h3 className="font-semibold text-green-800 mb-2">Flächenausnutzung</h3>
            <p className="font-bold text-3xl text-green-700">{utilizationPercentage}%</p>
            <p className="text-xs mt-1">(Grundfläche)</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="font-semibold text-yellow-800 mb-2">Geschätztes Gewicht</h3>
            <p className="font-bold text-2xl text-yellow-700">{(totalWeightKg / 1000).toFixed(1)} t</p>
            <p className="text-xs mt-1">
              (Max: {(TRUCK_TYPES[selectedTruck].maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG) / 1000}t)
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 shadow-sm text-center">
            <h3 className="font-semibold text-purple-800 mb-2">Achslasten (geschätzt)</h3>
            <p>
              Front: <span className="font-bold">{axleFront.toFixed(1)} kg</span>
            </p>
            <p>
              Rear: <span className="font-bold">{axleRear.toFixed(1)} kg</span>
            </p>
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
        <p>by Andreas Steiner </p>
      </footer>

      <Toaster />
    </div>
  );
}
