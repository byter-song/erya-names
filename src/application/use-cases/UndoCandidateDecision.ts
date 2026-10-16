import type { DecisionRepository } from "../ports/DecisionRepository";
import type { ActiveCandidatePool } from "../../domain/candidate/decision";
import {
  moveCandidatePool,
  type CandidateMoveDirection,
} from "../../domain/candidate/decisionState";
import { err, ok, type Result } from "../../domain/shared/result";
import type { SessionUndoStack } from "../../domain/candidate/sessionUndo";

export class UndoCandidateDecision {
  constructor(
    private readonly repository: DecisionRepository,
    private readonly dependencies: {
      now: () => string;
      undoStack: SessionUndoStack;
    },
  ) {}

  hasCommands(projectId: string): boolean {
    return this.dependencies.undoStack.hasCommands(projectId);
  }

  async execute(input: { projectId: string }): Promise<Result<{ hasMore: boolean }, string>> {
    const command = this.dependencies.undoStack.pop(input.projectId);
    if (!command) return err("no-undo-command");
    const current = await this.repository.get(command.candidateId);
    if (!current || current.projectId !== input.projectId || current.pool !== command.from) {
      this.restore(command);
      return err(!current ? "candidate-not-found" : "undo-state-changed");
    }
    const direction = directionBetween(command.from, command.to);
    if (!direction) {
      this.restore(command);
      return err("undo-state-changed");
    }
    try {
      const moved = await this.repository.move({
        projectId: input.projectId,
        candidateId: command.candidateId,
        direction,
        expectedUpdatedAt: current.updatedAt,
        changedAt: this.dependencies.now(),
      });
      if (!moved.ok) {
        this.restore(command);
        return moved;
      }
      return ok({ hasMore: this.dependencies.undoStack.hasCommands(input.projectId) });
    } catch (error) {
      this.restore(command);
      return err(error instanceof Error ? error.message : "undo-failed");
    }
  }

  private restore(command: {
    projectId: string;
    candidateId: string;
    from: ActiveCandidatePool;
    to: ActiveCandidatePool;
  }) {
    this.dependencies.undoStack.push({
      ...command,
      from: command.to,
      to: command.from,
    });
  }
}

function directionBetween(
  from: ActiveCandidatePool,
  to: ActiveCandidatePool,
): CandidateMoveDirection | undefined {
  if (moveCandidatePool(from, "forward") === to) return "forward";
  if (moveCandidatePool(from, "backward") === to) return "backward";
  return undefined;
}
