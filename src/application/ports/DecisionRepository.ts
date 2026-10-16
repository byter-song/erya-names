import type {
  CandidateDecision,
  CandidatePool,
  ExcludedCandidateDecision,
} from "../../domain/candidate/decision";
import type { CandidateMoveDirection } from "../../domain/candidate/decisionState";
import type { Result } from "../../domain/shared/result";

export type DecisionWriteError =
  | "candidate-not-found"
  | "candidate-stale"
  | "invalid-transition"
  | "candidate-not-excluded"
  | "candidate-project-mismatch";

interface DecisionMutationIdentity {
  projectId: string;
  candidateId: string;
  expectedUpdatedAt: string;
  changedAt: string;
}

/** Owns pool transitions and their history transaction; no arbitrary target pool is accepted. */
export interface DecisionRepository {
  get(candidateId: string): Promise<CandidateDecision | undefined>;
  list(projectId: string, pool?: CandidatePool): Promise<CandidateDecision[]>;
  /** Derives the adjacent destination from the persisted pool after an optimistic-lock check. */
  move(
    input: DecisionMutationIdentity & { direction: CandidateMoveDirection },
  ): Promise<Result<CandidateDecision, DecisionWriteError>>;
  exclude(
    input: DecisionMutationIdentity & { reason?: string },
  ): Promise<Result<ExcludedCandidateDecision, DecisionWriteError>>;
  /** Restores the recorded lastActivePool; callers cannot nominate a destination. */
  restore(
    input: DecisionMutationIdentity,
  ): Promise<Result<CandidateDecision, DecisionWriteError>>;
  /** Atomically removes selected excluded candidates and all of their project-owned records. */
  clearExcluded(input: {
    projectId: string;
    candidates: Array<{ candidateId: string; expectedUpdatedAt: string }>;
  }): Promise<Result<{ deleted: number }, DecisionWriteError>>;
}
