import type { ExcludedCandidateDecision } from "../../domain/candidate/decision";
import { err, type Result } from "../../domain/shared/result";
import type { DecisionRepository } from "../ports/DecisionRepository";

export class ExcludeCandidate {
  constructor(
    private readonly repository: DecisionRepository,
    private readonly dependencies: { now: () => string },
  ) {}

  async execute(input: {
    projectId: string;
    candidateId: string;
    expectedUpdatedAt: string;
    reason?: string;
  }): Promise<Result<ExcludedCandidateDecision, string>> {
    try {
      const excluded = await this.repository.exclude({
        projectId: input.projectId,
        candidateId: input.candidateId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        changedAt: this.dependencies.now(),
        ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
      });
      return excluded.ok ? excluded : err(excluded.error);
    } catch (error) {
      return err(error instanceof Error ? error.message : "candidate-exclusion-failed");
    }
  }
}
