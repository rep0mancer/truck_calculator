"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

/* -------------------------------------------------------------
   Dimensions in cm
-------------------------------------------------------------- */

const TRUCK_TYPES: any = {
  curtainSider: {
    name: "Planensattel Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 245, occupiedRects: [] }],
    usableLength: 1320,
    maxWidth: 245,
    maxGrossWeightKg: 24000,
  },
};

const PALLET_TYPES: any = {
  euro: { type: "euro", name: "Europalette (120×80)", length: 120, width: 80, color: "bg-blue-500", border: "border-blue-700" },
  din:  { type: "din",  name: "Industriepalette (120×100)", length: 120, width: 100, color: "bg-green-500", border: "border-green-700" },
};

/* ------------------------------------------------------------- */

const MAX_GROSS_WEIGHT_KG = 24000;
const MAX_PALLET_SIM_QTY = 300;
const MAX_WEIGHT_PER_METER_KG = 1800;
const AXLE_WARN_EUP_STACKED = 18;
const AXLE_WARN_DIN_STACKED = 16;

type EupPattern = "auto" | "broad" | "long";

const zIndexFor = (p: any) => {
  const stacked = !!p.showAsFraction;
  const isDIN = p.type === "din";
  if (stacked) return (isDIN ? 400 : 300) + (p.isStackedTier === "top" ? 1 : 0);
  return isDIN ? 200 : 100;
};
const catPrio = (p: any) => {
  const s = !!p.showAsFraction;
  if (p.type === "din"  && s) return 0; // STACKED DIN
  if (p.type === "euro" && s) return 1; // STACKED EUP
  if (p.type === "din")        return 2; // DIN
  return 3;                              // EUP
};
const pairOrder = (p: any) => (p.isStackedTier === "top" ? 1 : 0);

/* -------------------------------------------------------------
   Planner – fixed physical order:
   STACKED DIN → STACKED EUP → DIN → EUP
   Rules:
   - DIN: 100 cm step along length, two 120-cm slots across → 26 / 52 on 13.2 m
   - EUP broad (preferred): 3×80 across, step 120 along → 33 / 66
   - EUP long (on request): 2×120 across, step 80 + one 3-across row → also 33
   - Mixed: never leave a hole. If a DIN row ends single, fill the partner slot
     immediately with an EUP in that SAME row (stacked if we’re in stacked stage).
   - “Stackable pallets” input N means N pallets may be stacked (topsBudget = ⌊N/2⌋).
-------------------------------------------------------------- */

type PlaceCtx = {
  weightLimit: number;
  eupWeight: number;
  dinWeight: number;
  eupTopsBudget: number;
  dinTopsBudget: number;
  totalWeight: number;
  totalAreaBase: number;
  eupLabel: number;
  dinLabel: number;
  warnings: string[];
};

type PlanInputs = {
  truckKey: string;
  reqEUP: number;
  reqDIN: number;
  eupStackable: boolean;
  dinStackable: boolean;
  eupStackLimit?: number;
  dinStackLimit?: number;
  eupWeightStr: string;
  dinWeightStr: string;
  eupPattern: EupPattern;
};

type PlanResult = {
  palletArrangement: any[];
  loadedIndustrialPalletsBase: number;
  loadedEuroPalletsBase: number;
  totalDinPalletsVisual: number;
  totalEuroPalletsVisual: number;
  utilizationPercentage: number;
  warnings: string[];
  totalWeightKg: number;
  eupLoadingPatternUsed: EupPattern;
};

