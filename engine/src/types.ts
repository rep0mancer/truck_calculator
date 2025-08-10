export type Family = 'EUP' | 'DIN';

export interface Item {
  id?: string;
  family: Family;
  qty: number;
  // Additional fields can exist but are not required for band building
}

export interface FamilyBandConfig {
  family: Family;
  stackableCount: number;   // units allowed to be stacked for this job
  maxStackHeight: number;   // default 2
}

export interface PackOptions {
  enforceRowPairConsistency: boolean;
  aisleReserve?: number;         // mm at doors
  frontStagingDepth: number;     // mm, stacked allowed only in [0..frontStagingDepth]
  blockStrategy: 'fixed';        // fixed policy
  fixedSequence: Array<'DIN_stacked' | 'EUP_stacked' | 'DIN_unstacked' | 'EUP_unstacked'>;
}

export interface TruckPreset {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  // Optional more explicit fields for height logic
  innerHeight?: number;       // if absent, fall back to heightMm
  sideDoorHeight?: number;    // if absent, default 2650
}

export interface Placement {
  x: number;
  y: number; // mm, front-to-back (0 at bulkhead)
  w: number; // mm
  h: number; // mm (row depth)
  rotated: boolean;
  idx: number; // running index for label
  // Vertical info for height checks (optional)
  z?: number;                 // base elevation in mm (default 0)
  stackHeightMm?: number;     // vertical height of the placed unit/column
  units?: Item[];             // actual units represented by this placement slot
}

export interface PlanResult {
  sequenceUsed: Array<'DIN_stacked' | 'EUP_stacked' | 'DIN_unstacked' | 'EUP_unstacked'>;
  notes?: string[];
  // For simple validation/debugging
  bandCounts?: Record<string, number>;
  // Floor plan placements
  placements?: Placement[];
  // Items that could not be placed and the reason
  rejected?: { item: Item; reason: string }[];
  // Optional warnings collected during planning
  warnings?: string[];
  // Utilization metrics
  usedLengthMm?: number;
  usedWidthMm?: number;
  usedHeightMm?: number;
}