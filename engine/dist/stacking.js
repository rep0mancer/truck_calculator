"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formColumns = formColumns;
exports.buildStackedBands = buildStackedBands;
exports.computeRowDepthByFamily = computeRowDepthByFamily;
exports.applyFrontZoneDowngrade = applyFrontZoneDowngrade;
function sumNumber(values) {
    let total = 0;
    for (const v of values) {
        if (typeof v === 'number' && Number.isFinite(v))
            total += v;
    }
    return total;
}
function makeColumn(units) {
    const family = (units[0]?.family ?? 'EUP');
    const height = sumNumber(units.map((u) => u.heightMm));
    const weight = sumNumber(units.map((u) => u.weightKg));
    return { units, height, weight, family };
}
function formColumns(units, maxStackHeight) {
    if (maxStackHeight <= 1) {
        return { columns: [], singles: [...units] };
    }
    const columns = [];
    const singles = [];
    // Prefer full columns: greedily take groups of exactly maxStackHeight; leftover become singles
    let buffer = [];
    for (const unit of units) {
        buffer.push(unit);
        if (buffer.length === maxStackHeight) {
            columns.push(makeColumn(buffer));
            buffer = [];
        }
    }
    if (buffer.length > 0) {
        // Do not form a partial column; push leftover as singles
        singles.push(...buffer);
    }
    return { columns, singles };
}
function getMaxStackHeightForFamily(famCfgs, family) {
    const cfg = famCfgs.find((c) => c.family === family);
    return cfg?.maxStackHeight ?? 2;
}
function buildStackedBands(bands, famCfgs) {
    const eupMax = getMaxStackHeightForFamily(famCfgs, 'EUP');
    const dinMax = getMaxStackHeightForFamily(famCfgs, 'DIN');
    const { columns: EUP_columns, singles: EUP_singles } = formColumns(bands.EUP_stacked, eupMax);
    const { columns: DIN_columns, singles: DIN_singles } = formColumns(bands.DIN_stacked, dinMax);
    return { EUP_columns, DIN_columns, EUP_singles, DIN_singles };
}
function computeRowDepthByFamily(_preset, _opts) {
    // Example heuristic: both families use approximately 1200mm depth plus any needed clearances.
    // Clearances can be parameterized later; keep simple for now.
    const baseDepthMm = 1200;
    const clearanceMm = 0;
    return { EUP: baseDepthMm + clearanceMm, DIN: baseDepthMm + clearanceMm };
}
function applyFrontZoneDowngrade(stacked, preset, opts, rowDepthByFamily) {
    const warnings = [];
    let downgradedCount = 0;
    function trimForFamily(columns, family) {
        const rowDepth = Math.max(1, Math.floor(rowDepthByFamily[family]));
        const rowsFit = Math.max(0, Math.floor(opts.frontStagingDepth / rowDepth));
        if (columns.length <= rowsFit) {
            return { kept: columns, removed: [], downgradedUnits: [] };
        }
        const kept = columns.slice(0, rowsFit);
        const removed = columns.slice(rowsFit);
        const downgradedUnits = removed.flatMap((c) => c.units);
        return { kept, removed, downgradedUnits };
    }
    const eupTrim = trimForFamily(stacked.EUP_columns, 'EUP');
    if (eupTrim.removed.length > 0) {
        const count = eupTrim.downgradedUnits.length;
        downgradedCount += count;
        warnings.push(`Stacked EUP: downgraded ${count} units; front zone capacity exceeded.`);
    }
    const dinTrim = trimForFamily(stacked.DIN_columns, 'DIN');
    if (dinTrim.removed.length > 0) {
        const count = dinTrim.downgradedUnits.length;
        downgradedCount += count;
        warnings.push(`Stacked DIN: downgraded ${count} units; front zone capacity exceeded.`);
    }
    const updated = {
        EUP_columns: eupTrim.kept,
        DIN_columns: dinTrim.kept,
        EUP_singles: stacked.EUP_singles, // leftover from stacked band stays here; caller will append downgraded to unstacked bands
        DIN_singles: stacked.DIN_singles,
    };
    return {
        stacked: updated,
        downgradedCount,
        warnings,
        downgraded: { EUP: eupTrim.downgradedUnits, DIN: dinTrim.downgradedUnits },
    };
}
