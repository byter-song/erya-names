import type { CandidateEvaluation } from "../../domain/candidate/evaluation";
import type { Result } from "../../domain/shared/result";

export type EvaluationWriteError =
  "candidate-not-found" | "candidate-project-mismatch" | "evaluation-stale";

/** Saves an evaluation only after checking candidate ownership in the same transaction. */
export interface EvaluationRepository {
  get(candidateId: string): Promise<CandidateEvaluation | undefined>;
  list(projectId: string): Promise<CandidateEvaluation[]>;
  /** Omitting expectedUpdatedAt is create-only; updates must carry the observed revision. */
  save(input: {
    evaluation: CandidateEvaluation;
    expectedUpdatedAt?: string;
  }): Promise<Result<CandidateEvaluation, EvaluationWriteError>>;
}
