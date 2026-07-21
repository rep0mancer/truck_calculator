export type WeightEntry = { id: number; weight: string; quantity: number };

export const TRUCK_TYPES = {
  roadTrain: { name: 'Hängerzug (2x 7,2m)', units: [{ id: 'unit1', length: 720, width: 245 }, { id: 'unit2', length: 720, width: 245 }], totalLength: 1440, usableLength: 1440, maxWidth: 245, maxGrossWeightKg: 24000 },
  curtainSider: { name: 'Planensattel Standard (13.2m)', units: [{ id: 'main', length: 1320, width: 245 }], totalLength: 1320, usableLength: 1320, maxWidth: 245, maxGrossWeightKg: 24000 },
  frigo: { name: 'Frigo (Kühler) Standard (13.2m)', units: [{ id: 'main', length: 1320, width: 245 }], totalLength: 1320, usableLength: 1320, maxWidth: 245, maxGrossWeightKg: 18300 },
  smallTruck: { name: 'Motorwagen (7.2m)', units: [{ id: 'main', length: 720, width: 245 }], totalLength: 720, usableLength: 720, maxWidth: 245, maxGrossWeightKg: 10000 },
  Waggon: { name: 'Waggon POE', units: [{ id: 'main', length: 1520, width: 290 }], totalLength: 1520, usableLength: 1520, maxWidth: 290, maxDinPallets: 26, maxGrossWeightKg: 24000 },
  Waggon2: { name: 'Waggon KRM', units: [{ id: 'main', length: 1600, width: 290 }], totalLength: 1600, usableLength: 1600, maxWidth: 290, maxDinPallets: 28, maxGrossWeightKg: 24000 },
} as const;

export const PALLET_TYPES = {
  euro: { name: 'Euro Palette (1.2m x 0.8m)', type: 'euro', length: 120, width: 80, area: 9600, color: 'bg-blue-500', borderColor: 'border-blue-700' },
  industrial: { name: 'Industrial Palette (1.2m x 1.0m)', type: 'industrial', length: 120, width: 100, area: 12000, color: 'bg-green-500', borderColor: 'border-green-700' },
};

export const MAX_GROSS_WEIGHT_KG = 24000;
export const MAX_PALLET_SIMULATION_QUANTITY = 300;
export const KILOGRAM_FORMATTER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

type Kind = 'euro' | 'industrial';
type Single = { id: number; type: Kind; weight: number; sourceId: number };
type Pattern = 'auto' | 'long' | 'broad';

function rowsForEuro(count: number, pattern: Pattern): number[] | null {
  if (count === 0) return [];
  const choices = pattern === 'long' ? [3] : pattern === 'broad' ? [2] : [2, 3];
  let best: number[] | null = null;
  for (let longRows = 0; longRows <= (choices.includes(3) ? Math.ceil(count / 3) : 0); longRows++) {
    const remaining = Math.max(0, count - longRows * 3);
    const broadRows = choices.includes(2) ? Math.ceil(remaining / 2) : (remaining === 0 ? 0 : Infinity);
    if (!Number.isFinite(broadRows)) continue;
    const candidate = [...Array(longRows).fill(3), ...Array(broadRows).fill(2)];
    if (!best || rowLength(candidate) < rowLength(best) || (rowLength(candidate) === rowLength(best) && candidate.join() > best.join())) best = candidate;
  }
  return best;
}

function rowLength(rows: number[]): number {
  return rows.reduce((sum, count) => sum + (count === 3 ? 120 : 80), 0);
}

function requiredLength(din: number, eup: number, pattern: Pattern): number {
  const eupRows = rowsForEuro(eup, pattern);
  return Math.ceil(din / 2) * 100 + (eupRows ? rowLength(eupRows) : Infinity);
}

function allocationForUnits(din: number, eup: number, lengths: number[], pattern: Pattern): Array<{ din: number; eup: number }> | null {
  const search = (unit: number, d: number, e: number): Array<{ din: number; eup: number }> | null => {
    if (unit === lengths.length) return d === 0 && e === 0 ? [] : null;
    for (let di = d; di >= 0; di--) for (let eu = e; eu >= 0; eu--) {
      if (requiredLength(di, eu, pattern) > lengths[unit]) continue;
      const tail = search(unit + 1, d - di, e - eu);
      if (tail) return [{ din: di, eup: eu }, ...tail];
    }
    return null;
  };
  return search(0, din, eup);
}

