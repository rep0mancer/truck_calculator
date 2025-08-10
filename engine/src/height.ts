import { PlanResult, TruckPreset } from './types';

function getSideDoorHeight(preset: TruckPreset): number {
  const v = preset.sideDoorHeight;
  const n = typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  return n ?? 2650;
}

function getPlacementTop(placement: any): number {
  const z = typeof placement.z === 'number' ? placement.z : 0;
  const height = typeof placement.stackHeightMm === 'number' ? placement.stackHeightMm : 0;
  return z + height;
}

export function applyHeightChecks(plan: PlanResult, preset: TruckPreset): PlanResult {
  const sideDoorHeight = getSideDoorHeight(preset);
  const innerHeight = preset.innerHeight ?? preset.heightMm ?? 0;

  const warnings: string[] = [...(plan.warnings ?? [])];
  const notes: string[] = [...(plan.notes ?? [])];
  const rejected = [...(plan.rejected ?? [])];

  const placements = plan.placements ?? [];

  // Track max top per (x,y) anchor for warnings, while rejecting per offending placement
  type MaxEntry = { top: number; x: number; y: number; idx?: number };
  const byXY = new Map<string, MaxEntry>();

  for (const p of placements as any[]) {
    const top = getPlacementTop(p);
    const key = `${p.x},${p.y}`;
    const prev = byXY.get(key);
    if (!prev || top > prev.top) {
      byXY.set(key, { top, x: p.x, y: p.y, idx: p.idx });
    }

    if (innerHeight && top > innerHeight) {
      const units = Array.isArray(p.units) ? p.units : [];
      if (units.length > 0) {
        for (const u of units) rejected.push({ item: u as any, reason: 'overheight' });
      } else {
        rejected.push({
          item: { family: 'EUP', qty: 1, id: `overheight@${p.x},${p.y}` } as any,
          reason: 'overheight',
        });
      }
    }
  }

  for (const entry of byXY.values()) {
    if (entry.top > sideDoorHeight) {
      warnings.push(
        `Side-door height risk at approx x=${entry.x}mm, y=${entry.y}mm: ${Math.round(entry.top)}mm exceeds ${sideDoorHeight}mm.`
      );
    }
  }

  return {
    ...plan,
    warnings,
    notes,
    rejected,
  };
}