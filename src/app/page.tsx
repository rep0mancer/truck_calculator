"use client";

import React, { useState, useEffect, useCallback } from "react";

// Constants for truck types, including single-layer capacities
const TRUCK_TYPES: any = {
  roadTrain: {
    name: "Hängerzug (2x 7,2m)",
    units: [
      { id: "unit1", length: 720, width: 245 },
      { id: "unit2", length: 720, width: 245 },
    ],
    totalLength: 1440,
    usableLength: 1440,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  curtainSider: {
    name: "Planensattel Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 245 }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  frigo: {
    name: "Frigo (Kühler) Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 245 }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 18300,
  },
  smallTruck: {
    name: "Motorwagen (7.2m)",
    units: [{ id: "main", length: 720, width: 245 }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 10000,
  },
  Waggon: {
    name: "Waggon Hbbils (15,2m)",
    units: [{ id: "main", length: 1520, width: 290 }],
    totalLength: 1520,
    usableLength: 1520,
    maxWidth: 290,
    maxDinPallets: 26,
    maxGrossWeightKg: 24000,
  },
  Waggon2: {
    name: "Waggon KRM",
    units: [{ id: "main", length: 1600, width: 290 }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
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

// #region Core Calculation Logic (Refactored)
// This entire section has been rewritten to support the new loading order
// and to remove duplicated code.

/**
 * Main calculation function. Orchestrates the pallet placement in a specific order.
 * Order: Stacked DIN -> Stacked EUP -> Single DIN -> Single EUP
 */
const calculateLoadingLogic = (
  truckKey: string,
  requestedEupQuantity: number,
  requestedDinQuantity: number,
  isEUPStackable: boolean,
  isDINStackable: boolean,
  eupWeightStr: string,
  dinWeightStr: string,
  eupLoadingPattern: "auto" | "long" | "broad" | "none",
  eupStackLimitStr: string,
  dinStackLimitStr: string
) => {
  const truckConfig = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const weightLimit = truckConfig.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;

  // --- Initialize state for the entire calculation process ---
  let tempWarnings: string[] = [];
  let totalWeight = 0;
  let totalArea = 0;
  let labelCounters = { din: 0, eup: 0 };
  let placedPallets = {
    din: { base: 0, visual: 0 },
    eup: { base: 0, visual: 0 },
  };

  let unitsState = truckConfig.units.map((u: any) => ({
    ...u,
    palletsVisual: [],
    currentX: 0,
    occupiedRects: [],
  }));

  // --- Parse inputs ---
  const eupWeight = parseFloat(eupWeightStr) || 0;
  const dinWeight = parseFloat(dinWeightStr) || 0;
  const eupStackLimit = isEUPStackable ? (parseInt(eupStackLimitStr, 10) || requestedEupQuantity) : 0;
  const dinStackLimit = isDINStackable ? (parseInt(dinStackLimitStr, 10) || requestedDinQuantity) : 0;

  let dinToPlace = Math.min(
    requestedDinQuantity,
    truckConfig.maxDinPallets ?? Infinity
  );
  if (requestedDinQuantity > dinToPlace && requestedDinQuantity !== MAX_PALLET_SIMULATION_QUANTITY) {
    tempWarnings.push(
      `${truckConfig.name.trim()} maximale DIN-Kapazität ist ${truckConfig.maxDinPallets}. ` +
      `Angeforderte Menge ${requestedDinQuantity}, es werden ${dinToPlace} platziert.`
    );
  }

  // --- Define loading phases based on the required order ---
  const dinToStack = Math.min(dinToPlace, dinStackLimit);
  const dinSingle = dinToPlace - dinToStack;
  const eupToStack = Math.min(requestedEupQuantity, eupStackLimit);
  const eupSingle = requestedEupQuantity - eupToStack;

  const loadingPhases = [
    { type: "industrial", quantity: dinToStack, isStacked: true, weight: dinWeight },
    { type: "euro", quantity: eupToStack, isStacked: true, weight: eupWeight, pattern: eupLoadingPattern },
    { type: "industrial", quantity: dinSingle, isStacked: false, weight: dinWeight },
    { type: "euro", quantity: eupSingle, isStacked: false, weight: eupWeight, pattern: eupLoadingPattern },
  ];
  
  let determinedEupPattern: "auto" | "long" | "broad" | "none" = "none";

  // --- Execute loading phases sequentially ---
  for (const phase of loadingPhases) {
    if (phase.quantity <= 0) continue;

    const result = placePalletGroup(
      unitsState,
      phase.type,
      phase.quantity,
      phase.isStacked,
      phase.weight,
      (phase as any).pattern,
      weightLimit,
      totalWeight,
      labelCounters
    );

    // Update global state with results from the phase
    unitsState = result.unitsState;
    totalWeight = result.currentWeight;
    totalArea += result.areaPlaced;
    labelCounters = result.labelCounters;
    placedPallets[phase.type].base += result.palletsPlaced.base;
    placedPallets[phase.type].visual += result.palletsPlaced.visual;
    tempWarnings.push(...result.warnings);
    if(phase.type === 'euro' && result.chosenPattern) {
        determinedEupPattern = result.chosenPattern;
    }
  }

  // --- Final Calculations and Warnings ---
  const finalPalletArrangement = unitsState.map((u: any) => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: u.palletsVisual,
  }));

  const totalPracticalArea = truckConfig.usableLength * truckConfig.maxWidth;
  const util = totalPracticalArea > 0 ? (totalArea / totalPracticalArea) * 100 : 0;
  const utilizationPercentage = parseFloat(util.toFixed(1));

  const usedLength = truckConfig.maxWidth > 0 ? totalArea / truckConfig.maxWidth : 0;
  const usedLengthPercentage = truckConfig.usableLength > 0 ? (usedLength / truckConfig.usableLength) * 100 : 0;
  const weightPerMeter = usedLength > 0 ? totalWeight / (usedLength / 100) : 0;

  if (weightPerMeter >= MAX_WEIGHT_PER_METER_KG) {
    tempWarnings.push(`ACHTUNG – mögliche Achslastüberschreitung: ${weightPerMeter.toFixed(1)} kg/m`);
  }
  if (totalWeight >= 10500 && usedLengthPercentage <= 40) {
    tempWarnings.push("ACHTUNG – mehr als 11t auf weniger als 40% der Ladefläche");
  }

  const stackedEupPallets = placedPallets.eup.visual - placedPallets.eup.base;
  if (stackedEupPallets >= STACKED_EUP_THRESHOLD_FOR_AXLE_WARNING) {
    tempWarnings.push(`ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${stackedEupPallets} gestapelte EUP)`);
  }
  const stackedDinPallets = placedPallets.din.visual - placedPallets.din.base;
  if (stackedDinPallets >= STACKED_DIN_THRESHOLD_FOR_AXLE_WARNING) {
    tempWarnings.push(`ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${stackedDinPallets} gestapelte DIN)`);
  }

  const totalPlacedDin = placedPallets.din.visual;
  if (totalPlacedDin < dinToPlace && !tempWarnings.some(w => w.includes("Gewichtslimit") || w.includes("Kapazität"))) {
      tempWarnings.push(`Konnte nicht alle ${dinToPlace} DIN-Paletten laden. Nur ${totalPlacedDin} platziert.`);
  }
  const totalPlacedEup = placedPallets.eup.visual;
  if (totalPlacedEup < requestedEupQuantity && !tempWarnings.some(w => w.includes("Gewichtslimit"))) {
      tempWarnings.push(`Konnte nicht alle ${requestedEupQuantity} EUP-Paletten laden. Nur ${totalPlacedEup} platziert.`);
  }

  return {
    palletArrangement: finalPalletArrangement,
    loadedIndustrialPalletsBase: placedPallets.din.base,
    loadedEuroPalletsBase: placedPallets.eup.base,
    totalDinPalletsVisual: placedPallets.din.visual,
    totalEuroPalletsVisual: placedPallets.eup.visual,
    utilizationPercentage: utilizationPercentage,
    warnings: Array.from(new Set(tempWarnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: eupLoadingPattern === 'auto' && determinedEupPattern !== 'none' ? determinedEupPattern : eupLoadingPattern,
  };
};

/**
 * Generic helper to place a group of pallets.
 * It handles different pallet types and loading patterns.
 */
const placePalletGroup = (
    initialUnitsState: any[],
    palletType: 'euro' | 'industrial',
    quantity: number,
    isStacked: boolean,
    weightPerPallet: number,
    eupPattern: 'auto' | 'long' | 'broad' | 'none',
    weightLimit: number,
    currentWeight: number,
    initialLabelCounters: { din: number, eup: number }
) => {
    if (palletType === 'euro' && eupPattern === 'auto') {
        // If auto, try both patterns and pick the one that places more pallets
        const longResult = placePallets(JSON.parse(JSON.stringify(initialUnitsState)), palletType, quantity, isStacked, weightPerPallet, 'long', weightLimit, currentWeight, JSON.parse(JSON.stringify(initialLabelCounters)));
        const broadResult = placePallets(JSON.parse(JSON.stringify(initialUnitsState)), palletType, quantity, isStacked, weightPerPallet, 'broad', weightLimit, currentWeight, JSON.parse(JSON.stringify(initialLabelCounters)));

        if (longResult.palletsPlaced.visual > broadResult.palletsPlaced.visual) {
            return { ...longResult, chosenPattern: 'long' };
        }
        // Prefer broad if quantities are equal as it's often more stable
        return { ...broadResult, chosenPattern: 'broad' };
    } else {
        // For DIN or a fixed EUP pattern, just run the placement once
        const pattern = palletType === 'industrial' ? 'broad' : eupPattern; // DIN is always loaded 'broad' (2 side-by-side)
        const result = placePallets(JSON.parse(JSON.stringify(initialUnitsState)), palletType, quantity, isStacked, weightPerPallet, pattern, weightLimit, currentWeight, JSON.parse(JSON.stringify(initialLabelCounters)));
        return {...result, chosenPattern: pattern};
    }
};

/**
 * The core placement algorithm for a single pallet type and pattern.
 */
const placePallets = (
    unitsState: any[],
    palletType: 'euro' | 'industrial',
    quantity: number,
    isStacked: boolean,
    weightPerPallet: number,
    pattern: 'long' | 'broad' | 'none',
    weightLimit: number,
    currentWeight: number,
    labelCounters: { din: number, eup: number }
) => {
    let palletsToPlace = quantity;
    const palletDef = PALLET_TYPES[palletType];
    const warnings: string[] = [];
    let areaPlaced = 0;
    let palletsPlaced = { base: 0, visual: 0 };

    const isEuro = palletType === 'euro';
    const palLen = isEuro && pattern === 'long' ? palletDef.length : palletDef.width;
    const palWid = isEuro && pattern === 'long' ? palletDef.width : palletDef.length;
    const palletsPerRow = isEuro ? (pattern === 'long' ? 3 : 2) : 2;

    for (const unit of unitsState) {
        if (palletsToPlace <= 0) break;
        
        while (unit.currentX < unit.length) {
            if (palletsToPlace <= 0) break;
            
            let rowPalletsPlaced = 0;
            let rowHeight = 0;
            unit.currentY = 0;

            for (let i = 0; i < palletsPerRow; i++) {
                if (palletsToPlace <= 0) break;

                // Check if pallet fits geometrically
                if (unit.currentX + palLen > unit.length || unit.currentY + palWid > unit.width) {
                    continue; // Try next position in the row
                }
                
                // Check weight for the base pallet
                if (weightPerPallet > 0 && currentWeight + weightPerPallet > weightLimit) {
                    if (!warnings.some(w => w.includes(`Gewichtslimit für ${palletDef.name}`))) {
                        warnings.push(`Gewichtslimit für ${palletDef.name} erreicht.`);
                    }
                    palletsToPlace = 0; // Stop placing this type
                    break;
                }

                const labelKey = palletType === 'euro' ? 'eup' : 'din';
                const baseLabelId = ++labelCounters[labelKey];
                
                const basePallet = {
                    x: unit.currentX,
                    y: unit.currentY,
                    width: palLen,
                    height: palWid,
                    type: palletType,
                    isStackedTier: null,
                    key: `${palletType}_base_${unit.id}_${palletsPlaced.base}_${i}`,
                    unitId: unit.id,
                    labelId: baseLabelId,
                    displayBaseLabelId: baseLabelId,
                    displayStackedLabelId: null,
                    showAsFraction: false,
                };

                unit.palletsVisual.push(basePallet);
                unit.occupiedRects.push({ x: unit.currentX, y: unit.currentY, width: palLen, height: palWid });
                
                currentWeight += weightPerPallet;
                areaPlaced += palletDef.area;
                palletsPlaced.base++;
                palletsPlaced.visual++;
                palletsToPlace--;
                rowPalletsPlaced++;
                rowHeight = Math.max(rowHeight, palLen);

                if (isStacked && palletsToPlace > 0) {
                     if (weightPerPallet > 0 && currentWeight + weightPerPallet > weightLimit) {
                        if (!warnings.some(w => w.includes(`Gewichtslimit beim Stapeln`))) {
                            warnings.push(`Gewichtslimit beim Stapeln von ${palletDef.name} erreicht.`);
                        }
                        // Don't break, just stop stacking this one
                     } else {
                        const stackedLabelId = ++labelCounters[labelKey];
                        basePallet.showAsFraction = true;
                        basePallet.displayStackedLabelId = stackedLabelId;
                        basePallet.isStackedTier = "base";
                        
                        unit.palletsVisual.push({
                            ...basePallet,
                            isStackedTier: "top",
                            key: `${palletType}_stack_${unit.id}_${palletsPlaced.base - 1}_${i}`,
                            labelId: stackedLabelId,
                        });
                        
                        currentWeight += weightPerPallet;
                        palletsPlaced.visual++;
                        palletsToPlace--;
                     }
                }
                
                unit.currentY += palWid;
            }

            if (rowPalletsPlaced > 0) {
                unit.currentX += rowHeight;
            } else {
                // Cannot fit any more pallets in this unit
                unit.currentX = unit.length;
            }
        }
    }
    
    return { unitsState, currentWeight, areaPlaced, labelCounters, palletsPlaced, warnings };
};

// #endregion

export default function HomePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState("curtainSider");
  const [eupQuantity, setEupQuantity] = useState(0);
  const [dinQuantity, setDinQuantity] = useState(0);
  const [eupLoadingPattern, setEupLoadingPattern] = useState<"auto" | "long" | "broad" | "none">("auto");
  const [isEUPStackable, setIsEUPStackable] = useState(false);
  const [isDINStackable, setIsDINStackable] = useState(false);

  // FIX: Store limits as strings to prevent input fields from resetting to 0 on clear
  const [eupStackLimit, setEupStackLimit] = useState("");
  const [dinStackLimit, setDinStackLimit] = useState("");

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

  const calculateAndSetState = useCallback(
    (currentEup = eupQuantity, currentDin = dinQuantity) => {
      // Primary calculation based on current inputs
      const primaryResults = calculateLoadingLogic(
        selectedTruck,
        currentEup,
        currentDin,
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        eupLoadingPattern,
        eupStackLimit,
        dinStackLimit
      );

      // --- Remaining capacity checks ---
      // To check remaining EUP space, we try to fill the truck with EUPs after the current DINs are placed.
      const eupCapacityCheckResults = calculateLoadingLogic(
        selectedTruck,
        MAX_PALLET_SIMULATION_QUANTITY, // Try to fill with EUPs
        primaryResults.totalDinPalletsVisual, // But keep the already placed DINs
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        "auto", // Always use auto to find max capacity
        eupStackLimit,
        dinStackLimit
      );
      const additionalEupPossible = Math.max(0, eupCapacityCheckResults.totalEuroPalletsVisual - primaryResults.totalEuroPalletsVisual);

      // To check remaining DIN space, we try to fill with DINs after current EUPs are placed.
      const dinCapacityCheckResults = calculateLoadingLogic(
        selectedTruck,
        primaryResults.totalEuroPalletsVisual, // Keep already placed EUPs
        MAX_PALLET_SIMULATION_QUANTITY, // Try to fill with DINs
        isEUPStackable,
        isDINStackable,
        eupWeightPerPallet,
        dinWeightPerPallet,
        primaryResults.eupLoadingPatternUsed, // Use the same pattern for consistency
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

      // ... (rest of the warning logic is largely unchanged)

      setPalletArrangement(primaryResults.palletArrangement);
      setLoadedIndustrialPalletsBase(primaryResults.loadedIndustrialPalletsBase);
      setLoadedEuroPalletsBase(primaryResults.loadedEuroPalletsBase);
      setTotalDinPalletsVisual(primaryResults.totalDinPalletsVisual);
      setTotalEuroPalletsVisual(primaryResults.totalEuroPalletsVisual);
      setUtilizationPercentage(primaryResults.utilizationPercentage);
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
  
  // This effect runs once on component mount to signal that the client has loaded.
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // This effect performs the calculation, but only after the component has mounted.
  useEffect(() => {
    if (isMounted) {
      calculateAndSetState();
    }
  }, [isMounted, calculateAndSetState]);

  const handleQuantityChange = (type: "eup" | "din", amount: number) => {
    if (type === "eup")
      setEupQuantity((prev) => Math.max(0, (prev || 0) + amount));
    else if (type === "din")
      setDinQuantity((prev) => Math.max(0, (prev || 0) + amount));
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
    const simResults = calculateLoadingLogic(
      selectedTruck,
      palletTypeToMax === 'euro' ? MAX_PALLET_SIMULATION_QUANTITY : 0,
      palletTypeToMax === 'industrial' ? MAX_PALLET_SIMULATION_QUANTITY : 0,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      eupLoadingPattern,
      eupStackLimit,
      dinStackLimit
    );

    setDinQuantity(simResults.totalDinPalletsVisual);
    setEupQuantity(simResults.totalEuroPalletsVisual);

    if (eupLoadingPattern === "auto" && simResults.eupLoadingPatternUsed !== "auto" && simResults.eupLoadingPatternUsed !== "none") {
      setEupLoadingPattern(simResults.eupLoadingPatternUsed);
    }
  };

  const handleFillRemaining = (palletTypeToFill: "industrial" | "euro") => {
     const simResults = calculateLoadingLogic(
      selectedTruck,
      palletTypeToFill === 'euro' ? MAX_PALLET_SIMULATION_QUANTITY : eupQuantity,
      palletTypeToFill === 'industrial' ? MAX_PALLET_SIMULATION_QUANTITY : dinQuantity,
      isEUPStackable,
      isDINStackable,
      eupWeightPerPallet,
      dinWeightPerPallet,
      "auto", // Use auto to find the best fit for the remaining space
      eupStackLimit,
      dinStackLimit
    );
    setDinQuantity(simResults.totalDinPalletsVisual);
    setEupQuantity(simResults.totalEuroPalletsVisual);
  }

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
          width: `${w}px`,
          height: `${h}px`,
          opacity: pallet.isStackedTier === "top" ? 0.7 : 1,
          zIndex: pallet.isStackedTier === "top" ? 10 : 5,
          fontSize: "10px",
        }}
      >
        <span className="text-white font-semibold select-none">{txt}</span>
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
      // Initial state
  } else if (warningsWithoutInfo.length === 0) {
    meldungenStyle = { bg: "bg-green-50", border: "border-green-200", header: "text-green-800", list: "text-green-700" };
  } else if (warningsWithoutInfo.every((w) => w.toLowerCase().includes("achslast"))) {
    meldungenStyle = { bg: "bg-yellow-50", border: "border-yellow-200", header: "text-yellow-800", list: "text-yellow-700" };
  } else {
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
          {/* Input Column */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label htmlFor="truckType" className="block text-sm font-medium text-gray-700 mb-1">LKW-Typ:</label>
              <select id="truckType" value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                {Object.keys(TRUCK_TYPES).map((key) => (<option key={key} value={key}>{TRUCK_TYPES[key].name}</option>))}
              </select>
            </div>

            <div className="pt-4">
              <button onClick={handleClearAllPallets} className="w-full py-2 px-4 bg-[#00906c] text-white font-semibold rounded-md shadow-sm hover:bg-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50 transition duration-150 ease-in-out">
                Alles zurücksetzen
              </button>
            </div>

            {/* DIN Section */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industriepaletten (DIN)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange("din", -1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input type="number" min="0" value={dinQuantity} onChange={(e) => setDinQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange("din", 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => handleMaximizePallets("industrial")} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50">Max. DIN</button>
              <button onClick={() => handleFillRemaining("industrial")} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50">Rest mit max. DIN füllen</button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/DIN (kg):</label>
                <input type="number" min="0" value={dinWeightPerPallet} onChange={(e) => setDinWeightPerPallet(e.target.value)} placeholder="z.B. 500" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="dinStackable" checked={isDINStackable} onChange={(e) => setIsDINStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="dinStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {isDINStackable && (<input type="number" min="0" value={dinStackLimit} onChange={(e) => setDinStackLimit(e.target.value)} className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" placeholder="Anzahl stapelbarer Paletten (0 = alle)" />)}
            </div>

            {/* EUP Section */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Europaletten (EUP)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQuantityChange("eup", -1)} className="px-3 py-1 bg-red-500 text-white rounded-l-md hover:bg-red-600">-</button>
                <input type="number" min="0" value={eupQuantity} onChange={(e) => setEupQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                <button onClick={() => handleQuantityChange("eup", 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => handleMaximizePallets("euro")} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e] focus:outline-none focus:ring-2 focus:ring-[#00906c] focus:ring-opacity-50">Max. EUP</button>
              <button onClick={() => handleFillRemaining("euro")} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49] focus:outline-none focus:ring-2 focus:ring-[#008c6b] focus:ring-opacity-50">Rest mit max. EUP füllen</button>
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/EUP (kg):</label>
                <input type="number" min="0" value={eupWeightPerPallet} onChange={(e) => setEupWeightPerPallet(e.target.value)} placeholder="z.B. 400" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" />
              </div>
              <div className="flex items-center mt-2">
                <input type="checkbox" id="eupStackable" checked={isEUPStackable} onChange={(e) => setIsEUPStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                <label htmlFor="eupStackable" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {isEUPStackable && (<input type="number" min="0" value={eupStackLimit} onChange={(e) => setEupStackLimit(e.target.value)} className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs" placeholder="Anzahl stapelbarer Paletten (0 = alle)" />)}
            </div>

            {(eupQuantity > 0 || totalEuroPalletsVisual > 0 || actualEupLoadingPattern !== "auto" || eupLoadingPattern !== "auto") && (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">EUP Lade-Pattern: <span className="text-xs text-gray-500"> (Ermittelt: {actualEupLoadingPattern})</span></label>
                <div className="flex flex-col space-y-1">
                  <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="auto" checked={eupLoadingPattern === "auto"} onChange={(e) => setEupLoadingPattern(e.target.value as any)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" /><span className="ml-2 text-sm text-gray-700">Auto-Optimieren</span></label>
                  <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="long" checked={eupLoadingPattern === "long"} onChange={(e) => setEupLoadingPattern(e.target.value as any)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" /><span className="ml-2 text-sm text-gray-700">Längs (3 nebeneinander)</span></label>
                  <label className="flex items-center"><input type="radio" name="eupLoadingPattern" value="broad" checked={eupLoadingPattern === "broad"} onChange={(e) => setEupLoadingPattern(e.target.value as any)} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" /><span className="ml-2 text-sm text-gray-700">Quer (2 nebeneinander)</span></label>
                </div>
              </div>
            )}
          </div>

          {/* Visualization Column */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Ladefläche Visualisierung</p>
            {palletArrangement.map((unit: any, index: number) => (
              <div key={unit.unitId} className="mb-4 w-full flex flex-col items-center">
                {TRUCK_TYPES[selectedTruck].units.length > 1 && (<p className="text-sm text-gray-700 mb-1">Einheit {index + 1} ({unit.unitLength / 100}m x {unit.unitWidth / 100}m)</p>)}
                <div className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner" style={{ width: `${unit.unitWidth * truckVisualizationScale}px`, height: `${unit.unitLength * truckVisualizationScale}px`, }}>
                  {unit.pallets.map((p: any) => renderPallet(p, truckVisualizationScale))}
                </div>
              </div>
            ))}
            {palletArrangement.length === 0 && (<p className="text-gray-500">Keine Paletten zum Anzeigen.</p>)}
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
            {warnings.length > 0 ? (<ul className={`list-disc list-inside text-sm space-y-1 ${meldungenStyle.list}`}>{warnings.map((w, i) => (<li key={i}>{w}</li>))}</ul>) : (<p className={`text-sm ${meldungenStyle.list}`}>Keine Probleme erkannt.</p>)}
          </div>
        </div>
      </main>

      <footer className="text-center py-4 mt-8 text-sm text-gray-500 border-t border-gray-200">
        <p>Laderaumrechner © {new Date().getFullYear()}</p>
        <p>by Andreas Steiner </p>
      </footer>

    </div>
  );
}
