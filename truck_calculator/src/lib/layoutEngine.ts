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

  const plan: Plan = {
    container,
    pallet,
    constraints,
    units,
    placements,
    metrics: computeMetrics({ container, pallet, constraints, units, placements }),
    note: params.note,
  };

  return plan;
}

export default computePlan;