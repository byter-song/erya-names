import type { EvaluationRepository } from "../ports/EvaluationRepository";
import {
  candidateEvaluationSchema,
  type CandidateEvaluation,
} from "../../domain/candidate/evaluation";
import { err, ok, type Result } from "../../domain/shared/result";

export class RecordCandidateEvaluation {
  constructor(
    private readonly repository: EvaluationRepository,
    private readonly dependencies: { now: () => string },
  ) {}

  async execute(input: {
    projectId: string;
    candidateId: string;
    rating?: number;
    note?: string;
  }): Promise<Result<CandidateEvaluation, string>> {
    if (
      input.rating !== undefined &&
      (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    ) {
      return err("评分必须在 1 到 5 之间");
    }
    if (
      !(await this.repository.candidateBelongsToProject(input.candidateId, input.projectId))
    ) {
      return err("candidate-not-found");
    }
    try {
      const evaluation = candidateEvaluationSchema.parse({
        projectId: input.projectId,
        candidateId: input.candidateId,
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        updatedAt: this.dependencies.now(),
      });
      await this.repository.save(evaluation);
      return ok(evaluation);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unable to save evaluation");
    }
  }
}
