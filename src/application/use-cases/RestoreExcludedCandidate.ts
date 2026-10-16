import type { CandidateDecision } from "../../domain/candidate/decision";
import { err, type Result } from "../../domain/shared/result";
import type { DecisionRepository } from "../ports/DecisionRepository";

export class RestoreExcludedCandidate {
  constructor(
    private readonly repository: DecisionRepository,
    private readonly dependencies: { now: () => string },
  ) {}

  async execute(input: {
    projectId: string;
    candidateId: string;
    expectedUpdatedAt: string;
  }): Promise<Result<CandidateDecision, string>> {
    try {
      const restored = await this.repository.restore({
        projectId: input.projectId,
        candidateId: input.candidateId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        changedAt: this.dependencies.now(),
      });
      return restored.ok ? restored : err(restored.error);
    } catch (error) {
      return err(error instanceof Error ? error.message : "candidate-restore-failed");
    }
  }
}
