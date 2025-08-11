import type { Item, TruckPreset, PackOptions, FamilyBandConfig } from './types';
import type { Bands } from './bands';

export interface Column {
  units: Item[];
  height: number;
  weight: number;
  family: 'EUP' | 'DIN';
}

function sumNumber(values: Array<number | undefined | null>): number {
  let total = 0;
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

function makeColumn(units: Item[]): Column {
  const family = (units[0]?.family ?? 'EUP') as 'EUP' | 'DIN';
  const height = sumNumber(units.map((u) => (u as any).heightMm));
  const weight = sumNumber(units.map((u) => (u as any).weightKg));
  return { units, height, weight, family };
}

export function formColumns(units: Item[], maxStackHeight: number): { columns: Column[]; singles: Item[] } {
  if (maxStackHeight <= 1) {
    return { columns: [], singles: [...units] };
  }

  const columns: Column[] = [];
  const singles: Item[] = [];

  let buffer: Item[] = [];
  for (const unit of units) {
    buffer.push(unit);
    if (buffer.length === maxStackHeight) {
      columns.push(makeColumn(buffer));
      buffer = [];
    }
  }
  if (buffer.length > 0) {
    singles.push(...buffer);
  }

  return { columns, singles };
}

export interface StackedBands {
  EUP_columns: Column[];
  DIN_columns: Column[];
  EUP_singles: Item[];
  DIN_singles: Item[];
}

function getMaxStackHeightForFamily(famCfgs: FamilyBandConfig[], family: 'EUP' | 'DIN'): number {
  const cfg = famCfgs.find((c) => c.family === family);
  return cfg?.maxStackHeight ?? 2;
}

export function buildStackedBands(
  bands: Bands,
  famCfgs: FamilyBandConfig[]
): StackedBands {
  const eupMax = getMaxStackHeightForFamily(famCfgs, 'EUP');
  const dinMax = getMaxStackHeightForFamily(famCfgs, 'DIN');

  const { columns: EUP_columns, singles: EUP_singles } = formColumns(bands.EUP_stacked, eupMax);
  const { columns: DIN_columns, singles: DIN_singles } = formColumns(bands.DIN_stacked, dinMax);

  return { EUP_columns, DIN_columns, EUP_singles, DIN_singles };
}

export function computeRowDepthByFamily(_preset: TruckPreset, _opts: PackOptions): Record<'EUP' | 'DIN', number> {
  const baseDepthMm = 1200;
  const clearanceMm = 0;
  return { EUP: baseDepthMm + clearanceMm, DIN: baseDepthMm + clearanceMm };
}

export function applyFrontZoneDowngrade(
  stacked: StackedBands,
  _preset: TruckPreset,
  opts: PackOptions,
  rowDepthByFamily: Record<'EUP' | 'DIN', number>
): {
  stacked: StackedBands;
  downgradedCount: number;
  warnings: string[];
  downgraded: { EUP: Item[]; DIN: Item[] };
} {
  const warnings: string[] = [];
  let downgradedCount = 0;

  function trimForFamily(columns: Column[], family: 'EUP' | 'DIN') {
    const rowDepth = Math.max(1, Math.floor(rowDepthByFamily[family]));
    const rowsFit = Math.max(0, Math.floor(opts.frontStagingDepth / rowDepth));

    if (columns.length <= rowsFit) {
      return { kept: columns, removed: [] as Column[], downgradedUnits: [] as Item[] };
    }

    const kept = columns.slice(0, rowsFit);
    const removed = columns.slice(rowsFit);
    const downgradedUnits = removed.flatMap((c) => c.units);
    return { kept, removed, downgradedUnits };
  }

  const eupTrim = trimForFamily(stacked.EUP_columns, 'EUP');
  if (eupTrim.removed.length > 0) {
    const count = eupTrim.downgradedUnits.length;
    downgradedCount += count;
    warnings.push(`Stacked EUP: downgraded ${count} units; front zone capacity exceeded.`);
  }

  const dinTrim = trimForFamily(stacked.DIN_columns, 'DIN');
  if (dinTrim.removed.length > 0) {
    const count = dinTrim.downgradedUnits.length;
    downgradedCount += count;
    warnings.push(`Stacked DIN: downgraded ${count} units; front zone capacity exceeded.`);
  }

  const updated: StackedBands = {
    EUP_columns: eupTrim.kept,
    DIN_columns: dinTrim.kept,
    EUP_singles: stacked.EUP_singles,
    DIN_singles: stacked.DIN_singles,
  };

  return {
    stacked: updated,
    downgradedCount,
    warnings,
    downgraded: { EUP: eupTrim.downgradedUnits, DIN: dinTrim.downgradedUnits },
  };
}