export type CargoItem = {
  id: string;
  weightKg: number;
  lengthM: number;
};

export function computeAxleLoadPerMeter(totalWeightKg: number, usableLengthM: number): number {
  if (usableLengthM <= 0) {
    throw new Error('usableLengthM must be greater than 0');
  }
  return totalWeightKg / usableLengthM;
}

export function sumCargoWeight(cargo: CargoItem[]): number {
  return cargo.reduce((acc, item) => acc + item.weightKg, 0);
}