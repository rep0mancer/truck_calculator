export type WeightEntry = { id: number; weight: string; quantity: number };

export type AxleComponent = 'supportTractor' | 'trailerAxleGroup';
export type LoadingWarning =
  | { code: 'wagonStackingDisabled' }
  | { code: 'palletsRemaining'; params: { industrial: number; euro: number } }
  | { code: 'weightLimitReached' }
  | { code: 'axleLimitExceeded'; params: { component: AxleComponent; calculatedKg: number; limitKg: number } };

export type AxleCalculation = {
  available: true;
  fifthWheelPositionCm: number;
  trailerAxleGroupCenterCm: number;
  supportTractor: { cargoReactionKg: number; unladenReactionKg: number; calculatedKg: number; limitKg: number; exceeded: boolean };
  trailerAxleGroup: { cargoReactionKg: number; unladenReactionKg: number; calculatedKg: number; limitKg: number; exceeded: boolean };
  exceededComponents: AxleComponent[];
} | { available: false; reason: 'unsupportedVehicleConfiguration' };

type AxleModel = {
  fifthWheelPositionCm: number;
  trailerAxleGroupCenterCm: number;
  supportTractorLimitKg: number;
  trailerAxleGroupLimitKg: number;
  unladenSupportReactionKg: number;
  unladenTrailerAxleGroupReactionKg: number;
};

/*
 * Legal baseline: consolidated Directive 96/53/EC, Annex I, points 3.1-3.5:
 * single non-driving axle 10 t; single driving axle 11.5 t; motor-vehicle
 * tandem 11.5/16/18 t (19 t only with the stated suspension/tyre conditions);
 * trailer tandem 11/16/18/20 t according to spacing; trailer tridem 21/24 t.
 * Source: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:01996L0053-20240506
 *
 * The UI identifies German as Austria. Austrian KFG 1967 § 4(7a) uses the
 * same applicable 18 t tractor tandem and 24 t trailer tridem maxima here, so
 * no stricter Austrian value is required for this assumed 2+3 semitrailer.
 * Source: https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10011384&Paragraf=4
 * These are group limits, deliberately not a universal per-axle constant.
 * Geometry and unladen reactions are explicit engineering assumptions for a
 * representative 13.2 m semitrailer and must be replaced with plate/weighbridge
 * data for a specific vehicle.
 */
export const EU_AXLE_LIMITS_KG = {
  single: { nonDriving: 10_000, driving: 11_500 },
  motorVehicleTandem: { under1m: 11_500, from1mTo1_3m: 16_000, from1_3mTo1_8m: 18_000, qualifiedFrom1_3mTo1_8m: 19_000 },
  trailerTandem: { under1m: 11_000, from1mTo1_3m: 16_000, from1_3mTo1_8m: 18_000, from1_8m: 20_000 },
  trailerTridem: { upTo1_3m: 21_000, from1_3mTo1_4m: 24_000 },
} as const;

export const STANDARD_SEMITRAILER_AXLE_MODEL: Readonly<AxleModel> = {
  fifthWheelPositionCm: 50,
  trailerAxleGroupCenterCm: 1080,
  supportTractorLimitKg: EU_AXLE_LIMITS_KG.motorVehicleTandem.from1_3mTo1_8m,
  trailerAxleGroupLimitKg: EU_AXLE_LIMITS_KG.trailerTridem.from1_3mTo1_4m,
  unladenSupportReactionKg: 5_500,
  unladenTrailerAxleGroupReactionKg: 6_500,
};

