import { planWithFixedSequence } from './sequence';
import { Item, FamilyBandConfig, TruckPreset, PackOptions } from './types';

const items: Item[] = [
  { family: 'EUP', qty: 32 },
  { family: 'DIN', qty: 2 },
];

const famCfgs: FamilyBandConfig[] = [
  { family: 'EUP', stackableCount: 4, maxStackHeight: 2 },
  { family: 'DIN', stackableCount: 0, maxStackHeight: 2 },
];

const preset: TruckPreset = { lengthMm: 13600, widthMm: 2460, heightMm: 2700 };

const opts: PackOptions = {
  enforceRowPairConsistency: false,
  frontStagingDepth: 2000,
  blockStrategy: 'fixed',
  fixedSequence: ['DIN_stacked', 'EUP_stacked', 'DIN_unstacked', 'EUP_unstacked'],
};

const result = planWithFixedSequence(items, famCfgs, preset, opts);
console.log(JSON.stringify(result, null, 2));