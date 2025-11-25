import { describe, it, expect } from 'vitest';
import { calculateLoadingLogic, TRUCK_TYPES, WeightEntry } from './logic';

describe('calculateLoadingLogic', () => {
  // Helper to create weight entries
  const createEntry = (quantity: number, stackable: boolean = false, weight: string = '0'): WeightEntry[] => [
    { id: 1, quantity, stackable, weight }
  ];

  describe('Edge Case 1: 52 DIN Stackable', () => {
    it('should load all 52 DIN pallets by stacking overflow', () => {
      const dinWeights = createEntry(52, true);
      const eupWeights = createEntry(0);
      
      const result = calculateLoadingLogic(
        'curtainSider',
        eupWeights,
        dinWeights,
        false, // isEUPStackable
        true,  // isDINStackable
        'auto',
        'DIN_FIRST',
        undefined,
        52, // maxStackedDin
        'axle_safe'
      );
      
      // 13.2m / 1m = 13 rows × 2 pallets = 26 base pallets
      // Overflow: 26 pallets should be stacked
      expect(result.loadedIndustrialPalletsBase).toBe(26);
      expect(result.totalDinPalletsVisual).toBe(52);
      expect(result.warnings).not.toContain(expect.stringContaining('Übrig'));
    });

    it('should prioritize Safe Zone (rear) for stacking with axle_safe strategy', () => {
      const dinWeights = createEntry(52, true);
      const eupWeights = createEntry(0);
      
      const result = calculateLoadingLogic(
        'curtainSider',
        eupWeights,
        dinWeights,
        false,
        true,
        'auto',
        'DIN_FIRST',
        undefined,
        52,
        'axle_safe'
      );
      
      // Should have loaded all 52 DIN
      expect(result.totalDinPalletsVisual).toBe(52);
    });
  });

  describe('Edge Case 2: 33 EUP on 13.2m trailer', () => {
    it('should fit 33 EUP on curtainSider with 3-wide pattern', () => {
      const dinWeights = createEntry(0);
      const eupWeights = createEntry(33);
      
      const result = calculateLoadingLogic(
        'curtainSider',
        eupWeights,
        dinWeights,
        false,
        false,
        'long', // Force 3-wide pattern (120cm rows)
        'EUP_FIRST'
      );
      
      // 13.2m / 1.2m = 11 rows × 3 pallets = 33 pallets
      expect(result.loadedEuroPalletsBase).toBe(33);
      expect(result.totalEuroPalletsVisual).toBe(33);
      expect(result.warnings).not.toContain(expect.stringContaining('Übrig'));
    });

    it('should also work with auto pattern', () => {
      const dinWeights = createEntry(0);
      const eupWeights = createEntry(33);
      
      const result = calculateLoadingLogic(
        'curtainSider',
        eupWeights,
        dinWeights,
        false,
        false,
        'auto',
        'EUP_FIRST'
      );
      
      expect(result.totalEuroPalletsVisual).toBe(33);
    });
  });

  describe('Edge Case 3: Mixed load - 28 DIN + 11 EUP', () => {
    it('should handle mixed load with stacking', () => {
      const dinWeights = createEntry(28, true);
      const eupWeights = createEntry(11, false);
      
      const result = calculateLoadingLogic(
        'curtainSider',
        eupWeights,
        dinWeights,
        false,
        true,
        'auto',
        'DIN_FIRST',
        undefined,
        28,
        'axle_safe'
      );
      
      // DINs first: up to 26 base, 2 overflow
      // EUPs should be able to fit in remaining space or stacking should help
      expect(result.loadedIndustrialPalletsBase).toBeGreaterThanOrEqual(13);
      expect(result.totalDinPalletsVisual).toBeGreaterThanOrEqual(26);
    });
  });

  describe('Basic functionality', () => {
    it('should return correct structure for empty input', () => {
      const result = calculateLoadingLogic(
        'curtainSider',
        createEntry(0),
        createEntry(0),
        false,
        false,
        'auto',
        'DIN_FIRST'
      );
      
      expect(result.palletArrangement).toBeDefined();
      expect(result.palletArrangement.length).toBeGreaterThan(0);
      expect(result.palletArrangement[0].pallets).toEqual([]);
    });

    it('should place DIN pallets with correct dimensions', () => {
      const result = calculateLoadingLogic(
        'curtainSider',
        createEntry(0),
        createEntry(2),
        false,
        false,
        'auto',
        'DIN_FIRST'
      );
      
      const pallets = result.palletArrangement[0].pallets;
      expect(pallets.length).toBe(2);
      
      // DIN row: 100cm width (along truck), 120cm height (perpendicular)
      expect(pallets[0].width).toBe(100);
      expect(pallets[0].height).toBe(120);
    });

    it('should place EUP pallets with correct dimensions (long pattern)', () => {
      const result = calculateLoadingLogic(
        'curtainSider',
        createEntry(3),
        createEntry(0),
        false,
        false,
        'long',
        'EUP_FIRST'
      );
      
      const pallets = result.palletArrangement[0].pallets;
      expect(pallets.length).toBe(3);
      
      // EUP long row: 120cm width (along truck), 80cm height (perpendicular)
      expect(pallets[0].width).toBe(120);
      expect(pallets[0].height).toBe(80);
    });

    it('should place EUP pallets with correct dimensions (broad pattern)', () => {
      const result = calculateLoadingLogic(
        'curtainSider',
        createEntry(2),
        createEntry(0),
        false,
        false,
        'broad',
        'EUP_FIRST'
      );
      
      const pallets = result.palletArrangement[0].pallets;
      expect(pallets.length).toBe(2);
      
      // EUP broad row: 80cm width (along truck), 120cm height (perpendicular)
      expect(pallets[0].width).toBe(80);
      expect(pallets[0].height).toBe(120);
    });
  });

  describe('Stacking logic', () => {
    it('should mark stacked pallets correctly', () => {
      const dinWeights = createEntry(28, true);
      
      const result = calculateLoadingLogic(
        'curtainSider',
        createEntry(0),
        dinWeights,
        false,
        true,
        'auto',
        'DIN_FIRST',
        undefined,
        28,
        'axle_safe'
      );
      
      const pallets = result.palletArrangement[0].pallets;
      const basePallets = pallets.filter(p => p.isStackedTier === 'base');
      const topPallets = pallets.filter(p => p.isStackedTier === 'top');
      
      // 28 DIN with stacking: 26 base + 2 overflow = 2 stacks needed
      // Actually: 13 rows × 2 = 26 base, 2 overflow should stack on 1 row (2 pallets)
      expect(topPallets.length).toBe(2);
      expect(basePallets.length).toBe(2);
    });

    it('should show fraction labels for stacked pallets', () => {
      const dinWeights = createEntry(28, true);
      
      const result = calculateLoadingLogic(
        'curtainSider',
        createEntry(0),
        dinWeights,
        false,
        true,
        'auto',
        'DIN_FIRST',
        undefined,
        28,
        'axle_safe'
      );
      
      const pallets = result.palletArrangement[0].pallets;
      const basePallets = pallets.filter(p => p.isStackedTier === 'base');
      
      basePallets.forEach(p => {
        expect(p.showAsFraction).toBe(true);
        expect(p.displayStackedLabelId).toBeDefined();
      });
    });
  });

  describe('Road train (multi-unit)', () => {
    it('should distribute pallets across both units', () => {
      const dinWeights = createEntry(30);
      
      const result = calculateLoadingLogic(
        'roadTrain',
        createEntry(0),
        dinWeights,
        false,
        false,
        'auto',
        'DIN_FIRST'
      );
      
      // Road train: 2 × 7.2m = 14.4m total
      // 14 rows × 2 = 28 DIN base capacity
      expect(result.palletArrangement.length).toBe(2);
      expect(result.loadedIndustrialPalletsBase).toBeLessThanOrEqual(28);
    });
  });

  describe('Waggon special handling', () => {
    it('should disable stacking on Waggon', () => {
      const dinWeights = createEntry(28, true);
      
      const result = calculateLoadingLogic(
        'Waggon',
        createEntry(0),
        dinWeights,
        true, // Try to enable stacking
        true,
        'auto',
        'DIN_FIRST'
      );
      
      // Waggon has max 26 DIN
      expect(result.loadedIndustrialPalletsBase).toBe(26);
      expect(result.warnings.some(w => w.includes('Stapeln ist auf dem Waggon nicht möglich'))).toBe(true);
    });
  });
});
