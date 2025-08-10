import { Item, FamilyBandConfig } from './types';

export type Bands = {
  EUP_stacked: Item[];
  EUP_unstacked: Item[];
  DIN_stacked: Item[];
  DIN_unstacked: Item[];
};

function getFamilyConfig(famCfgs: FamilyBandConfig[], family: 'EUP' | 'DIN'): FamilyBandConfig {
  const found = famCfgs.find((c) => c.family === family);
  return found ?? { family, stackableCount: 0, maxStackHeight: 2 };
}

export function expandUnits(items: Item[]): Item[] {
  const units: Item[] = [];
  for (const item of items) {
    const qty = Math.max(1, Number(item.qty ?? 1));
    for (let i = 0; i < qty; i += 1) {
      units.push({ ...item, qty: 1 });
    }
  }
  return units;
}

export function splitIntoBands(allItems: Item[], famCfgs: FamilyBandConfig[]): Bands {
  const units = expandUnits(allItems);

  const eupCfg = getFamilyConfig(famCfgs, 'EUP');
  const dinCfg = getFamilyConfig(famCfgs, 'DIN');

  const EUP_units = units.filter((u) => u.family === 'EUP');
  const DIN_units = units.filter((u) => u.family === 'DIN');

  const EUP_stacked: Item[] = [];
  const EUP_unstacked: Item[] = [];
  const DIN_stacked: Item[] = [];
  const DIN_unstacked: Item[] = [];

  // Preserve original order while taking first N to stacked
  for (let i = 0; i < EUP_units.length; i += 1) {
    if (i < eupCfg.stackableCount) EUP_stacked.push(EUP_units[i]);
    else EUP_unstacked.push(EUP_units[i]);
  }
  for (let i = 0; i < DIN_units.length; i += 1) {
    if (i < dinCfg.stackableCount) DIN_stacked.push(DIN_units[i]);
    else DIN_unstacked.push(DIN_units[i]);
  }

  return { EUP_stacked, EUP_unstacked, DIN_stacked, DIN_unstacked };
}