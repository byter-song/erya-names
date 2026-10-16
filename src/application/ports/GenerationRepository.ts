import type { GenerationBatch } from "../../domain/generation/batch";
import type { CandidateDecision } from "../../domain/candidate/decision";
import type { CandidateSourceEvidence } from "../../domain/candidate/sourceEvidence";
import type { Candidate } from "../../domain/candidate/candidate";

export interface PersistedGeneratedCandidate extends Candidate {
  sourceEvidence: CandidateSourceEvidence[];
}

export interface GenerationRepository {
  findHistoricalFingerprints(projectId: string): Promise<Set<string>>;
  countBatches(projectId: string): Promise<number>;
  listCandidates(
    projectId: string,
    pools?: CandidateDecision["pool"][],
  ): Promise<
    Array<{
      candidate: Candidate;
      decision: CandidateDecision;
      sources: CandidateSourceEvidence[];
    }>
  >;
  saveCompletedBatch(input: {
    batch: GenerationBatch;
    candidates: PersistedGeneratedCandidate[];
  }): Promise<void>;
}
