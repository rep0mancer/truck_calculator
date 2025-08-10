"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packBandSequence = packBandSequence;
function getFamilyWidthMm(f) {
    return f === 'EUP' ? 800 : 1000;
}
function getFamilyDepthMm(f) {
    return 1200;
}
function getUnitWeight(u) {
    if (u.weight != null)
        return u.weight; // Column has weight
    const w = u.weightKg;
    return typeof w === 'number' && Number.isFinite(w) ? w : 0;
}
function buildRowsForBand(kind, prepared) {
    const family = kind.includes('EUP') ? 'EUP' : 'DIN';
    const depth = getFamilyDepthMm(family);
    let pool = [];
    if (kind === 'EUP_stacked')
        pool = [...prepared.EUP_columns];
    if (kind === 'DIN_stacked')
        pool = [...prepared.DIN_columns];
    if (kind === 'EUP_unstacked')
        pool = [...prepared.unstacked_EUP, ...prepared.EUP_singles];
    if (kind === 'DIN_unstacked')
        pool = [...prepared.unstacked_DIN, ...prepared.DIN_singles];
    const rows = [];
    // two-across, pair-consistent
    for (let i = 0; i < pool.length; i += 2) {
        const a = pool[i];
        const b = pool[i + 1];
        if (!b) {
            // orphan; carry forward as potential remainder handled by caller
            rows.push({ family, items: [a], weight: getUnitWeight(a), depthMm: depth });
            break;
        }
        const rowItems = [a, b];
        const weight = getUnitWeight(a) + getUnitWeight(b);
        rows.push({ family, items: rowItems, weight, depthMm: depth });
    }
    return rows;
}
function packBandSequence(seq, prepared, preset, opts) {
    const placements = [];
    const rejected = [];
    const notes = [];
    let yCursor = 0; // front-to-back from bulkhead
    const widthMm = preset.widthMm;
    const lengthMm = preset.lengthMm;
    const aisleReserve = Math.max(0, Math.floor(opts.aisleReserve ?? 0));
    const usableLength = Math.max(0, lengthMm - aisleReserve);
    const sequenceUsed = [];
    const bandCounts = {};
    for (const band of seq) {
        // Build rows for this band
        const rows = buildRowsForBand(band, prepared);
        // Count items eligible in this band
        const countInBand = rows.reduce((acc, r) => acc + (r.items.length >= 2 ? 2 : 1), 0);
        bandCounts[band] = countInBand;
        if (countInBand === 0)
            continue;
        // Sort heavy-forward within the band
        const fullRows = rows.filter(r => r.items.length === 2);
        const orphan = rows.find(r => r.items.length === 1);
        fullRows.sort((a, b) => b.weight - a.weight);
        const family = band.includes('EUP') ? 'EUP' : 'DIN';
        const rowDepth = getFamilyDepthMm(family);
        const rowWidth = getFamilyWidthMm(family) * 2; // two across
        // Ensure fits width
        if (rowWidth > widthMm) {
            notes.push(`Row width ${rowWidth} exceeds truck width ${widthMm} for ${family}.`);
            // reject all units in this band for width issue
            for (const r of fullRows) {
                for (const u of r.items)
                    rejected.push({ item: u, reason: 'row-width' });
            }
            if (orphan)
                rejected.push({ item: orphan.items[0], reason: 'row-width' });
            continue;
        }
        // Place rows front-to-back within remaining length
        let placedAny = false;
        for (const row of fullRows) {
            if (yCursor + rowDepth > usableLength) {
                // cannot place more rows in this band; reject remaining in this band for length
                for (const r of fullRows.slice(fullRows.indexOf(row))) {
                    for (const u of r.items)
                        rejected.push({ item: u, reason: opts.enforceRowPairConsistency ? 'pair-consistency' : 'length' });
                }
                if (orphan)
                    rejected.push({ item: orphan.items[0], reason: opts.enforceRowPairConsistency ? 'pair-consistency' : 'length' });
                break;
            }
            // x placement: two slots across width, same family per row
            const slotW = getFamilyWidthMm(row.family);
            const xLeft = Math.floor((widthMm - slotW * 2) / 2); // center the two-across
            // left slot
            placements.push({ x: xLeft, y: yCursor, w: slotW, h: rowDepth, rotated: false, idx: placements.length });
            // right slot
            placements.push({ x: xLeft + slotW, y: yCursor, w: slotW, h: rowDepth, rotated: false, idx: placements.length });
            yCursor += rowDepth;
            placedAny = true;
        }
        // If there is an orphan, enforce pair-consistency
        if (orphan) {
            if (yCursor + rowDepth <= usableLength) {
                // Carry forward orphan to next band of same family if exists later in seq, else reject
                const laterBandExists = seq.slice(seq.indexOf(band) + 1).some(b => b.includes(orphan.family));
                if (!laterBandExists || !opts.enforceRowPairConsistency) {
                    rejected.push({ item: orphan.items[0], reason: 'pair-consistency' });
                }
                else {
                    notes.push(`Carried forward orphan ${orphan.family} unit for pairing in later band.`);
                    // Put back into appropriate unstacked pool to pair later
                    if (orphan.family === 'EUP')
                        prepared.unstacked_EUP.unshift(orphan.items[0]);
                    else
                        prepared.unstacked_DIN.unshift(orphan.items[0]);
                }
            }
            else {
                rejected.push({ item: orphan.items[0], reason: 'pair-consistency' });
            }
        }
        if (placedAny)
            sequenceUsed.push(band);
    }
    const usedLengthMm = yCursor;
    const result = {
        sequenceUsed,
        bandCounts,
        placements,
        rejected,
        notes: [
            'Packed bands front-to-back with pair-consistent two-across rows and heavy-forward bias.',
            `Aisle reserve ${aisleReserve}mm respected at rear.`,
        ],
        usedLengthMm,
        usedWidthMm: widthMm,
        usedHeightMm: preset.heightMm,
    };
    return result;
}
