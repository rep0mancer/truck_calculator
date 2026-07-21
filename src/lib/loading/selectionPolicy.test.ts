import { describe, expect, it } from 'vitest';
import { LoadingCandidate, selectLoadingCandidates } from './selectionPolicy';

type Pallet = { id: string; weight: number };

const selectWithPayload = (pallets: Pallet[], limit = 24_000) => {
  let loadedWeight = 0;
  const candidates: LoadingCandidate<Pallet>[] = pallets.map(pallet => ({
    type: 'euro',
    weight: pallet.weight,
    pallets: [pallet],
  }));
  return selectLoadingCandidates(candidates, candidate => {
    if (loadedWeight + candidate.weight > limit) return 'payload';
    loadedWeight += candidate.weight;
  });
};

describe('stable first-fit loading selection', () => {
  it.each([
    [[{ id: 'heavy', weight: 20_000 }, { id: 'too-heavy', weight: 5_000 }, { id: 'light', weight: 4_000 }], ['heavy', 'light'], ['too-heavy']],
    [[{ id: 'too-heavy', weight: 5_000 }, { id: 'heavy', weight: 20_000 }, { id: 'light', weight: 4_000 }], ['too-heavy', 'light'], ['heavy']],
  ] as const)('skips an overweight group and still considers lighter groups: %j', (pallets, accepted, skipped) => {
    const result = selectWithPayload([...pallets]);
    expect(result.accepted.flatMap(candidate => candidate.pallets.map(pallet => pallet.id))).toEqual(accepted);
    expect(result.skipped.map(candidate => candidate.pallets[0].id)).toEqual(skipped);
    expect(result.skipped[0].reason).toBe('payload');
  });

  it('documents the intentional user-order effect of stable first-fit', () => {
    expect(selectWithPayload([{ id: 'a', weight: 16_000 }, { id: 'b', weight: 9_000 }]).accepted[0].weight).toBe(16_000);
    expect(selectWithPayload([{ id: 'b', weight: 9_000 }, { id: 'a', weight: 16_000 }]).accepted[0].weight).toBe(9_000);
  });

  it('accepts or rejects a stacked pair atomically', () => {
    const pair = [{ id: 'EUP-1', weight: 7_000 }, { id: 'EUP-2', weight: 7_000 }];
    const result = selectLoadingCandidates(
      [{ type: 'euro', weight: 14_000, pallets: pair }],
      () => 'payload',
    );
    expect(result.accepted).toEqual([]);
    expect(result.skipped[0].pallets).toEqual(pair);
  });
});
