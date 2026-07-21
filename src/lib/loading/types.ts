export type TruckKey = 'roadTrain' | 'curtainSider' | 'frigo' | 'smallTruck' | 'Waggon' | 'Waggon2';
export type PalletType = 'euro' | 'industrial';
export type EupPattern = 'auto' | 'long' | 'broad';
export type PlacementOrder = 'DIN_FIRST' | 'EUP_FIRST';

export interface WeightGroup { readonly id: number; readonly quantity: number; readonly weightKg: number }
export interface LoadingRequest {
  readonly truckKey: TruckKey;
  readonly euro: readonly WeightGroup[];
  readonly industrial: readonly WeightGroup[];
  readonly euroStackable: boolean;
  readonly industrialStackable: boolean;
  /** Number of individual pallets eligible for pairing; zero means no limit. */
  readonly maxStackedEuro: number;
  readonly maxStackedIndustrial: number;
  readonly eupPattern: EupPattern;
  readonly placementOrder: PlacementOrder;
}
export type WarningCode = 'PALLETS_REJECTED' | 'PAYLOAD_REACHED' | 'STACKING_DISABLED' | 'DIN_CAPACITY_REACHED' | 'AXLE_DENSITY' | 'CONCENTRATED_LOAD';
export interface LoadingWarning { readonly code: WarningCode; readonly values: Readonly<Record<string, number | string>> }
export interface PalletRectangle {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
  readonly type: PalletType; readonly weightKg: number; readonly sourceId: number;
  readonly key: string; readonly labelId: number; readonly unitId: string;
  readonly isStackedTier: 'base' | 'top' | null; readonly stackGroupId?: string;
  readonly displayBaseLabelId: number; readonly displayStackedLabelId: number | null; readonly showAsFraction: boolean;
}
export interface UnitArrangement { readonly unitId: string; readonly unitLength: number; readonly unitWidth: number; readonly pallets: readonly PalletRectangle[] }
export interface LoadingResult {
  readonly palletArrangement: readonly UnitArrangement[];
  readonly loadedIndustrialPalletsBase: number; readonly loadedEuroPalletsBase: number;
  readonly totalDinPalletsVisual: number; readonly totalEuroPalletsVisual: number;
  readonly requested: Readonly<Record<PalletType, number>>; readonly rejected: Readonly<Record<PalletType, number>>;
  readonly utilizationPercentage: number; readonly warnings: readonly LoadingWarning[];
  readonly totalWeightKg: number; readonly eupLoadingPatternUsed: EupPattern;
}
