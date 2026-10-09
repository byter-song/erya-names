import type { FinalDecisionRepository } from "../ports/FinalDecisionRepository";
import { finalDecisionSchema, type FinalDecision } from "../../domain/candidate/finalDecision";
import { err, ok, type Result } from "../../domain/shared/result";

/** @deprecated V4 keeps this use case for legacy read/report compatibility only. */
export class FinalizeNamingDecision {
  constructor(
    private readonly repository: FinalDecisionRepository,
    private readonly dependencies: { now: () => string; beforeSave?: () => Promise<void> },
  ) {}

  async execute(input: {
    projectId: string;
    selectedCandidateId: string;
    rationale: string;
  }): Promise<Result<FinalDecision, string>> {
    const finalistIds = await this.repository.listFinalistIds(input.projectId);
    if (finalistIds.length < 3 || finalistIds.length > 5) {
      return err("最终候选需要保持在 3 到 5 个");
    }
    if (!finalistIds.includes(input.selectedCandidateId)) {
      return err("最终选择必须来自最终候选");
    }
    try {
      const decision = finalDecisionSchema.parse({
        ...input,
        updatedAt: this.dependencies.now(),
      });
      await this.dependencies.beforeSave?.();
      await this.repository.saveAndCompleteProject(decision);
      return ok(decision);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to finalize decision");
    }
  }
}
