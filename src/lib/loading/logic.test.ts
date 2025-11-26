import { describe, it, expect } from 'vitest';
import { calculateLoadingLogic, TRUCK_CAPACITY_BY_TYPE } from './logic';

describe('Loading Logic - Capacity Configuration', () => {
  it('curtainSider has correct capacities', () => {
    const capacity = TRUCK_CAPACITY_BY_TYPE['curtainSider'];
    expect(capacity.floorDIN).toBe(26);
    expect(capacity.floorEUP).toBe(33);
    expect(capacity.stackedDIN).toBe(52);
    expect(capacity.stackedEUP).toBe(66);
    expect(capacity.supportsStacking).toBe(true);
  });

  it('waggon does not support stacking', () => {
    const capacity = TRUCK_CAPACITY_BY_TYPE['waggon'];
    expect(capacity.supportsStacking).toBe(false);
  });
});

describe('Loading Logic - DIN Pallets Stacking', () => {
  it('28 DIN pallets: 26 floor + 2 stacked', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [],
      [{ id: 1, weight: '100', quantity: 28, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    expect(result.totalDinPalletsVisual).toBe(28);
    expect(result.loadedIndustrialPalletsBase).toBe(26);
    // Stacked count = total - floor
    expect(result.totalDinPalletsVisual - result.loadedIndustrialPalletsBase).toBe(2);
  });

  it('36 DIN pallets: 26 floor + 10 stacked', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [],
      [{ id: 1, weight: '100', quantity: 36, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    expect(result.totalDinPalletsVisual).toBe(36);
    expect(result.loadedIndustrialPalletsBase).toBe(26);
    expect(result.totalDinPalletsVisual - result.loadedIndustrialPalletsBase).toBe(10);
  });

  it('52 DIN pallets: maximum capacity (26 floor + 26 stacked)', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [],
      [{ id: 1, weight: '100', quantity: 52, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    expect(result.totalDinPalletsVisual).toBe(52);
    expect(result.loadedIndustrialPalletsBase).toBe(26);
    expect(result.totalDinPalletsVisual - result.loadedIndustrialPalletsBase).toBe(26);
    // No overflow warnings (info messages are ok)
    expect(result.warnings.some(w => w.includes('konnten nicht'))).toBe(false);
  });

  it('60 DIN pallets: overflow - only 52 loaded', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [],
      [{ id: 1, weight: '100', quantity: 60, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    expect(result.totalDinPalletsVisual).toBe(52);
    expect(result.loadedIndustrialPalletsBase).toBe(26);
    // Should have warning about 8 unloaded pallets
    expect(result.warnings.some(w => w.includes('8') && w.includes('DIN'))).toBe(true);
  });
});

describe('Loading Logic - EUP Pallets Stacking', () => {
  it('33 EUP pallets: all on floor, no stacking', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [{ id: 1, weight: '100', quantity: 33, stackable: true }],
      [],
      true,
      false,
      'auto',
      'EUP_FIRST'
    );

    expect(result.totalEuroPalletsVisual).toBe(33);
    expect(result.loadedEuroPalletsBase).toBe(33);
    expect(result.totalEuroPalletsVisual - result.loadedEuroPalletsBase).toBe(0);
  });

  it('50 EUP pallets: 33 floor + 17 stacked', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [{ id: 1, weight: '100', quantity: 50, stackable: true }],
      [],
      true,
      false,
      'auto',
      'EUP_FIRST'
    );

    expect(result.totalEuroPalletsVisual).toBe(50);
    expect(result.loadedEuroPalletsBase).toBe(33);
    expect(result.totalEuroPalletsVisual - result.loadedEuroPalletsBase).toBe(17);
  });

  it('66 EUP pallets: maximum capacity (33 floor + 33 stacked)', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [{ id: 1, weight: '100', quantity: 66, stackable: true }],
      [],
      true,
      false,
      'auto',
      'EUP_FIRST'
    );

    expect(result.totalEuroPalletsVisual).toBe(66);
    expect(result.loadedEuroPalletsBase).toBe(33);
    expect(result.totalEuroPalletsVisual - result.loadedEuroPalletsBase).toBe(33);
    // No overflow warnings (info messages are ok)
    expect(result.warnings.some(w => w.includes('konnten nicht'))).toBe(false);
  });
});

describe('Loading Logic - No Stacking when disabled', () => {
  it('28 DIN without stacking enabled: only 26 loaded', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [],
      [{ id: 1, weight: '100', quantity: 28, stackable: true }],
      false,
      false, // Stacking disabled
      'auto',
      'DIN_FIRST'
    );

    expect(result.totalDinPalletsVisual).toBe(26);
    expect(result.loadedIndustrialPalletsBase).toBe(26);
    expect(result.warnings.some(w => w.includes('2') && w.includes('DIN'))).toBe(true);
  });
});

