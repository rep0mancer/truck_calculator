"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planWithFixedSequence = planWithFixedSequence;
const bands_1 = require("./bands");
const stacking_1 = require("./stacking");
const packer_1 = require("./packer");
function getMaxHeightForFamily(famCfgs, family) {
    const cfg = famCfgs.find((c) => c.family === family);
    return cfg?.maxStackHeight ?? 2;
}
function planWithFixedSequence(items, famCfgs, preset, opts) {
    // a) build bands (units)
    const unitBands = (0, bands_1.splitIntoBands)(items, famCfgs);
    // b) transform stacked units → columns
    const eupMax = getMaxHeightForFamily(famCfgs, 'EUP');
    const dinMax = getMaxHeightForFamily(famCfgs, 'DIN');
    const eupColumns = (0, stacking_1.formColumns)(unitBands.EUP_stacked, eupMax);
    const dinColumns = (0, stacking_1.formColumns)(unitBands.DIN_stacked, dinMax);
    // c) enforce stacked-only front zone via downgrade (overflow columns → singles)
    const eupAfterZone = (0, stacking_1.applyFrontZoneDowngrade)(eupColumns, opts.frontStagingDepth, preset);
    const dinAfterZone = (0, stacking_1.applyFrontZoneDowngrade)(dinColumns, opts.frontStagingDepth, preset);
    const bandsForPacking = {
        EUP_stacked: eupAfterZone,
        DIN_stacked: dinAfterZone,
        EUP_unstacked: unitBands.EUP_unstacked,
        DIN_unstacked: unitBands.DIN_unstacked,
    };
    // d) pack in fixed sequence (skip empty bands)
    return (0, packer_1.packBandSequence)(bandsForPacking, opts.fixedSequence, preset, opts);
}
