import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { CONTAINER_PRESETS, PALLET_PRESETS } from './presets';
import type { Constraints, Plan, Units } from './types';
import { computePlan } from './lib/layoutEngine';
import { PlannerInputSchema, type PlannerInputs } from './validation';

interface PlannerState {
  // inputs
  units: Units;
  containerId: string; // selected preset id or 'custom'
  containerCustom?: PlannerInputs['container'];
  palletId: string; // selected preset id or 'custom'
  palletCustom?: PlannerInputs['pallet'];
  constraints: Constraints;
  note?: string;

  // derived
  plan: Plan | null;
  lastValidationErrors: string[]; // compact errors for non-UI logging/inspection

  // actions
  setUnits: (units: Units) => void;
  setContainerById: (id: string) => void;
  setCustomContainer: (container: PlannerInputs['container']) => void;
  setPalletById: (id: string) => void;
  setCustomPallet: (pallet: PlannerInputs['pallet']) => void;
  setConstraints: (constraints: Constraints) => void;
  setNote: (note?: string) => void;
  recompute: () => void;
  reset: () => void;
}

function getSelectedContainer(state: PlannerState): PlannerInputs['container'] {
  if (state.containerId === 'custom' && state.containerCustom) return state.containerCustom;
  const preset = CONTAINER_PRESETS.find((c) => c.id === state.containerId) ?? CONTAINER_PRESETS[0];
  return preset;
}

function getSelectedPallet(state: PlannerState): PlannerInputs['pallet'] {
  if (state.palletId === 'custom' && state.palletCustom) return state.palletCustom;
  const preset = PALLET_PRESETS.find((p) => p.id === state.palletId) ?? PALLET_PRESETS[0];
  return preset;
}

function computeFromState(state: PlannerState): { plan: Plan | null; errors: string[] } {
  const container = getSelectedContainer(state);
  const pallet = getSelectedPallet(state);

  const candidate: PlannerInputs = {
    container,
    pallet,
    constraints: state.constraints,
    units: state.units,
    note: state.note,
  };

  const parsed = PlannerInputSchema.safeParse(candidate);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return { plan: null, errors };
  }

  const plan = computePlan({
    container: parsed.data.container,
    pallet: parsed.data.pallet,
    constraints: parsed.data.constraints,
    units: parsed.data.units,
    note: parsed.data.note,
  });

  return { plan, errors: [] };
}

const defaultConstraints: Constraints = {
  allowRotate: true,
  wallClearance: 60,
  betweenClearance: 50,
  aisleLengthReserve: 0,
};

export const usePlannerStore = create<PlannerState>()(
  devtools((set, get) => ({
    units: 'metric',
    containerId: CONTAINER_PRESETS[0]?.id ?? 'sprinter',
    palletId: PALLET_PRESETS[0]?.id ?? 'euro',
    constraints: defaultConstraints,
    note: undefined,
    plan: null,
    lastValidationErrors: [],

    setUnits: (units) => set({ units }, false, 'setUnits'),
    setContainerById: (id) => set({ containerId: id, containerCustom: undefined }, false, 'setContainerById'),
    setCustomContainer: (container) => set({ containerId: 'custom', containerCustom: container }, false, 'setCustomContainer'),
    setPalletById: (id) => set({ palletId: id, palletCustom: undefined }, false, 'setPalletById'),
    setCustomPallet: (pallet) => set({ palletId: 'custom', palletCustom: pallet }, false, 'setCustomPallet'),
    setConstraints: (constraints) => set({ constraints }, false, 'setConstraints'),
    setNote: (note) => set({ note }, false, 'setNote'),

    recompute: () => {
      const results = computeFromState(get());
      set({ plan: results.plan, lastValidationErrors: results.errors }, false, 'recompute');
    },

    reset: () => set({
      units: 'metric',
      containerId: CONTAINER_PRESETS[0]?.id ?? 'sprinter',
      containerCustom: undefined,
      palletId: PALLET_PRESETS[0]?.id ?? 'euro',
      palletCustom: undefined,
      constraints: defaultConstraints,
      note: undefined,
      plan: null,
      lastValidationErrors: [],
    }, false, 'reset'),
  }))
);