export function computeAxleLoadPerMeter(totalWeightKg, usableLengthM) {
    if (usableLengthM <= 0) {
        throw new Error('usableLengthM must be greater than 0');
    }
    return totalWeightKg / usableLengthM;
}
export function sumCargoWeight(cargo) {
    return cargo.reduce((acc, item) => acc + item.weightKg, 0);
}
//# sourceMappingURL=index.js.map