import { PackOptions, PlanResult, TruckPreset } from './types';
import { Bands } from './bands';

export function packBandSequence(
  bands: Bands,
  sequence: PackOptions['fixedSequence'],
  _preset: TruckPreset,
  _opts: PackOptions
): PlanResult {
  const sequenceUsed: PlanResult['sequenceUsed'] = [];
  const bandCounts: Record<string, number> = {
    EUP_stacked: bands.EUP_stacked.length,
    EUP_unstacked: bands.EUP_unstacked.length,
    DIN_stacked: bands.DIN_stacked.length,
    DIN_unstacked: bands.DIN_unstacked.length,
  };

  for (const bandName of sequence) {
    const count = bandCounts[bandName] ?? 0;
    if (count > 0) sequenceUsed.push(bandName as PlanResult['sequenceUsed'][number]);
  }

  return {
    sequenceUsed,
    bandCounts,
    notes: ['Packed using fixed sequence; empty bands skipped.'],
  };
}