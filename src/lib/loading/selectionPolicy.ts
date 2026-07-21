export type SelectionRejectionReason = 'payload' | 'type-capacity' | 'geometry';

export type LoadingCandidate<T> = {
  type: 'euro' | 'industrial';
  weight: number;
  pallets: T[];
};

export type SkippedCandidate<T> = LoadingCandidate<T> & {
  reason: SelectionRejectionReason;
};

/**
 * Stable first-fit selection policy.
 *
 * Candidates must already be grouped in the chosen type priority. Within that
 * priority their user order is retained. An infeasible candidate is recorded
 * and skipped; it never terminates selection, because a later candidate can be
 * lighter or can consume a different type capacity. A candidate is atomic, so
 * a stacked pair is accepted in full or rejected in full.
 */
export function selectLoadingCandidates<T>(
  candidates: LoadingCandidate<T>[],
  accept: (candidate: LoadingCandidate<T>) => SelectionRejectionReason | undefined,
) {
  const accepted: LoadingCandidate<T>[] = [];
  const skipped: SkippedCandidate<T>[] = [];

  for (const candidate of candidates) {
    const reason = accept(candidate);
    if (reason) skipped.push({ ...candidate, reason });
    else accepted.push(candidate);
  }

  return { accepted, skipped };
}
