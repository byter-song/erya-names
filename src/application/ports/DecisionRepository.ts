import type {
  ActiveCandidateStage,
  CandidateDecision,
  CandidateStage,
} from "../../domain/candidate/decision";

export interface DecisionRepository {
  get(candidateId: string): Promise<CandidateDecision | undefined>;
  move(input: {
    projectId: string;
    candidateId: string;
    from: CandidateStage;
    to: CandidateStage;
    rejectionReason?: string;
    lastActiveStage?: ActiveCandidateStage;
    folkloreReviewed?: boolean;
    maximumTargetCount?: number;
    changedAt: string;
  }): Promise<CandidateDecision>;
  moveMany(input: {
    projectId: string;
    moves: Array<{
      candidateId: string;
      from: CandidateStage;
      to: CandidateStage;
      expectedUpdatedAt: string;
    }>;
    batchId: string;
    changedAt: string;
  }): Promise<void>;
}