export const TRUCK_TYPES = {
  roadTrain: { name: 'Hängerzug (2x 7,2m)', units: [{ id: 'unit1', length: 720, width: 245 }, { id: 'unit2', length: 720, width: 245 }], totalLength: 1440, usableLength: 1440, maxWidth: 245, maxGrossWeightKg: 24000, axleModel: null },
  curtainSider: { name: 'Planensattel Standard (13.2m)', units: [{ id: 'main', length: 1320, width: 245 }], totalLength: 1320, usableLength: 1320, maxWidth: 245, maxGrossWeightKg: 24000, axleModel: STANDARD_SEMITRAILER_AXLE_MODEL },
  frigo: { name: 'Frigo (Kühler) Standard (13.2m)', units: [{ id: 'main', length: 1320, width: 245 }], totalLength: 1320, usableLength: 1320, maxWidth: 245, maxGrossWeightKg: 18300, axleModel: STANDARD_SEMITRAILER_AXLE_MODEL },
  smallTruck: { name: 'Motorwagen (7.2m)', units: [{ id: 'main', length: 720, width: 245 }], totalLength: 720, usableLength: 720, maxWidth: 245, maxGrossWeightKg: 10000, axleModel: null },
  Waggon: { name: 'Waggon POE', units: [{ id: 'main', length: 1520, width: 290 }], totalLength: 1520, usableLength: 1520, maxWidth: 290, maxDinPallets: 26, maxGrossWeightKg: 24000, axleModel: null },
  Waggon2: { name: 'Waggon KRM', units: [{ id: 'main', length: 1600, width: 290 }], totalLength: 1600, usableLength: 1600, maxWidth: 290, maxDinPallets: 28, maxGrossWeightKg: 24000, axleModel: null },
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
/** overflow-only preserves the legacy policy; force pairs cargo before floor planning. */
export type StackingStrategy = 'overflow-only' | 'force';
type PlannedRow =
  | { kind: 'DIN'; length: 100; dinCount: 1 | 2 }
  | { kind: 'EUP_BROAD'; length: 80; eupCount: 1 | 2 }
  | { kind: 'EUP_LONG'; length: 120; eupCount: 1 | 2 | 3 }
  | { kind: 'MIXED_DIN_EUP'; length: 100; dinCount: 1; eupCount: 1 };
type RowPlan = { rows: PlannedRow[]; length: number };
type UnitAllocation = { din: number; eup: number; plan: RowPlan };
type RenderedPallet = { x: number; y: number; width: number; height: number; weight: number; type: Kind; isStackedTier: 'base' | 'top' | null; [key: string]: unknown };

function euroRows(count: number, pattern: Pattern): PlannedRow[] | null {
  if (count === 0) return [];
  let best: PlannedRow[] | null = null;
  const maxLong = pattern === 'broad' ? 0 : Math.ceil(count / 3);
  const maxBroad = pattern === 'long' ? 0 : Math.ceil(count / 2);
  for (let long = 0; long <= maxLong; long++) for (let broad = 0; broad <= maxBroad; broad++) {
    if (long * 3 + broad * 2 < count) continue;
    let left = count;
    const candidate: PlannedRow[] = [];
    for (let i = 0; i < broad && left > 0; i++) {
      const eupCount = Math.min(2, left) as 1 | 2;
      candidate.push({ kind: 'EUP_BROAD', length: 80, eupCount }); left -= eupCount;
    }
    for (let i = 0; i < long && left > 0; i++) {
      const eupCount = Math.min(3, left) as 1 | 2 | 3;
      candidate.push({ kind: 'EUP_LONG', length: 120, eupCount }); left -= eupCount;
    }
    if (left > 0) continue;
    const candidateLength = candidate.reduce((sum, row) => sum + row.length, 0);
    const bestLength = best?.reduce((sum, row) => sum + row.length, 0) ?? Infinity;
    // Stable final tie-break: broad rows precede long rows, then retain enumeration order.
    if (candidateLength < bestLength || (candidateLength === bestLength && candidate.length < (best?.length ?? Infinity))) best = candidate;
  }
  return best;
}

/** Produces the canonical geometry consumed by both feasibility and rendering. */
function planRows(din: number, eup: number, pattern: Pattern, unitWidth: number): RowPlan | null {
  let best: RowPlan | null = null;
  const mayMix = unitWidth >= 240 && pattern !== 'long';
  for (const mixed of mayMix ? [0, 1] : [0]) {
    if (mixed > din % 2 || mixed > eup) continue;
    const rows: PlannedRow[] = [];
    const pureDin = din - mixed;
    for (let remaining = pureDin; remaining > 0; remaining -= 2) rows.push({ kind: 'DIN', length: 100, dinCount: Math.min(2, remaining) as 1 | 2 });
    if (mixed) rows.push({ kind: 'MIXED_DIN_EUP', length: 100, dinCount: 1, eupCount: 1 });
    const eupPlan = euroRows(eup - mixed, pattern);
    if (!eupPlan) continue;
    rows.push(...eupPlan);
    const candidate = { rows, length: rows.reduce((sum, row) => sum + row.length, 0) };
    if (!best || candidate.length < best.length || (candidate.length === best.length && candidate.rows.length < best.rows.length)) best = candidate;
  }
  return best;
}

function allocationForUnits(din: number, eup: number, units: ReadonlyArray<{ length: number; width: number }>, pattern: Pattern): UnitAllocation[] | null {
  const search = (unit: number, d: number, e: number): UnitAllocation[] | null => {
    if (unit === units.length) return d === 0 && e === 0 ? [] : null;
    for (let di = d; di >= 0; di--) for (let eu = e; eu >= 0; eu--) {
      const plan = planRows(di, eu, pattern, units[unit].width);
      if (!plan || plan.length > units[unit].length) continue;
      const tail = search(unit + 1, d - di, e - eu);
      if (tail) return [{ din: di, eup: eu, plan }, ...tail];
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
  eupStackingStrategy: StackingStrategy = 'overflow-only',
  dinStackingStrategy: StackingStrategy = 'overflow-only',
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
  const allocationCache = new Map<string, UnitAllocation[] | null>();
  const getAllocation = (din: number, eup: number) => {
    const key = `${din}:${eup}`;
    if (!allocationCache.has(key)) allocationCache.set(key, allocationForUnits(din, eup, truck.units, pattern));
    return allocationCache.get(key)!;
  };
  const maxDin = 'maxDinPallets' in truck ? truck.maxDinPallets : Infinity;
  let weight = 0;

  const tops: Record<Kind, Single[]> = { euro: [], industrial: [] };
  const canStack = { euro: eupStackable && !truckKey.startsWith('Waggon'), industrial: dinStackable && !truckKey.startsWith('Waggon') };
  const limits = { euro: stackLimit(maxStackedEup), industrial: stackLimit(maxStackedDin) };
  const strategies = { euro: eupStackingStrategy, industrial: dinStackingStrategy };

  // Phase one. A rejected heavy or geometrically unsuitable pallet never blocks a later candidate.
  for (const type of priority) {
    const cargo = requested[type];
    // Forced pairs follow flattened input order: first is base, second is top.
    // An odd final pallet is a base. Paired bases are kept together at the end
    // so rendering's stacked block retains the exact base/top association.
    const forcedPairCount = canStack[type] && strategies[type] === 'force'
      ? Math.min(Math.floor(cargo.length / 2), limits[type]) : 0;
    const candidates: Array<{ base: Single; top?: Single }> = [];
    for (let index = 0; index < forcedPairCount * 2; index += 2) candidates.push({ base: cargo[index], top: cargo[index + 1] });
    const unpaired = cargo.slice(forcedPairCount * 2).map(base => ({ base }));
    for (const candidate of [...unpaired, ...candidates]) {
      const pallet = candidate.base;
      const d = floor.industrial.length + (type === 'industrial' ? 1 : 0);
      const e = floor.euro.length + (type === 'euro' ? 1 : 0);
      if (weight + pallet.weight <= truck.maxGrossWeightKg && d <= maxDin && getAllocation(d, e)) {
        floor[type].push(pallet); weight += pallet.weight;
        if (candidate.top && weight + candidate.top.weight <= truck.maxGrossWeightKg) {
          tops[type].push(candidate.top); weight += candidate.top.weight;
        } else if (candidate.top) rejected[type].push(candidate.top);
      } else {
        rejected[type].push(pallet);
        if (candidate.top) rejected[type].push(candidate.top);
      }
    }
  }

  // Phase two. Limits count TOP pallets (not pairs and not floor pallets).
  for (const type of priority) if (canStack[type]) {
    if (strategies[type] === 'force') continue;
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
    const classifiedPlans = () => ({
      normal: planRows(unitDin.length, unitEup.length, pattern, unit.width)!,
      stacked: planRows(stackedDin.length, stackedEup.length, pattern, unit.width)!,
    });
    while (classifiedPlans().normal.length + classifiedPlans().stacked.length > unit.length && (stackedDin.length || stackedEup.length)) {
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
    const pallets: RenderedPallet[] = [];
    let x = 0;
    let dinLabel = 0; let eupLabel = 0;
    const add = (base: Single, top: Single | undefined, px: number, py: number, width: number, height: number) => {
      const labelId = base.type === 'euro' ? ++eupLabel : ++dinLabel;
      const visual = { x: px, y: py, width, height, type: base.type, weight: base.weight, sourceId: base.sourceId, isStackedTier: top ? 'base' : null, unitId: unit.id, labelId, displayBaseLabelId: labelId, displayStackedLabelId: top ? labelId + 1 : null, showAsFraction: Boolean(top), key: `${base.type}_${base.id}` };
      pallets.push(visual);
      if (top) pallets.push({ ...visual, weight: top.weight, sourceId: top.sourceId, isStackedTier: 'top', labelId: base.type === 'euro' ? ++eupLabel : ++dinLabel, key: `${base.type}_${top.id}_stack` });
    };
    const renderPlan = (plan: RowPlan, dinBases: Single[], dinTops: Single[], eupBases: Single[], eupTops: Single[]) => {
      let dinIndex = 0; let eupIndex = 0;
      for (const row of plan.rows) {
        if (row.kind === 'DIN') {
          for (let lane = 0; lane < row.dinCount; lane++) add(dinBases[dinIndex], dinTops[dinIndex++], x, lane * 120, 100, 120);
        } else if (row.kind === 'EUP_BROAD') {
          for (let lane = 0; lane < row.eupCount; lane++) add(eupBases[eupIndex], eupTops[eupIndex++], x, lane * 120, 80, 120);
        } else if (row.kind === 'EUP_LONG') {
          for (let lane = 0; lane < row.eupCount; lane++) add(eupBases[eupIndex], eupTops[eupIndex++], x, lane * 80, 120, 80);
        } else {
          add(dinBases[dinIndex], dinTops[dinIndex++], x, 0, 100, 120);
          add(eupBases[eupIndex], eupTops[eupIndex++], x, 120, 80, 120);
        }
        x += row.length;
      }
    };
    // Without stacking this is the exact UnitAllocation plan that admitted the
    // pallets; capacity and visualization therefore cannot diverge.
    const plans = stackedDin.length || stackedEup.length
      ? classifiedPlans()
      : { normal: counts.plan, stacked: { rows: [], length: 0 } as RowPlan };
    renderPlan(plans.normal, unitDin, [], unitEup, []);
    x = Math.max(x, unit.length - plans.stacked.length);
    renderPlan(plans.stacked, stackedDin, takeDinTops, stackedEup, takeEupTops);
    return { unitId: unit.id, unitLength: unit.length, unitWidth: unit.width, pallets };
  });

  const all = arrangements.flatMap(unit => unit.pallets) as Array<{ type: Kind; isStackedTier: string | null }>;
  const loadedEup = all.filter(p => p.type === 'euro').length;
  const loadedDin = all.filter(p => p.type === 'industrial').length;
  const basesEup = all.filter(p => p.type === 'euro' && p.isStackedTier !== 'top').length;
  const basesDin = all.filter(p => p.type === 'industrial' && p.isStackedTier !== 'top').length;
  const warnings: LoadingWarning[] = [];
  if (truckKey.startsWith('Waggon') && (eupStackable || dinStackable)) warnings.push({ code: 'wagonStackingDisabled' });
  if (loadedEup < requested.euro.length || loadedDin < requested.industrial.length) warnings.push({ code: 'palletsRemaining', params: { industrial: requested.industrial.length - loadedDin, euro: requested.euro.length - loadedEup } });
  if (weight >= truck.maxGrossWeightKg) warnings.push({ code: 'weightLimitReached' });
  let axleCalculation: AxleCalculation = { available: false, reason: 'unsupportedVehicleConfiguration' };
  if (truck.axleModel) {
    const model = truck.axleModel;
    const span = model.trailerAxleGroupCenterCm - model.fifthWheelPositionCm;
    const renderedPallets = arrangements.flatMap(unit => unit.pallets) as Array<{ x: number; width: number; weight: number }>;
    const cargo = renderedPallets.reduce<{ support: number; trailer: number }>((sum, p) => {
      const center = p.x + p.width / 2;
      return {
        support: sum.support + p.weight * (model.trailerAxleGroupCenterCm - center) / span,
        trailer: sum.trailer + p.weight * (center - model.fifthWheelPositionCm) / span,
      };
    }, { support: 0, trailer: 0 });
    const support = cargo.support + model.unladenSupportReactionKg;
    const trailer = cargo.trailer + model.unladenTrailerAxleGroupReactionKg;
    const exceededComponents: AxleComponent[] = [];
    if (support > model.supportTractorLimitKg) exceededComponents.push('supportTractor');
    if (trailer > model.trailerAxleGroupLimitKg) exceededComponents.push('trailerAxleGroup');
    const calculated: Extract<AxleCalculation, { available: true }> = {
      available: true, fifthWheelPositionCm: model.fifthWheelPositionCm, trailerAxleGroupCenterCm: model.trailerAxleGroupCenterCm,
      supportTractor: { cargoReactionKg: cargo.support, unladenReactionKg: model.unladenSupportReactionKg, calculatedKg: support, limitKg: model.supportTractorLimitKg, exceeded: support > model.supportTractorLimitKg },
      trailerAxleGroup: { cargoReactionKg: cargo.trailer, unladenReactionKg: model.unladenTrailerAxleGroupReactionKg, calculatedKg: trailer, limitKg: model.trailerAxleGroupLimitKg, exceeded: trailer > model.trailerAxleGroupLimitKg },
      exceededComponents,
    };
    axleCalculation = calculated;
    for (const component of exceededComponents) {
      const result = component === 'supportTractor' ? calculated.supportTractor : calculated.trailerAxleGroup;
      warnings.push({ code: 'axleLimitExceeded', params: { component, calculatedKg: Math.round(result.calculatedKg), limitKg: result.limitKg } });
    }
  }
  const baseArea = basesEup * PALLET_TYPES.euro.area + basesDin * PALLET_TYPES.industrial.area;
  return { palletArrangement: arrangements, loadedIndustrialPalletsBase: basesDin, loadedEuroPalletsBase: basesEup, totalDinPalletsVisual: loadedDin, totalEuroPalletsVisual: loadedEup, utilizationPercentage: Number((baseArea / (truck.usableLength * truck.maxWidth) * 100).toFixed(1)), warnings, axleCalculation, totalWeightKg: weight, eupLoadingPatternUsed: pattern };
}
