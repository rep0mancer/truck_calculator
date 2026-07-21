import { describe, expect, it } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { calculateLoadingLogic, TRUCK_TYPES, type WeightEntry } from './loadingCalculator';

const entry = (quantity: number, weight = 500, id = 1): WeightEntry[] => [{ id, quantity, weight: String(weight) }];

describe('loadingCalculator real-world combination matrix', () => {
  it('matches established floor capacities for standard road equipment', () => {
    const cases = [
      ['curtainSider', 33, 26], ['frigo', 33, 26], ['smallTruck', 18, 14], ['roadTrain', 36, 28],
    ] as const;
    for (const [truck, euro, din] of cases) {
      expect(calculateLoadingLogic(truck, entry(300, 0), [], false, false, 'auto', 'EUP_FIRST').totalEuroPalletsVisual).toBe(euro);
      expect(calculateLoadingLogic(truck, [], entry(300, 0), false, false, 'auto', 'DIN_FIRST').totalDinPalletsVisual).toBe(din);
    }
  });

  it('keeps every combination within physical and payload limits', () => {
    const quantities = [0, 1, 2, 17, 40];
    const weights = [0, 500, 2_000];
    const patterns = ['auto', 'long', 'broad'] as const;
    const orders = ['DIN_FIRST', 'EUP_FIRST'] as const;

    for (const truck of Object.keys(TRUCK_TYPES) as Array<keyof typeof TRUCK_TYPES>) {
      for (const eupStacked of [false, true]) for (const dinStacked of [false, true]) {
        for (const pattern of patterns) for (const order of orders) {
          for (const quantity of quantities) for (const weight of weights) {
            const result = calculateLoadingLogic(truck, entry(quantity, weight), entry(quantity, weight, 2), eupStacked, dinStacked, pattern, order, 6, 6);
            const config = TRUCK_TYPES[truck];
            expect(result.totalWeightKg).toBeLessThanOrEqual(config.maxGrossWeightKg);
            expect(result.loadedEuroPalletsBase).toBeLessThanOrEqual(result.totalEuroPalletsVisual);
            expect(result.loadedIndustrialPalletsBase).toBeLessThanOrEqual(result.totalDinPalletsVisual);
            expect(result.totalEuroPalletsVisual).toBeLessThanOrEqual(quantity);
            expect(result.totalDinPalletsVisual).toBeLessThanOrEqual(quantity);

            for (const unit of result.palletArrangement) {
              const floorPallets = unit.pallets.filter((p: any) => p.isStackedTier !== 'top');
              for (const pallet of floorPallets) {
                expect(pallet.x).toBeGreaterThanOrEqual(0);
                expect(pallet.y).toBeGreaterThanOrEqual(0);
                expect(pallet.x + pallet.width).toBeLessThanOrEqual(unit.unitLength);
                expect(pallet.y + pallet.height).toBeLessThanOrEqual(unit.unitWidth);
              }
              for (let a = 0; a < floorPallets.length; a++) for (let b = a + 1; b < floorPallets.length; b++) {
                const p = floorPallets[a]; const q = floorPallets[b];
                const overlaps = p.x < q.x + q.width && p.x + p.width > q.x && p.y < q.y + q.height && p.y + p.height > q.y;
                expect(overlaps, `${truck}: ${p.key} overlaps ${q.key}`).toBe(false);
              }
            }
          }
        }
      }
    }
  }, 15_000);

  it('loads only weight that is actually represented in the arrangement', () => {
    const result = calculateLoadingLogic('smallTruck', entry(30, 700), entry(30, 900, 2), true, true, 'auto', 'DIN_FIRST');
    expect(result.totalWeightKg).toBe(result.totalEuroPalletsVisual * 700 + result.totalDinPalletsVisual * 900);
  });

  it('disables stacking for rail wagons', () => {
    for (const truck of ['Waggon', 'Waggon2'] as const) {
      const result = calculateLoadingLogic(truck, entry(10), entry(10, 500, 2), true, true, 'auto');
      expect(result.loadedEuroPalletsBase).toBe(result.totalEuroPalletsVisual);
      expect(result.loadedIndustrialPalletsBase).toBe(result.totalDinPalletsVisual);
      expect(result.warnings.some(warning => warning.includes('Stapeln'))).toBe(true);
    }
  });

  it('reproduces the exact 33/66 EUP and 26/52 DIN curtain-sider capacities', () => {
    expect(calculateLoadingLogic('curtainSider', entry(33, 0), [], true, false, 'auto').totalEuroPalletsVisual).toBe(33);
    expect(calculateLoadingLogic('curtainSider', entry(66, 0), [], true, false, 'auto').totalEuroPalletsVisual).toBe(66);
    expect(calculateLoadingLogic('curtainSider', [], entry(26, 0), false, true, 'auto').totalDinPalletsVisual).toBe(26);
    expect(calculateLoadingLogic('curtainSider', [], entry(52, 0), false, true, 'auto').totalDinPalletsVisual).toBe(52);
  });

  it.each([[2, 2], [3, 3], [4, 3]])('optimizes the EUP boundary after 24 DIN (%i requested, %i loaded)', (requested, loaded) => {
    const result = calculateLoadingLogic('curtainSider', entry(requested, 0), entry(24, 0, 2), false, false, 'auto');
    expect(result.totalDinPalletsVisual).toBe(24);
    expect(result.totalEuroPalletsVisual).toBe(loaded);
  });

  it('treats stack limits as top limits and keeps every top exactly on a same-type base', () => {
    const result = calculateLoadingLogic('curtainSider', [], entry(40, 100), false, true, 'auto', 'DIN_FIRST', undefined, 4);
    expect(result.loadedIndustrialPalletsBase).toBe(26);
    expect(result.totalDinPalletsVisual).toBe(30);
    const pallets = result.palletArrangement[0].pallets as any[];
    for (const top of pallets.filter(p => p.isStackedTier === 'top')) {
      const base = pallets.find(p => p.isStackedTier === 'base' && p.x === top.x && p.y === top.y);
      expect(base).toMatchObject({ type: top.type, width: top.width, height: top.height });
    }
  });

  it('skips an overweight pallet and continues with later entries', () => {
    const result = calculateLoadingLogic('curtainSider', [{ id: 1, quantity: 1, weight: '25000' }, { id: 2, quantity: 2, weight: '100' }], [], false, false, 'auto');
    expect(result.totalEuroPalletsVisual).toBe(2);
    expect(result.totalWeightKg).toBe(200);
  });
});
