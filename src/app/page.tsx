"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

/* ----------------------------------------------------------------
   TRUCKS & PALLETS  (all dimensions in cm)
----------------------------------------------------------------- */

const TRUCK_TYPES: any = {
  curtainSider: {
    name: "Planensattel Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 245, occupiedRects: [] }],
    usableLength: 1320,
    maxWidth: 245,
    /* sanity targets for capacity */
    singleLayerEUPCapacity3Across: 33,  // preferred EUP (3×80 across, 120 step)
    singleLayerEUPCapacityLongish: 33,  // we support a hybrid long pattern that also reaches 33
    singleLayerDINCapacity: 26,         // DIN: 2×120 across, 100 step
    maxGrossWeightKg: 24000,
  },
  frigo: {
    name: "Frigo (Kühler) Standard (13.2m)",
    units: [{ id: "main", length: 1320, width: 245, occupiedRects: [] }],
    usableLength: 1320,
    maxWidth: 245,
    singleLayerEUPCapacity3Across: 33,
    singleLayerEUPCapacityLongish: 33,
    singleLayerDINCapacity: 26,
    maxGrossWeightKg: 18300,
  },
  smallTruck: {
    name: "Motorwagen (7.2m)",
    units: [{ id: "main", length: 720, width: 245, occupiedRects: [] }],
    usableLength: 720,
    maxWidth: 245,
    singleLayerEUPCapacity3Across: 18,
    singleLayerEUPCapacityLongish: 18,
    singleLayerDINCapacity: 14,
    maxGrossWeightKg: 10000,
  },
  roadTrain: {
    name: "Hängerzug (2x 7,2m)",
    units: [
      { id: "unit1", length: 720, width: 245, occupiedRects: [] },
      { id: "unit2", length: 720, width: 245, occupiedRects: [] },
    ],
    usableLength: 1440,
    maxWidth: 245,
    singleLayerEUPCapacity3AcrossPerUnit: 18,
    singleLayerEUPCapacityLongishPerUnit: 18,
    singleLayerDINCapacityPerUnit: 14,
    maxGrossWeightKg: 24000,
  },
};

const PALLET_TYPES: any = {
  euro: {
    name: "Europalette (120×80)",
    type: "euro",
    length: 120,
    width: 80,
    color: "bg-blue-500",
    borderColor: "border-blue-700",
  },
  din: {
    name: "Industriepalette (120×100)",
    type: "din",
    length: 120,
    width: 100,
    color: "bg-green-500",
    borderColor: "border-green-700",
  },
};

/* ----------------------------------------------------------------
   CONSTANTS
----------------------------------------------------------------- */

const MAX_GROSS_WEIGHT_KG = 24000;
const MAX_PALLET_SIM_QTY = 300;

const MAX_WEIGHT_PER_METER_KG = 1800;
const AXLE_WARN_EUP_STACKED = 18;
const AXLE_WARN_DIN_STACKED = 16;

/* ----------------------------------------------------------------
   DRAW ORDER (enforce: STACKED DIN > STACKED EUP > DIN > EUP)
----------------------------------------------------------------- */

const zIndexFor = (p: any) => {
  const stacked = !!p.showAsFraction;
  if (p.type === "din" && stacked) return p.isStackedTier === "top" ? 401 : 400;
  if (p.type === "euro" && stacked) return p.isStackedTier === "top" ? 301 : 300;
  if (p.type === "din") return 200;
  return 100;
};

const categoryPriority = (p: any) => {
  const s = !!p.showAsFraction;
  if (p.type === "din" && s) return 0;
  if (p.type === "euro" && s) return 1;
  if (p.type === "din") return 2;
  return 3;
};
const withinPair = (p: any) => (p.isStackedTier === "top" ? 1 : 0);

/* ----------------------------------------------------------------
   CORE PLANNER – follows the agreed logic exactly
   - DIN-only: 2×120 across, step 100 along length → 26 unstacked / 52 stacked
   - EUP-only: preferred 3×80 across, step 120 → 33 / 66
               optional "longish": mostly 2×120 across, step 80 + one 3-across row → also 33
   - Mixed: never leave a visible hole.
       Strategy A: DIN-first (true DIN raster 100). If a DIN row would be single,
                   fill the partner slot with a long EUP (120×80) in the same row.
       Strategy B: EUP-first (3 across). DIN appended after, but DIN keep the 100-step
                   and are placed only where two slots fit – if an odd DIN remains, we
                   put it after the EUP block as a single row (its partner slot gets one
                   long EUP immediately so no hole remains).
   - Stacking: input N means "N pallets may be stacked" ⇒ topsBudget = floor(N/2)
   - Visual order enforced by sort + z-index.
----------------------------------------------------------------- */

type EupPattern = "auto" | "broad" | "long";

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

