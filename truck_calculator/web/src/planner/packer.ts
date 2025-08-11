import type { PackOptions, PlanResult, TruckPreset, Item, Placement } from './types';
import type { Column } from './stacking';

export type SeqBand = 'DIN_stacked'|'EUP_stacked'|'DIN_unstacked'|'EUP_unstacked';

interface Prepared {
  EUP_columns: Column[]; DIN_columns: Column[];
  EUP_singles: Item[];  DIN_singles: Item[];
  unstacked_EUP: Item[];
  unstacked_DIN: Item[];
}

interface RowCandidate {
  family: 'EUP'|'DIN';
  items: (Item | Column)[];
  weight: number;
  depthMm: number;
}

function getFamilyWidthMm(f: 'EUP'|'DIN'): number { return f === 'EUP' ? 800 : 1000; }
function getFamilyDepthMm(_f: 'EUP'|'DIN'): number { return 1200; }
function getUnitWeight(u: Item | Column): number {
  if ((u as any).weight != null) return (u as any).weight as number;
  const w = (u as any).weightKg;
  return typeof w === 'number' && Number.isFinite(w) ? w : 0;
}

function buildRowsForBand(kind: SeqBand, prepared: Prepared): RowCandidate[] {
  const family: 'EUP'|'DIN' = kind.includes('EUP') ? 'EUP' : 'DIN';
  const depth = getFamilyDepthMm(family);

  let pool: Array<Item|Column> = [];
  if (kind === 'EUP_stacked') pool = [...prepared.EUP_columns];
  if (kind === 'DIN_stacked') pool = [...prepared.DIN_columns];
  if (kind === 'EUP_unstacked') pool = [...prepared.unstacked_EUP, ...prepared.EUP_singles];
  if (kind === 'DIN_unstacked') pool = [...prepared.unstacked_DIN, ...prepared.DIN_singles];

  const rows: RowCandidate[] = [];
  for (let i = 0; i < pool.length; i += 2) {
    const a = pool[i];
    const b = pool[i + 1];
    if (!b) {
      rows.push({ family, items: [a], weight: getUnitWeight(a), depthMm: depth });
      break;
    }
    const rowItems: (Item|Column)[] = [a, b];
    const weight = getUnitWeight(a) + getUnitWeight(b);
    rows.push({ family, items: rowItems, weight, depthMm: depth });
  }
  return rows;
}

function deriveUnitsAndHeight(u: Item | Column): { units: Item[]; heightMm: number } {
  if ((u as any).units && (u as any).height != null) {
    const col = u as Column;
    return { units: [...col.units], heightMm: Math.max(0, Math.floor(col.height)) };
    }
  const item = u as Item;
  const h = (item as any).heightMm;
  const heightMm = typeof h === 'number' && Number.isFinite(h) ? Math.max(0, Math.floor(h)) : 0;
  return { units: [item], heightMm };
}

export function packBandSequence(
  seq: SeqBand[],
  prepared: Prepared,
  preset: TruckPreset,
  opts: PackOptions
): PlanResult {
  const placements: Placement[] = [];
  const rejected: { item: Item; reason: string }[] = [];
  const notes: string[] = [];

  let yCursor = 0;
  const widthMm = preset.widthMm;
  const lengthMm = preset.lengthMm;
  const aisleReserve = Math.max(0, Math.floor(opts.aisleReserve ?? 0));
  const usableLength = Math.max(0, lengthMm - aisleReserve);

  const sequenceUsed: PlanResult['sequenceUsed'] = [];
  const bandCounts: Record<string, number> = {};

  for (const band of seq) {
    const rows = buildRowsForBand(band, prepared);
    const countInBand = rows.reduce((acc, r) => acc + (r.items.length >= 2 ? 2 : 1), 0);
    bandCounts[band] = countInBand;
    if (countInBand === 0) continue;

    const fullRows = rows.filter(r => r.items.length === 2);
    const orphan = rows.find(r => r.items.length === 1);
    fullRows.sort((a, b) => b.weight - a.weight);

    const family = band.includes('EUP') ? 'EUP' : 'DIN';
    const rowDepth = getFamilyDepthMm(family);
    const rowWidth = getFamilyWidthMm(family) * 2;

    if (rowWidth > widthMm) {
      notes.push(`Row width ${rowWidth} exceeds truck width ${widthMm} for ${family}.`);
      for (const r of fullRows) {
        for (const u of r.items as Item[]) rejected.push({ item: u as Item, reason: 'row-width' });
      }
      if (orphan) rejected.push({ item: orphan.items[0] as Item, reason: 'row-width' });
      continue;
    }

    let placedAny = false;
    for (const row of fullRows) {
      if (yCursor + rowDepth > usableLength) {
        for (const r of fullRows.slice(fullRows.indexOf(row))) {
          for (const u of r.items as Item[]) rejected.push({ item: u as Item, reason: opts.enforceRowPairConsistency ? 'pair-consistency' : 'length' });
        }
        if (orphan) rejected.push({ item: orphan.items[0] as Item, reason: opts.enforceRowPairConsistency ? 'pair-consistency' : 'length' });
        break;
      }
      const slotW = getFamilyWidthMm(row.family);
      const xLeft = Math.floor((widthMm - slotW * 2) / 2);

      const leftMeta = deriveUnitsAndHeight(row.items[0]);
      const rightMeta = deriveUnitsAndHeight(row.items[1]);

      placements.push({ x: xLeft, y: yCursor, w: slotW, h: rowDepth, rotated: false, idx: placements.length, z: 0, stackHeightMm: leftMeta.heightMm, units: leftMeta.units });
      placements.push({ x: xLeft + slotW, y: yCursor, w: slotW, h: rowDepth, rotated: false, idx: placements.length, z: 0, stackHeightMm: rightMeta.heightMm, units: rightMeta.units });
      yCursor += rowDepth;
      placedAny = true;
    }

    if (orphan) {
      if (yCursor + rowDepth <= usableLength) {
        const laterBandExists = seq.slice(seq.indexOf(band) + 1).some(b => b.includes(orphan.family));
        if (!laterBandExists || !opts.enforceRowPairConsistency) {
          rejected.push({ item: orphan.items[0] as Item, reason: 'pair-consistency' });
        } else {
          notes.push(`Carried forward orphan ${orphan.family} unit for pairing in later band.`);
          if (orphan.family === 'EUP') prepared.unstacked_EUP.unshift(orphan.items[0] as Item);
          else prepared.unstacked_DIN.unshift(orphan.items[0] as Item);
        }
      } else {
        rejected.push({ item: orphan.items[0] as Item, reason: 'pair-consistency' });
      }
    }

    if (placedAny) sequenceUsed.push(band);
  }

  const usedLengthMm = yCursor;
  const result: PlanResult = {
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