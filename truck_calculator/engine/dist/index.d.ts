export type CargoItem = {
    id: string;
    weightKg: number;
    lengthM: number;
};
export declare function computeAxleLoadPerMeter(totalWeightKg: number, usableLengthM: number): number;
export declare function sumCargoWeight(cargo: CargoItem[]): number;
//# sourceMappingURL=index.d.ts.map