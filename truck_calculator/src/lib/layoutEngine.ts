import { ContainerPreset, PalletPreset, Constraints, Units, Plan, Placement } from '../types';

interface OrientationResult {
  cols: number;
  rows: number;
  count: number;
  placements: Placement[];
}

function clampNonNegative(value: number): number {
  return Math.max(0, value);
}

function computeGrid(
  container: ContainerPreset,
  palletLength: number,
  palletWidth: number,
  constraints: Constraints,
  rotated: boolean
): OrientationResult {
  const wall = Math.max(0, constraints.wallClearance);
  const between = Math.max(0, constraints.betweenClearance);
  const aisleReserve = Math.max(0, constraints.aisleLengthReserve || 0);

  const effectiveLength = container.innerLength - 2 * wall - aisleReserve;
  const effectiveWidth = container.innerWidth - 2 * wall;

  const cols = Math.floor((effectiveLength + between) / (palletLength + between));
  const rows = Math.floor((effectiveWidth + between) / (palletWidth + between));

  const safeCols = clampNonNegative(cols);
  const safeRows = clampNonNegative(rows);
  const count = safeCols * safeRows;

  const placements: Placement[] = [];
  let idx = 1;
  const startX = wall;
  const startY = wall;
  for (let r = 0; r < safeRows; r++) {
    for (let c = 0; c < safeCols; c++) {
      const x = startX + c * (palletLength + between);
      const y = startY + r * (palletWidth + between);
      placements.push({
        x,
        y,
        w: palletLength,
        h: palletWidth,
        rotated,
        idx: idx++,
      });
    }
  }

  return { cols: safeCols, rows: safeRows, count, placements };
}

function computeMixed(
  container: ContainerPreset,
  pallet: PalletPreset,
  constraints: Constraints
): OrientationResult {
  // Fill with orientation A grid, then try to add one rotated row (orientation B) in leftover width
  const wall = Math.max(0, constraints.wallClearance);
  const between = Math.max(0, constraints.betweenClearance);
  const aisleReserve = Math.max(0, constraints.aisleLengthReserve || 0);

  const effectiveLength = container.innerLength - 2 * wall - aisleReserve;
  const effectiveWidth = container.innerWidth - 2 * wall;

  // Orientation A: pallet as-is (length along length)
  const A = computeGrid(container, pallet.length, pallet.width, constraints, false);

  // Determine if we can add a rotated row in leftover width
  const occupiedWidthA = A.rows > 0 ? A.rows * pallet.width + (A.rows - 1) * between : 0;
  const leftoverWidth = effectiveWidth - occupiedWidthA;
  const rotatedRowRequires = pallet.length + (A.rows > 0 ? between : 0);
  const canAddRotatedRow = leftoverWidth >= rotatedRowRequires && effectiveLength > 0;

  let placements: Placement[] = [...A.placements];
  let extraCols = 0;

  if (canAddRotatedRow) {
    const colsRotated = Math.floor((effectiveLength + between) / (pallet.width + between));
    const safeColsRotated = clampNonNegative(colsRotated);
    extraCols = safeColsRotated;

    const startX = wall;
    const yRotated = wall + (A.rows * pallet.width) + (A.rows > 0 ? A.rows * between : 0);

    let idx = A.count + 1;
    for (let c = 0; c < safeColsRotated; c++) {
      const x = startX + c * (pallet.width + between);
      placements.push({
        x,
        y: yRotated,
        w: pallet.width,
        h: pallet.length,
        rotated: true,
        idx: idx++,
      });
    }
  }

  return { cols: A.cols, rows: A.rows + (canAddRotatedRow ? 1 : 0), count: A.count + extraCols, placements };
}

