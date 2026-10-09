import type { GeneratedCandidate } from "../../domain/generation/generateCandidates";
import type { GenerationBatch } from "../../domain/generation/batch";
import type { CandidateDecision } from "../../domain/candidate/decision";
import type { CandidateRuleResult } from "../../domain/rules/types";

export interface PersistedGeneratedCandidate extends GeneratedCandidate {
  batchId: string;
  createdAt: string;
}

export interface GenerationRepository {
  findHistoricalFingerprints(projectId: string): Promise<Set<string>>;
  countBatches(projectId: string): Promise<number>;
  listCandidates(
    projectId: string,
    stages?: CandidateDecision["stage"][],
  ): Promise<
    Array<{
      candidate: PersistedGeneratedCandidate;
      decision: CandidateDecision;
      warnings: CandidateRuleResult[];
      systemScore: number;
      scoreEvidence: CandidateRuleResult[];
      ruleEvidence: CandidateRuleResult[];
    }>
  >;
  saveCompletedBatch(input: {
    batch: GenerationBatch;
    candidates: PersistedGeneratedCandidate[];
  }): Promise<void>;
}
