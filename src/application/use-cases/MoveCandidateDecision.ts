import type { DecisionRepository } from "../ports/DecisionRepository";
import type { CandidateDecision } from "../../domain/candidate/decision";
import { candidateMoveDirectionSchema } from "../../domain/candidate/decisionState";
import type { CandidateMoveDirection } from "../../domain/candidate/decisionState";
import { err, ok, type Result } from "../../domain/shared/result";
import type { SessionUndoStack } from "../../domain/candidate/sessionUndo";

export class MoveCandidateDecision {
  constructor(
    private readonly repository: DecisionRepository,
    private readonly dependencies: {
      now: () => string;
      undoStack?: SessionUndoStack;
    },
  ) {}

  async execute(input: {
    projectId: string;
    candidateId: string;
    direction: CandidateMoveDirection;
    expectedUpdatedAt: string;
  }): Promise<Result<CandidateDecision, string>> {
    candidateMoveDirectionSchema.parse(input.direction);
    const current = await this.repository.get(input.candidateId);
    if (!current || current.projectId !== input.projectId) return err("candidate-not-found");
    if (current.pool === "excluded") return err("invalid-transition");
    try {
      const moved = await this.repository.move({
        projectId: input.projectId,
        candidateId: input.candidateId,
        direction: input.direction,
        expectedUpdatedAt: input.expectedUpdatedAt,
        changedAt: this.dependencies.now(),
      });
      if (!moved.ok) return moved;
      if (moved.value.pool === "excluded") return err("invalid-transition");
      this.dependencies.undoStack?.push({
        projectId: input.projectId,
        candidateId: input.candidateId,
        from: current.pool,
        to: moved.value.pool,
      });
      return ok(moved.value);
    } catch (error) {
      return err(error instanceof Error ? error.message : "decision-move-failed");
    }
  }
}
