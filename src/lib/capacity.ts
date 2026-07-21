export type PalletWeightGroup = {
  id: number;
  weight: string;
  quantity: number;
};

export type PalletKind = 'euro' | 'industrial';

export type LoadingSummary = {
  totalEuroPalletsVisual: number;
  totalDinPalletsVisual: number;
  loadedBySource: Record<number, number>;
};

export type CapacityQueryResult = {
  requested: number;
  loaded: number;
  rejected: number;
  additionallyFeasible: number;
};

type CapacityCalculator = (
  eup: PalletWeightGroup[],
  din: PalletWeightGroup[],
  order: 'DIN_FIRST' | 'EUP_FIRST'
) => LoadingSummary;

const quantity = (groups: PalletWeightGroup[]) =>
  groups.reduce((total, group) => total + Math.max(0, Number(group.quantity) || 0), 0);

/**
 * Queries capacity without mutating the supplied manifest.  The initial run
 * identifies the manifest that was actually accepted; the simulation then
 * starts with those exact source groups and appends candidates only to the
 * pallet kind being queried.
 */
export function queryAdditionalCapacity(
  eupGroups: PalletWeightGroup[],
  dinGroups: PalletWeightGroup[],
  kind: PalletKind,
  additionalWeight: string,
  calculate: CapacityCalculator,
  candidateQuantity = 300
): CapacityQueryResult {
  const requested = kind === 'euro' ? quantity(eupGroups) : quantity(dinGroups);
  const initial = calculate(eupGroups, dinGroups, 'DIN_FIRST');
  const loaded = kind === 'euro'
    ? initial.totalEuroPalletsVisual
    : initial.totalDinPalletsVisual;

  const accepted = (groups: PalletWeightGroup[]) => groups.map(group => ({
    ...group,
    quantity: Math.min(Math.max(0, Number(group.quantity) || 0), initial.loadedBySource[group.id] || 0),
  }));
  const acceptedEup = accepted(eupGroups);
  const acceptedDin = accepted(dinGroups);
  // Negative IDs are reserved for simulated candidates and cannot collide
  // with the Date.now()-based IDs created by the UI.
  const candidate = { id: kind === 'euro' ? -101 : -102, quantity: candidateQuantity, weight: additionalWeight || '0' };
  const simulation = calculate(
    kind === 'euro' ? [...acceptedEup, candidate] : acceptedEup,
    kind === 'industrial' ? [...acceptedDin, candidate] : acceptedDin,
    kind === 'euro' ? 'DIN_FIRST' : 'EUP_FIRST'
  );

  return {
    requested,
    loaded,
    rejected: Math.max(0, requested - loaded),
    additionallyFeasible: simulation.loadedBySource[candidate.id] || 0,
  };
}
