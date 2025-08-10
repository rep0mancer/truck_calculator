"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planWithFixedSequence = planWithFixedSequence;
const bands_1 = require("./bands");
const stacking_1 = require("./stacking");
const packer_1 = require("./packer");
function flattenColumnsToItems(columns) {
    const items = [];
    for (const c of columns)
        items.push(...c.units);
    return items;
}
function planWithFixedSequence(items, famCfgs, preset, opts) {
    // a) build bands (units)
    const unitBands = (0, bands_1.splitIntoBands)(items, famCfgs);
    // b) transform stacked units → columns (+ leftover singles)
    const stacked = (0, stacking_1.buildStackedBands)(unitBands, famCfgs);
    // c) enforce front zone by downgrading overflow columns to singles
    const rowDepthByFamily = (0, stacking_1.computeRowDepthByFamily)(preset, opts);
    const downgrade = (0, stacking_1.applyFrontZoneDowngrade)(stacked, preset, opts, rowDepthByFamily);
    // d) prepare pools for packing
    const prepared = {
        EUP_columns: downgrade.stacked.EUP_columns,
        DIN_columns: downgrade.stacked.DIN_columns,
        EUP_singles: downgrade.stacked.EUP_singles,
        DIN_singles: downgrade.stacked.DIN_singles,
        // unstacked pools from original unstacked items plus downgraded overflow
        unstacked_EUP: [
            ...unitBands.EUP_unstacked,
            ...downgrade.downgraded.EUP,
        ],
        unstacked_DIN: [
            ...unitBands.DIN_unstacked,
            ...downgrade.downgraded.DIN,
        ],
    };
    // e) pack in fixed sequence (skip empty bands)
    const packed = (0, packer_1.packBandSequence)(opts.fixedSequence, prepared, preset, opts);
    // f) append warnings
    const notes = [
        ...(packed.notes ?? []),
        ...downgrade.warnings,
    ];
    return {
        ...packed,
        notes,
    };
}
