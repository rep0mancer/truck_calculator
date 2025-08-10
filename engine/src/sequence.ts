import { Bands, splitIntoBands } from './bands';
import { PackOptions, PlanResult, FamilyBandConfig, TruckPreset, Item } from './types';
import { buildStackedBands, applyFrontZoneDowngrade, computeRowDepthByFamily } from './stacking';
import { packBandSequence } from './packer';

function flattenColumnsToItems(columns: { units: Item[] }[]): Item[] {
  const items: Item[] = [];
  for (const c of columns) items.push(...c.units);
  return items;
}

export function planWithFixedSequence(
  items: Item[],
  famCfgs: FamilyBandConfig[],
  preset: TruckPreset,
  opts: PackOptions
): PlanResult {
  // a) build bands (units)
  const unitBands: Bands = splitIntoBands(items, famCfgs);

  // b) transform stacked units → columns (+ leftover singles)
  const stacked = buildStackedBands(unitBands, famCfgs);

  // c) enforce front zone by downgrading overflow columns to singles
  const rowDepthByFamily = computeRowDepthByFamily(preset, opts);
  const downgrade = applyFrontZoneDowngrade(stacked, preset, opts, rowDepthByFamily);

  // d) prepare pools for packing
  const prepared = {
    EUP_columns: downgrade.stacked.EUP_columns,
    DIN_columns: downgrade.stacked.DIN_columns,
    EUP_singles: downgrade.stacked.EUP_singles,
    DIN_singles: downgrade.stacked.DIN_singles,
    // unstacked pools from original unstacked items plus downgraded overflow
    unstacked_EUP: [
      ...unitBands.EUP_unstacked,
      ...downgrade.downgraded.EUP,
    ],
    unstacked_DIN: [
      ...unitBands.DIN_unstacked,
      ...downgrade.downgraded.DIN,
    ],
  };

  // e) pack in fixed sequence (skip empty bands)
  const packed = packBandSequence(opts.fixedSequence, prepared, preset, opts);

  // f) append warnings
  const notes = [
    ...(packed.notes ?? []),
    ...downgrade.warnings,
  ];

  return {
    ...packed,
    notes,
  };
}