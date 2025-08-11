export type Family = 'EUP' | 'DIN';

export interface Item {
  id?: string;
  family: Family;
  qty: number;
  // Optional fields used by packing/preview
  heightMm?: number;
  weightKg?: number;
}

export interface FamilyBandConfig {
  family: Family;
  stackableCount: number;   // how many units are allowed to be stacked for this job
  maxStackHeight: number;   // e.g., 2, 3, 4
}

export interface PackOptions {
  enforceRowPairConsistency: boolean;
  aisleReserve?: number;         // mm at rear door
  frontStagingDepth: number;     // mm, stacked allowed only in [0..frontStagingDepth]
  blockStrategy: 'fixed';        // fixed policy
  fixedSequence: Array<'DIN_stacked' | 'EUP_stacked' | 'DIN_unstacked' | 'EUP_unstacked'>;
}

export interface TruckPreset {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  innerHeight?: number;
  sideDoorHeight?: number;
}

export interface Placement {
  x: number;
  y: number; // mm, front-to-back (0 at bulkhead)
  w: number; // mm
  h: number; // mm (row depth)
  rotated: boolean;
  idx: number; // running index for label
  z?: number;                 // base elevation in mm (default 0)
  stackHeightMm?: number;     // vertical height of the placed unit/column
  units?: Item[];             // actual units represented by this placement slot
}

export interface PlanResult {
  sequenceUsed: Array<'DIN_stacked' | 'EUP_stacked' | 'DIN_unstacked' | 'EUP_unstacked'>;
  notes?: string[];
  bandCounts?: Record<string, number>;
  placements?: Placement[];
  rejected?: { item: Item; reason: string }[];
  warnings?: string[];
  usedLengthMm?: number;
  usedWidthMm?: number;
  usedHeightMm?: number;
}