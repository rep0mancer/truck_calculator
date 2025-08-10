import { PackOptions, PlanResult, TruckPreset, Item, Placement } from './types';
import { Column } from './stacking';

// Row template: two-across for EUP (1200x800) and DIN (1200x1000).
// Place columns (stacked) and singles (unstacked) as rows with two same-family slots per row.
// If odd unit remains, carry to next row; if no depth left, reject with "pair-consistency".

type SeqBand = 'DIN_stacked'|'EUP_stacked'|'DIN_unstacked'|'EUP_unstacked';

interface Prepared {
  EUP_columns: Column[]; DIN_columns: Column[];
  EUP_singles: Item[];  DIN_singles: Item[];
  unstacked_EUP: Item[]; // from bands
  unstacked_DIN: Item[];
}

interface RowCandidate {
  family: 'EUP'|'DIN';
  items: (Item | Column)[]; // exactly 2 slots (same family)
  weight: number; // sum weights
  depthMm: number; // template depth by family
}

function getFamilyWidthMm(f: 'EUP'|'DIN'): number {
  return f === 'EUP' ? 800 : 1000;
}
function getFamilyDepthMm(f: 'EUP'|'DIN'): number {
  return 1200;
}
function getUnitWeight(u: Item | Column): number {
  if ((u as any).weight != null) return (u as any).weight as number; // Column has weight
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
  // two-across, pair-consistent
  for (let i = 0; i < pool.length; i += 2) {
    const a = pool[i];
    const b = pool[i + 1];
    if (!b) {
      // orphan; carry forward as potential remainder handled by caller
      rows.push({ family, items: [a], weight: getUnitWeight(a), depthMm: depth });
      break;
    }
    const rowItems: (Item|Column)[] = [a, b];
    const weight = getUnitWeight(a) + getUnitWeight(b);
    rows.push({ family, items: rowItems, weight, depthMm: depth });
  }
  return rows;
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

  let yCursor = 0; // front-to-back from bulkhead
  const widthMm = preset.widthMm;
  const lengthMm = preset.lengthMm;
  const aisleReserve = Math.max(0, Math.floor(opts.aisleReserve ?? 0));
  const usableLength = Math.max(0, lengthMm - aisleReserve);

  const sequenceUsed: PlanResult['sequenceUsed'] = [];
  const bandCounts: Record<string, number> = {};

  for (const band of seq) {
    // Build rows for this band
    const rows = buildRowsForBand(band, prepared);
    // Count items eligible in this band
    const countInBand = rows.reduce((acc, r) => acc + (r.items.length >= 2 ? 2 : 1), 0);
    bandCounts[band] = countInBand;
    if (countInBand === 0) continue;

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
        for (const u of r.items as Item[]) rejected.push({ item: u as Item, reason: 'row-width' });
      }
      if (orphan) rejected.push({ item: orphan.items[0] as Item, reason: 'row-width' });
      continue;
    }

    // Place rows front-to-back within remaining length
    let placedAny = false;
    for (const row of fullRows) {
      if (yCursor + rowDepth > usableLength) {
        // cannot place more rows in this band; reject remaining in this band for length
        for (const r of fullRows.slice(fullRows.indexOf(row))) {
          for (const u of r.items as Item[]) rejected.push({ item: u as Item, reason: opts.enforceRowPairConsistency ? 'pair-consistency' : 'length' });
        }
        if (orphan) rejected.push({ item: orphan.items[0] as Item, reason: opts.enforceRowPairConsistency ? 'pair-consistency' : 'length' });
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
          rejected.push({ item: orphan.items[0] as Item, reason: 'pair-consistency' });
        } else {
          notes.push(`Carried forward orphan ${orphan.family} unit for pairing in later band.`);
          // Put back into appropriate unstacked pool to pair later
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