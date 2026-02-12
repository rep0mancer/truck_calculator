"use client";

export type WeightEntry = {
  id: number;
  weight: string;
  quantity: number;
  stackable?: boolean;
};

export type StackingStrategy = 'axle_safe' | 'max_pairs';

export const MAX_GROSS_WEIGHT_KG = 24000;
export const MAX_PALLET_SIMULATION_QUANTITY = 300; 
export const WARNING_AXLE_LOAD_KG = 1800;

export const KILOGRAM_FORMATTER = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

export const TRUCK_TYPES = {
  standard13_2: {
    name: 'Planensattel (13,2m)',
    units: [{ id: 'main', length: 1320, width: 244 }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 244,
    maxGrossWeightKg: 24000,
  },
  mega13_6: {
    name: 'Mega (13,6m)',
    units: [{ id: 'main', length: 1360, width: 248 }],
    totalLength: 1360,
    usableLength: 1360,
    maxWidth: 248,
    maxGrossWeightKg: 24000,
  },
  roadTrain: {
    name: 'Hängerzug (2x 7,2m)',
    units: [
      { id: 'unit1', length: 720, width: 245 },
      { id: 'unit2', length: 720, width: 245 },
    ],
    totalLength: 1440,
    usableLength: 1440,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
  frigo13_2: {
    name: 'Frigo (13,2m)',
    units: [{ id: 'main', length: 1320, width: 246 }],
    totalLength: 1320,
    usableLength: 1320,
    maxWidth: 246,
    maxGrossWeightKg: 20000,
  },
  smallTruck7_2: {
    name: 'Motorwagen (7,2m)',
    units: [{ id: 'main', length: 720, width: 245 }],
    totalLength: 720,
    usableLength: 720,
    maxWidth: 245,
    maxGrossWeightKg: 12000,
  },
  waggon: {
    name: 'Waggon (16m)',
    units: [{ id: 'main', length: 1600, width: 290 }],
    totalLength: 1600,
    usableLength: 1600,
    maxWidth: 290,
    maxGrossWeightKg: 28000,
  }
};

export const PALLET_TYPES = {
  euro: { name: 'Euro (120x80)', type: 'euro', length: 120, width: 80 },
  industrial: { name: 'DIN (120x100)', type: 'industrial', length: 120, width: 100 },
};

type PalletItem = {
  id: string;
  type: 'euro' | 'industrial';
  weight: number;
  stackable: boolean;
  labelId: number;
};

const createVisualUnits = (truckConfig: (typeof TRUCK_TYPES)[keyof typeof TRUCK_TYPES]) =>
  truckConfig.units.map(u => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: [] as any[]
  }));

const createWaggonPallet = (
  item: PalletItem,
  width: number,
  height: number,
  x: number,
  y: number,
) => ({
  key: item.id,
  type: item.type,
  width,
  height,
  x,
  y,
  labelId: item.labelId,
  isStackedTier: 'base' as const,
});

