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
      expect(result.warnings.some(warning => warning.code === 'wagonStackingDisabled')).toBe(true);
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

  describe('forced stacking strategy', () => {
    const forceEup = (quantity: number, limit: number | undefined = undefined) =>
      calculateLoadingLogic('curtainSider', entry(quantity, 100), [], true, false, 'auto', 'EUP_FIRST', limit, undefined, 'force');

    it('turns 18 EUP into exactly nine same-type double-stack positions', () => {
      const result = forceEup(18);
      expect(result.loadedEuroPalletsBase).toBe(9);
      expect(result.totalEuroPalletsVisual).toBe(18);
      expect(result.palletArrangement[0].pallets.filter((p: any) => p.isStackedTier === 'top')).toHaveLength(9);
    });

    it('stacks only weight groups explicitly marked as stackable', () => {
      const groups: WeightEntry[] = [
        { id: 1, quantity: 4, weight: '100', stackable: false },
        { id: 2, quantity: 4, weight: '200', stackable: true },
      ];
      const result = calculateLoadingLogic('curtainSider', groups, [], false, false, 'auto', 'EUP_FIRST', undefined, undefined, 'force');
      const tops = result.palletArrangement[0].pallets.filter((p: any) => p.isStackedTier === 'top');
      expect(tops).toHaveLength(2);
      expect(tops.every((p: any) => p.sourceId === 2)).toBe(true);
    });

    it('keeps the type-wide switch as an all-groups stacking option', () => {
      const groups: WeightEntry[] = [
        { id: 1, quantity: 4, weight: '100', stackable: false },
        { id: 2, quantity: 4, weight: '200', stackable: false },
      ];
      const result = calculateLoadingLogic('curtainSider', groups, [], true, false, 'auto', 'EUP_FIRST', undefined, undefined, 'force');
      const tops = result.palletArrangement[0].pallets.filter((p: any) => p.isStackedTier === 'top');
      expect(tops).toHaveLength(4);
      expect(new Set(tops.map((p: any) => p.sourceId))).toEqual(new Set([1, 2]));
    });

    it('warns when a double stack would stand alone in its row', () => {
      const result = forceEup(2);
      expect(result.warnings).toContainEqual({ code: 'unevenStacking', params: { row: 1 } });
    });

    it('retains the backward-compatible floor-first default', () => {
      const result = calculateLoadingLogic('curtainSider', entry(18, 100), [], true, false, 'auto', 'EUP_FIRST');
      expect(result.loadedEuroPalletsBase).toBe(18);
      expect(result.palletArrangement[0].pallets.some((p: any) => p.isStackedTier === 'top')).toBe(false);
    });

    it('pairs as many odd cargo items as possible and leaves one base', () => {
      const result = forceEup(19);
      expect(result.loadedEuroPalletsBase).toBe(10);
      expect(result.totalEuroPalletsVisual).toBe(19);
    });

    it('continues to interpret finite limits as maximum top counts', () => {
      const result = forceEup(18, 4);
      expect(result.loadedEuroPalletsBase).toBe(14);
      expect(result.totalEuroPalletsVisual - result.loadedEuroPalletsBase).toBe(4);
    });

    it('applies independent EUP and DIN strategies to mixed cargo', () => {
      const result = calculateLoadingLogic('curtainSider', entry(6, 100), entry(6, 200, 2), true, true, 'auto', 'DIN_FIRST', 0, 0, 'force', 'overflow-only');
      expect(result.totalEuroPalletsVisual - result.loadedEuroPalletsBase).toBe(3);
      expect(result.totalDinPalletsVisual - result.loadedIndustrialPalletsBase).toBe(0);
    });

    it('retains every mixed-weight pallet exactly once in deterministic adjacent pairs', () => {
      const weights = [{ id: 1, quantity: 3, weight: '100' }, { id: 2, quantity: 3, weight: '250' }];
      const result = calculateLoadingLogic('curtainSider', weights, [], true, false, 'auto', 'EUP_FIRST', 0, 0, 'force');
      const displayed = result.palletArrangement.flatMap(unit => unit.pallets) as any[];
      expect(displayed.map(p => p.weight).sort((a, b) => a - b)).toEqual([100, 100, 100, 250, 250, 250]);
      expect(displayed.reduce((sum, pallet) => sum + pallet.weight, 0)).toBe(result.totalWeightKg);
    });

    it('is disabled on rail wagons and still rejects cargo over payload', () => {
      const wagon = calculateLoadingLogic('Waggon', entry(18, 100), [], true, false, 'auto', 'EUP_FIRST', 0, 0, 'force');
      expect(wagon.loadedEuroPalletsBase).toBe(wagon.totalEuroPalletsVisual);
      const payload = calculateLoadingLogic('curtainSider', entry(18, 2_000), [], true, false, 'auto', 'EUP_FIRST', 0, 0, 'force');
      expect(payload.totalWeightKg).toBeLessThanOrEqual(TRUCK_TYPES.curtainSider.maxGrossWeightKg);
      expect(payload.totalEuroPalletsVisual).toBeLessThan(18);
    });

    it('uses forced pairs in remaining-capacity simulations', () => {
      const simulation = calculateLoadingLogic('curtainSider', entry(300, 0), [], true, false, 'auto', 'EUP_FIRST', 0, 0, 'force');
      expect(simulation.totalEuroPalletsVisual).toBe(66);
      expect(simulation.loadedEuroPalletsBase).toBe(33);
    });
  });

  it('preserves existing EUPs when the remaining space is filled with stackable DINs', () => {
    const existingEups = entry(10, 0);
    const fillSimulation = calculateLoadingLogic(
      'curtainSider', existingEups, entry(300, 0, 2), false, true, 'auto', 'EUP_FIRST', 0, 0,
    );
    const dinToAdd = fillSimulation.totalDinPalletsVisual;
    const finalResult = calculateLoadingLogic(
      'curtainSider', existingEups, entry(dinToAdd, 0, 2), false, true, 'auto', 'EUP_FIRST', 0, 0,
    );

    expect(finalResult.totalEuroPalletsVisual).toBe(10);
    expect(finalResult.totalDinPalletsVisual).toBe(dinToAdd);
    expect(finalResult.palletArrangement).toEqual(fillSimulation.palletArrangement);
  });

  it('skips an overweight pallet and continues with later entries', () => {
    const result = calculateLoadingLogic('curtainSider', [{ id: 1, quantity: 1, weight: '25000' }, { id: 2, quantity: 2, weight: '100' }], [], false, false, 'auto');
    expect(result.totalEuroPalletsVisual).toBe(2);
    expect(result.totalWeightKg).toBe(200);
  });

  it('uses the free lane in an incomplete DIN row for the 23 DIN + 4 EUP regression', () => {
    const result = calculateLoadingLogic('curtainSider', entry(4, 0), entry(23, 0, 2), false, false, 'auto', 'DIN_FIRST');
    expect(result.totalDinPalletsVisual).toBe(23);
    expect(result.totalEuroPalletsVisual).toBe(4);
    expect(result.loadedIndustrialPalletsBase).toBe(23);
    expect(result.loadedEuroPalletsBase).toBe(4);
    expect(result.totalWeightKg).toBe(0);
    expect(result.warnings.some(warning => warning.code === 'palletsRemaining')).toBe(false);

    const floor = result.palletArrangement[0].pallets.filter((p: any) => p.isStackedTier !== 'top');
    expect(floor).toHaveLength(27);
    expect(result.palletArrangement[0].pallets.some((p: any) => p.isStackedTier === 'top')).toBe(false);
    assertPhysicalLayout(result.palletArrangement[0]);
    const rows = floor.reduce((map: Map<number, any[]>, pallet: any) => map.set(pallet.x, [...(map.get(pallet.x) ?? []), pallet]), new Map<number, any[]>());
    const mixed = [...rows.values()].find(row => row.length === 2 && new Set(row.map((p: any) => p.type)).size === 2);
    expect(mixed?.map((p: any) => p.type).sort()).toEqual(['euro', 'industrial']);
    expect(Math.max(...mixed!.map((p: any) => p.width))).toBeLessThanOrEqual(100);
    const longEuroRow = [...rows.values()].find(row => row.length === 3 && row.every((p: any) => p.type === 'euro'));
    expect(longEuroRow).toHaveLength(3);
    expect(longEuroRow!.every((p: any) => p.width === 120 && p.height === 80)).toBe(true);
  });

  it.each([
    [24, 4, 24, 3],
    [25, 1, 25, 1],
    [25, 2, 25, 1],
    [21, 6, 21, 6],
  ])('plans mixed-row boundary case %i DIN + %i EUP', (din, eup, loadedDin, loadedEup) => {
    const result = calculateLoadingLogic('curtainSider', entry(eup, 0), entry(din, 0, 2), false, false, 'auto', 'DIN_FIRST');
    expect(result.totalDinPalletsVisual).toBe(loadedDin);
    expect(result.totalEuroPalletsVisual).toBe(loadedEup);
    assertPhysicalLayout(result.palletArrangement[0]);
  });

  it('matches an independent mixed-row feasibility oracle for all standard floor combinations', () => {
    const euroLength = (count: number) => {
      let best = Infinity;
      for (let long = 0; long <= Math.ceil(count / 3); long++) best = Math.min(best, long * 120 + Math.ceil(Math.max(0, count - long * 3) / 2) * 80);
      return best;
    };
    const oracle = (din: number, eup: number) => [0, 1].some(mixed =>
      mixed <= din % 2 && mixed <= eup && Math.ceil((din - mixed) / 2) * 100 + mixed * 100 + euroLength(eup - mixed) <= 1320,
    );
    for (let din = 0; din <= 26; din++) for (let eup = 0; eup <= 33; eup++) {
      if (!oracle(din, eup)) continue;
      const result = calculateLoadingLogic('curtainSider', entry(eup, 0), entry(din, 0, 2), false, false, 'auto', 'DIN_FIRST');
      expect([result.totalDinPalletsVisual, result.totalEuroPalletsVisual], `${din} DIN + ${eup} EUP`).toEqual([din, eup]);
    }
  });
});

