import type { FinalDecision } from "../../domain/candidate/finalDecision";

export interface FinalDecisionRepository {
  listFinalistIds(projectId: string): Promise<string[]>;
  saveAndCompleteProject(decision: FinalDecision): Promise<void>;
  get(projectId: string): Promise<FinalDecision | undefined>;
}
