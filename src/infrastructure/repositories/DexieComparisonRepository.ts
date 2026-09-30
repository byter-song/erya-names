import type { ComparisonRepository } from "../../application/ports/ComparisonRepository";
import {
  comparisonSnapshotSchema,
  type ComparisonSnapshot,
} from "../../domain/candidate/comparisonSnapshot";
import type { EryaDatabase } from "../database/EryaDatabase";

export class DexieComparisonRepository implements ComparisonRepository {
  constructor(private readonly database: EryaDatabase) {}
  async listComparisonCandidateIds(projectId: string): Promise<string[]> {
    return (
      await this.database.candidateDecisions
        .where("[projectId+stage]")
        .equals([projectId, "comparison"])
        .toArray()
    ).map((item) => item.candidateId);
  }
  async saveSnapshot(snapshot: ComparisonSnapshot): Promise<void> {
    await this.database.comparisonSnapshots.add(snapshot);
  }
  async listSnapshots(projectId: string): Promise<ComparisonSnapshot[]> {
    const records = await this.database.comparisonSnapshots
      .where("projectId")
      .equals(projectId)
      .reverse()
      .sortBy("createdAt");
    return records.map((record) => comparisonSnapshotSchema.parse(record));
  }
}
