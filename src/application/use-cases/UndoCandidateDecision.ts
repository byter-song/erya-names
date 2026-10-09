import type { DecisionRepository } from "../ports/DecisionRepository";
import { candidateRestoreStage, type CandidateStage } from "../../domain/candidate/decision";
import { err, ok, type Result } from "../../domain/shared/result";
import type { SessionUndoStack } from "../../domain/candidate/sessionUndo";

export class UndoCandidateDecision {
  constructor(
    private readonly repository: DecisionRepository,
    private readonly dependencies: {
      now: () => string;
      canProgress: (projectId: string) => Promise<boolean>;
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
    if (!current || current.projectId !== input.projectId || current.stage !== command.from) {
      this.restore(command);
      return err(!current ? "candidate-not-found" : "undo-state-changed");
    }
    if (
      ["comparison", "finalist"].includes(command.to) &&
      !(await this.dependencies.canProgress(input.projectId))
    ) {
      this.restore(command);
      return err("family-rules-pending");
    }
    try {
      await this.repository.move({
        projectId: input.projectId,
        candidateId: command.candidateId,
        from: command.from,
        to: command.to,
        ...(["excluded", "rejected"].includes(command.to)
          ? {
              rejectionReason: "撤销恢复",
              lastActiveStage: candidateRestoreStage(current.stage),
            }
          : {}),
        ...(command.to === "comparison" || command.to === "finalist"
          ? { maximumTargetCount: 5 }
          : {}),
        changedAt: this.dependencies.now(),
      });
      return ok({ hasMore: this.dependencies.undoStack.hasCommands(input.projectId) });
    } catch (error) {
      this.restore(command);
      return err(error instanceof Error ? error.message : "undo-failed");
    }
  }

  private restore(command: {
    projectId: string;
    candidateId: string;
    from: CandidateStage;
    to: CandidateStage;
  }) {
    this.dependencies.undoStack.push({
      ...command,
      from: command.to,
      to: command.from,
    });
  }
}
