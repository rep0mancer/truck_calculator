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

  // d) prepare final bands for packing
  const EUP_stacked_items: Item[] = flattenColumnsToItems(downgrade.stacked.EUP_columns);
  const DIN_stacked_items: Item[] = flattenColumnsToItems(downgrade.stacked.DIN_columns);

  const EUP_unstacked: Item[] = [
    ...unitBands.EUP_unstacked,
    ...downgrade.stacked.EUP_singles, // leftover from forming columns
    ...downgrade.downgraded.EUP, // overflow columns downgraded to singles
  ];
  const DIN_unstacked: Item[] = [
    ...unitBands.DIN_unstacked,
    ...downgrade.stacked.DIN_singles,
    ...downgrade.downgraded.DIN,
  ];

  const bandsForPacking: Bands = {
    EUP_stacked: EUP_stacked_items,
    DIN_stacked: DIN_stacked_items,
    EUP_unstacked,
    DIN_unstacked,
  };

  // e) pack in fixed sequence (skip empty bands)
  const packed = packBandSequence(bandsForPacking, opts.fixedSequence, preset, opts);

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