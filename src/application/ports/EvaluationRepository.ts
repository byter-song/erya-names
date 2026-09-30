import type { CandidateEvaluation } from "../../domain/candidate/evaluation";

export interface EvaluationRepository {
  candidateBelongsToProject(candidateId: string, projectId: string): Promise<boolean>;
  get(candidateId: string): Promise<CandidateEvaluation | undefined>;
  list(projectId: string): Promise<CandidateEvaluation[]>;
  save(evaluation: CandidateEvaluation): Promise<void>;
}