function stackLimit(value: number | string | undefined): number {
  if (value === undefined || value === '' || Number(value) <= 0) return Infinity;
  return Math.max(0, Math.floor(Number(value)));
}

/** Deterministic two-phase loader: floor positions are accepted first, overflow is then used as top cargo. */
export function calculateLoadingLogic(
  truckKey: keyof typeof TRUCK_TYPES,
  eupWeights: WeightEntry[],
  dinWeights: WeightEntry[],
  eupStackable: boolean,
  dinStackable: boolean,
  pattern: Pattern,
  placementOrder: 'DIN_FIRST' | 'EUP_FIRST' = 'DIN_FIRST',
  maxStackedEup?: number | string,
  maxStackedDin?: number | string,
) {
  const truck = TRUCK_TYPES[truckKey];
  let id = 0;
  const flatten = (entries: WeightEntry[], type: Kind): Single[] => entries.flatMap(entry =>
    Array.from({ length: Math.max(0, Math.floor(Number(entry.quantity) || 0)) }, () => ({
      id: ++id, type, sourceId: entry.id, weight: Math.max(0, Number.parseFloat(entry.weight) || 0),
    })),
  );
  const requested = { euro: flatten(eupWeights, 'euro'), industrial: flatten(dinWeights, 'industrial') };
  const priority: Kind[] = placementOrder === 'DIN_FIRST' ? ['industrial', 'euro'] : ['euro', 'industrial'];
  const floor: Record<Kind, Single[]> = { euro: [], industrial: [] };
  const rejected: Record<Kind, Single[]> = { euro: [], industrial: [] };
  const lengths = truck.units.map(unit => unit.length);
  const allocationCache = new Map<string, Array<{ din: number; eup: number }> | null>();
  const getAllocation = (din: number, eup: number) => {
    const key = `${din}:${eup}`;
    if (!allocationCache.has(key)) allocationCache.set(key, allocationForUnits(din, eup, lengths, pattern));
    return allocationCache.get(key)!;
  };
  const maxDin = 'maxDinPallets' in truck ? truck.maxDinPallets : Infinity;
  let weight = 0;

  // Phase one. A rejected heavy or geometrically unsuitable pallet never blocks a later candidate.
  for (const type of priority) for (const pallet of requested[type]) {
    const d = floor.industrial.length + (type === 'industrial' ? 1 : 0);
    const e = floor.euro.length + (type === 'euro' ? 1 : 0);
    if (weight + pallet.weight <= truck.maxGrossWeightKg && d <= maxDin && getAllocation(d, e)) {
      floor[type].push(pallet); weight += pallet.weight;
    } else rejected[type].push(pallet);
  }

  // Phase two. Limits count TOP pallets (not pairs and not floor pallets).
  const tops: Record<Kind, Single[]> = { euro: [], industrial: [] };
  const canStack = { euro: eupStackable && !truckKey.startsWith('Waggon'), industrial: dinStackable && !truckKey.startsWith('Waggon') };
  const limits = { euro: stackLimit(maxStackedEup), industrial: stackLimit(maxStackedDin) };
  for (const type of priority) if (canStack[type]) {
    for (const pallet of rejected[type]) {
      if (tops[type].length >= floor[type].length || tops[type].length >= limits[type]) continue;
      if (weight + pallet.weight > truck.maxGrossWeightKg) continue;
      tops[type].push(pallet); weight += pallet.weight;
    }
  }

  const allocation = getAllocation(floor.industrial.length, floor.euro.length)!;
  const arrangements = truck.units.map((unit, unitIndex) => {
    const counts = allocation[unitIndex];
    const unitDin = floor.industrial.splice(0, counts.din);
    const unitEup = floor.euro.splice(0, counts.eup);
    const stackedDin = unitDin.splice(Math.max(0, unitDin.length - tops.industrial.length));
    const stackedEup = unitEup.splice(Math.max(0, unitEup.length - tops.euro.length));
    const takeDinTops = tops.industrial.splice(0, stackedDin.length);
    const takeEupTops = tops.euro.splice(0, stackedEup.length);
    const classifiedLength = () => requiredLength(unitDin.length, 0, pattern) + requiredLength(0, unitEup.length, pattern) + requiredLength(stackedDin.length, 0, pattern) + requiredLength(0, stackedEup.length, pattern);
    while (classifiedLength() > unit.length && (stackedDin.length || stackedEup.length)) {
      // Splitting normal and stacked blocks can consume an extra boundary row.
      // Keep every floor pallet and drop only the last top until the four ordered
      // blocks have a physically valid representation.
      if (stackedDin.length) {
        const base = stackedDin.shift()!; unitDin.push(base);
        const removed = takeDinTops.shift(); if (removed) weight -= removed.weight;
      } else {
        const base = stackedEup.shift()!; unitEup.push(base);
        const removed = takeEupTops.shift(); if (removed) weight -= removed.weight;
      }
    }
    const pallets: Record<string, unknown>[] = [];
    let x = 0;
    let dinLabel = 0; let eupLabel = 0;
    const add = (base: Single, top: Single | undefined, px: number, py: number, width: number, height: number) => {
      const labelId = base.type === 'euro' ? ++eupLabel : ++dinLabel;
      const visual = { x: px, y: py, width, height, type: base.type, isStackedTier: top ? 'base' : null, unitId: unit.id, labelId, displayBaseLabelId: labelId, displayStackedLabelId: top ? labelId + 1 : null, showAsFraction: Boolean(top), key: `${base.type}_${base.id}` };
      pallets.push(visual);
      if (top) pallets.push({ ...visual, isStackedTier: 'top', labelId: base.type === 'euro' ? ++eupLabel : ++dinLabel, key: `${base.type}_${base.id}_stack` });
    };
    const blocks: Array<{ type: Kind; bases: Single[]; top: Single[] }> = [
      { type: 'industrial', bases: unitDin, top: [] },
      { type: 'euro', bases: unitEup, top: [] },
      { type: 'industrial', bases: stackedDin, top: takeDinTops },
      { type: 'euro', bases: stackedEup, top: takeEupTops },
    ];
    const rearStackLength = requiredLength(stackedDin.length, 0, pattern) + requiredLength(0, stackedEup.length, pattern);
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      if (blockIndex === 2) x = Math.max(x, unit.length - rearStackLength);
      if (block.type === 'industrial') {
        for (let i = 0; i < block.bases.length; i += 2) {
          for (let lane = 0; lane < 2 && i + lane < block.bases.length; lane++) add(block.bases[i + lane], block.top[i + lane], x, lane * 120, 100, 120);
          x += 100;
        }
        continue;
      }
      const rows = rowsForEuro(block.bases.length, pattern)!; let offset = 0;
      for (const rowCount of rows) {
        const broad = rowCount <= 2;
        for (let lane = 0; lane < rowCount && offset + lane < block.bases.length; lane++) add(block.bases[offset + lane], block.top[offset + lane], x, lane * (broad ? 120 : 80), broad ? 80 : 120, broad ? 120 : 80);
        offset += rowCount; x += broad ? 80 : 120;
      }
    }
    return { unitId: unit.id, unitLength: unit.length, unitWidth: unit.width, pallets };
  });

  const all = arrangements.flatMap(unit => unit.pallets) as Array<{ type: Kind; isStackedTier: string | null }>;
  const loadedEup = all.filter(p => p.type === 'euro').length;
  const loadedDin = all.filter(p => p.type === 'industrial').length;
  const basesEup = all.filter(p => p.type === 'euro' && p.isStackedTier !== 'top').length;
  const basesDin = all.filter(p => p.type === 'industrial' && p.isStackedTier !== 'top').length;
  const warnings: string[] = [];
  if (truckKey.startsWith('Waggon') && (eupStackable || dinStackable)) warnings.push('Info: Stapeln ist auf dem Waggon nicht möglich und wurde deaktiviert.');
  if (loadedEup < requested.euro.length || loadedDin < requested.industrial.length) warnings.push(`Konnte nicht alle Paletten laden. Übrig: ${requested.industrial.length - loadedDin} DIN und ${requested.euro.length - loadedEup} EUP.`);
  if (weight >= truck.maxGrossWeightKg) warnings.push('Gewichtslimit erreicht.');
  const baseArea = basesEup * PALLET_TYPES.euro.area + basesDin * PALLET_TYPES.industrial.area;
  return { palletArrangement: arrangements, loadedIndustrialPalletsBase: basesDin, loadedEuroPalletsBase: basesEup, totalDinPalletsVisual: loadedDin, totalEuroPalletsVisual: loadedEup, utilizationPercentage: Number((baseArea / (truck.usableLength * truck.maxWidth) * 100).toFixed(1)), warnings, totalWeightKg: weight, eupLoadingPatternUsed: pattern };
}
