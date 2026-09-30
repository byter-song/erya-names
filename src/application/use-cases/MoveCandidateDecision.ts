import type { DecisionRepository } from "../ports/DecisionRepository";
import {
  candidateStageSchema,
  type CandidateDecision,
  type CandidateStage,
} from "../../domain/candidate/decision";
import { canMoveCandidate } from "../../domain/candidate/decisionState";
import { err, ok, type Result } from "../../domain/shared/result";
import type { SessionUndoStack } from "../../domain/candidate/sessionUndo";

export class MoveCandidateDecision {
  constructor(
    private readonly repository: DecisionRepository,
    private readonly dependencies: { now: () => string; undoStack?: SessionUndoStack },
  ) {}

  async execute(input: {
    projectId: string;
    candidateId: string;
    to: CandidateStage;
    rejectionReason?: string;
  }): Promise<Result<CandidateDecision, string>> {
    candidateStageSchema.parse(input.to);
    const current = await this.repository.get(input.candidateId);
    if (!current || current.projectId !== input.projectId) return err("candidate-not-found");
    if (!canMoveCandidate(current.stage, input.to)) {
      return err(`invalid-transition:${current.stage}->${input.to}`);
    }
    if (input.to === "rejected" && !input.rejectionReason?.trim()) {
      return err("rejection-reason-required");
    }
    if (input.rejectionReason && input.rejectionReason.trim().length > 500) {
      return err("rejection-reason-too-long");
    }
    try {
      const moved = await this.repository.move({
        projectId: input.projectId,
        candidateId: input.candidateId,
        from: current.stage,
        to: input.to,
        ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
        ...((input.to === "comparison" || input.to === "finalist") && current.stage !== input.to
          ? { maximumTargetCount: 5 }
          : {}),
        changedAt: this.dependencies.now(),
      });
      this.dependencies.undoStack?.push({
        projectId: input.projectId,
        candidateId: input.candidateId,
        from: current.stage,
        to: input.to,
      });
      return ok(moved);
    } catch (error) {
      return err(error instanceof Error ? error.message : "decision-move-failed");
    }
  }
}
