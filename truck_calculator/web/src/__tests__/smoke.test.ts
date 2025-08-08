import { describe, it, expect } from 'vitest';
import { computeAxleLoadPerMeter } from '@rep0mancer/engine';

describe('web uses engine', () => {
  it('computes axle load', () => {
    expect(computeAxleLoadPerMeter(25000, 10)).toBe(2500);
  });
});