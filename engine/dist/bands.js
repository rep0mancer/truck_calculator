"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandUnits = expandUnits;
exports.splitIntoBands = splitIntoBands;
function getFamilyConfig(famCfgs, family) {
    const found = famCfgs.find((c) => c.family === family);
    return found ?? { family, stackableCount: 0, maxStackHeight: 2 };
}
function expandUnits(items) {
    const units = [];
    for (const item of items) {
        const qty = Math.max(1, Number(item.qty ?? 1));
        for (let i = 0; i < qty; i += 1) {
            units.push({ ...item, qty: 1 });
        }
    }
    return units;
}
function splitIntoBands(allItems, famCfgs) {
    const units = expandUnits(allItems);
    const eupCfg = getFamilyConfig(famCfgs, 'EUP');
    const dinCfg = getFamilyConfig(famCfgs, 'DIN');
    const EUP_units = units.filter((u) => u.family === 'EUP');
    const DIN_units = units.filter((u) => u.family === 'DIN');
    const EUP_stacked = [];
    const EUP_unstacked = [];
    const DIN_stacked = [];
    const DIN_unstacked = [];
    // Preserve original order while taking first N to stacked
    for (let i = 0; i < EUP_units.length; i += 1) {
        if (i < eupCfg.stackableCount)
            EUP_stacked.push(EUP_units[i]);
        else
            EUP_unstacked.push(EUP_units[i]);
    }
    for (let i = 0; i < DIN_units.length; i += 1) {
        if (i < dinCfg.stackableCount)
            DIN_stacked.push(DIN_units[i]);
        else
            DIN_unstacked.push(DIN_units[i]);
    }
    return { EUP_stacked, EUP_unstacked, DIN_stacked, DIN_unstacked };
}
