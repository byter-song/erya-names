import type { DecisionRepository } from "../ports/DecisionRepository";
import type { CandidateStage } from "../../domain/candidate/decision";
import { err, ok, type Result } from "../../domain/shared/result";

export class ApplyCandidateAutoFilter {
  constructor(
    private readonly repository: DecisionRepository,
    private readonly dependencies: { now: () => string; createBatchId: () => string },
  ) {}

  async execute(input: {
    projectId: string;
    moves: Array<{
      candidateId: string;
      from: CandidateStage;
      to: CandidateStage;
      expectedUpdatedAt: string;
    }>;
  }): Promise<Result<{ movedCandidateIds: string[] }, string>> {
    if (input.moves.length === 0) return ok({ movedCandidateIds: [] });
    const valid = input.moves.every(
      (move) =>
        (move.from === "basic_shortlist" && move.to === "inbox") ||
        (move.from === "folklore_review" && move.to === "basic_shortlist"),
    );
    if (!valid) return err("invalid-auto-filter-transition");
    if (new Set(input.moves.map((move) => move.candidateId)).size !== input.moves.length)
      return err("duplicate-auto-filter-candidate");
    try {
      await this.repository.moveMany({
        projectId: input.projectId,
        moves: input.moves,
        batchId: this.dependencies.createBatchId(),
        changedAt: this.dependencies.now(),
      });
      return ok({ movedCandidateIds: input.moves.map((move) => move.candidateId) });
    } catch (error) {
      return err(error instanceof Error ? error.message : "auto-filter-failed");
    }
  }
}
