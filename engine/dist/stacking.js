"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formColumns = formColumns;
exports.applyFrontZoneDowngrade = applyFrontZoneDowngrade;
function formColumns(items, maxStackHeight) {
    if (maxStackHeight <= 1)
        return items.map((it) => ({ items: [it] }));
    const columns = [];
    let buffer = [];
    for (const it of items) {
        buffer.push(it);
        if (buffer.length === maxStackHeight) {
            columns.push({ items: buffer });
            buffer = [];
        }
    }
    if (buffer.length > 0)
        columns.push({ items: buffer });
    return columns;
}
// Downgrade columns to singles if they cannot be placed within the front zone.
// In this scaffold, we conservatively downgrade nothing based on capacity.
// The packer is expected to place stacked items only in the front zone.
function applyFrontZoneDowngrade(columns, _frontStagingDepth, _preset) {
    // In a real implementation, calculate how many columns can fit within _frontStagingDepth
    // and downgrade overflow columns to single items. For now, return items unchanged.
    const items = [];
    for (const col of columns)
        items.push(...col.items);
    return items;
}
