import { splitIntoBands } from './bands';
import { buildStackedBands, applyFrontZoneDowngrade, computeRowDepthByFamily } from './stacking';
import { packBandSequence } from './packer';
import type { PackOptions, PlanResult, FamilyBandConfig, TruckPreset, Item } from './types';

export function planWithFixedSequence(
  items: Item[],
  famCfgs: FamilyBandConfig[],
  preset: TruckPreset,
  opts: PackOptions
): PlanResult {
  const unitBands = splitIntoBands(items, famCfgs);
  const stacked = buildStackedBands(unitBands, famCfgs);
  const rowDepthByFamily = computeRowDepthByFamily(preset, opts);
  const downgrade = applyFrontZoneDowngrade(stacked, preset, opts, rowDepthByFamily);

  const prepared = {
    EUP_columns: downgrade.stacked.EUP_columns,
    DIN_columns: downgrade.stacked.DIN_columns,
    EUP_singles: downgrade.stacked.EUP_singles,
    DIN_singles: downgrade.stacked.DIN_singles,
    unstacked_EUP: [
      ...unitBands.EUP_unstacked,
      ...downgrade.downgraded.EUP,
    ],
    unstacked_DIN: [
      ...unitBands.DIN_unstacked,
      ...downgrade.downgraded.DIN,
    ],
  } as any;

  const packed = packBandSequence(opts.fixedSequence as any, prepared as any, preset, opts);
  const notes = [...(packed.notes ?? []), ...downgrade.warnings];
  return { ...packed, notes };
}