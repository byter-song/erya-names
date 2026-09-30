import type { FinalDecisionRepository } from "../ports/FinalDecisionRepository";
import type { FinalDecision } from "../../domain/candidate/finalDecision";

export class GetFinalDecision {
  constructor(private readonly repository: FinalDecisionRepository) {}

  execute(projectId: string): Promise<FinalDecision | undefined> {
    return this.repository.get(projectId);
  }
}
