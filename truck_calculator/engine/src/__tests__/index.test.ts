import { computeAxleLoadPerMeter, sumCargoWeight } from '../index';

describe('engine', () => {
  it('computes axle load per meter deterministically', () => {
    expect(computeAxleLoadPerMeter(25000, 10)).toBe(2500);
  });

  it('sums cargo weight', () => {
    expect(sumCargoWeight([{ id: 'a', weightKg: 1000, lengthM: 1 }])).toBe(1000);
  });
});