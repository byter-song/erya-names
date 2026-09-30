import type { ComparisonRepository } from "../ports/ComparisonRepository";
import {
  comparisonSnapshotSchema,
  type ComparisonSnapshot,
} from "../../domain/candidate/comparisonSnapshot";
import { err, ok, type Result } from "../../domain/shared/result";
import type { CandidateFunnelItem } from "../models/CandidateFunnelItem";

export class CreateComparisonSnapshot {
  constructor(
    private readonly repository: ComparisonRepository,
    private readonly dependencies: { createId: () => string; now: () => string },
  ) {}

  async execute(input: {
    projectId: string;
    name?: string;
    candidates: CandidateFunnelItem[];
  }): Promise<Result<ComparisonSnapshot, string>> {
    const candidateIds = [...new Set(input.candidates.map((candidate) => candidate.id))];
    if (candidateIds.length < 2 || candidateIds.length > 5)
      return err("comparison-requires-two-to-five-candidates");
    const currentIds = new Set(
      await this.repository.listComparisonCandidateIds(input.projectId),
    );
    if (candidateIds.some((candidateId) => !currentIds.has(candidateId)))
      return err("comparison-candidate-not-in-pool");
    const snapshot = comparisonSnapshotSchema.parse({
      id: this.dependencies.createId(),
      projectId: input.projectId,
      name:
        input.name?.trim() ||
        `对比快照 ${this.dependencies.now().slice(0, 16).replace("T", " ")}`,
      candidateIds,
      candidates: input.candidates.map((candidate) => ({
        id: candidate.id,
        fullName: candidate.fullName,
        pinyin: candidate.pinyin,
        sourceType: candidate.sourceType,
        summary: candidate.summary,
        sourceEvidence: candidate.sourceEvidence ?? [],
        warnings: candidate.warnings,
        ruleEvidence: candidate.ruleEvidence ?? [],
        ...(candidate.rating !== undefined ? { rating: candidate.rating } : {}),
        ...(candidate.note !== undefined ? { note: candidate.note } : {}),
      })),
      createdAt: this.dependencies.now(),
    });
    await this.repository.saveSnapshot(snapshot);
    return ok(snapshot);
  }

  list(projectId: string): Promise<ComparisonSnapshot[]> {
    return this.repository.listSnapshots(projectId);
  }
}
