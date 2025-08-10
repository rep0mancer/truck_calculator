"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packBandSequence = packBandSequence;
function packBandSequence(bands, sequence, _preset, _opts) {
    const sequenceUsed = [];
    const bandCounts = {
        EUP_stacked: bands.EUP_stacked.length,
        EUP_unstacked: bands.EUP_unstacked.length,
        DIN_stacked: bands.DIN_stacked.length,
        DIN_unstacked: bands.DIN_unstacked.length,
    };
    for (const bandName of sequence) {
        const count = bandCounts[bandName] ?? 0;
        if (count > 0)
            sequenceUsed.push(bandName);
    }
    return {
        sequenceUsed,
        bandCounts,
        notes: ['Packed using fixed sequence; empty bands skipped.'],
    };
}
