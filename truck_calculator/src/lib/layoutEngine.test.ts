import { describe, it, expect } from 'vitest';
import { computePlan } from './layoutEngine';
import { CONTAINER_PRESETS, PALLET_PRESETS } from '../presets';
import { Constraints, ContainerPreset, PalletPreset } from '../types';

const defaultConstraints: Constraints = {
  allowRotate: true,
  wallClearance: 60,
  betweenClearance: 50,
};

describe('layoutEngine', () => {
  it('20ft + EUR pallet with default clearances -> expected count', () => {
    const container = CONTAINER_PRESETS.find(c => c.id === '20ft')!;
    const pallet = PALLET_PRESETS.find(p => p.id === 'euro')!;
    const plan = computePlan({ container, pallet, constraints: defaultConstraints });
    expect(plan.metrics.count).toBe(8);
  });

  it('Rotation off vs on -> on should be >= off', () => {
    const container = CONTAINER_PRESETS.find(c => c.id === '20ft')!;
    const pallet = PALLET_PRESETS.find(p => p.id === 'euro')!;

    const offPlan = computePlan({ container, pallet, constraints: { ...defaultConstraints, allowRotate: false } });
    const onPlan = computePlan({ container, pallet, constraints: { ...defaultConstraints, allowRotate: true } });

    expect(onPlan.metrics.count).toBeGreaterThanOrEqual(offPlan.metrics.count);
  });

  it('Aisle reserve reduces count as expected', () => {
    const container = CONTAINER_PRESETS.find(c => c.id === '20ft')!;
    const pallet = PALLET_PRESETS.find(p => p.id === 'euro')!;

    const basePlan = computePlan({ container, pallet, constraints: defaultConstraints });
    const withAisle = computePlan({ container, pallet, constraints: { ...defaultConstraints, aisleLengthReserve: 1000 } });

    expect(withAisle.metrics.count).toBeLessThan(basePlan.metrics.count);
  });

  it('Mixed heuristic can outperform pure A/B in a crafted case', () => {
    const container: ContainerPreset = {
      id: 'test_box',
      name: 'Test Box',
      innerLength: 2800,
      innerWidth: 2000,
    };
    const pallet: PalletPreset = {
      id: 'test_pallet',
      name: '900x1100',
      length: 900,
      width: 1100,
    };

    const constraints: Constraints = { allowRotate: true, wallClearance: 0, betweenClearance: 0 };

    const plan = computePlan({ container, pallet, constraints });

    // Compute pure A and pure B counts analytically
    const colsA = Math.floor(container.innerLength / pallet.length);
    const rowsA = Math.floor(container.innerWidth / pallet.width);
    const countA = colsA * rowsA;

    const colsB = Math.floor(container.innerLength / pallet.width);
    const rowsB = Math.floor(container.innerWidth / pallet.length);
    const countB = colsB * rowsB;

    const bestPure = Math.max(countA, countB);

    expect(plan.metrics.count).toBeGreaterThan(bestPure);
    expect(plan.metrics.count).toBe(5);
  });
});