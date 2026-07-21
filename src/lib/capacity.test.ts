import { describe, expect, it } from 'vitest';
import { queryAdditionalCapacity, type PalletWeightGroup } from './capacity';

const calculator = (payloadLimit: number, slotLimit: number, stackLimit = Infinity) =>
  (eup: PalletWeightGroup[], din: PalletWeightGroup[], order: 'DIN_FIRST' | 'EUP_FIRST') => {
    let payload = 0;
    let slots = 0;
    const loadedBySource: Record<number, number> = {};
    let euro = 0;
    let industrial = 0;
    const manifests = order === 'DIN_FIRST'
      ? ([['industrial', din], ['euro', eup]] as const)
      : ([['euro', eup], ['industrial', din]] as const);
    for (const [kind, groups] of manifests) {
      for (const group of groups) {
        for (let i = 0; i < group.quantity; i++) {
          const weight = Number(group.weight) || 0;
          if (slots >= Math.min(slotLimit, stackLimit) || payload + weight > payloadLimit) break;
          payload += weight; slots++;
          loadedBySource[group.id] = (loadedBySource[group.id] || 0) + 1;
          if (kind === 'euro') euro++; else industrial++;
        }
      }
    }
    return { totalEuroPalletsVisual: euro, totalDinPalletsVisual: industrial, loadedBySource };
  };

describe('queryAdditionalCapacity', () => {
  it('preserves multiple weight groups and counts from the accepted manifest', () => {
    const result = queryAdditionalCapacity(
      [{ id: 1, quantity: 2, weight: '100' }, { id: 2, quantity: 2, weight: '300' }],
      [], 'euro', '100', calculator(700, 20)
    );
    // The rejected 300kg pallet is not subtracted from the simulated result;
    // the two genuinely placeable 100kg candidates are reported.
    expect(result).toEqual({ requested: 4, loaded: 3, rejected: 1, additionallyFeasible: 2 });
  });

  it('appends only the queried type in a mixed manifest', () => {
    const result = queryAdditionalCapacity(
      [{ id: 1, quantity: 1, weight: '100' }],
      [{ id: 2, quantity: 1, weight: '200' }],
      'industrial', '50', calculator(400, 10)
    );
    expect(result).toEqual({ requested: 1, loaded: 1, rejected: 0, additionallyFeasible: 2 });
  });

  it('honours stack/slot limits and an exact payload boundary', () => {
    const result = queryAdditionalCapacity([], [], 'euro', '250', calculator(1000, 20, 4));
    expect(result.additionallyFeasible).toBe(4);
  });
});