function calculatePlan(input: PlanInputs): PlanResult {
  const {
    truckKey, reqEUP, reqDIN,
    eupStackable, dinStackable,
    eupStackLimit, dinStackLimit,
    eupWeightStr, dinWeightStr,
    eupPattern
  } = input;

  const truck = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const weightLimit = truck.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;

  const eupWeight = Math.max(0, parseFloat(eupWeightStr) || 0);
  const dinWeight = Math.max(0, parseFloat(dinWeightStr) || 0);

  const ctx: PlaceCtx = {
    weightLimit,
    eupWeight,
    dinWeight,
    eupTopsBudget: eupStackable ? (eupStackLimit && eupStackLimit > 0 ? Math.floor(eupStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
    dinTopsBudget: dinStackable ? (dinStackLimit && dinStackLimit > 0 ? Math.floor(dinStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
    totalWeight: 0,
    totalAreaBase: 0,
    eupLabel: 0,
    dinLabel: 0,
    warnings: [],
  };

  let eupLeft = Math.max(0, reqEUP);
  let dinLeft = Math.max(0, reqDIN);

  const canAdd = (w: number) => ctx.weightLimit <= 0 || ctx.totalWeight + w <= ctx.weightLimit;

  const units = truck.units.map((u: any) => ({ ...u, currentX: 0, currentY: 0, palletsVisual: [] as any[] }));
  const push = (unit: any, p: any) => {
    unit.palletsVisual.push(p);
    unit.occupiedRects.push({ x: p.x, y: p.y, width: p.width, height: p.height });
  };

  // fill partner slot in the last DIN row of each unit if exactly one DIN is there
  const fillDinPartnerWithEUP = (stage: "stacked" | "solo") => {
    for (const u of units) {
      const lastX = u.currentX - 100;
      if (lastX < 0 || eupLeft <= 0) continue;
      const rowDIN = u.palletsVisual.filter((p: any) => p.type === "din" && p.x === lastX && !p.showAsFraction);
      if (rowDIN.length !== 1) continue;
      // avoid double fill
      const alreadySomething = u.palletsVisual.some((p: any) => p.x === lastX && p.type === "euro");
      if (alreadySomething) continue;

      const usedY = rowDIN[0].y;
      const partnerY = usedY === 0 ? 120 : 0;

      const baseId = ++ctx.eupLabel;
      const base = {
        x: lastX, y: partnerY, width: 80, height: 120,
        type: "euro" as const, isStackedTier: null as any,
        key: `eup_fill_${u.id}_${baseId}`, unitId: u.id,
        labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any,
        showAsFraction: false
      };
      push(u, base);
      ctx.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
      ctx.totalWeight += ctx.eupWeight;
      eupLeft--;

      if (stage === "stacked" && eupStackable && ctx.eupTopsBudget > 0 && eupLeft > 0 && canAdd(ctx.eupWeight)) {
        const topId = ++ctx.eupLabel;
        u.palletsVisual[u.palletsVisual.length - 1] = {
          ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
        };
        push(u, { ...base, isStackedTier: "top" as const, key: `eup_fill_top_${u.id}_${topId}`,
          labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true });
        ctx.totalWeight += ctx.eupWeight;
        eupLeft--;
        ctx.eupTopsBudget--;
      }
    }
  };

  // DIN rows: true DIN raster
  const placeDINRows = (stacked: boolean) => {
    if (dinLeft <= 0) return;
    for (const unit of units) {
      while (dinLeft > 0 && unit.currentX + 100 <= unit.length) {
        unit.currentY = 0;
        let placedInRow = 0;
        for (let i = 0; i < 2 && dinLeft > 0; i++) {
          if (!canAdd(ctx.dinWeight)) { unit.currentX = unit.length; break; }
          if (unit.currentY + 120 <= unit.width) {
            const baseId = ++ctx.dinLabel;
            const base = {
              x: unit.currentX, y: unit.currentY, width: 100, height: 120,
              type: "din" as const, isStackedTier: null as any,
              key: `din_${stacked ? "stk" : "solo"}_${unit.id}_${baseId}_${i}`, unitId: unit.id,
              labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
            };
            push(unit, base);
            ctx.totalAreaBase += PALLET_TYPES.din.length * PALLET_TYPES.din.width;
            ctx.totalWeight += ctx.dinWeight;
            dinLeft--;
            placedInRow++;

            if (stacked && dinLeft > 0 && ctx.dinTopsBudget > 0 && canAdd(ctx.dinWeight)) {
              const topId = ++ctx.dinLabel;
              unit.palletsVisual[unit.palletsVisual.length - 1] = {
                ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
              };
              push(unit, { ...base, isStackedTier: "top" as const, key: `din_top_${unit.id}_${topId}_${i}`,
                labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true });
              ctx.totalWeight += ctx.dinWeight;
              dinLeft--;
              ctx.dinTopsBudget--;
            }

            unit.currentY += 120;
          }
        }

        // inline micro-fill for SOLO stage, in the same row
        if (!stacked && placedInRow === 1 && eupLeft > 0) {
          const rowStartX = unit.currentX;
          const partnerY = unit.currentY === 120 ? 0 : 120; // if first placed at y=0 then currentY=120 now
          const baseId = ++ctx.eupLabel;
          const base = {
            x: rowStartX, y: partnerY, width: 80, height: 120,
            type: "euro" as const, isStackedTier: null as any,
            key: `eup_fill_inline_${unit.id}_${baseId}`, unitId: unit.id,
            labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
          };
          push(unit, base);
          ctx.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
          ctx.totalWeight += ctx.eupWeight;
          eupLeft--;
        }

        if (placedInRow > 0) unit.currentX += 100; else break;
      }
    }
  };

  // EUP variants
  const tryPlaceEUPVariant = (variant: "broad" | "long", stacked: boolean, cloneUnits: any[], localCtx: PlaceCtx, leftInit: number) => {
    let left = leftInit;

    if (variant === "broad") {
      // 3 across, step 120
      for (const u of cloneUnits) {
        while (left > 0 && u.currentX + 120 <= u.length) {
          u.currentY = 0;
          let placed = 0;
          for (let i = 0; i < 3 && left > 0; i++) {
            if (!(localCtx.weightLimit <= 0 || localCtx.totalWeight + localCtx.eupWeight <= localCtx.weightLimit)) { u.currentX = u.length; break; }
            if (u.currentY + 80 <= u.width) {
              const baseId = ++localCtx.eupLabel;
              const base = {
                x: u.currentX, y: u.currentY, width: 120, height: 80,
                type: "euro" as const, isStackedTier: null as any,
                key: `eup_broad_${u.id}_${baseId}_${i}`, unitId: u.id,
                labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
              };
              u.palletsVisual.push(base);
              u.occupiedRects.push({ x: base.x, y: base.y, width: base.width, height: base.height });
              localCtx.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
              localCtx.totalWeight += localCtx.eupWeight;
              left--; placed++;

              if (stacked && left > 0 && localCtx.eupTopsBudget > 0 &&
                  (localCtx.weightLimit <= 0 || localCtx.totalWeight + localCtx.eupWeight <= localCtx.weightLimit)) {
                const topId = ++localCtx.eupLabel;
                u.palletsVisual[u.palletsVisual.length - 1] = {
                  ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
                };
                u.palletsVisual.push({
                  ...base, isStackedTier: "top" as const, key: `eup_broad_top_${u.id}_${topId}_${i}`,
                  labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true
                });
                localCtx.totalWeight += localCtx.eupWeight; left--; localCtx.eupTopsBudget--;
              }
              u.currentY += 80;
            }
          }
          if (placed > 0) u.currentX += 120; else break;
        }
      }
    } else {
      // long: one 3-across row (120) + then 2-across rows with step 80
      for (const u of cloneUnits) {
        if (left > 0 && u.currentX + 120 <= u.length) {
          u.currentY = 0;
          let placed = 0;
          for (let i = 0; i < 3 && left > 0; i++) {
            if (!(localCtx.weightLimit <= 0 || localCtx.totalWeight + localCtx.eupWeight <= localCtx.weightLimit)) { u.currentX = u.length; break; }
            if (u.currentY + 80 <= u.width) {
              const baseId = ++localCtx.eupLabel;
              const base = {
                x: u.currentX, y: u.currentY, width: 120, height: 80,
                type: "euro" as const, isStackedTier: null as any, key: `eup_long_head_${u.id}_${baseId}_${i}`,
                unitId: u.id, labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
              };
              u.palletsVisual.push(base);
              u.occupiedRects.push({ x: base.x, y: base.y, width: base.width, height: base.height });
              localCtx.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
              localCtx.totalWeight += localCtx.eupWeight;
              left--; placed++;
              if (stacked && left > 0 && localCtx.eupTopsBudget > 0 &&
                  (localCtx.weightLimit <= 0 || localCtx.totalWeight + localCtx.eupWeight <= localCtx.weightLimit)) {
                const topId = ++localCtx.eupLabel;
                u.palletsVisual[u.palletsVisual.length - 1] = {
                  ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
                };
                u.palletsVisual.push({
                  ...base, isStackedTier: "top" as const, key: `eup_long_head_top_${u.id}_${topId}_${i}`,
                  labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true
                });
                localCtx.totalWeight += localCtx.eupWeight; left--; localCtx.eupTopsBudget--;
              }
              u.currentY += 80;
            }
          }
          if (placed > 0) u.currentX += 120;
        }
        while (left > 0 && u.currentX + 80 <= u.length) {
          u.currentY = 0;
          let placed = 0;
          for (let i = 0; i < 2 && left > 0; i++) {
            if (!(localCtx.weightLimit <= 0 || localCtx.totalWeight + localCtx.eupWeight <= localCtx.weightLimit)) { u.currentX = u.length; break; }
            if (u.currentY + 120 <= u.width) {
              const baseId = ++localCtx.eupLabel;
              const base = {
                x: u.currentX, y: u.currentY, width: 80, height: 120,
                type: "euro" as const, isStackedTier: null as any, key: `eup_long_${u.id}_${baseId}_${i}`,
                unitId: u.id, labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
              };
              u.palletsVisual.push(base);
              u.occupiedRects.push({ x: base.x, y: base.y, width: base.width, height: base.height });
              localCtx.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
              localCtx.totalWeight += localCtx.eupWeight;
              left--; placed++;
              if (stacked && left > 0 && localCtx.eupTopsBudget > 0 &&
                  (localCtx.weightLimit <= 0 || localCtx.totalWeight + localCtx.eupWeight <= localCtx.weightLimit)) {
                const topId = ++localCtx.eupLabel;
                u.palletsVisual[u.palletsVisual.length - 1] = {
                  ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
                };
                u.palletsVisual.push({
                  ...base, isStackedTier: "top" as const, key: `eup_long_top_${u.id}_${topId}_${i}`,
                  labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true
                });
                localCtx.totalWeight += localCtx.eupWeight; left--; localCtx.eupTopsBudget--;
              }
              u.currentY += 120;
            }
          }
          if (placed > 0) u.currentX += 80; else break;
        }
      }
    }
    return { units: cloneUnits, ctx: localCtx, left };
  };

  const placeEUP = (stacked: boolean) => {
    if (eupLeft <= 0) return;

    const order: ("broad" | "long")[] = eupPattern === "auto" ? ["broad", "long"] : (eupPattern === "broad" ? ["broad"] : ["long"]);
    let best = { score: -1, res: null as any };

    for (const v of order) {
      const cloneU = JSON.parse(JSON.stringify(units));
      const lctx: PlaceCtx = JSON.parse(JSON.stringify(ctx));
      const placed = tryPlaceEUPVariant(v, stacked, cloneU, lctx, eupLeft);
      const score = placed.units.reduce((s: number, u: any) => s + u.palletsVisual.length, 0);
      if (score > best.score) best = { score, res: placed };
    }

    if (best.res) {
      for (let i = 0; i < units.length; i++) units[i] = best.res.units[i];
      ctx.eupLabel = best.res.ctx.eupLabel;
      ctx.eupTopsBudget = best.res.ctx.eupTopsBudget;
      ctx.totalAreaBase = best.res.ctx.totalAreaBase;
      ctx.totalWeight = best.res.ctx.totalWeight;
      eupLeft = best.res.left;
    }
  };

  // ---------- pipeline (fixed) ----------
  // 1) STACKED DIN
  placeDINRows(true);
  // micro-fill partner slot with STACKED EUP if possible
  fillDinPartnerWithEUP("stacked");
  // 2) STACKED EUP
  placeEUP(true);
  // 3) DIN (solo) with inline micro-fill of partner slot per row
  placeDINRows(false);
  // 4) EUP (solo)
  placeEUP(false);

  // ---------- finalization ----------
  for (const u of units) {
    u.palletsVisual.sort((a: any, b: any) => {
      const ca = catPrio(a), cb = catPrio(b);
      if (ca !== cb) return ca - cb;
      return pairOrder(a) - pairOrder(b);
    });
  }

  const pallets = units.flatMap((u: any) => u.palletsVisual);
  const euroBase = pallets.filter((p) => p.type === "euro" && !p.showAsFraction).length;
  const dinBase  = pallets.filter((p) => p.type === "din"  && !p.showAsFraction).length;
  const totalEuro = pallets.filter((p) => p.type === "euro").length;
  const totalDin  = pallets.filter((p) => p.type === "din").length;

  const usedArea = ctx.totalAreaBase;
  const totalArea = truck.usableLength * truck.maxWidth;
  const utilization = totalArea > 0 ? Math.round((usedArea / totalArea) * 1000) / 10 : 0;

  const usedLength = truck.maxWidth ? usedArea / truck.maxWidth : 0;
  const weightPerMeter = usedLength > 0 ? ctx.totalWeight / (usedLength / 100) : 0;
  if (weightPerMeter >= MAX_WEIGHT_PER_METER_KG) ctx.warnings.push(`ACHTUNG – mögliche Achslastüberschreitung: ${weightPerMeter.toFixed(1)} kg/m`);

  const stackedEup = totalEuro - euroBase;
  const stackedDin = totalDin - dinBase;
  if (stackedEup >= AXLE_WARN_EUP_STACKED) ctx.warnings.push(`ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${stackedEup} gestapelte EUP)`);
  if (stackedDin >= AXLE_WARN_DIN_STACKED) ctx.warnings.push(`ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${stackedDin} gestapelte DIN)`);
  ctx.warnings = Array.from(new Set(ctx.warnings));

  return {
    palletArrangement: units.map((u: any) => ({ unitId: u.id, unitLength: u.length, unitWidth: u.width, pallets: u.palletsVisual })),
    loadedIndustrialPalletsBase: dinBase,
    loadedEuroPalletsBase: euroBase,
    totalDinPalletsVisual: totalDin,
    totalEuroPalletsVisual: totalEuro,
    utilizationPercentage: utilization,
    warnings: ctx.warnings,
    totalWeightKg: ctx.totalWeight,
    eupLoadingPatternUsed: eupPattern,
  };
}

/* -------------------------------------------------------------
   Page
-------------------------------------------------------------- */

export default function Page() {
  const [selectedTruck, setSelectedTruck] = useState("curtainSider");

  const [dinQty, setDinQty] = useState(0);
  const [eupQty, setEupQty] = useState(0);

  const [dinStackable, setDinStackable] = useState(false);
  const [eupStackable, setEupStackable] = useState(false);

  const [dinStackLimitInput, setDinStackLimitInput] = useState("");
  const [eupStackLimitInput, setEupStackLimitInput] = useState("");

  const dinStackLimit = useMemo(() => Math.max(0, parseInt(dinStackLimitInput, 10) || 0), [dinStackLimitInput]);
  const eupStackLimit = useMemo(() => Math.max(0, parseInt(eupStackLimitInput, 10) || 0), [eupStackLimitInput]);

  const [dinWeight, setDinWeight] = useState("");
  const [eupWeight, setEupWeight] = useState("");

  const [eupPattern, setEupPattern] = useState<EupPattern>("auto");

  const [arrangement, setArrangement] = useState<any[]>([]);
  const [loadedDinBase, setLoadedDinBase] = useState(0);
  const [loadedEupBase, setLoadedEupBase] = useState(0);
  const [totalDinVisual, setTotalDinVisual] = useState(0);
  const [totalEupVisual, setTotalEupVisual] = useState(0);
  const [utilization, setUtilization] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [totalWeightKg, setTotalWeightKg] = useState(0);
  const [actualPattern, setActualPattern] = useState<EupPattern>("auto");

  const recompute = useCallback(() => {
    const res = calculatePlan({
      truckKey: selectedTruck,
      reqEUP: eupQty,
      reqDIN: dinQty,
      eupStackable,
      dinStackable,
      eupStackLimit,
      dinStackLimit,
      eupWeightStr: eupWeight,
      dinWeightStr: dinWeight,
      eupPattern,
    });

    setArrangement(res.palletArrangement);
    setLoadedDinBase(res.loadedIndustrialPalletsBase);
    setLoadedEupBase(res.loadedEuroPalletsBase);
    setTotalDinVisual(res.totalDinPalletsVisual);
    setTotalEupVisual(res.totalEuroPalletsVisual);
    setUtilization(res.utilizationPercentage);
    setWarnings(res.warnings);
    setTotalWeightKg(res.totalWeightKg);
    setActualPattern(res.eupLoadingPatternUsed);
  }, [selectedTruck, dinQty, eupQty, dinStackable, eupStackable, dinStackLimit, eupStackLimit, dinWeight, eupWeight, eupPattern]);

  useEffect(() => { recompute(); }, [recompute]);

  const handleQty = (t: "din" | "eup", d: number) => {
    if (t === "din") setDinQty((v) => Math.max(0, (parseInt(String(v), 10) || 0) + d));
    else setEupQty((v) => Math.max(0, (parseInt(String(v), 10) || 0) + d));
  };

  const handleReset = () => {
    setDinQty(0); setEupQty(0);
    setDinStackable(false); setEupStackable(false);
    setDinStackLimitInput(""); setEupStackLimitInput("");
    setDinWeight(""); setEupWeight("");
    setEupPattern("auto");
  };

  const handleMax = (type: "din" | "euro") => {
    const res = calculatePlan({
      truckKey: selectedTruck,
      reqEUP: type === "euro" ? MAX_PALLET_SIM_QTY : 0,
      reqDIN: type === "din" ? MAX_PALLET_SIM_QTY : 0,
      eupStackable,
      dinStackable,
      eupStackLimit,
      dinStackLimit,
      eupWeightStr: eupWeight,
      dinWeightStr: dinWeight,
      eupPattern: type === "euro" ? "auto" : eupPattern,
    });
    if (type === "euro") { setEupQty(res.totalEuroPalletsVisual); setDinQty(0); }
    else { setDinQty(res.totalDinPalletsVisual); setEupQty(0); }
  };

  const fillRestEUP = () => {
    const res = calculatePlan({
      truckKey: selectedTruck,
      reqEUP: MAX_PALLET_SIM_QTY,
      reqDIN: dinQty,
      eupStackable,
      dinStackable,
      eupStackLimit,
      dinStackLimit,
      eupWeightStr: eupWeight,
      dinWeightStr: dinWeight,
      eupPattern: "auto",
    });
    setEupQty(res.totalEuroPalletsVisual);
    setDinQty(res.totalDinPalletsVisual);
  };
  const fillRestDIN = () => {
    const res = calculatePlan({
      truckKey: selectedTruck,
      reqEUP: eupQty,
      reqDIN: MAX_PALLET_SIM_QTY,
      eupStackable,
      dinStackable,
      eupStackLimit,
      dinStackLimit,
      eupWeightStr: eupWeight,
      dinWeightStr: dinWeight,
      eupPattern: "auto",
    });
    setEupQty(res.totalEuroPalletsVisual);
    setDinQty(res.totalDinPalletsVisual);
  };

  // ---------- rendering ----------
  const renderPallet = (p: any, scale = 0.3) => {
    const def = PALLET_TYPES[p.type];
    const w = p.height * scale; // horizontal
    const h = p.width * scale;  // vertical
    const x = p.y * scale;
    const y = p.x * scale;
    const label = p.showAsFraction && p.displayStackedLabelId
      ? `${p.displayBaseLabelId}/${p.displayStackedLabelId}` : `${p.labelId}`;

    return (
      <div
        key={p.key}
        className={`absolute ${def.color} ${def.border} border rounded-sm shadow-sm flex items-center justify-center`}
        style={{ left: x, top: y, width: w, height: h, opacity: p.isStackedTier === "top" ? 0.7 : 1, zIndex: zIndexFor(p), fontSize: 10 }}
        title={`${def.name} ${label}`}
      >
        <span className="text-black font-semibold select-none">{label}</span>
        {p.isStackedTier === "top" && <div className="absolute inset-0 border-t-2 border-l-2 border-black opacity-30 rounded-sm pointer-events-none" />}
      </div>
    );
  };

  const truckScale = 0.3;

  const QuickPick = ({ onPick }: { onPick: (v: number | "") => void }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {[2,4,6,8,10].map(v => (
        <button key={v} onClick={() => onPick(v)} className="px-2 py-[3px] text-xs border rounded-md hover:bg-slate-100">{v}</button>
      ))}
      <button onClick={() => onPick("")} className="px-2 py-[3px] text-xs border rounded-md hover:bg-slate-100">Alle</button>
    </div>
  );

  const warnStyle =
    warnings.length === 0
      ? { bg: "bg-green-50", border: "border-green-200", header: "text-green-800", list: "text-green-700" }
      : warnings.every((w) => w.toLowerCase().includes("achslast"))
      ? { bg: "bg-yellow-50", border: "border-yellow-200", header: "text-yellow-800", list: "text-yellow-700" }
      : { bg: "bg-red-50", border: "border-red-200", header: "text-red-800", list: "text-red-700" };

  return (
    <div className="container mx-auto p-4 bg-gray-50">
      <header className="bg-blue-800 text-white p-5 rounded-t-lg shadow mb-6">
        <h1 className="text-3xl font-bold text-center">Laderaumrechner</h1>
        <p className="text-center text-sm opacity-90">Visualisierung der Palettenplatzierung</p>
      </header>

      <main className="p-6 bg-white shadow rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* LEFT */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded border border-slate-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LKW-Typ:</label>
              <select value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm">
                {Object.keys(TRUCK_TYPES).map((k) => (<option key={k} value={k}>{TRUCK_TYPES[k].name}</option>))}
              </select>
            </div>

            <div className="pt-2"><button onClick={handleReset} className="w-full py-2 px-4 bg-[#00906c] text-white font-semibold rounded hover:bg-[#007e5e]">Alles zurücksetzen</button></div>

            <div><button onClick={fillRestEUP} className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700">Automatisch anpassen</button></div>

            {/* DIN */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Industriepaletten (DIN)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQty("din",-1)} className="px-3 py-1 bg-red-500 text-white rounded-l hover:bg-red-600">-</button>
                <input type="number" min={0} value={dinQty} onChange={(e)=>setDinQty(Math.max(0,parseInt(e.target.value,10)||0))} className="w-full text-center py-1.5 border-t border-b border-gray-300" />
                <button onClick={() => handleQty("din",1)} className="px-3 py-1 bg-blue-500 text-white rounded-r hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => handleMax("din")} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded shadow">Max. DIN</button>
              <button onClick={fillRestDIN} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded shadow">Rest mit max. DIN füllen</button>

              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/DIN (kg):</label>
                <input type="number" min={0} value={dinWeight} onChange={(e)=>setDinWeight(e.target.value)} placeholder="z.B. 500" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded shadow-sm text-xs"/>
              </div>

              <div className="flex items-center mt-2">
                <input type="checkbox" id="dinStack" checked={dinStackable} onChange={e=>setDinStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded"/>
                <label htmlFor="dinStack" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {dinStackable && (
                <>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={dinStackLimitInput} onChange={(e)=>setDinStackLimitInput(e.target.value.replace(/\D+/g,""))} className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded shadow-sm text-xs" placeholder="Stapelbare Paletten gesamt (0 = alle)"/>
                  <QuickPick onPick={(v)=>setDinStackLimitInput(v===""? "": String(v))}/>
                </>
              )}
            </div>

            {/* EUP */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Europaletten (EUP)</label>
              <div className="flex items-center mt-1">
                <button onClick={() => handleQty("eup",-1)} className="px-3 py-1 bg-red-500 text-white rounded-l hover:bg-red-600">-</button>
                <input type="number" min={0} value={eupQty} onChange={(e)=>setEupQty(Math.max(0,parseInt(e.target.value,10)||0))} className="w-full text-center py-1.5 border-t border-b border-gray-300" />
                <button onClick={() => handleQty("eup",1)} className="px-3 py-1 bg-blue-500 text-white rounded-r hover:bg-blue-600">+</button>
              </div>
              <button onClick={() => handleMax("euro")} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded shadow">Max. EUP</button>
              <button onClick={fillRestEUP} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded shadow">Rest mit max. EUP füllen</button>

              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/EUP (kg):</label>
                <input type="number" min={0} value={eupWeight} onChange={(e)=>setEupWeight(e.target.value)} placeholder="z.B. 400" className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded shadow-sm text-xs"/>
              </div>

              <div className="flex items-center mt-2">
                <input type="checkbox" id="eupStack" checked={eupStackable} onChange={e=>setEupStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded"/>
                <label htmlFor="eupStack" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {eupStackable && (
                <>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={eupStackLimitInput} onChange={(e)=>setEupStackLimitInput(e.target.value.replace(/\D+/g,""))} className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded shadow-sm text-xs" placeholder="Stapelbare Paletten gesamt (0 = alle)"/>
                  <QuickPick onPick={(v)=>setEupStackLimitInput(v===""? "": String(v))}/>
                </>
              )}

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  EUP Lade-Pattern: <span className="text-xs text-gray-500">(gewählt: {actualPattern})</span>
                </label>
                <div className="flex flex-col space-y-1">
                  <label className="flex items-center">
                    <input type="radio" name="eupPattern" value="auto" checked={eupPattern==="auto"} onChange={(e)=>setEupPattern(e.target.value as EupPattern)} className="h-4 w-4 text-indigo-600"/>
                    <span className="ml-2 text-sm">Auto (3 nebeneinander bevorzugt)</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="eupPattern" value="broad" checked={eupPattern==="broad"} onChange={(e)=>setEupPattern(e.target.value as EupPattern)} className="h-4 w-4 text-indigo-600"/>
                    <span className="ml-2 text-sm">Quer – 3 nebeneinander</span>
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="eupPattern" value="long" checked={eupPattern==="long"} onChange={(e)=>setEupPattern(e.target.value as EupPattern)} className="h-4 w-4 text-indigo-600"/>
                    <span className="ml-2 text-sm">Längsverladung – hybrid (auch 33)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded border border-gray-200 flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Ladefläche Visualisierung</p>
            {arrangement.map((unit: any) => (
              <div key={unit.unitId} className="mb-4 w-full flex flex-col items-center">
                <div className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded shadow-inner"
                  style={{ width: unit.unitWidth * truckScale, height: unit.unitLength * truckScale }}>
                  {unit.pallets.map((p: any) => renderPallet(p, truckScale))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded border border-blue-200 text-center">
            <h3 className="font-semibold text-blue-800 mb-2">Geladene Paletten (visuell)</h3>
            <p>Industrie (DIN): <span className="font-bold text-lg">{totalDinVisual}</span></p>
            <p>Euro (EUP): <span className="font-bold text-lg">{totalEupVisual}</span></p>
            <p className="text-xs mt-1">(Basis: {loadedDinBase} DIN, {loadedEupBase} EUP)</p>
          </div>
          <div className="bg-green-50 p-4 rounded border border-green-200 text-center">
            <h3 className="font-semibold text-green-800 mb-2">Flächenausnutzung</h3>
            <p className="font-bold text-3xl text-green-700">{utilization}%</p>
            <p className="text-xs mt-1">(Grundfläche)</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded border border-yellow-200 text-center">
            <h3 className="font-semibold text-yellow-800 mb-2">Geschätztes Gewicht</h3>
            <p className="font-bold text-2xl text-yellow-700">{(totalWeightKg/1000).toFixed(1)} t</p>
            <p className="text-xs mt-1">(Max: {(TRUCK_TYPES[selectedTruck].maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG)/1000} t)</p>
          </div>
          <div className={`${warnStyle.bg} p-4 rounded border ${warnStyle.border}`}>
            <h3 className={`font-semibold mb-2 ${warnStyle.header}`}>Meldungen</h3>
            {warnings.length ? (
              <ul className={`list-disc list-inside text-sm space-y-1 ${warnStyle.list}`}>
                {warnings.map((w,i)=><li key={i}>{w}</li>)}
              </ul>
            ) : <p className={`text-sm ${warnStyle.list}`}>Keine Probleme erkannt.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
