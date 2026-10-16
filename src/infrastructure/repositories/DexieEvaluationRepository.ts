import type { EvaluationRepository } from "../../application/ports/EvaluationRepository";
import {
  candidateEvaluationSchema,
  type CandidateEvaluation,
} from "../../domain/candidate/evaluation";
import { err, ok } from "../../domain/shared/result";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieEvaluationRepository implements EvaluationRepository {
  constructor(private readonly database: EryaDatabase) {}

  async get(candidateId: string): Promise<CandidateEvaluation | undefined> {
    const record = await this.database.candidateEvaluations.get(candidateId);
    return record ? candidateEvaluationSchema.parse(record) : undefined;
  }

  async list(projectId: string): Promise<CandidateEvaluation[]> {
    const records = await this.database.candidateEvaluations
      .where("projectId")
      .equals(projectId)
      .toArray();
    return records.map((record) => candidateEvaluationSchema.parse(record));
  }

  async save(input: Parameters<EvaluationRepository["save"]>[0]) {
    return this.database.transaction(
      "rw",
      [this.database.candidates, this.database.candidateEvaluations],
      async () => {
        const candidate = await this.database.candidates.get(input.evaluation.candidateId);
        if (!candidate) return err("candidate-not-found" as const);
        if (candidate.projectId !== input.evaluation.projectId)
          return err("candidate-project-mismatch" as const);

        const existing = await this.database.candidateEvaluations.get(
          input.evaluation.candidateId,
        );
        if (
          (input.expectedUpdatedAt === undefined && existing !== undefined) ||
          (input.expectedUpdatedAt !== undefined &&
            existing?.updatedAt !== input.expectedUpdatedAt)
        )
          return err("evaluation-stale" as const);

        const evaluation = candidateEvaluationSchema.parse(input.evaluation);
        await this.database.candidateEvaluations.put(evaluation);
        return ok(evaluation);
      },
    );
  }
}
