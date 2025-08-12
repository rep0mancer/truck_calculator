export type Units = 'metric' | 'imperial';

export interface ContainerPreset {
  id: string;
  name: string;
  innerLength: number; // mm
  innerWidth: number; // mm
  innerHeight?: number; // mm
  maxPayloadKg?: number;
}

export interface PalletPreset {
  id: string;
  name: string;
  length: number; // mm
  width: number; // mm
  height?: number; // mm
  weightKg?: number; // typical pallet weight if provided
}

export interface Constraints {
  allowRotate: boolean;
  wallClearance: number; // mm
  betweenClearance: number; // mm
  aisleLengthReserve?: number; // mm, optional reserved length for walkway
}

export interface Placement {
  x: number;
  y: number; // mm, top-left
  w: number; // mm
  h: number; // mm
  rotated: boolean;
  idx: number; // running index for label
}

export interface Plan {
  container: ContainerPreset;
  pallet: PalletPreset;
  constraints: Constraints;
  units: Units;
  placements: Placement[];
  metrics: {
    count: number;
    floorAreaUsedRatio: number; // 0..1
    volumeUsedRatio?: number; // if heights given
    totalPalletWeightKg?: number;
    maxPayloadExceeded?: boolean;
  };
  axles?: {
    R_front: number;
    R_rear: number;
    maxKgPerM: number;
    warnings: string[];
  };
  note?: string;
}