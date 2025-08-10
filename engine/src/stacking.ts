import { Item, TruckPreset } from './types';

export type Column = { items: Item[] };

export function formColumns(items: Item[], maxStackHeight: number): Column[] {
  if (maxStackHeight <= 1) return items.map((it) => ({ items: [it] }));
  const columns: Column[] = [];
  let buffer: Item[] = [];
  for (const it of items) {
    buffer.push(it);
    if (buffer.length === maxStackHeight) {
      columns.push({ items: buffer });
      buffer = [];
    }
  }
  if (buffer.length > 0) columns.push({ items: buffer });
  return columns;
}

// Downgrade columns to singles if they cannot be placed within the front zone.
// In this scaffold, we conservatively downgrade nothing based on capacity.
// The packer is expected to place stacked items only in the front zone.
export function applyFrontZoneDowngrade(columns: Column[], _frontStagingDepth: number, _preset: TruckPreset): Item[] {
  // In a real implementation, calculate how many columns can fit within _frontStagingDepth
  // and downgrade overflow columns to single items. For now, return items unchanged.
  const items: Item[] = [];
  for (const col of columns) items.push(...col.items);
  return items;
}