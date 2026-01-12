import { describe, it, expect, beforeAll } from 'vitest';
import {
  calculateLoadingLogic,
  getTopLayerSlotPriority,
  TRUCK_TYPES,
  type WeightEntry,
} from './logic';

// ============================================================================
// Helper function tests
// ============================================================================
describe('getTopLayerSlotPriority', () => {
  it('returns correct priority order for typical trailer (10 slots, boundary at 3)', () => {
    const result = getTopLayerSlotPriority({ slotCount: 10, driveAxleBoundarySlotIndex: 3 });
    // Rear region (4-9) first, back-to-front: 9,8,7,6,5,4
    // Then front region (0-3), back-to-front: 3,2,1,0
    expect(result).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it('handles boundary at 0 (all rear except slot 0)', () => {
    const result = getTopLayerSlotPriority({ slotCount: 5, driveAxleBoundarySlotIndex: 0 });
    // Rear: 4,3,2,1; Front: 0
    expect(result).toEqual([4, 3, 2, 1, 0]);
  });

  it('handles boundary beyond last slot (all front)', () => {
    const result = getTopLayerSlotPriority({ slotCount: 5, driveAxleBoundarySlotIndex: 10 });
    // All front region, back-to-front: 4,3,2,1,0
    expect(result).toEqual([4, 3, 2, 1, 0]);
  });

  it('handles boundary at -1 (all rear)', () => {
    const result = getTopLayerSlotPriority({ slotCount: 5, driveAxleBoundarySlotIndex: -1 });
    // All rear region, back-to-front: 4,3,2,1,0
    expect(result).toEqual([4, 3, 2, 1, 0]);
  });

  it('returns empty for zero slots', () => {
    expect(getTopLayerSlotPriority({ slotCount: 0, driveAxleBoundarySlotIndex: 0 })).toEqual([]);
  });
});

// ============================================================================
// Test fixtures and helpers
// ============================================================================
const createStackableWeights = (quantity: number): WeightEntry[] => [
  { id: 1, weight: '100', quantity, stackable: true }
];

// Type for pallet in arrangement (matches structure in logic.ts)
interface PalletVisual {
  palletId: number;
  labelId: number;
  x: number;
  y: number;
  width: number;
  length: number;
  type: 'euro' | 'industrial';
  isStacked: boolean;
  baseIndex: number | null;
}

/**
 * Extracts stacking information from pallet arrangement.
 * Returns arrays of slot indices (based on X position) that have stacked pallets.
 */
function extractStackedSlotInfo(result: ReturnType<typeof calculateLoadingLogic>) {
  const pallets = (result.palletArrangement[0]?.pallets || []) as PalletVisual[];
  
  // Group pallets by type and stacking status
  const dinStacked: number[] = [];
  const eupStacked: number[] = [];
  
  pallets.forEach((p) => {
    if (p.isStacked) {
      // Convert x position to slot index (roughly: x / row_length)
      // For DIN: row_length = 100, for EUP broad: row_length = 80, for EUP long: row_length = 120
      const slotX = p.x;
      if (p.type === 'industrial') {
        if (!dinStacked.includes(slotX)) dinStacked.push(slotX);
      } else {
        if (!eupStacked.includes(slotX)) eupStacked.push(slotX);
      }
    }
  });
  
  // Sort by position (for comparison)
  dinStacked.sort((a, b) => a - b);
  eupStacked.sort((a, b) => a - b);
  
  return { dinStacked, eupStacked };
}

/**
 * Calculate single layer capacity for a given truck and pallet type
 */
function getSingleLayerCapacity(truckKey: keyof typeof TRUCK_TYPES, palletType: 'din' | 'eup') {
  // Run with max pallets, no stacking
  const weights = [{ id: 1, weight: '0', quantity: 300, stackable: false }];
  const result = palletType === 'din'
    ? calculateLoadingLogic(truckKey, [], weights, false, false, 'auto', 'DIN_FIRST')
    : calculateLoadingLogic(truckKey, weights, [], false, false, 'auto', 'EUP_FIRST');
  
  return palletType === 'din' ? result.totalDinPalletsVisual : result.totalEuroPalletsVisual;
}

// ============================================================================
// Partial double-stacking tests - DIN pallets
// ============================================================================
describe('DIN partial double-stacking slot order', () => {
  const truckKey = 'standard13_2' as const;
  let singleLayerCapacity: number;
  let driveAxleBoundaryX: number;
  
  beforeAll(() => {
    singleLayerCapacity = getSingleLayerCapacity(truckKey, 'din');
    driveAxleBoundaryX = TRUCK_TYPES[truckKey].driveAxleBoundaryX;
  });

  it('places top-layer pallets in rear region first (4 extra pallets)', () => {
    const topCount = 4;
    const palletCount = singleLayerCapacity + topCount;
    
    const weights = createStackableWeights(palletCount);
    const result = calculateLoadingLogic(
      truckKey,
      [],
      weights,
      false,
      true, // DIN stackable
      'auto',
      'DIN_FIRST',
      undefined,
      undefined,
      'axle_safe'
    );
    
    const { dinStacked } = extractStackedSlotInfo(result);
    
    // All stacked pallets should be behind the drive axle boundary
    dinStacked.forEach(xPos => {
      expect(xPos).toBeGreaterThan(driveAxleBoundaryX);
    });
    
    // We should have exactly topCount stacked positions (may have multiple pallets per row)
    expect(dinStacked.length).toBeGreaterThan(0);
    expect(dinStacked.length).toBeLessThanOrEqual(topCount);
  });

  it('fills rear region before using front region for stacking', () => {
    // Calculate how many rows fit in rear region
    // DIN rows are 100cm each, rear region starts after 380cm
    const truckLength = TRUCK_TYPES[truckKey].usableLength;
    const rowLength = 100; // DIN row length in cm
    const rearStartX = driveAxleBoundaryX;
    const maxRearRows = Math.floor((truckLength - rearStartX) / rowLength);
    const rearCapacity = maxRearRows * 2; // 2 DIN per row
    
    // Request enough top pallets to exceed rear capacity (if small) or test within
    const topCount = Math.min(rearCapacity, 8);
    const palletCount = singleLayerCapacity + topCount;
    
    const weights = createStackableWeights(palletCount);
    const result = calculateLoadingLogic(
      truckKey,
      [],
      weights,
      false,
      true,
      'auto',
      'DIN_FIRST',
      undefined,
      undefined,
      'axle_safe'
    );
    
    const { dinStacked } = extractStackedSlotInfo(result);
    
    // If topCount <= rearCapacity, NO stacked pallet should be in front region
    if (topCount <= rearCapacity) {
      const frontStacked = dinStacked.filter(x => x <= driveAxleBoundaryX);
      expect(frontStacked).toHaveLength(0);
    }
  });
});

// ============================================================================
// Partial double-stacking tests - EUP pallets
// ============================================================================
describe('EUP partial double-stacking slot order', () => {
  const truckKey = 'standard13_2' as const;
  let singleLayerCapacity: number;
  let driveAxleBoundaryX: number;
  
  beforeAll(() => {
    singleLayerCapacity = getSingleLayerCapacity(truckKey, 'eup');
    driveAxleBoundaryX = TRUCK_TYPES[truckKey].driveAxleBoundaryX;
  });

  it('places top-layer pallets in rear region first (7 extra pallets)', () => {
    const topCount = 7;
    const palletCount = singleLayerCapacity + topCount;
    
    const weights = createStackableWeights(palletCount);
    const result = calculateLoadingLogic(
      truckKey,
      weights,
      [],
      true, // EUP stackable
      false,
      'auto',
      'EUP_FIRST',
      undefined,
      undefined,
      'axle_safe'
    );
    
    const { eupStacked } = extractStackedSlotInfo(result);
    
    // All stacked pallets should be behind the drive axle boundary
    eupStacked.forEach(xPos => {
      expect(xPos).toBeGreaterThan(driveAxleBoundaryX);
    });
    
    expect(eupStacked.length).toBeGreaterThan(0);
  });

  it('fills rear region before using front region for stacking', () => {
    const truckLength = TRUCK_TYPES[truckKey].usableLength;
    // EUP 'broad' pattern uses 80cm rows
    const rowLength = 80;
    const rearStartX = driveAxleBoundaryX;
    const maxRearRows = Math.floor((truckLength - rearStartX) / rowLength);
    const rearCapacity = maxRearRows * 2; // 2 EUP per row in broad pattern
    
    const topCount = Math.min(rearCapacity, 10);
    const palletCount = singleLayerCapacity + topCount;
    
    const weights = createStackableWeights(palletCount);
    const result = calculateLoadingLogic(
      truckKey,
      weights,
      [],
      true,
      false,
      'broad', // Force broad pattern for predictable row length
      'EUP_FIRST',
      undefined,
      undefined,
      'axle_safe'
    );
    
    const { eupStacked } = extractStackedSlotInfo(result);
    
    if (topCount <= rearCapacity) {
      const frontStacked = eupStacked.filter(x => x <= driveAxleBoundaryX);
      expect(frontStacked).toHaveLength(0);
    }
  });
});

// ============================================================================
// Regression tests - Full double-stacking unchanged
// ============================================================================
describe('Full double-stacking regression', () => {
  const truckKey = 'standard13_2' as const;

  it('DIN full double: all base slots have stacked pallets', () => {
    const singleLayerCapacity = getSingleLayerCapacity(truckKey, 'din');
    const fullDoubleCount = singleLayerCapacity * 2;
    
    const weights = createStackableWeights(fullDoubleCount);
    const result = calculateLoadingLogic(
      truckKey,
      [],
      weights,
      false,
      true,
      'auto',
      'DIN_FIRST',
      undefined,
      undefined,
      'axle_safe'
    );
    
    // For full double, total pallets should equal 2x single layer capacity
    expect(result.totalDinPalletsVisual).toBe(fullDoubleCount);
    
    // Count base and stacked pallets
    const pallets = (result.palletArrangement[0]?.pallets || []) as PalletVisual[];
    const basePallets = pallets.filter((p) => !p.isStacked && p.type === 'industrial');
    const stackedPallets = pallets.filter((p) => p.isStacked && p.type === 'industrial');
    
    // Should have equal base and stacked counts
    expect(basePallets.length).toBe(singleLayerCapacity);
    expect(stackedPallets.length).toBe(singleLayerCapacity);
  });

  it('EUP full double: all base slots have stacked pallets', () => {
    const singleLayerCapacity = getSingleLayerCapacity(truckKey, 'eup');
    const fullDoubleCount = singleLayerCapacity * 2;
    
    const weights = createStackableWeights(fullDoubleCount);
    const result = calculateLoadingLogic(
      truckKey,
      weights,
      [],
      true,
      false,
      'auto',
      'EUP_FIRST',
      undefined,
      undefined,
      'axle_safe'
    );
    
    expect(result.totalEuroPalletsVisual).toBe(fullDoubleCount);
    
    const pallets = (result.palletArrangement[0]?.pallets || []) as PalletVisual[];
    const basePallets = pallets.filter((p) => !p.isStacked && p.type === 'euro');
    const stackedPallets = pallets.filter((p) => p.isStacked && p.type === 'euro');
    
    expect(basePallets.length).toBe(singleLayerCapacity);
    expect(stackedPallets.length).toBe(singleLayerCapacity);
  });
});

// ============================================================================
// Regression tests - Single layer unchanged
// ============================================================================
describe('Single layer regression', () => {
  const truckKey = 'standard13_2' as const;

  it('DIN single layer: no stacked pallets', () => {
    const singleLayerCapacity = getSingleLayerCapacity(truckKey, 'din');
    
    // Use exactly single layer capacity
    const weights = createStackableWeights(singleLayerCapacity);
    const result = calculateLoadingLogic(
      truckKey,
      [],
      weights,
      false,
      true,
      'auto',
      'DIN_FIRST',
      undefined,
      undefined,
      'axle_safe'
    );
    
    expect(result.totalDinPalletsVisual).toBe(singleLayerCapacity);
    
    const pallets = (result.palletArrangement[0]?.pallets || []) as PalletVisual[];
    const stackedPallets = pallets.filter((p) => p.isStacked && p.type === 'industrial');
    
    // No stacked pallets for single layer
    expect(stackedPallets.length).toBe(0);
  });

  it('EUP single layer: no stacked pallets', () => {
    const singleLayerCapacity = getSingleLayerCapacity(truckKey, 'eup');
    
    const weights = createStackableWeights(singleLayerCapacity);
    const result = calculateLoadingLogic(
      truckKey,
      weights,
      [],
      true,
      false,
      'auto',
      'EUP_FIRST',
      undefined,
      undefined,
      'axle_safe'
    );
    
    expect(result.totalEuroPalletsVisual).toBe(singleLayerCapacity);
    
    const pallets = (result.palletArrangement[0]?.pallets || []) as PalletVisual[];
    const stackedPallets = pallets.filter((p) => p.isStacked && p.type === 'euro');
    
    expect(stackedPallets.length).toBe(0);
  });

  it('DIN single layer baseline: floor distribution pattern', () => {
    const singleLayerCapacity = getSingleLayerCapacity(truckKey, 'din');
    
    const weights = createStackableWeights(singleLayerCapacity);
    const result = calculateLoadingLogic(
      truckKey,
      [],
      weights,
      false,
      false, // Not stackable to ensure single layer
      'auto',
      'DIN_FIRST'
    );
    
    const pallets = (result.palletArrangement[0]?.pallets || []) as PalletVisual[];
    
    // Verify pallets are placed in sequential rows from front (x=0) to back
    const xPositions = pallets.map((p) => p.x).sort((a, b) => a - b);
    
    // Should start from x=0
    expect(xPositions[0]).toBe(0);
    
    // Positions should be sequential (each row is 100cm for DIN)
    for (let i = 1; i < xPositions.length; i++) {
      const diff = xPositions[i] - xPositions[i - 1];
      // Either same row (diff=0) or next row (diff=100)
      expect([0, 100]).toContain(diff);
    }
  });
});

// ============================================================================
// Drive axle boundary configuration tests
// ============================================================================
describe('Drive axle boundary configuration', () => {
  it('all truck types have driveAxleBoundaryX defined', () => {
    Object.entries(TRUCK_TYPES).forEach(([, config]) => {
      expect(config.driveAxleBoundaryX).toBeDefined();
      expect(typeof config.driveAxleBoundaryX).toBe('number');
      expect(config.driveAxleBoundaryX).toBeGreaterThan(0);
    });
  });

  it('driveAxleBoundaryX is less than truck usable length', () => {
    Object.entries(TRUCK_TYPES).forEach(([, config]) => {
      expect(config.driveAxleBoundaryX).toBeLessThan(config.usableLength);
    });
  });
});
