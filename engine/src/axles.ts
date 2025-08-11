import { PlanResult, TruckPreset, AxleOptions } from './types';

export interface AxleReport {
  R_front: number; // kingpin proxy
  R_rear: number;  // trailer axle group
  maxKgPerM: number;
  warnings: string[];
}

function getPlacementCentroidY(p: { y: number; h: number }): number {
  const y = typeof p.y === 'number' ? p.y : 0;
  const h = typeof p.h === 'number' ? p.h : 0;
  return y + h / 2;
}

function sumPlacementWeightKg(p: Placement): number {
  // If units with weights are present, sum them; else 0 and let caller add perSlotWeightKg
  const units = p.units ?? [];
  let total = 0;
  for (const u of units) {
    const w = (u as typeof u & { weightKg?: number }).weightKg;
    if (typeof w === 'number' && Number.isFinite(w)) total += w;
  }
  return total;
}

export function checkAxles(plan: PlanResult, _preset: TruckPreset, opts: AxleOptions): AxleReport {
  const placements = Array.isArray(plan.placements) ? plan.placements : [];
  const perSlotWeightKg = Math.max(0, Math.floor(opts.perSlotWeightKg ?? 0));

  // A) Linear kg/m triage
  const binSizeMm = Math.max(1, Math.floor(opts.binSizeMm ?? 1000));
  const binToKg = new Map<number, number>();
  let totalWeightKg = 0;

  for (const p of placements) {
    const centroid = getPlacementCentroidY(p as any);
    const bin = Math.floor(centroid / binSizeMm);

    const unitSum = sumPlacementWeightKg(p as any);
    const w = unitSum > 0 ? unitSum : perSlotWeightKg;

    totalWeightKg += w;
    binToKg.set(bin, (binToKg.get(bin) ?? 0) + w);
  }

  let maxBinKg = 0;
  for (const kg of binToKg.values()) {
    if (kg > maxBinKg) maxBinKg = kg;
  }
  const maxKgPerM = (maxBinKg * 1000) / binSizeMm;

  const warnings: string[] = [];
  if (opts.maxKgPerM != null && maxKgPerM > opts.maxKgPerM) {
    warnings.push(`Peak linear density ${Math.round(maxKgPerM)} kg/m exceeds threshold ${opts.maxKgPerM} kg/m.`);
  }

  // B) Two-support beam
  const supportFrontX = Math.max(0, Math.floor(opts.supportFrontX));
  const supportRearX = Math.max(supportFrontX + 1, Math.floor(opts.supportRearX));
  const L = supportRearX - supportFrontX;

  let R_front = 0;
  let R_rear = 0;

  for (const p of placements) {
    const x = getPlacementCentroidY(p as any);
    const xi = Math.max(supportFrontX, Math.min(supportRearX, x));

    const unitSum = sumPlacementWeightKg(p as any);
    const w = unitSum > 0 ? unitSum : perSlotWeightKg;

    const a = (supportRearX - xi) / L; // fraction to front support
    const b = (xi - supportFrontX) / L; // fraction to rear support

    R_front += w * a;
    R_rear += w * b;
  }

  // Limits
  if (opts.rearAxleGroupMaxKg != null && R_rear > opts.rearAxleGroupMaxKg) {
    warnings.push(`Rear axle group load ${Math.round(R_rear)} kg exceeds ${opts.rearAxleGroupMaxKg} kg.`);
  }
  if (opts.kingpinMinKg != null && R_front < opts.kingpinMinKg) {
    warnings.push(`Front support (kingpin) load ${Math.round(R_front)} kg below minimum ${opts.kingpinMinKg} kg.`);
  }
  if (opts.kingpinMaxKg != null && R_front > opts.kingpinMaxKg) {
    warnings.push(`Front support (kingpin) load ${Math.round(R_front)} kg exceeds ${opts.kingpinMaxKg} kg.`);
  }
  if (opts.payloadMaxKg != null && totalWeightKg > opts.payloadMaxKg) {
    warnings.push(`Total payload ${Math.round(totalWeightKg)} kg exceeds ${opts.payloadMaxKg} kg.`);
  }

  return {
    R_front: Math.round(R_front),
    R_rear: Math.round(R_rear),
    maxKgPerM: Math.round(maxKgPerM),
    warnings,
  };
}