function computeMetrics(plan: Omit<Plan, 'metrics' | 'placements'> & { placements: Placement[] }): Plan['metrics'] {
  const { container, pallet, placements } = plan;
  const count = placements.length;
  const containerArea = container.innerLength * container.innerWidth;
  const palletArea = pallet.length * pallet.width;
  const floorAreaUsedRatio = containerArea > 0 ? (count * palletArea) / containerArea : 0;

  let volumeUsedRatio: number | undefined = undefined;
  if (container.innerHeight != null && pallet.height != null) {
    const containerVolume = containerArea * container.innerHeight;
    const palletsVolume = count * palletArea * pallet.height;
    volumeUsedRatio = containerVolume > 0 ? palletsVolume / containerVolume : 0;
  }

  const totalPalletWeightKg = count * (pallet.weightKg || 0);
  const maxPayload = container.maxPayloadKg ?? Infinity;
  const maxPayloadExceeded = totalPalletWeightKg > maxPayload;

  return {
    count,
    floorAreaUsedRatio,
    volumeUsedRatio,
    totalPalletWeightKg,
    maxPayloadExceeded,
  };
}

export function computePlan(params: {
  container: ContainerPreset;
  pallet: PalletPreset;
  constraints: Constraints;
  units?: Units;
  note?: string;
}): Plan {
  const { container, pallet, constraints } = params;
  const units: Units = params.units ?? 'metric';

  const wall = Math.max(0, constraints.wallClearance);
  const aisleReserve = Math.max(0, constraints.aisleLengthReserve || 0);

  // Early warning: if effective dims are too small, result will be zero placements
  const effectiveLength = container.innerLength - 2 * wall - aisleReserve;
  const effectiveWidth = container.innerWidth - 2 * wall;

  const canFitAny = effectiveLength >= Math.min(pallet.length, pallet.width) && effectiveWidth >= Math.min(pallet.length, pallet.width);

  const orientationA = computeGrid(container, pallet.length, pallet.width, constraints, false);

  let orientationB: OrientationResult = { cols: 0, rows: 0, count: 0, placements: [] };
  if (constraints.allowRotate) {
    orientationB = computeGrid(container, pallet.width, pallet.length, constraints, true);
  }

  let mixed: OrientationResult = { cols: 0, rows: 0, count: 0, placements: [] };
  if (constraints.allowRotate) {
    mixed = computeMixed(container, pallet, constraints);
  }

  const candidates: OrientationResult[] = [orientationA, orientationB, mixed];

  // Choose the best by highest count, break ties by higher area usage (same as count*area here)
  let best = candidates[0];
  const containerArea = container.innerLength * container.innerWidth;
  const palletArea = pallet.length * pallet.width;
  for (const cand of candidates) {
    if (cand.count > best.count) {
      best = cand;
    } else if (cand.count === best.count) {
      const bestArea = (best.count * palletArea) / containerArea;
      const candArea = (cand.count * palletArea) / containerArea;
      if (candArea > bestArea) {
        best = cand;
      }
    }
  }

  const placements = canFitAny ? best.placements : [];

  // Axle analysis (approximate)
  type AxleReport = { R_front: number; R_rear: number; maxKgPerM: number; warnings: string[] };

  function getAxleOptionsForContainer(): any {
    // Rough presets; can be tuned per container type
    const baseBinMm = 1000;
    const id = container.id;
    if (id === 'eu_semitrailer') {
      return {
        perSlotWeightKg: pallet.weightKg ?? 0,
        binSizeMm: baseBinMm,
        maxKgPerM: 3000,
        supportFrontX: 1000,
        supportRearX: Math.max(2000, container.innerLength - 1500),
        rearAxleGroupMaxKg: 24000,
        kingpinMinKg: 6000,
        kingpinMaxKg: 15000,
        payloadMaxKg: container.maxPayloadKg ?? undefined,
      };
    }
    if (id === 'truck7_5t') {
      return {
        perSlotWeightKg: pallet.weightKg ?? 0,
        binSizeMm: baseBinMm,
        maxKgPerM: 1500,
        supportFrontX: 800,
        supportRearX: Math.max(1600, container.innerLength - 1200),
        rearAxleGroupMaxKg: 5200,
        kingpinMinKg: undefined,
        kingpinMaxKg: undefined,
        payloadMaxKg: container.maxPayloadKg ?? 3000,
      };
    }
    if (id === 'sprinter') {
      return {
        perSlotWeightKg: pallet.weightKg ?? 0,
        binSizeMm: baseBinMm,
        maxKgPerM: 800,
        supportFrontX: 600,
        supportRearX: Math.max(1200, container.innerLength - 1000),
        rearAxleGroupMaxKg: 1800,
        kingpinMinKg: undefined,
        kingpinMaxKg: undefined,
        payloadMaxKg: container.maxPayloadKg ?? 1200,
      };
    }
    if (id === '20ft' || id === '40ft') {
      return {
        perSlotWeightKg: pallet.weightKg ?? 0,
        binSizeMm: baseBinMm,
        maxKgPerM: 3000,
        supportFrontX: 1000,
        supportRearX: Math.max(2000, container.innerLength - 1500),
        rearAxleGroupMaxKg: container.maxPayloadKg ?? 26000,
        kingpinMinKg: undefined,
        kingpinMaxKg: undefined,
        payloadMaxKg: container.maxPayloadKg ?? undefined,
      };
    }
    return {
      perSlotWeightKg: pallet.weightKg ?? 0,
      binSizeMm: baseBinMm,
      maxKgPerM: 2000,
      supportFrontX: 800,
      supportRearX: Math.max(1600, container.innerLength - 1200),
      payloadMaxKg: container.maxPayloadKg ?? undefined,
    };
  }

  function centroidY(p: Placement): number {
    return p.y + p.h / 2;
  }

  function computeAxles(placements: Placement[], opts: any): AxleReport {
    const perSlotWeightKg = Math.max(0, Math.floor(opts.perSlotWeightKg ?? 0));
    const binSizeMm = Math.max(1, Math.floor(opts.binSizeMm ?? 1000));

    const binToKg = new Map<number, number>();
    let totalWeightKg = 0;

    for (const p of placements) {
      const bin = Math.floor(centroidY(p) / binSizeMm);
      const units: any[] = (p as any).units ?? [];
      const unitSum = units.reduce((acc, u) => acc + (typeof u?.weightKg === 'number' ? u.weightKg : 0), 0);
      const w = unitSum > 0 ? unitSum : perSlotWeightKg;
      totalWeightKg += w;
      binToKg.set(bin, (binToKg.get(bin) ?? 0) + w);
    }

    let maxBinKg = 0;
    for (const kg of binToKg.values()) maxBinKg = Math.max(maxBinKg, kg);
    const maxKgPerM = (maxBinKg * 1000) / binSizeMm;

    const warnings: string[] = [];
    if (opts.maxKgPerM != null && maxKgPerM > opts.maxKgPerM) {
      warnings.push(`Peak linear density ${Math.round(maxKgPerM)} kg/m exceeds threshold ${opts.maxKgPerM} kg/m.`);
    }

    const supportFrontX = Math.max(0, Math.floor(opts.supportFrontX));
    const supportRearX = Math.max(supportFrontX + 1, Math.floor(opts.supportRearX));
    const L = supportRearX - supportFrontX;

    let R_front = 0;
    let R_rear = 0;

    for (const p of placements) {
      const xi = Math.max(supportFrontX, Math.min(supportRearX, centroidY(p)));
      const units: any[] = (p as any).units ?? [];
      const unitSum = units.reduce((acc, u) => acc + (typeof u?.weightKg === 'number' ? u.weightKg : 0), 0);
      const w = unitSum > 0 ? unitSum : perSlotWeightKg;
      const a = (supportRearX - xi) / L;
      const b = (xi - supportFrontX) / L;
      R_front += w * a;
      R_rear += w * b;
    }

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

    return { R_front: Math.round(R_front), R_rear: Math.round(R_rear), maxKgPerM: Math.round(maxKgPerM), warnings };
  }

  const plan: Plan = {
    container,
    pallet,
    constraints,
    units,
    placements,
    metrics: computeMetrics({ container, pallet, constraints, units, placements }),
    note: params.note,
  };

  try {
    const axleOpts = getAxleOptionsForContainer();
    const report = computeAxles(plan.placements, axleOpts);
    plan.axles = report;
  } catch (e) {
    console.error('Axle analysis failed:', e);
    // swallow axle analysis errors to avoid breaking core planning
  }

  return plan;
}

export default computePlan;