const calc = (
  truckKey: string,
  reqEUP: number,
  reqDIN: number,
  eupStackable: boolean,
  dinStackable: boolean,
  eupWeightStr: string,
  dinWeightStr: string,
  eupPattern: EupPattern,
  // algorithm decides the order that avoids holes while meeting requests best
) => {
  const truck = JSON.parse(JSON.stringify(TRUCK_TYPES[truckKey]));
  const weightLimit = truck.maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG;

  const eupWeight = Math.max(0, parseFloat(eupWeightStr) || 0);
  const dinWeight = Math.max(0, parseFloat(dinWeightStr) || 0);

  // tops budgets: number of tops allowed = floor(limit/2). If unchecked, budget=0.
  const eupLimitStr = ""; // not used here; budgets will be injected by wrappers
  const dinLimitStr = "";

  const baseCtx: PlaceCtx = {
    weightLimit,
    eupWeight,
    dinWeight,
    eupTopsBudget: 0,
    dinTopsBudget: 0,
    totalWeight: 0,
    totalAreaBase: 0,
    eupLabel: 0,
    dinLabel: 0,
    warnings: [],
  };

  const canAdd = (ctx: PlaceCtx, w: number) => ctx.weightLimit <= 0 || ctx.totalWeight + w <= ctx.weightLimit;

  const push = (unit: any, p: any) => {
    unit.palletsVisual.push(p);
    unit.occupiedRects.push({ x: p.x, y: p.y, width: p.width, height: p.height });
  };

  const placeDINRows = (
    units: any[],
    ctx: PlaceCtx,
    dinLeft: number,
    stacked: boolean,
    stepAlong: number, // 100 for real DIN rows
    slotAcross: number // 120 across
  ) => {
    if (dinLeft <= 0) return { units, dinLeft };

    for (const unit of units) {
      if (dinLeft <= 0) break;

      while (unit.currentX + stepAlong <= unit.length && dinLeft > 0) {
        unit.currentY = 0;
        let placedInRow = 0;

        for (let i = 0; i < 2 && dinLeft > 0; i++) {
          if (!canAdd(ctx, ctx.dinWeight)) {
            if (!ctx.warnings.some((w) => w.includes("Gewichtslimit für DIN")))
              ctx.warnings.push(`Gewichtslimit für DIN-Paletten erreicht. Max ${ctx.weightLimit / 1000}t.`);
            unit.currentX = unit.length;
            break;
          }
          if (unit.currentY + slotAcross <= unit.width) {
            const baseId = ++ctx.dinLabel;
            const base = {
              x: unit.currentX,
              y: unit.currentY,
              width: stepAlong,  // along length
              height: slotAcross, // across width
              type: "din",
              isStackedTier: null as any,
              key: `din_base_${unit.id}_${baseId}_${i}`,
              unitId: unit.id,
              labelId: baseId,
              displayBaseLabelId: baseId,
              displayStackedLabelId: null as any,
              showAsFraction: false,
            };
            push(unit, base);
            ctx.totalAreaBase += PALLET_TYPES.din.length * PALLET_TYPES.din.width;
            ctx.totalWeight += ctx.dinWeight;
            dinLeft--;
            placedInRow++;

            // stack on top if allowed (one more DIN consumed)
            if (stacked && dinLeft > 0 && ctx.dinTopsBudget > 0 && canAdd(ctx, ctx.dinWeight)) {
              const topId = ++ctx.dinLabel;
              unit.palletsVisual[unit.palletsVisual.length - 1] = {
                ...base,
                isStackedTier: "base" as const,
                showAsFraction: true,
                displayStackedLabelId: topId,
              };
              push(unit, {
                ...base,
                isStackedTier: "top" as const,
                key: `din_top_${unit.id}_${topId}_${i}`,
                labelId: topId,
                displayBaseLabelId: baseId,
                displayStackedLabelId: topId,
                showAsFraction: true,
              });
              ctx.totalWeight += ctx.dinWeight;
              dinLeft--;
              ctx.dinTopsBudget--;
            }

            unit.currentY += slotAcross;
          }
        }

        if (placedInRow > 0) unit.currentX += stepAlong;
        else break;
      }
    }
    return { units, dinLeft };
  };

  const tryPlaceEUP = (
    units: any[],
    ctx: PlaceCtx,
    eupLeft: number,
    pattern: EupPattern,
    stacked: boolean
  ) => {
    if (eupLeft <= 0) return { units, eupLeft };

    // Two concrete layouts:
    //   - "broad" (preferred): 3 across, step 120 along length
    //   - "long": 2 across, step 80 along length, BUT we may use one 3-across row
    //             (120 along) to reach 33 on 13.2m trailers.
    const useBroad = pattern === "broad" || pattern === "auto";
    const tryOrder = pattern === "auto" ? (["broad", "long"] as EupPattern[]) : [pattern];

    let best = {
      score: -1,
      result: { units: JSON.parse(JSON.stringify(units)), eupLeft, ctxClone: JSON.parse(JSON.stringify(ctx)) },
    };

    for (const variant of tryOrder) {
      let clone = JSON.parse(JSON.stringify(units));
      let local = JSON.parse(JSON.stringify(ctx)) as PlaceCtx;
      let left = eupLeft;

      if (variant === "broad") {
        const palLen = 120; // along length
        const palWid = 80;  // across
        for (const u of clone) {
          if (left <= 0) break;
          while (u.currentX + palLen <= u.length && left > 0) {
            u.currentY = 0;
            let placed = 0;
            for (let i = 0; i < 3 && left > 0; i++) {
              if (!canAdd(local, local.eupWeight)) { u.currentX = u.length; break; }
              if (u.currentY + palWid <= u.width) {
                const baseId = ++local.eupLabel;
                const base = {
                  x: u.currentX, y: u.currentY, width: palLen, height: palWid,
                  type: "euro", isStackedTier: null as any,
                  key: `eup_broad_base_${u.id}_${baseId}_${i}`, unitId: u.id,
                  labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
                };
                push(u, base);
                local.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
                local.totalWeight += local.eupWeight;
                left--; placed++;
                if (stacked && left > 0 && local.eupTopsBudget > 0 && canAdd(local, local.eupWeight)) {
                  const topId = ++local.eupLabel;
                  u.palletsVisual[u.palletsVisual.length - 1] = {
                    ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
                  };
                  push(u, { ...base, isStackedTier: "top" as const, key: `eup_broad_top_${u.id}_${topId}_${i}`,
                    labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true });
                  local.totalWeight += local.eupWeight; left--; local.eupTopsBudget--;
                }
                u.currentY += palWid;
              }
            }
            if (placed > 0) u.currentX += palLen; else break;
          }
        }
      } else {
        // "longish": 2 across (step 80) + optionally one 3-across row (120) if space allows and it improves total
        const step80 = 80, across120 = 120;

        for (const u of clone) {
          if (left <= 0) break;

          // Heuristic: if we have enough length for 15 rows of 80 + 1 row of 120, we insert one 3-across row at the front.
          const canDoHybrid = u.length >= 15 * 80 + 120;

          if (canDoHybrid) {
            // First a 3-across row (120 along)
            if (left > 0) {
              let placed = 0;
              u.currentY = 0;
              for (let i = 0; i < 3 && left > 0; i++) {
                if (!canAdd(local, local.eupWeight)) { u.currentX = u.length; break; }
                if (u.currentY + 80 <= u.width) {
                  const baseId = ++local.eupLabel;
                  const base = {
                    x: u.currentX, y: u.currentY, width: 120, height: 80,
                    type: "euro", isStackedTier: null as any, key: `eup_hybrid120_base_${u.id}_${baseId}_${i}`,
                    unitId: u.id, labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
                  };
                  push(u, base);
                  local.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
                  local.totalWeight += local.eupWeight;
                  left--; placed++;
                  if (stacked && left > 0 && local.eupTopsBudget > 0 && canAdd(local, local.eupWeight)) {
                    const topId = ++local.eupLabel;
                    u.palletsVisual[u.palletsVisual.length - 1] = {
                      ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
                    };
                    push(u, { ...base, isStackedTier: "top" as const, key: `eup_hybrid120_top_${u.id}_${topId}_${i}`,
                      labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true });
                    local.totalWeight += local.eupWeight; left--; local.eupTopsBudget--;
                  }
                  u.currentY += 80;
                }
              }
              if (placed > 0) u.currentX += 120;
            }
          }

          // Then rows of 2 across, step 80 along
          while (u.currentX + step80 <= u.length && left > 0) {
            u.currentY = 0;
            let placed = 0;
            for (let i = 0; i < 2 && left > 0; i++) {
              if (!canAdd(local, local.eupWeight)) { u.currentX = u.length; break; }
              if (u.currentY + across120 <= u.width) {
                const baseId = ++local.eupLabel;
                const base = {
                  x: u.currentX, y: u.currentY, width: step80, height: across120,
                  type: "euro", isStackedTier: null as any, key: `eup_long_base_${u.id}_${baseId}_${i}`,
                  unitId: u.id, labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
                };
                push(u, base);
                local.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
                local.totalWeight += local.eupWeight;
                left--; placed++;
                if (stacked && left > 0 && local.eupTopsBudget > 0 && canAdd(local, local.eupWeight)) {
                  const topId = ++local.eupLabel;
                  u.palletsVisual[u.palletsVisual.length - 1] = {
                    ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
                  };
                  push(u, { ...base, isStackedTier: "top" as const, key: `eup_long_top_${u.id}_${topId}_${i}`,
                    labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true });
                  local.totalWeight += local.eupWeight; left--; local.eupTopsBudget--;
                }
                u.currentY += across120;
              }
            }
            if (placed > 0) u.currentX += step80; else break;
          }
        }
      }

      // score = number placed
      const placed = eupLeft - left;
      if (placed > best.score) {
        best.score = placed;
        best.result = { units: clone, eupLeft: left, ctxClone: local };
      }
    }

    // commit best
    return {
      units: best.result.units,
      eupLeft: best.result.eupLeft,
      ctx: best.result.ctxClone,
    };
  };

  const solveOneOrder = (
    order: "DIN_FIRST" | "EUP_FIRST",
    eupPatternChoice: EupPattern,
    eupLeftInit: number,
    dinLeftInit: number,
    eupTopsBudget: number,
    dinTopsBudget: number
  ) => {
    const ctx: PlaceCtx = { ...baseCtx, eupTopsBudget, dinTopsBudget };
    let eupLeft = eupLeftInit;
    let dinLeft = dinLeftInit;
    const units = truck.units.map((u: any) => ({ ...u, currentX: 0, currentY: 0, palletsVisual: [] as any[] }));

    if (order === "DIN_FIRST") {
      // 1) Stacked DIN (true 100-step) then stacked EUP (fill single-slot with one long EUP), then DIN, then EUP.
      ({ units: undefined, dinLeft } = placeDINRows(units, ctx, dinLeft, true, 100, 120));
      // If last DIN row ended with a single slot free and EUP exist, put one long EUP there (prevents hole)
      if (eupLeft > 0) {
        for (const u of units) {
          if (dinLeftInit > 0) {
            // check last row occupancy: we can infer by currentY; if last placement in a row left y=120, there was 1 DIN
            // Simpler: scan last 100-depth band (x = currentX - 100) for DIN count.
            const xRowStart = Math.max(0, u.currentX - 100);
            const rowPallets = u.palletsVisual.filter((p: any) => p.type === "din" && p.x === xRowStart);
            if (rowPallets.length === 1 && eupLeft > 0) {
              // place one EUP long (80 along, 120 across) into the free slot at y=120
              const baseId = ++ctx.eupLabel;
              const base = {
                x: xRowStart, y: 120, width: 80, height: 120,
                type: "euro", isStackedTier: null as any, key: `eup_fill_${u.id}_${baseId}`,
                unitId: u.id, labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
              };
              push(u, base);
              ctx.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
              ctx.totalWeight += ctx.eupWeight;
              eupLeft--;
              if (eupStackable && ctx.eupTopsBudget > 0 && eupLeft > 0 && canAdd(ctx, ctx.eupWeight)) {
                const topId = ++ctx.eupLabel;
                u.palletsVisual[u.palletsVisual.length - 1] = {
                  ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
                };
                push(u, { ...base, isStackedTier: "top" as const, key: `eup_fill_top_${u.id}_${topId}`,
                  labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true });
                ctx.totalWeight += ctx.eupWeight; eupLeft--; ctx.eupTopsBudget--;
              }
            }
          }
        }
      }

      // 2) Stacked EUP in chosen pattern
      if (eupLeft > 0) {
        const placed = tryPlaceEUP(units, ctx, eupLeft, eupPatternChoice, true);
        eupLeft = placed.eupLeft;
        Object.assign(ctx, placed.ctx);
      }
      // 3) Remaining DIN (true DIN rows)
      ({ units: undefined, dinLeft } = placeDINRows(units, ctx, dinLeft, false, 100, 120));
      // 4) Remaining EUP
      if (eupLeft > 0) {
        const placed2 = tryPlaceEUP(units, ctx, eupLeft, eupPatternChoice, false);
        eupLeft = placed2.eupLeft;
        Object.assign(ctx, placed2.ctx);
      }

      return { units, ctx, eupLeft, dinLeft };
    } else {
      // EUP_FIRST
      if (eupLeft > 0) {
        const placed = tryPlaceEUP(units, ctx, eupLeft, eupPatternChoice, true);
        eupLeft = placed.eupLeft;
        Object.assign(ctx, placed.ctx);
      }
      ({ units: undefined, dinLeft } = placeDINRows(units, ctx, dinLeft, true, 100, 120));
      if (eupLeft > 0) {
        const placed2 = tryPlaceEUP(units, ctx, eupLeft, eupPatternChoice, false);
        eupLeft = placed2.eupLeft;
        Object.assign(ctx, placed2.ctx);
      }
      ({ units: undefined, dinLeft } = placeDINRows(units, ctx, dinLeft, false, 100, 120));

      // If a last DIN row ended single and we still have EUP left (rare), drop one long EUP into that row
      if (eupLeft > 0) {
        for (const u of units) {
          const xRowStart = Math.max(0, u.currentX - 100);
          const rowPallets = u.palletsVisual.filter((p: any) => p.type === "din" && p.x === xRowStart);
          if (rowPallets.length === 1 && eupLeft > 0) {
            const baseId = ++ctx.eupLabel;
            const base = {
              x: xRowStart, y: 120, width: 80, height: 120,
              type: "euro", isStackedTier: null as any, key: `eup_fill2_${u.id}_${baseId}`,
              unitId: u.id, labelId: baseId, displayBaseLabelId: baseId, displayStackedLabelId: null as any, showAsFraction: false
            };
            push(u, base);
            ctx.totalAreaBase += PALLET_TYPES.euro.length * PALLET_TYPES.euro.width;
            ctx.totalWeight += ctx.eupWeight;
            eupLeft--;
            if (eupStackable && ctx.eupTopsBudget > 0 && eupLeft > 0 && canAdd(ctx, ctx.eupWeight)) {
              const topId = ++ctx.eupLabel;
              u.palletsVisual[u.palletsVisual.length - 1] = {
                ...base, isStackedTier: "base" as const, showAsFraction: true, displayStackedLabelId: topId
              };
              push(u, { ...base, isStackedTier: "top" as const, key: `eup_fill2_top_${u.id}_${topId}`,
                labelId: topId, displayBaseLabelId: baseId, displayStackedLabelId: topId, showAsFraction: true });
              ctx.totalWeight += ctx.eupWeight; eupLeft--; ctx.eupTopsBudget--;
            }
          }
        }
      }

      return { units, ctx, eupLeft, dinLeft };
    }
  };

  // wrapper tries both orders and picks the one that
  // (a) places all requested counts if possible, else (b) places more pallets,
  // and (c) avoids holes by the above micro-fill.
  return (
    eupTopsBudget: number,
    dinTopsBudget: number,
    eupStackableFlag: boolean,
    dinStackableFlag: boolean,
    eupPatternChoice: EupPattern
  ) => {
    const a = solveOneOrder("DIN_FIRST", eupPatternChoice, reqEUP, reqDIN, eupStackableFlag ? eupTopsBudget : 0, dinStackableFlag ? dinTopsBudget : 0);
    const b = solveOneOrder("EUP_FIRST", eupPatternChoice, reqEUP, reqDIN, eupStackableFlag ? eupTopsBudget : 0, dinStackableFlag ? dinTopsBudget : 0);

    const score = (r: any) => {
      const pallets = r.units.flatMap((u: any) => u.palletsVisual);
      return pallets.length;
    };

    // Prefer a solution that satisfies requests fully
    const needA =
      (reqEUP === 0 || b.eupLeft > 0) && (reqDIN === 0 || b.dinLeft > 0)
        ? true
        : (reqEUP === 0 || a.eupLeft === 0) && (reqDIN === 0 || a.dinLeft === 0);

    const pick =
      (a.eupLeft === 0 && a.dinLeft === 0 && !(b.eupLeft === 0 && b.dinLeft === 0))
        ? a
        : (b.eupLeft === 0 && b.dinLeft === 0 && !(a.eupLeft === 0 && a.dinLeft === 0))
        ? b
        : score(b) > score(a)
        ? b
        : a;

    // finalize sorting (draw order)
    for (const u of pick.units) {
      u.palletsVisual.sort((x: any, y: any) => {
        const cx = categoryPriority(x), cy = categoryPriority(y);
        if (cx !== cy) return cx - cy;
        return withinPair(x) - withinPair(y);
      });
    }

    const pallets = pick.units.flatMap((u: any) => u.palletsVisual);
    const euroBase = pallets.filter((p) => p.type === "euro" && !p.showAsFraction).length;
    const dinBase  = pallets.filter((p) => p.type === "din"  && !p.showAsFraction).length;
    const totalEuro = pallets.filter((p) => p.type === "euro").length;
    const totalDin  = pallets.filter((p) => p.type === "din").length;

    // axle-ish warnings
    const usedArea = pick.ctx.totalAreaBase;
    const totalArea = truck.usableLength * truck.maxWidth;
    const utilization = totalArea ? Math.round((usedArea / totalArea) * 1000) / 10 : 0;

    const usedLength = truck.maxWidth ? usedArea / truck.maxWidth : 0;
    const weightPerMeter = usedLength > 0 ? pick.ctx.totalWeight / (usedLength / 100) : 0;
    if (weightPerMeter >= MAX_WEIGHT_PER_METER_KG)
      pick.ctx.warnings.push(`ACHTUNG – mögliche Achslastüberschreitung: ${weightPerMeter.toFixed(1)} kg/m`);

    const stackedEup = totalEuro - euroBase;
    const stackedDin = totalDin - dinBase;
    if (stackedEup >= AXLE_WARN_EUP_STACKED)
      pick.ctx.warnings.push(`ACHTUNG - ACHSLAST bei EUP im AUGE BEHALTEN! (${stackedEup} gestapelte EUP)`);
    if (stackedDin >= AXLE_WARN_DIN_STACKED)
      pick.ctx.warnings.push(`ACHTUNG - ACHSLAST bei DIN im AUGE BEHALTEN! (${stackedDin} gestapelte DIN)`);

    // uniq warnings
    pick.ctx.warnings = Array.from(new Set(pick.ctx.warnings));

    return {
      palletArrangement: pick.units.map((u: any) => ({
        unitId: u.id, unitLength: u.length, unitWidth: u.width, pallets: u.palletsVisual,
      })),
      loadedIndustrialPalletsBase: dinBase,
      loadedEuroPalletsBase: euroBase,
      totalDinPalletsVisual: totalDin,
      totalEuroPalletsVisual: totalEuro,
      utilizationPercentage: utilization,
      warnings: pick.ctx.warnings,
      totalWeightKg: pick.ctx.totalWeight,
      eupLoadingPatternUsed: eupPatternChoice,
    };
  }
  );
};

