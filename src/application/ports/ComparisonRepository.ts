import type { ComparisonSnapshot } from "../../domain/candidate/comparisonSnapshot";

export interface ComparisonRepository {
  listComparisonCandidateIds(projectId: string): Promise<string[]>;
  listSnapshots(projectId: string): Promise<ComparisonSnapshot[]>;
  saveSnapshot(snapshot: ComparisonSnapshot): Promise<void>;
}