describe('Loading Logic - Different truck types', () => {
  it('smallTruck7_2: 14 DIN floor, 28 max stacked', () => {
    const capacity = TRUCK_CAPACITY_BY_TYPE['smallTruck7_2'];
    expect(capacity.floorDIN).toBe(14);
    expect(capacity.stackedDIN).toBe(28);

    const result = calculateLoadingLogic(
      'smallTruck7_2',
      [],
      [{ id: 1, weight: '100', quantity: 20, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    expect(result.totalDinPalletsVisual).toBe(20);
    expect(result.loadedIndustrialPalletsBase).toBe(14);
  });

  it('mega13_6: 34 EUP floor (broad pattern better)', () => {
    const capacity = TRUCK_CAPACITY_BY_TYPE['mega13_6'];
    expect(capacity.floorEUP).toBe(34);
    expect(capacity.stackedEUP).toBe(68);
  });

  it('roadTrain: 28 DIN floor total', () => {
    const capacity = TRUCK_CAPACITY_BY_TYPE['roadTrain'];
    expect(capacity.floorDIN).toBe(28);
    expect(capacity.stackedDIN).toBe(56);
  });

  it('roadTrain: shows both units with pallets distributed', () => {
    const result = calculateLoadingLogic(
      'roadTrain',
      [],
      [{ id: 1, weight: '100', quantity: 20, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    // Road train has 2 units
    expect(result.palletArrangement.length).toBe(2);
    expect(result.palletArrangement[0].unitId).toBe('unit1');
    expect(result.palletArrangement[1].unitId).toBe('unit2');
    
    // Both units should have pallets
    const unit1Pallets = result.palletArrangement[0].pallets.length;
    const unit2Pallets = result.palletArrangement[1].pallets.length;
    expect(unit1Pallets + unit2Pallets).toBe(20);
    expect(unit1Pallets).toBeGreaterThan(0);
    expect(unit2Pallets).toBeGreaterThan(0);
  });

  it('roadTrain: no pallet extends beyond unit boundary', () => {
    const result = calculateLoadingLogic(
      'roadTrain',
      [],
      [{ id: 1, weight: '100', quantity: 28, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    // Each unit is 720cm
    const unit1 = result.palletArrangement[0];
    const unit2 = result.palletArrangement[1];

    // All pallets in unit1 should fit within 0 to 720
    unit1.pallets.forEach((p: any) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(unit1.unitLength);
    });

    // All pallets in unit2 should fit within 0 to 720 (relative coords)
    unit2.pallets.forEach((p: any) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(unit2.unitLength);
    });
  });

  it('roadTrain: last pallet in unit1 does not cross into unit2', () => {
    const result = calculateLoadingLogic(
      'roadTrain',
      [],
      [{ id: 1, weight: '100', quantity: 28, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    const unit1 = result.palletArrangement[0];
    // Find the highest x position pallet in unit1
    const maxX = Math.max(...unit1.pallets.map((p: any) => p.x));
    const palletsAtMaxX = unit1.pallets.filter((p: any) => p.x === maxX);
    
    // DIN pallets have width=100 (along truck)
    // With unit length of 720, max x should be 600 (600+100=700 ≤ 720)
    expect(maxX).toBeLessThanOrEqual(620); // 720 - 100 = 620 max safe x
    palletsAtMaxX.forEach((p: any) => {
      expect(p.x + p.width).toBeLessThanOrEqual(720);
    });
  });
});

describe('Loading Logic - Visual Output', () => {
  it('generates correct pallet arrangement structure', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [{ id: 1, weight: '100', quantity: 5 }],
      [{ id: 1, weight: '100', quantity: 10, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    expect(result.palletArrangement).toBeDefined();
    expect(result.palletArrangement.length).toBeGreaterThan(0);
    expect(result.palletArrangement[0].unitId).toBe('main');
    expect(result.palletArrangement[0].pallets).toBeDefined();
    expect(result.totalDinPalletsVisual).toBe(10);
    expect(result.totalEuroPalletsVisual).toBe(5);
  });

  it('pallets have correct width and height properties', () => {
    const result = calculateLoadingLogic(
      'curtainSider',
      [],
      [{ id: 1, weight: '100', quantity: 4, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    const pallets = result.palletArrangement[0].pallets;
    expect(pallets.length).toBe(4);

    // DIN pallets: 100 along truck (width), 120 across (height)
    pallets.forEach((p: any) => {
      expect(p.width).toBe(100);
      expect(p.height).toBe(120);
      expect(p.type).toBe('industrial');
    });
  });
});

describe('Loading Logic - Mixed DIN and EUP', () => {
  it('22 DIN + 5 EUP should all fit on floor', () => {
    // 22 DIN = 11 rows * 100cm = 1100cm
    // Remaining: 1320 - 1100 = 220cm
    // EUP mixed: 1 long row (120cm) = 3 EUP + 1 broad row (80cm) = 2 EUP = 5 EUP total
    const result = calculateLoadingLogic(
      'curtainSider',
      [{ id: 1, weight: '100', quantity: 5 }],
      [{ id: 2, weight: '100', quantity: 22 }],
      false,
      false,
      'auto',
      'DIN_FIRST'
    );

    expect(result.totalDinPalletsVisual).toBe(22);
    expect(result.totalEuroPalletsVisual).toBe(5);
    // No overflow warnings
    expect(result.warnings.some(w => w.includes('konnten nicht'))).toBe(false);
  });

  it('26 DIN + EUP: no room left for EUP', () => {
    // 26 DIN = 13 rows * 100cm = 1300cm
    // Remaining: 1320 - 1300 = 20cm - not enough for any EUP
    const result = calculateLoadingLogic(
      'curtainSider',
      [{ id: 1, weight: '100', quantity: 10 }],
      [{ id: 2, weight: '100', quantity: 26 }],
      false,
      false,
      'auto',
      'DIN_FIRST'
    );

    expect(result.totalDinPalletsVisual).toBe(26);
    expect(result.totalEuroPalletsVisual).toBe(0);
    // Should have overflow warning for EUP
    expect(result.warnings.some(w => w.includes('EUP') && w.includes('10'))).toBe(true);
  });
});

describe('Loading Logic - Stacking Order', () => {
  it('stacking starts at rear position (highest x) and moves toward front', () => {
    // 28 DIN = 26 floor + 2 stacked
    // Floor: positions 1-26 at rows 0-12 (2 per row)
    // Stacking should be on positions 26, 25 (rear row first, x=1200)
    const result = calculateLoadingLogic(
      'curtainSider',
      [],
      [{ id: 1, weight: '100', quantity: 28, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    const pallets = result.palletArrangement[0].pallets;
    expect(pallets.length).toBe(28);

    // Find stacked pallets (isStackedTier === 'top')
    const stackedPallets = pallets.filter((p: any) => p.isStackedTier === 'top');
    expect(stackedPallets.length).toBe(2);

    // Floor positions: row 0 at x=0, row 1 at x=100, ..., row 12 at x=1200
    // Positions 25,26 are at row 12 (x=1200)
    // Stacked pallets should be at the highest x (rear)
    const floorPallets = pallets.filter((p: any) => p.isStackedTier !== 'top');
    const maxFloorX = Math.max(...floorPallets.map((p: any) => p.x));

    // Both stacked pallets should be at the rear (max x = 1200)
    expect(maxFloorX).toBe(1200);
    stackedPallets.forEach((p: any) => {
      expect(p.x).toBe(maxFloorX);
    });
  });

  it('with 14 stacked DIN, stacking fills rear rows first', () => {
    // 40 DIN = 26 floor + 14 stacked
    // Stacking on positions 26,25,24,...,13 (rear to front)
    const result = calculateLoadingLogic(
      'curtainSider',
      [],
      [{ id: 1, weight: '100', quantity: 40, stackable: true }],
      false,
      true,
      'auto',
      'DIN_FIRST'
    );

    const pallets = result.palletArrangement[0].pallets;
    expect(pallets.length).toBe(40);

    const stackedPallets = pallets.filter((p: any) => p.isStackedTier === 'top');
    expect(stackedPallets.length).toBe(14);

    // Stacked pallets should have descending x values from rear
    // 14 pallets = 7 rows (2 per row) starting from rear
    // Row 12 (x=1200): 2 stacked
    // Row 11 (x=1100): 2 stacked
    // ...
    // Row 6 (x=600): 2 stacked (14 total)

    const stackedXValues = stackedPallets.map((p: any) => p.x).sort((a: number, b: number) => b - a);
    // Should have pairs at x=1200, 1100, 1000, 900, 800, 700, 600
    expect(stackedXValues[0]).toBe(1200);
    expect(stackedXValues[1]).toBe(1200);
  });

  it('EUP stacking starts at rear (highest x) and moves toward front', () => {
    // 40 EUP = 33 floor + 7 stacked
    const result = calculateLoadingLogic(
      'curtainSider',
      [{ id: 1, weight: '100', quantity: 40, stackable: true }],
      [],
      true,
      false,
      'auto',
      'EUP_FIRST'
    );

    const pallets = result.palletArrangement[0].pallets;
    expect(pallets.length).toBe(40);

    const stackedPallets = pallets.filter((p: any) => p.isStackedTier === 'top');
    expect(stackedPallets.length).toBe(7);

    // Stacked EUP should be at highest x values (rear)
    const floorPallets = pallets.filter((p: any) => p.isStackedTier !== 'top');
    const maxFloorX = Math.max(...floorPallets.map((p: any) => p.x));

    // Stacked pallets should start from the rear
    const stackedXValues = stackedPallets.map((p: any) => p.x).sort((a: number, b: number) => b - a);
    expect(stackedXValues[0]).toBe(maxFloorX);
  });
});
