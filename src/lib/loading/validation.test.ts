import { describe, expect, it } from 'vitest';
import { MAX_PALLET_WEIGHT_KG, validateWeightEntries } from './validation';

const entry = (weight: unknown, quantity: unknown) => [{ id: 1, weight, quantity }];

describe('loading boundary validation', () => {
  it.each([
    ['negative quantity', '100', -1],
    ['decimal quantity', '100', 1.5],
    ['NaN quantity', '100', Number.NaN],
    ['infinite quantity', '100', Number.POSITIVE_INFINITY],
  ])('rejects %s', (_name, weight, quantity) => {
    expect(validateWeightEntries(entry(weight, quantity)).success).toBe(false);
  });

  it.each([
    ['negative', '-1'],
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
    ['empty', ''],
    ['scientific notation', '1e3'],
    ['extremely large', String(MAX_PALLET_WEIGHT_KG + 1)],
    ['partial number', '12kg'],
  ])('rejects %s pallet weights', (_name, weight) => {
    const result = validateWeightEntries(entry(weight, 1));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]).toMatchObject({ entryId: 1, field: 'weight' });
  });

  it('accepts localized decimals and returns typed values', () => {
    expect(validateWeightEntries(entry('123,5', 2))).toEqual({
      success: true,
      data: [{ id: 1, weight: 123.5, quantity: 2 }],
      errors: [],
    });
  });

  it('rejects invalid programmatic state before candidates can lower payload', () => {
    const valid = validateWeightEntries(entry('500', 2));
    const malicious = validateWeightEntries(entry('-500', 2));
    expect(valid.success && valid.data.reduce((sum, item) => sum + item.weight * item.quantity, 0)).toBe(1000);
    expect(malicious.success).toBe(false);
    if (!malicious.success) expect(malicious.data).toBeNull();
  });
});