/* ----------------------------------------------------------------
   PAGE
----------------------------------------------------------------- */

export default function Page() {
  const [selectedTruck, setSelectedTruck] = useState("curtainSider");

  const [eupQty, setEupQty] = useState(0);
  const [dinQty, setDinQty] = useState(0);

  const [eupPattern, setEupPattern] = useState<EupPattern>("auto"); // preferred 3-across, longish on request
  const [eupStackable, setEupStackable] = useState(false);
  const [dinStackable, setDinStackable] = useState(false);

  // keep as strings to avoid leading zeroes
  const [eupStackLimitInput, setEupStackLimitInput] = useState("");
  const [dinStackLimitInput, setDinStackLimitInput] = useState("");

  const eupStackLimit = useMemo(() => Math.max(0, parseInt(eupStackLimitInput, 10) || 0), [eupStackLimitInput]);
  const dinStackLimit = useMemo(() => Math.max(0, parseInt(dinStackLimitInput, 10) || 0), [dinStackLimitInput]);

  const [eupWeight, setEupWeight] = useState("");
  const [dinWeight, setDinWeight] = useState("");

  const [loadedEuroBase, setLoadedEuroBase] = useState(0);
  const [loadedDinBase, setLoadedDinBase] = useState(0);
  const [totalEuroVisual, setTotalEuroVisual] = useState(0);
  const [totalDinVisual, setTotalDinVisual] = useState(0);
  const [utilization, setUtilization] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [palletArrangement, setPalletArrangement] = useState<any[]>([]);
  const [totalWeightKg, setTotalWeightKg] = useState(0);
  const [actualPattern, setActualPattern] = useState<EupPattern>("auto");

  const { toast } = useToast();

  const recompute = useCallback(() => {
    // tops budgets derived here (input N pallets -> floor(N/2) tops)
    const eupTopsBudget = eupStackable ? (eupStackLimit > 0 ? Math.floor(eupStackLimit / 2) : Number.POSITIVE_INFINITY) : 0;
    const dinTopsBudget = dinStackable ? (dinStackLimit > 0 ? Math.floor(dinStackLimit / 2) : Number.POSITIVE_INFINITY) : 0;

    const run = calc(
      selectedTruck,
      eupQty,
      dinQty,
      eupStackable,
      dinStackable,
      eupWeight,
      dinWeight,
      eupPattern
    );

    const res = run(eupTopsBudget, dinTopsBudget, eupStackable, dinStackable, eupPattern);

    setPalletArrangement(res.palletArrangement);
    setLoadedDinBase(res.loadedIndustrialPalletsBase);
    setLoadedEuroBase(res.loadedEuroPalletsBase);
    setTotalDinVisual(res.totalDinPalletsVisual);
    setTotalEuroVisual(res.totalEuroPalletsVisual);
    setUtilization(res.utilizationPercentage);
    setWarnings(res.warnings);
    setTotalWeightKg(res.totalWeightKg);
    setActualPattern(res.eupLoadingPatternUsed);
  }, [
    selectedTruck, eupQty, dinQty, eupStackable, dinStackable,
    eupWeight, dinWeight, eupPattern, eupStackLimit, dinStackLimit
  ]);

  useEffect(() => { recompute(); }, [recompute]);

  /* ---------------- UI handlers ---------------- */

  const handleQuantityChange = (type: "eup" | "din", delta: number) => {
    if (type === "eup") setEupQty((p) => Math.max(0, (parseInt(String(p), 10) || 0) + delta));
    else setDinQty((p) => Math.max(0, (parseInt(String(p), 10) || 0) + delta));
  };

  const handleReset = () => {
    setEupQty(0);
    setDinQty(0);
    setEupWeight("");
    setDinWeight("");
    setEupStackable(false);
    setDinStackable(false);
    setEupStackLimitInput("");
    setDinStackLimitInput("");
    setEupPattern("auto");
  };

  const handleMax = (type: "euro" | "din") => {
    // fast helper that simulates unlimited quantity for the chosen type
    const maxRes = calc(
      selectedTruck,
      type === "euro" ? MAX_PALLET_SIM_QTY : 0,
      type === "din" ? MAX_PALLET_SIM_QTY : 0,
      eupStackable,
      dinStackable,
      eupWeight,
      dinWeight,
      type === "euro" ? "auto" : eupPattern
    )(
      eupStackable ? (eupStackLimit > 0 ? Math.floor(eupStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
      dinStackable ? (dinStackLimit > 0 ? Math.floor(dinStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
      eupStackable,
      dinStackable,
      type === "euro" ? "auto" : eupPattern
    );

    if (type === "euro") {
      setEupQty(maxRes.totalEuroPalletsVisual);
      setDinQty(0);
    } else {
      setDinQty(maxRes.totalDinPalletsVisual);
      setEupQty(0);
    }
  };

  const handleFillRestEUP = () => {
    const res = calc(
      selectedTruck,
      MAX_PALLET_SIM_QTY,
      dinQty,
      eupStackable,
      dinStackable,
      eupWeight,
      dinWeight,
      "auto"
    )(
      eupStackable ? (eupStackLimit > 0 ? Math.floor(eupStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
      dinStackable ? (dinStackLimit > 0 ? Math.floor(dinStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
      eupStackable,
      dinStackable,
      "auto"
    );
    setEupQty(res.totalEuroPalletsVisual);
    setDinQty(res.totalDinPalletsVisual);
  };

  const handleFillRestDIN = () => {
    const res = calc(
      selectedTruck,
      eupQty,
      MAX_PALLET_SIM_QTY,
      eupStackable,
      dinStackable,
      eupWeight,
      dinWeight,
      "auto"
    )(
      eupStackable ? (eupStackLimit > 0 ? Math.floor(eupStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
      dinStackable ? (dinStackLimit > 0 ? Math.floor(dinStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
      eupStackable,
      dinStackable,
      "auto"
    );
    setEupQty(res.totalEuroPalletsVisual);
    setDinQty(res.totalDinPalletsVisual);
  };

  const suggestFeasibleLoad = () => {
    // start from current numbers and walk down DIN then EUP to find a feasible combo
    for (let d = dinQty; d >= 0; d--) {
      for (let e = eupQty; e >= 0; e--) {
        const res = calc(
          selectedTruck, e, d, eupStackable, dinStackable, eupWeight, dinWeight, eupPattern
        )(
          eupStackable ? (eupStackLimit > 0 ? Math.floor(eupStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
          dinStackable ? (dinStackLimit > 0 ? Math.floor(dinStackLimit / 2) : Number.POSITIVE_INFINITY) : 0,
          eupStackable, dinStackable, eupPattern
        );
        const blocks = res.warnings.some((w: string) => w.toLowerCase().includes("gewicht"));
        if (!blocks && res.totalEuroPalletsVisual >= e && res.totalDinPalletsVisual >= d) {
          setEupQty(e); setDinQty(d);
          toast({ title: "Vorschlag übernommen", description: `${d} DIN / ${e} EUP` });
          return;
        }
      }
    }
    toast({ title: "Hinweis", description: "Keine perfekte Kombination gefunden, bitte manuell anpassen." });
  };

  /* ---------------- rendering ---------------- */

  const renderPallet = (p: any, scale = 0.3) => {
    const def = PALLET_TYPES[p.type];
    if (!def) return null;

    // canvas is portrait (length vertical)
    const w = p.height * scale;
    const h = p.width * scale;
    const x = p.y * scale;
    const y = p.x * scale;

    const label = p.showAsFraction && p.displayStackedLabelId
      ? `${p.displayBaseLabelId}/${p.displayStackedLabelId}`
      : `${p.labelId}`;

    return (
      <div
        key={p.key}
        className={`absolute ${def.color} ${def.borderColor} border rounded-sm shadow-sm flex items-center justify-center`}
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${w}px`,
          height: `${h}px`,
          opacity: p.isStackedTier === "top" ? 0.7 : 1,
          zIndex: zIndexFor(p),
          fontSize: "10px",
        }}
        title={`${def.name} ${label}`}
      >
        <span className="text-black font-semibold select-none">{label}</span>
        {p.isStackedTier === "top" && (
          <div className="absolute inset-0 border-t-2 border-l-2 border-black opacity-30 rounded-sm pointer-events-none" />
        )}
      </div>
    );
  };

  const truckScale = 0.3;

  const QuickPick = ({ onPick }: { onPick: (v: number | "") => void }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {[2, 4, 6, 8, 10].map((v) => (
        <button key={v} onClick={() => onPick(v)} className="px-2 py-[3px] text-xs border rounded-md hover:bg-slate-100">
          {v}
        </button>
      ))}
      <button onClick={() => onPick("")} className="px-2 py-[3px] text-xs border rounded-md hover:bg-slate-100">Alle</button>
    </div>
  );

  const warningsStyle =
    warnings.length === 0
      ? { bg: "bg-green-50", border: "border-green-200", header: "text-green-800", list: "text-green-700" }
      : warnings.every((w) => w.toLowerCase().includes("achslast"))
      ? { bg: "bg-yellow-50", border: "border-yellow-200", header: "text-yellow-800", list: "text-yellow-700" }
      : { bg: "bg-red-50", border: "border-red-200", header: "text-red-800", list: "text-red-700" };

  return (
    <div className="container mx-auto p-4 font-sans bg-gray-50">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 rounded-t-lg shadow-lg mb-6">
        <h1 className="text-3xl font-bold text-center tracking-tight">Laderaumrechner</h1>
        <p className="text-center text-sm opacity-90">Visualisierung der Palettenplatzierung (Europäische Standards)</p>
      </header>

      <main className="p-6 bg-white shadow-lg rounded-b-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left controls */}
          <div className="lg:col-span-1 space-y-6 bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LKW-Typ:</label>
              <select
                value={selectedTruck}
                onChange={(e) => setSelectedTruck(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none"
              >
                {Object.keys(TRUCK_TYPES).map((k) => (
                  <option key={k} value={k}>{TRUCK_TYPES[k].name}</option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button onClick={handleReset} className="w-full py-2 px-4 bg-[#00906c] text-white font-semibold rounded-md shadow-sm hover:bg-[#007e5e]">
                Alles zurücksetzen
              </button>
            </div>

            <div>
              <button onClick={suggestFeasibleLoad} className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700">
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
                  value={dinQty}
                  onChange={(e) => setDinQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none"
                />
                <button onClick={() => handleQuantityChange("din", 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>

              <button onClick={() => handleMax("din")} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e]">
                Max. DIN
              </button>
              <button onClick={handleFillRestDIN} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49]">
                Rest mit max. DIN füllen
              </button>

              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/DIN (kg):</label>
                <input
                  type="number"
                  min={0}
                  value={dinWeight}
                  onChange={(e) => setDinWeight(e.target.value)}
                  placeholder="z.B. 500"
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-xs"
                />
              </div>

              <div className="flex items-center mt-2">
                <input type="checkbox" id="dinStack" checked={dinStackable} onChange={(e) => setDinStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                <label htmlFor="dinStack" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {dinStackable && (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={dinStackLimitInput}
                    onChange={(e) => setDinStackLimitInput(e.target.value.replace(/\D+/g, ""))}
                    className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-xs"
                    placeholder="Stapelbare Paletten gesamt (0 = alle)"
                  />
                  <QuickPick onPick={(v) => setDinStackLimitInput(v === "" ? "" : String(v))} />
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
                  value={eupQty}
                  onChange={(e) => setEupQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center py-1.5 border-t border-b border-gray-300 focus:outline-none"
                />
                <button onClick={() => handleQuantityChange("eup", 1)} className="px-3 py-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600">+</button>
              </div>

              <button onClick={() => handleMax("euro")} className="mt-2 w-full py-1.5 px-3 bg-gradient-to-b from-[#00b382] to-[#00906c] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#00906c] hover:to-[#007e5e]">
                Max. EUP
              </button>
              <button onClick={handleFillRestEUP} className="mt-1 w-full py-1.5 px-3 bg-gradient-to-b from-[#008c6b] to-[#006951] text-white text-xs font-medium rounded-md shadow-sm hover:from-[#007e5e] hover:to-[#005f49]">
                Rest mit max. EUP füllen
              </button>

              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600">Gewicht/EUP (kg):</label>
                <input
                  type="number"
                  min={0}
                  value={eupWeight}
                  onChange={(e) => setEupWeight(e.target.value)}
                  placeholder="z.B. 400"
                  className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-xs"
                />
              </div>

              <div className="flex items-center mt-2">
                <input type="checkbox" id="eupStack" checked={eupStackable} onChange={(e) => setEupStackable(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                <label htmlFor="eupStack" className="ml-2 text-sm text-gray-900">Stapelbar (2-fach)</label>
              </div>
              {eupStackable && (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={eupStackLimitInput}
                    onChange={(e) => setEupStackLimitInput(e.target.value.replace(/\D+/g, ""))}
                    className="mt-1 block w-full py-1 px-2 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-xs"
                    placeholder="Stapelbare Paletten gesamt (0 = alle)"
                  />
                  <QuickPick onPick={(v) => setEupStackLimitInput(v === "" ? "" : String(v))} />
                </>
              )}

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  EUP Lade-Pattern:
                  <span className="text-xs text-gray-500">
                    {" "}
                    (Gewählt: {actualPattern})
                  </span>
                </label>
                <div className="flex flex-col space-y-1">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="eupPattern"
                      value="auto"
                      checked={eupPattern === "auto"}
                      onChange={(e) => setEupPattern(e.target.value as EupPattern)}
                      className="h-4 w-4 text-indigo-600"
                    />
                    <span className="ml-2 text-sm">Auto (3 nebeneinander bevorzugt)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="eupPattern"
                      value="broad"
                      checked={eupPattern === "broad"}
                      onChange={(e) => setEupPattern(e.target.value as EupPattern)}
                      className="h-4 w-4 text-indigo-600"
                    />
                    <span className="ml-2 text-sm">Quer – 3 nebeneinander</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="eupPattern"
                      value="long"
                      checked={eupPattern === "long"}
                      onChange={(e) => setEupPattern(e.target.value as EupPattern)}
                      className="h-4 w-4 text-indigo-600"
                    />
                    <span className="ml-2 text-sm">Längsverladung – 120+120 (hybrid, auch 33)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right visualization */}
          <div className="lg:col-span-2 bg-gray-100 p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center">
            <p className="text-gray-700 text-lg mb-3 font-semibold">Ladefläche Visualisierung</p>
            {palletArrangement.map((unit: any, index: number) => (
              <div key={unit.unitId} className="mb-4 w-full flex flex-col items-center">
                {TRUCK_TYPES[selectedTruck].units.length > 1 && (
                  <p className="text-sm text-gray-700 mb-1">
                    Einheit {index + 1} ({unit.unitLength / 100} m × {unit.unitWidth / 100} m)
                  </p>
                )}
                <div
                  className="relative bg-gray-300 border-2 border-gray-500 overflow-hidden rounded-md shadow-inner"
                  style={{
                    width: `${unit.unitWidth * truckScale}px`,
                    height: `${unit.unitLength * truckScale}px`,
                  }}
                >
                  {unit.pallets.map((p: any) => renderPallet(p, truckScale))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm text-center">
            <h3 className="font-semibold text-blue-800 mb-2">Geladene Paletten (visuell)</h3>
            <p>Industrie (DIN): <span className="font-bold text-lg">{totalDinVisual}</span></p>
            <p>Euro (EUP): <span className="font-bold text-lg">{totalEuroVisual}</span></p>
            <p className="text-xs mt-1">(Basis: {loadedDinBase} DIN, {loadedEuroBase} EUP)</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm text-center">
            <h3 className="font-semibold text-green-800 mb-2">Flächenausnutzung</h3>
            <p className="font-bold text-3xl text-green-700">{utilization}%</p>
            <p className="text-xs mt-1">(Grundfläche)</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm text-center">
            <h3 className="font-semibold text-yellow-800 mb-2">Geschätztes Gewicht</h3>
            <p className="font-bold text-2xl text-yellow-700">{(totalWeightKg / 1000).toFixed(1)} t</p>
            <p className="text-xs mt-1">(Max: {(TRUCK_TYPES[selectedTruck].maxGrossWeightKg ?? MAX_GROSS_WEIGHT_KG) / 1000} t)</p>
          </div>
          <div className={`${warningsStyle.bg} p-4 rounded-lg border ${warningsStyle.border} shadow-sm`}>
            <h3 className={`font-semibold mb-2 ${warningsStyle.header}`}>Meldungen</h3>
            {warnings.length > 0 ? (
              <ul className={`list-disc list-inside text-sm space-y-1 ${warningsStyle.list}`}>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            ) : (
              <p className={`text-sm ${warningsStyle.list}`}>Keine Probleme erkannt.</p>
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