const calculateWaggonLayout = (
  truckConfig: (typeof TRUCK_TYPES)[keyof typeof TRUCK_TYPES],
  eupItems: PalletItem[],
  dinItems: PalletItem[],
) => {
  const visualUnits = createVisualUnits(truckConfig);
  const mainUnit = visualUnits[0];
  let loadedEuro = 0;
  let loadedDin = 0;
  let totalWeight = 0;
  const warnings: string[] = [];

  const onlyEup = eupItems.length > 0 && dinItems.length === 0;
  const onlyDin = dinItems.length > 0 && eupItems.length === 0;

  if (onlyEup) {
    // Historic POE layout from previous versions: 38 EUP max.
    const maxEup = Math.min(eupItems.length, 38);
    const laneStartY = 5;

    // Lane 1: 11x EUP längs (80x120)
    for (let i = 0; i < 11 && loadedEuro < maxEup; i++) {
      const item = eupItems[loadedEuro];
      mainUnit.pallets.push(createWaggonPallet(item, 80, 120, i * 120, laneStartY));
      loadedEuro++;
      totalWeight += item.weight;
    }

    // Lane 2: 11x EUP längs (80x120)
    for (let i = 0; i < 11 && loadedEuro < maxEup; i++) {
      const item = eupItems[loadedEuro];
      mainUnit.pallets.push(createWaggonPallet(item, 80, 120, i * 120, laneStartY + 80));
      loadedEuro++;
      totalWeight += item.weight;
    }

    // Lane 3: 16x EUP quer (120x80)
    for (let i = 0; i < 16 && loadedEuro < maxEup; i++) {
      const item = eupItems[loadedEuro];
      mainUnit.pallets.push(createWaggonPallet(item, 120, 80, i * 80, laneStartY + 160));
      loadedEuro++;
      totalWeight += item.weight;
    }

    if (eupItems.length > loadedEuro) {
      warnings.push(`Platzmangel / Gewichtslimit: ${eupItems.length - loadedEuro} Paletten konnten nicht geladen werden.`);
    }
  } else if (onlyDin) {
    // Historic POE layout from previous versions: 26 DIN max.
    const maxDin = Math.min(dinItems.length, 26);
    const laneStartY = 25;

    for (let i = 0; i < 13 && loadedDin < maxDin; i++) {
      const left = dinItems[loadedDin];
      mainUnit.pallets.push(createWaggonPallet(left, 120, 120, i * 120, laneStartY));
      loadedDin++;
      totalWeight += left.weight;

      if (loadedDin < maxDin) {
        const right = dinItems[loadedDin];
        mainUnit.pallets.push(createWaggonPallet(right, 120, 120, i * 120, laneStartY + 120));
        loadedDin++;
        totalWeight += right.weight;
      }
    }

    if (dinItems.length > loadedDin) {
      warnings.push(`Platzmangel / Gewichtslimit: ${dinItems.length - loadedDin} Paletten konnten nicht geladen werden.`);
    }
  } else {
    return null;
  }

  if (totalWeight > truckConfig.maxGrossWeightKg) {
    warnings.push(`Gewicht überschritten: ${KILOGRAM_FORMATTER.format(totalWeight)} kg`);
  }

  return {
    palletArrangement: visualUnits,
    loadedIndustrialPalletsBase: loadedDin,
    loadedEuroPalletsBase: loadedEuro,
    totalDinPalletsVisual: loadedDin,
    totalEuroPalletsVisual: loadedEuro,
    utilizationPercentage: 0,
    warnings: Array.from(new Set(warnings)),
    totalWeightKg: totalWeight,
    eupLoadingPatternUsed: onlyEup ? 'custom' : 'none',
  };
};

function expandItems(
  weights: WeightEntry[],
  type: 'euro' | 'industrial',
  globalStackableOverride: boolean,
  startLabelId: number
): PalletItem[] {
  const items: PalletItem[] = [];
  let currentLabel = startLabelId;

  weights.forEach(entry => {
    const w = parseFloat(entry.weight || '0');
    const qty = entry.quantity || 0;
    const canStack = globalStackableOverride && (entry.stackable !== false);

    for (let i = 0; i < qty; i++) {
      items.push({
        id: `${type}-${currentLabel}`,
        type,
        weight: w,
        stackable: canStack,
        labelId: currentLabel,
      });
      currentLabel++;
    }
  });
  return items;
}

