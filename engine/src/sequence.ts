import { Bands, splitIntoBands } from './bands';
import { PackOptions, PlanResult, FamilyBandConfig, TruckPreset, Item } from './types';
import { formColumns, applyFrontZoneDowngrade } from './stacking';
import { packBandSequence } from './packer';

function getMaxHeightForFamily(famCfgs: FamilyBandConfig[], family: 'EUP' | 'DIN'): number {
  const cfg = famCfgs.find((c) => c.family === family);
  return cfg?.maxStackHeight ?? 2;
}

export function planWithFixedSequence(
  items: Item[],
  famCfgs: FamilyBandConfig[],
  preset: TruckPreset,
  opts: PackOptions
): PlanResult {
  // a) build bands (units)
  const unitBands: Bands = splitIntoBands(items, famCfgs);

  // b) transform stacked units → columns
  const eupMax = getMaxHeightForFamily(famCfgs, 'EUP');
  const dinMax = getMaxHeightForFamily(famCfgs, 'DIN');

  const eupColumns = formColumns(unitBands.EUP_stacked, eupMax);
  const dinColumns = formColumns(unitBands.DIN_stacked, dinMax);

  // c) enforce stacked-only front zone via downgrade (overflow columns → singles)
  const eupAfterZone: Item[] = applyFrontZoneDowngrade(eupColumns, opts.frontStagingDepth, preset);
  const dinAfterZone: Item[] = applyFrontZoneDowngrade(dinColumns, opts.frontStagingDepth, preset);

  const bandsForPacking: Bands = {
    EUP_stacked: eupAfterZone,
    DIN_stacked: dinAfterZone,
    EUP_unstacked: unitBands.EUP_unstacked,
    DIN_unstacked: unitBands.DIN_unstacked,
  };

  // d) pack in fixed sequence (skip empty bands)
  return packBandSequence(bandsForPacking, opts.fixedSequence, preset, opts);
}