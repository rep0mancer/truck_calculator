type Family = 'EUP' | 'DIN';
interface Item {
    id?: string;
    family: Family;
    qty: number;
}
interface FamilyBandConfig {
    family: Family;
    stackableCount: number;
    maxStackHeight: number;
}
interface PackOptions {
    enforceRowPairConsistency: boolean;
    aisleReserve?: number;
    frontStagingDepth: number;
    blockStrategy: 'fixed';
    fixedSequence: Array<'DIN_stacked' | 'EUP_stacked' | 'DIN_unstacked' | 'EUP_unstacked'>;
}
interface TruckPreset {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    innerHeight?: number;
    sideDoorHeight?: number;
}
interface Placement {
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
    idx: number;
    z?: number;
    stackHeightMm?: number;
    units?: Item[];
}
interface PlanResult {
    sequenceUsed: Array<'DIN_stacked' | 'EUP_stacked' | 'DIN_unstacked' | 'EUP_unstacked'>;
    notes?: string[];
    bandCounts?: Record<string, number>;
    placements?: Placement[];
    rejected?: {
        item: Item;
        reason: string;
    }[];
    warnings?: string[];
    usedLengthMm?: number;
    usedWidthMm?: number;
    usedHeightMm?: number;
}
interface AxleOptions {
    perSlotWeightKg?: number;
    binSizeMm?: number;
    maxKgPerM?: number;
    supportFrontX: number;
    supportRearX: number;
    rearAxleGroupMaxKg?: number;
    kingpinMinKg?: number;
    kingpinMaxKg?: number;
    payloadMaxKg?: number;
}

type Bands = {
    EUP_stacked: Item[];
    EUP_unstacked: Item[];
    DIN_stacked: Item[];
    DIN_unstacked: Item[];
};
declare function expandUnits(items: Item[]): Item[];
declare function splitIntoBands(allItems: Item[], famCfgs: FamilyBandConfig[]): Bands;

interface Column {
    units: Item[];
    height: number;
    weight: number;
    family: 'EUP' | 'DIN';
}
declare function formColumns(units: Item[], maxStackHeight: number): {
    columns: Column[];
    singles: Item[];
};
interface StackedBands {
    EUP_columns: Column[];
    DIN_columns: Column[];
    EUP_singles: Item[];
    DIN_singles: Item[];
}
declare function buildStackedBands(bands: Bands, famCfgs: FamilyBandConfig[]): StackedBands;
declare function computeRowDepthByFamily(_preset: TruckPreset, _opts: PackOptions): Record<'EUP' | 'DIN', number>;
declare function applyFrontZoneDowngrade(stacked: StackedBands, preset: TruckPreset, opts: PackOptions, rowDepthByFamily: Record<'EUP' | 'DIN', number>): {
    stacked: StackedBands;
    downgradedCount: number;
    warnings: string[];
    downgraded: {
        EUP: Item[];
        DIN: Item[];
    };
};

declare function planWithFixedSequence(items: Item[], famCfgs: FamilyBandConfig[], preset: TruckPreset, opts: PackOptions): PlanResult;

type SeqBand = 'DIN_stacked' | 'EUP_stacked' | 'DIN_unstacked' | 'EUP_unstacked';
interface Prepared {
    EUP_columns: Column[];
    DIN_columns: Column[];
    EUP_singles: Item[];
    DIN_singles: Item[];
    unstacked_EUP: Item[];
    unstacked_DIN: Item[];
}
declare function packBandSequence(seq: SeqBand[], prepared: Prepared, preset: TruckPreset, opts: PackOptions): PlanResult;

declare function applyHeightChecks(plan: PlanResult, preset: TruckPreset): PlanResult;

interface AxleReport {
    R_front: number;
    R_rear: number;
    maxKgPerM: number;
    warnings: string[];
}
declare function checkAxles(plan: PlanResult, _preset: TruckPreset, opts: AxleOptions): AxleReport;

export { type AxleOptions, type AxleReport, type Bands, type Column, type Family, type FamilyBandConfig, type Item, type PackOptions, type Placement, type PlanResult, type StackedBands, type TruckPreset, applyFrontZoneDowngrade, applyHeightChecks, buildStackedBands, checkAxles, computeRowDepthByFamily, expandUnits, formColumns, packBandSequence, planWithFixedSequence, splitIntoBands };