export const calculateLoadingLogic = (
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  currentIsEUPStackable: boolean,
  currentIsDINStackable: boolean,
  currentEupLoadingPattern: 'auto' | 'long' | 'broad',
  placementOrder: 'DIN_FIRST' | 'EUP_FIRST',
  _maxEupStack: number,
  _maxDinStack: number,
  _strategy: StackingStrategy
) => {
  const truckConfig = TRUCK_TYPES[truckKey] || TRUCK_TYPES.standard13_2;
  
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Prepare Pool AND SORT
  // CRITICAL FIX: Sort non-stackable to the front, stackable to the back.
  // Because we stack from the back, the base pallets at the back MUST be the stackable ones.
  const dinItemsRaw = expandItems(dinWeights, 'industrial', currentIsDINStackable, 1);
  const eupItemsRaw = expandItems(eupWeights, 'euro', currentIsEUPStackable, 1);

  const dinItems = dinItemsRaw.sort((a, b) => Number(a.stackable) - Number(b.stackable));
  const eupItems = eupItemsRaw.sort((a, b) => Number(a.stackable) - Number(b.stackable));

  if (truckKey === 'waggon') {
    const waggonLayout = calculateWaggonLayout(truckConfig, eupItems, dinItems);
    if (waggonLayout) {
      return waggonLayout;
    }
  }

  // 2. Phase A: Floor Loading
  
  type FloorRow = {
    x: number;
    length: number;
    type: 'din_row' | 'eup_row_long' | 'eup_row_broad';
    slots: (PalletItem | null)[]; 
    stacked: (PalletItem | null)[]; 
    // w = dimension across truck width, l = dimension along truck length
    slotCoords: { y: number, w: number, l: number }[]; 
  };

  const rows: FloorRow[] = [];
  let currentX = 0;
  let currentWeight = 0;
  
  const remainingDins = [...dinItems]; 
  const remainingEups = [...eupItems]; 

  const TRUCK_WIDTH = truckConfig.maxWidth;
  const TRUCK_MAX_LEN = truckConfig.usableLength; 
  
  const placeDinRows = () => {
    // --- DIN PLACEMENT (Always Broad/Quer) ---
    // DIN Broad: Consumes 100cm length, 120cm width.
    while (remainingDins.length > 0) {
      if (currentX + 100 > TRUCK_MAX_LEN) break;

      const p1 = remainingDins.shift()!;
      const p2 = remainingDins.length > 0 ? remainingDins.shift() : null;

      const rowItems: (PalletItem | null)[] = [p1, p2];
      const offset = (TRUCK_WIDTH - 240) / 2;
      const rowCoords = [
        { y: offset, w: 120, l: 100 },
        { y: offset + 120, w: 120, l: 100 }
      ];

      // Gap Fill with EUP
      if (!p2 && remainingEups.length > 0) {
        const fillEup = remainingEups.shift()!;
        rowItems[1] = fillEup;
        // EUP broad is 120x80. Fits in the 120x100 slot.
        // We visualize it with its real length (80), but the row reserves 100.
        rowCoords[1] = { y: offset + 120, w: 120, l: 80 };
      }

      rows.push({
        x: currentX,
        length: 100,
        type: 'din_row',
        slots: rowItems,
        stacked: [null, null],
        slotCoords: rowCoords
      });

      currentX += 100;
      currentWeight += p1.weight + (rowItems[1]?.weight || 0);
    }
  };

  const placeEupRows = () => {
    // --- EUP PLACEMENT ---
    while (remainingEups.length > 0) {
      let useBroad = false;

      if (currentEupLoadingPattern === 'broad') {
        useBroad = true;

        // Broad mode optimization: if exactly 120cm remain and at least 3 EUP are left,
        // finish with one long row (3 pallets) so broad mode can also reach 33 on 13.2m.
        const remainingLength = TRUCK_MAX_LEN - currentX;
        if (remainingLength === 120 && remainingEups.length >= 3) {
          useBroad = false;
        }
      } else if (currentEupLoadingPattern === 'long') {
        useBroad = false;
      } else {
        // auto: Prefer 3-wide (Long) unless end of truck or few items left
        if (remainingEups.length <= 2) {
          useBroad = true;
        } else if (currentX + 120 > TRUCK_MAX_LEN && currentX + 80 <= TRUCK_MAX_LEN) {
          useBroad = true;
        }
      }

      if (useBroad) {
        // EUP Broad: 80cm length, 120cm width. 2 fit.
        if (currentX + 80 > TRUCK_MAX_LEN) break;

        const p1 = remainingEups.shift()!;
        const p2 = remainingEups.shift() || null;

        const offset = (TRUCK_WIDTH - 240) / 2;
        rows.push({
          x: currentX,
          length: 80,
          type: 'eup_row_broad',
          slots: [p1, p2],
          stacked: [null, null],
          slotCoords: [
            { y: offset, w: 120, l: 80 },
            { y: offset + 120, w: 120, l: 80 }
          ]
        });
        currentX += 80;
        currentWeight += p1.weight + (p2?.weight || 0);
      } else {
        // EUP Long: 120cm length, 80cm width. 3 fit.
        if (currentX + 120 > TRUCK_MAX_LEN) {
          if (currentEupLoadingPattern === 'long') {
            break;
          }
          if (currentX + 80 <= TRUCK_MAX_LEN) {
            useBroad = true;
          } else {
            break;
          }
        }

        if (useBroad) {
          const p1 = remainingEups.shift()!;
          const p2 = remainingEups.shift() || null;
          const offset = (TRUCK_WIDTH - 240) / 2;
          rows.push({
            x: currentX,
            length: 80,
            type: 'eup_row_broad',
            slots: [p1, p2],
            stacked: [null, null],
            slotCoords: [
              { y: offset, w: 120, l: 80 },
              { y: offset + 120, w: 120, l: 80 }
            ]
          });
          currentX += 80;
          currentWeight += p1.weight + (p2?.weight || 0);
          continue;
        }

        const p1 = remainingEups.shift()!;
        const p2 = remainingEups.shift() || null;
        const p3 = remainingEups.shift() || null;

        const offset = (TRUCK_WIDTH - 240) / 2;
        rows.push({
          x: currentX,
          length: 120,
          type: 'eup_row_long',
          slots: [p1, p2, p3],
          stacked: [null, null, null],
          slotCoords: [
            { y: offset, w: 80, l: 120 },
            { y: offset + 80, w: 80, l: 120 },
            { y: offset + 160, w: 80, l: 120 }
          ]
        });
        currentX += 120;
        currentWeight += p1.weight + (p2?.weight || 0) + (p3?.weight || 0);
      }
    }
  };

  if (placementOrder === 'EUP_FIRST') {
    placeEupRows();
    placeDinRows();
  } else {
    placeDinRows();
    placeEupRows();
  }

  // 3. Phase B: Reverse Stacking
  // We stack using the remaining items in the pool.
  
  // Stack EUPs (Back to Front)
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (remainingEups.length === 0) break;

    const isEupRow = row.type.startsWith('eup');
    const isMixedRowWithEupSlot = row.type === 'din_row' && row.slots[1]?.type === 'euro';
    
    if (isEupRow) {
      for (let s = 0; s < row.slots.length; s++) {
        if (remainingEups.length === 0) break;
        const base = row.slots[s];
        
        // Check if base allows stacking. Since we sorted inputs, the bases at the back SHOULD be stackable.
        if (base && base.stackable && row.stacked[s] === null) {
           const candidate = remainingEups[0];
           if (currentWeight + candidate.weight > truckConfig.maxGrossWeightKg) {
             warnings.push("Gesamtgewichtsgrenze für Stapelung erreicht.");
             break; 
           }
           row.stacked[s] = remainingEups.shift()!;
           currentWeight += row.stacked[s]!.weight;
        }
      }
    } else if (isMixedRowWithEupSlot) {
       // Mixed slot index 1
       if (row.slots[1] && row.slots[1].type === 'euro' && row.slots[1].stackable && row.stacked[1] === null) {
          if (remainingEups.length > 0) {
             const candidate = remainingEups[0];
             if (currentWeight + candidate.weight <= truckConfig.maxGrossWeightKg) {
                row.stacked[1] = remainingEups.shift()!;
                currentWeight += row.stacked[1]!.weight;
             }
          }
       }
    }
  }

  // Stack DINs (Back to Front)
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (remainingDins.length === 0) break;
    
    if (row.type === 'din_row') {
       for (let s = 0; s < row.slots.length; s++) {
         if (remainingDins.length === 0) break;
         const base = row.slots[s];
         if (base && base.type === 'industrial' && base.stackable && row.stacked[s] === null) {
            const candidate = remainingDins[0];
            if (currentWeight + candidate.weight > truckConfig.maxGrossWeightKg) {
               warnings.push("Gesamtgewichtsgrenze für Stapelung erreicht.");
               break;
            }
            row.stacked[s] = remainingDins.shift()!;
            currentWeight += row.stacked[s]!.weight;
         }
       }
    }
  }

  // 4. Validation
  const notLoadedCount = remainingDins.length + remainingEups.length;
  if (notLoadedCount > 0) {
    errors.push(`Platzmangel / Gewichtslimit: ${notLoadedCount} Paletten konnten nicht geladen werden.`);
  }
  
  if (currentWeight > truckConfig.maxGrossWeightKg) {
    errors.push(`Gewicht überschritten: ${KILOGRAM_FORMATTER.format(currentWeight)} kg`);
  }

  // Safety Check: Uneven Stacks
  rows.forEach((row, idx) => {
    const baseCount = row.slots.filter(s => s !== null).length;
    const stackCount = row.stacked.filter(s => s !== null).length;
    
    // If any stacking exists, it must match base count (full row stacking)
    // User requirement: "Gestapelte müssen praktisch immer im Doppelpack sein"
    if (stackCount > 0 && stackCount < baseCount) {
       warnings.push(`Warnung (Reihe ${idx + 1}): Ungleiche Stapelung!`);
    }
  });

  const axleLoad = currentWeight / (currentX / 100 || 1); 
  if (axleLoad > WARNING_AXLE_LOAD_KG) {
    warnings.push(`Hohe Achslast: ~${KILOGRAM_FORMATTER.format(axleLoad)} kg/ldm`);
  }

  // 5. Visualization Mapping
  let visualUnits = truckConfig.units.map(u => ({
    unitId: u.id,
    unitLength: u.length,
    unitWidth: u.width,
    pallets: [] as any[]
  }));

  rows.forEach(row => {
    const rowX = row.x;
    let targetUnit = visualUnits[0];
    let xInUnit = rowX;
    
    if (visualUnits.length > 1) {
        if (rowX >= visualUnits[0].unitLength) {
            targetUnit = visualUnits[1];
            xInUnit = rowX - visualUnits[0].unitLength;
        }
    }

    // Helper to push
    const pushPallet = (item: PalletItem | null, coords: { w: number, l: number, y: number }, isTop: boolean, baseLabel?: number) => {
        if (!item) return;
        targetUnit.pallets.push({
            key: item.id,
            type: item.type,
            // IMPORTANT: Mapping logic dimensions to visual dimensions
            // Logic 'l' (length along truck) -> Visual Height (vertical on screen)
            // Logic 'w' (width across truck) -> Visual Width (horizontal on screen)
            height: coords.l, 
            width: coords.w, 
            x: xInUnit,
            y: coords.y,
            labelId: item.labelId,
            isStackedTier: isTop ? 'top' : 'base',
            displayBaseLabelId: baseLabel || item.labelId,
            displayStackedLabelId: isTop ? item.labelId : undefined,
            showAsFraction: isTop
        });
    };

    row.slots.forEach((item, idx) => {
        pushPallet(item, row.slotCoords[idx], false);
    });

    row.stacked.forEach((item, idx) => {
        const base = row.slots[idx];
        pushPallet(item, row.slotCoords[idx], true, base?.labelId);
    });
  });

  const finalWarnings = [...errors, ...warnings];
  const totalDin = [...dinItems].length - remainingDins.length;
  const totalEup = [...eupItems].length - remainingEups.length;

  return {
    palletArrangement: visualUnits,
    loadedIndustrialPalletsBase: 0,
    loadedEuroPalletsBase: 0,
    totalDinPalletsVisual: totalDin,
    totalEuroPalletsVisual: totalEup,
    utilizationPercentage: Math.min(100, (currentX / truckConfig.totalLength) * 100),
    warnings: Array.from(new Set(finalWarnings)),
    totalWeightKg: currentWeight,
    eupLoadingPatternUsed: currentEupLoadingPattern,
  };
};