describe('static axle calculations', () => {
  it('reports front-heavy and rear-heavy placements differently at identical cargo weight', () => {
    const front = calculateLoadingLogic('curtainSider', entry(10, 0), entry(12, 2_000, 2), false, false, 'auto');
    const rear = calculateLoadingLogic('curtainSider', entry(2, 12_000), entry(15, 0, 2), false, false, 'auto');
    expect(front.totalWeightKg).toBe(rear.totalWeightKg);
    expect(front.axleCalculation.available && front.axleCalculation.exceededComponents).toContain('supportTractor');
    expect(rear.axleCalculation.available && rear.axleCalculation.exceededComponents).toContain('trailerAxleGroup');
    expect(front.warnings.filter(w => w.code === 'axleLimitExceeded')).not.toEqual(rear.warnings.filter(w => w.code === 'axleLimitExceeded'));
  });

  it('balances reactions for an evenly distributed load and includes unladen reactions', () => {
    const result = calculateLoadingLogic('curtainSider', entry(22, 500), [], false, false, 'auto');
    expect(result.axleCalculation.available).toBe(true);
    if (!result.axleCalculation.available) return;
    expect(result.axleCalculation.supportTractor.cargoReactionKg + result.axleCalculation.trailerAxleGroup.cargoReactionKg).toBeCloseTo(result.totalWeightKg);
    expect(result.axleCalculation.supportTractor.calculatedKg).toBeCloseTo(result.axleCalculation.supportTractor.cargoReactionKg + 5_500);
    expect(result.axleCalculation.trailerAxleGroup.calculatedKg).toBeCloseTo(result.axleCalculation.trailerAxleGroup.cargoReactionKg + 6_500);
  });

  it('preserves mixed and stacked pallet weights in placement moments', () => {
    const result = calculateLoadingLogic('curtainSider', [{ id: 1, quantity: 2, weight: '300' }, { id: 2, quantity: 2, weight: '700' }], entry(4, 1_100, 3), true, true, 'auto', 'DIN_FIRST');
    const weights = result.palletArrangement.flatMap(unit => unit.pallets.map(p => p.weight));
    expect(weights.sort((a, b) => a - b)).toEqual([300, 300, 700, 700, 1_100, 1_100, 1_100, 1_100]);
    expect(result.axleCalculation.available).toBe(true);
    if (result.axleCalculation.available) {
      expect(result.axleCalculation.supportTractor.cargoReactionKg + result.axleCalculation.trailerAxleGroup.cargoReactionKg).toBeCloseTo(6_400);
    }
  });

  it('returns configured unladen reactions for an empty semitrailer', () => {
    const result = calculateLoadingLogic('frigo', [], [], false, false, 'auto');
    expect(result.axleCalculation.available && result.axleCalculation.supportTractor.calculatedKg).toBe(5_500);
    expect(result.axleCalculation.available && result.axleCalculation.trailerAxleGroup.calculatedKg).toBe(6_500);
    expect(result.axleCalculation.available && result.axleCalculation.exceededComponents).toEqual([]);
  });

  it('does not warn when the support reaction is exactly at its limit', () => {
    // A DIN pallet in the first row has its centre at the fifth wheel (50 cm),
    // putting its entire 12,500 kg cargo reaction on the 5,500 kg support tare.
    const result = calculateLoadingLogic('curtainSider', [], entry(1, 12_500), false, false, 'auto');
    expect(result.axleCalculation.available && result.axleCalculation.supportTractor.calculatedKg).toBe(18_000);
    expect(result.axleCalculation.available && result.axleCalculation.supportTractor.exceeded).toBe(false);
    expect(result.warnings.some(w => w.code === 'axleLimitExceeded')).toBe(false);
    expect(result.warnings).toContainEqual({
      code: 'axleLimitApproaching',
      params: { component: 'supportTractor', calculatedKg: 18_000, limitKg: 18_000, percent: 100 },
    });
  });

  it.each(['roadTrain', 'smallTruck', 'Waggon', 'Waggon2'] as const)('marks %s axle calculation unavailable', truck => {
    const result = calculateLoadingLogic(truck, entry(10, 1_000), [], false, false, 'auto');
    expect(result.axleCalculation).toEqual({ available: false, reason: 'unsupportedVehicleConfiguration' });
    expect(result.warnings.some(w => w.code === 'axleLimitExceeded')).toBe(false);
  });
});

function assertPhysicalLayout(unit: { unitLength: number; unitWidth: number; pallets: any[] }) {
  const floor = unit.pallets.filter(p => p.isStackedTier !== 'top');
  for (const pallet of floor) {
    expect(pallet.x).toBeGreaterThanOrEqual(0); expect(pallet.y).toBeGreaterThanOrEqual(0);
    expect(pallet.x + pallet.width).toBeLessThanOrEqual(unit.unitLength);
    expect(pallet.y + pallet.height).toBeLessThanOrEqual(unit.unitWidth);
  }
  for (let a = 0; a < floor.length; a++) for (let b = a + 1; b < floor.length; b++) {
    const p = floor[a]; const q = floor[b];
    expect(p.x < q.x + q.width && p.x + p.width > q.x && p.y < q.y + q.height && p.y + p.height > q.y).toBe(false);
  }
}
