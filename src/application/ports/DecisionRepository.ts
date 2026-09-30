import type { CandidateDecision, CandidateStage } from "../../domain/candidate/decision";

export interface DecisionRepository {
  get(candidateId: string): Promise<CandidateDecision | undefined>;
  move(input: {
    projectId: string;
    candidateId: string;
    from: CandidateStage;
    to: CandidateStage;
    rejectionReason?: string;
    maximumTargetCount?: number;
    changedAt: string;
  }): Promise<CandidateDecision>;
}
