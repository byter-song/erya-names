import type { EvaluationRepository } from "../../application/ports/EvaluationRepository";
import {
  candidateEvaluationSchema,
  type CandidateEvaluation,
} from "../../domain/candidate/evaluation";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieEvaluationRepository implements EvaluationRepository {
  constructor(private readonly database: EryaDatabase) {}

  async candidateBelongsToProject(candidateId: string, projectId: string): Promise<boolean> {
    return (await this.database.candidates.get(candidateId))?.projectId === projectId;
  }

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

  async save(evaluation: CandidateEvaluation): Promise<void> {
    await this.database.candidateEvaluations.put({
      projectId: evaluation.projectId,
      candidateId: evaluation.candidateId,
      ...(evaluation.rating !== undefined ? { rating: evaluation.rating } : {}),
      ...(evaluation.note !== undefined ? { note: evaluation.note } : {}),
      updatedAt: evaluation.updatedAt,
    });
  }
}
