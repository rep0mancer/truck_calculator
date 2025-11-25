import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { PalletUnitArrangement } from './components/TruckVisualization';
import {
  MAX_PALLET_SIMULATION_QUANTITY,
  TRUCK_TYPES,
  calculateLoadingLogic,
  type StackingStrategy,
  type WeightEntry,
} from './lib/loading/logic';

type LastEdited = 'eup' | 'din';

type PlannerState = {
  selectedTruck: keyof typeof TRUCK_TYPES;
  eupWeights: WeightEntry[];
  dinWeights: WeightEntry[];
  eupLoadingPattern: 'auto' | 'long' | 'broad';
  isEUPStackable: boolean;
  isDINStackable: boolean;
  eupStackLimit: number;
  dinStackLimit: number;
  stackingStrategy: StackingStrategy;
  loadedEuroPalletsBase: number;
  loadedIndustrialPalletsBase: number;
  totalEuroPalletsVisual: number;
  totalDinPalletsVisual: number;
  utilizationPercentage: number;
  warnings: string[];
  palletArrangement: PalletUnitArrangement[];
  totalWeightKg: number;
  actualEupLoadingPattern: string;
  remainingCapacity: { eup: number; din: number };
  lastEdited: LastEdited;

  setSelectedTruck: (truck: keyof typeof TRUCK_TYPES) => void;
  setEupWeights: (weights: WeightEntry[]) => void;
  setDinWeights: (weights: WeightEntry[]) => void;
  setEupLoadingPattern: (pattern: 'auto' | 'long' | 'broad') => void;
  setIsEUPStackable: (stackable: boolean) => void;
  setIsDINStackable: (stackable: boolean) => void;
  setEupStackLimit: (limit: number) => void;
  setDinStackLimit: (limit: number) => void;
  setStackingStrategy: (strategy: StackingStrategy) => void;
  setLastEdited: (last: LastEdited) => void;

  clearAllPallets: () => void;
  maximizePallets: (palletTypeToMax: 'euro' | 'industrial') => void;
  fillRemaining: (typeToFill: 'euro' | 'industrial') => boolean;
  recalculate: () => void;
};

const createEmptyWeightEntries = () => ({
  eupWeights: [{ id: Date.now(), weight: '', quantity: 0 }],
  dinWeights: [{ id: Date.now() + 1, weight: '', quantity: 0 }],
});

