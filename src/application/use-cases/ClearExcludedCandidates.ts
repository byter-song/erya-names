import type { DecisionRepository } from "../ports/DecisionRepository";
import { err, type Result } from "../../domain/shared/result";

export interface ExcludedCandidateSelection {
  candidateId: string;
  expectedUpdatedAt: string;
}

/** Requires a typed count before delegating the graph deletion to one repository transaction. */
export class ClearExcludedCandidates {
  constructor(private readonly repository: DecisionRepository) {}

  async execute(input: {
    projectId: string;
    selected: ExcludedCandidateSelection[];
    confirmedCount: number;
  }): Promise<Result<{ deleted: number }, string>> {
    if (input.confirmedCount !== input.selected.length)
      return err("confirmation-count-mismatch");

    try {
      const cleared = await this.repository.clearExcluded({
        projectId: input.projectId,
        candidates: input.selected,
      });
      return cleared.ok ? cleared : err(cleared.error);
    } catch (error) {
      return err(error instanceof Error ? error.message : "candidate-clear-failed");
    }
  }
}
