"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequence_1 = require("./sequence");
const items = [
    { family: 'EUP', qty: 32 },
    { family: 'DIN', qty: 2 },
];
const famCfgs = [
    { family: 'EUP', stackableCount: 4, maxStackHeight: 2 },
    { family: 'DIN', stackableCount: 0, maxStackHeight: 2 },
];
const preset = { lengthMm: 13600, widthMm: 2460, heightMm: 2700 };
const opts = {
    enforceRowPairConsistency: false,
    frontStagingDepth: 2000,
    blockStrategy: 'fixed',
    fixedSequence: ['DIN_stacked', 'EUP_stacked', 'DIN_unstacked', 'EUP_unstacked'],
};
const result = (0, sequence_1.planWithFixedSequence)(items, famCfgs, preset, opts);
console.log(JSON.stringify(result, null, 2));