export const usePlannerStore = create<PlannerState>()(
  devtools((set, get) => ({
    selectedTruck: 'curtainSider',
    ...createEmptyWeightEntries(),
    eupLoadingPattern: 'auto',
    isEUPStackable: false,
    isDINStackable: false,
    eupStackLimit: 0,
    dinStackLimit: 0,
    stackingStrategy: 'axle_safe',
    loadedEuroPalletsBase: 0,
    loadedIndustrialPalletsBase: 0,
    totalEuroPalletsVisual: 0,
    totalDinPalletsVisual: 0,
    utilizationPercentage: 0,
    warnings: [],
    palletArrangement: [],
    totalWeightKg: 0,
    actualEupLoadingPattern: 'auto',
    remainingCapacity: { eup: 0, din: 0 },
    lastEdited: 'eup',

    setSelectedTruck: (truck) =>
      set(() => {
        const updates: Partial<PlannerState> = { selectedTruck: truck };
        if (['Waggon', 'Waggon2'].includes(truck)) {
          updates.isEUPStackable = false;
          updates.isDINStackable = false;
        }
        return updates;
      }, false, 'setSelectedTruck'),

    setEupWeights: (weights) => set({ eupWeights: weights }, false, 'setEupWeights'),
    setDinWeights: (weights) => set({ dinWeights: weights }, false, 'setDinWeights'),
    setEupLoadingPattern: (pattern) => set({ eupLoadingPattern: pattern }, false, 'setEupLoadingPattern'),
    setIsEUPStackable: (stackable) => set({ isEUPStackable: stackable }, false, 'setIsEUPStackable'),
    setIsDINStackable: (stackable) => set({ isDINStackable: stackable }, false, 'setIsDINStackable'),
    setEupStackLimit: (limit) => set({ eupStackLimit: limit }, false, 'setEupStackLimit'),
    setDinStackLimit: (limit) => set({ dinStackLimit: limit }, false, 'setDinStackLimit'),
    setStackingStrategy: (strategy) => set({ stackingStrategy: strategy }, false, 'setStackingStrategy'),
    setLastEdited: (last) => set({ lastEdited: last }, false, 'setLastEdited'),

    clearAllPallets: () =>
      set(
        () => {
          const emptyEntries = createEmptyWeightEntries();
          const truckConfig = TRUCK_TYPES[get().selectedTruck];
          const emptyArrangement = truckConfig.units.map((unit) => ({
            unitId: unit.id,
            unitLength: unit.length,
            unitWidth: unit.width,
            pallets: [],
          }));

          return {
            ...emptyEntries,
            isEUPStackable: false,
            isDINStackable: false,
            eupStackLimit: 0,
            dinStackLimit: 0,
            eupLoadingPattern: 'auto',
            lastEdited: 'eup',
            loadedEuroPalletsBase: 0,
            loadedIndustrialPalletsBase: 0,
            totalEuroPalletsVisual: 0,
            totalDinPalletsVisual: 0,
            utilizationPercentage: 0,
            warnings: [],
            palletArrangement: emptyArrangement,
            totalWeightKg: 0,
            actualEupLoadingPattern: 'auto',
            remainingCapacity: { eup: 0, din: 0 },
          };
        },
        false,
        'clearAllPallets',
      ),

    maximizePallets: (palletTypeToMax) => {
      const state = get();
      const simResults = calculateLoadingLogic(
        state.selectedTruck,
        palletTypeToMax === 'euro' ? [{ id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0' }] : [],
        palletTypeToMax === 'industrial' ? [{ id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0' }] : [],
        state.isEUPStackable,
        state.isDINStackable,
        'auto',
        palletTypeToMax === 'euro' ? 'EUP_FIRST' : 'DIN_FIRST',
        state.eupStackLimit,
        state.dinStackLimit,
        state.stackingStrategy,
      );

      if (palletTypeToMax === 'industrial') {
        set(
          () => ({
            dinWeights: [{ id: Date.now(), weight: '', quantity: simResults.totalDinPalletsVisual }],
            eupWeights: [{ id: Date.now() + 1, weight: '', quantity: 0 }],
            lastEdited: 'din',
          }),
          false,
          'maximizePallets',
        );
      } else {
        set(
          () => ({
            eupWeights: [{ id: Date.now(), weight: '', quantity: simResults.totalEuroPalletsVisual }],
            dinWeights: [{ id: Date.now() + 1, weight: '', quantity: 0 }],
            lastEdited: 'eup',
          }),
          false,
          'maximizePallets',
        );
      }
    },

    fillRemaining: (typeToFill) => {
      const state = get();
      const weightEntryToUse = typeToFill === 'euro' ? state.eupWeights[state.eupWeights.length - 1] : state.dinWeights[state.dinWeights.length - 1];
      const weightToFill = weightEntryToUse?.weight || '0';

      const eupSim = typeToFill === 'euro'
        ? [...state.eupWeights, { id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFill }]
        : [...state.eupWeights];
      const dinSim = typeToFill === 'industrial'
        ? [...state.dinWeights, { id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFill }]
        : [...state.dinWeights];

      const order = typeToFill === 'euro' ? 'DIN_FIRST' : 'EUP_FIRST';

      const res = calculateLoadingLogic(
        state.selectedTruck,
        eupSim,
        dinSim,
        state.isEUPStackable,
        state.isDINStackable,
        'auto',
        order,
        state.eupStackLimit,
        state.dinStackLimit,
        state.stackingStrategy,
      );

      const currentEups = state.eupWeights.reduce((s, e) => s + e.quantity, 0);
      const currentDins = state.dinWeights.reduce((s, e) => s + e.quantity, 0);

      const addedEups = res.totalEuroPalletsVisual - currentEups;
      const addedDins = res.totalDinPalletsVisual - currentDins;

      let updated = false;

      set(
        (existing) => {
          const updates: Partial<PlannerState> = { lastEdited: typeToFill === 'euro' ? 'eup' : 'din' };

          if (typeToFill === 'euro' && addedEups > 0 && existing.eupWeights.length > 0) {
            const newWeights = [...existing.eupWeights];
            const lastIndex = newWeights.length - 1;
            const updatedLastEntry = {
              ...newWeights[lastIndex],
              quantity: newWeights[lastIndex].quantity + addedEups,
            };
            newWeights[lastIndex] = updatedLastEntry;
            updates.eupWeights = newWeights;
            updated = true;
          } else if (typeToFill === 'industrial' && addedDins > 0 && existing.dinWeights.length > 0) {
            const newWeights = [...existing.dinWeights];
            const lastIndex = newWeights.length - 1;
            const updatedLastEntry = {
              ...newWeights[lastIndex],
              quantity: newWeights[lastIndex].quantity + addedDins,
            };
            newWeights[lastIndex] = updatedLastEntry;
            updates.dinWeights = newWeights;
            updated = true;
          }

          return updates;
        },
        false,
        'fillRemaining',
      );

      return updated;
    },

    recalculate: () => {
      const state = get();
      const eupQuantity = state.eupWeights.reduce((sum, entry) => sum + entry.quantity, 0);
      const dinQuantity = state.dinWeights.reduce((sum, entry) => sum + entry.quantity, 0);

      const primaryResults = calculateLoadingLogic(
        state.selectedTruck,
        state.eupWeights,
        state.dinWeights,
        state.isEUPStackable,
        state.isDINStackable,
        state.eupLoadingPattern,
        'DIN_FIRST',
        state.eupStackLimit,
        state.dinStackLimit,
        state.stackingStrategy,
      );

      let multiTruckWarnings: string[] = [];

      if (dinQuantity > 0 && eupQuantity === 0) {
        const dinCapacityResult = calculateLoadingLogic(
          state.selectedTruck,
          [],
          [{ id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0' }],
          state.isEUPStackable,
          state.isDINStackable,
          state.eupLoadingPattern,
          'DIN_FIRST',
          state.eupStackLimit,
          state.dinStackLimit,
          state.stackingStrategy,
        );
        const maxDinCapacity = dinCapacityResult.totalDinPalletsVisual;

        if (maxDinCapacity > 0 && dinQuantity > maxDinCapacity) {
          const totalTrucks = Math.ceil(dinQuantity / maxDinCapacity);
          const fullTrucks = Math.floor(dinQuantity / maxDinCapacity);
          const remainingPallets = dinQuantity % maxDinCapacity;

          if (remainingPallets === 0) {
            multiTruckWarnings.push(`Für diesen Auftrag werden ${fullTrucks} volle LKWs benötigt.`);
          } else {
            multiTruckWarnings.push(`Benötigt ${totalTrucks} LKWs: ${fullTrucks} volle LKW(s) und 1 LKW mit ${remainingPallets} Paletten.`);
          }
        }
      } else if (eupQuantity > 0 && dinQuantity === 0) {
        const eupCapacityResult = calculateLoadingLogic(
          state.selectedTruck,
          [{ id: 1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: '0' }],
          [],
          state.isEUPStackable,
          state.isDINStackable,
          state.eupLoadingPattern,
          'EUP_FIRST',
          state.eupStackLimit,
          state.dinStackLimit,
          state.stackingStrategy,
        );
        const maxEupCapacity = eupCapacityResult.totalEuroPalletsVisual;

        if (maxEupCapacity > 0 && eupQuantity > maxEupCapacity) {
          const totalTrucks = Math.ceil(eupQuantity / maxEupCapacity);
          const fullTrucks = Math.floor(eupQuantity / maxEupCapacity);
          const remainingPallets = eupQuantity % maxEupCapacity;

          if (remainingPallets === 0) {
            multiTruckWarnings.push(`Für diesen Auftrag werden ${fullTrucks} volle LKWs benötigt.`);
          } else {
            multiTruckWarnings.push(`Benötigt ${totalTrucks} LKWs: ${fullTrucks} volle LKW(s) und 1 LKW mit ${remainingPallets} Paletten.`);
          }
        }
      }

      const weightToFillEup = state.eupWeights.length > 0 ? state.eupWeights[state.eupWeights.length - 1].weight || '0' : '0';
      const eupCapacityResult = calculateLoadingLogic(
        state.selectedTruck,
        [{ id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFillEup }],
        state.dinWeights,
        state.isEUPStackable,
        state.isDINStackable,
        state.eupLoadingPattern,
        'DIN_FIRST',
        state.eupStackLimit,
        state.dinStackLimit,
        state.stackingStrategy,
      );
      const maxEup = eupCapacityResult.totalEuroPalletsVisual;
      const remainingEup = Math.max(0, maxEup - eupQuantity);

      const weightToFillDin = state.dinWeights.length > 0 ? state.dinWeights[state.dinWeights.length - 1].weight || '0' : '0';
      const dinCapacityResult = calculateLoadingLogic(
        state.selectedTruck,
        state.eupWeights,
        [{ id: -1, quantity: MAX_PALLET_SIMULATION_QUANTITY, weight: weightToFillDin }],
        state.isEUPStackable,
        state.isDINStackable,
        state.eupLoadingPattern,
        'EUP_FIRST',
        state.eupStackLimit,
        state.dinStackLimit,
        state.stackingStrategy,
      );
      const maxDin = dinCapacityResult.totalDinPalletsVisual;
      const remainingDin = Math.max(0, maxDin - dinQuantity);

      set(
        {
          palletArrangement: primaryResults.palletArrangement,
          loadedIndustrialPalletsBase: primaryResults.loadedIndustrialPalletsBase,
          loadedEuroPalletsBase: primaryResults.loadedEuroPalletsBase,
          totalDinPalletsVisual: primaryResults.totalDinPalletsVisual,
          totalEuroPalletsVisual: primaryResults.totalEuroPalletsVisual,
          utilizationPercentage: primaryResults.utilizationPercentage,
          warnings: Array.from(new Set([...primaryResults.warnings, ...multiTruckWarnings])),
          totalWeightKg: primaryResults.totalWeightKg,
          actualEupLoadingPattern: primaryResults.eupLoadingPatternUsed,
          remainingCapacity: { eup: remainingEup, din: remainingDin },
        },
        false,
        'recalculate',
      );
    },
  })),
);
